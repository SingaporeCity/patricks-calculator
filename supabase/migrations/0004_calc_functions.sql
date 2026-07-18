-- =============================================================================
-- 0004_calc_functions.sql — DE REKEN-ENGINE (set-based, in Postgres)
--
-- recompute(p_contract_ids) herberekent de rollups voor een set contracten
-- (NULL = alle). Eén set-based pass over alle contracten tegelijk:
--   * accrual_monthly : marginale staffel op cumulatief aantal (window-functie)
--   * advance_ledger  : voorschot-recoupment per auteur, jaar-op-jaar recurrence
--                       (recursieve CTE) met carry-forward
--   * payout_annual   : afgeleide uitbetaling per auteur per jaar
--
-- Deze logica is 1-op-1 de geteste TypeScript-engine (lib/calc/engine.ts).
-- Draai na een import: SELECT recompute();   (of recompute(ARRAY['<uuid>']::uuid[]))
-- =============================================================================

CREATE OR REPLACE FUNCTION recompute(p_contract_ids uuid[] DEFAULT NULL)
RETURNS TABLE(rows_written int, ms numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t0    timestamptz := clock_timestamp();
  v_rows int := 0;
BEGIN
  -- Serialiseer herberekeningen zodat twee runs elkaar niet in de weg zitten.
  PERFORM pg_advisory_xact_lock(hashtext('patricks_recompute')::bigint);

  -- 1. Oude rollups voor de scope weg.
  DELETE FROM payout_annual   WHERE p_contract_ids IS NULL OR contract_id = ANY(p_contract_ids);
  DELETE FROM advance_ledger  WHERE p_contract_ids IS NULL OR contract_id = ANY(p_contract_ids);
  DELETE FROM accrual_monthly WHERE p_contract_ids IS NULL OR contract_id = ANY(p_contract_ids);

  -- 2. accrual_monthly — marginale staffel-accrual.
  INSERT INTO accrual_monthly (contract_id, periode, boekjaar, omzet, aantal, royalty_cost, effective_rate, computed_at)
  WITH scope AS (
    SELECT * FROM contracts c WHERE p_contract_ids IS NULL OR c.id = ANY(p_contract_ids)
  ),
  brk AS (
    -- echte staffel voor tiered-contracten ...
    SELECT tb.contract_id, tb.lower_units,
           COALESCE(tb.upper_units, 9223372036854775807) AS upper_units, tb.rate_pct
    FROM tier_brackets tb
    JOIN scope c ON c.id = tb.contract_id AND c.royalty_model = 'tiered'
    UNION ALL
    -- ... of één gesynthetiseerde schijf [0, oneindig) voor vaste contracten
    SELECT c.id, 0::bigint, 9223372036854775807::bigint, c.flat_rate_pct
    FROM scope c
    WHERE c.royalty_model = 'flat'
       OR NOT EXISTS (SELECT 1 FROM tier_brackets t WHERE t.contract_id = c.id)
  ),
  period_agg AS (
    SELECT cp.contract_id, rl.product_id, rl.periode, rl.boekjaar,
           SUM(rl.omzet) AS omzet, SUM(rl.aantal) AS aantal
    FROM revenue_lines rl
    JOIN contract_products cp ON cp.product_id = rl.product_id
    JOIN scope c ON c.id = cp.contract_id
    GROUP BY cp.contract_id, rl.product_id, rl.periode, rl.boekjaar
  ),
  keyed AS (
    SELECT pa.contract_id, pa.periode, pa.boekjaar, pa.omzet, pa.aantal,
           CASE WHEN c.tier_accumulator = 'product'
                THEN pa.contract_id::text || ':' || pa.product_id::text
                ELSE pa.contract_id::text END AS accum_key,
           CASE WHEN c.tier_reset = 'year' THEN pa.boekjaar ELSE 0 END AS reset_key
    FROM period_agg pa JOIN scope c ON c.id = pa.contract_id
  ),
  grain AS (
    SELECT accum_key, reset_key, contract_id, periode, MAX(boekjaar) AS boekjaar,
           SUM(omzet) AS omzet, SUM(aantal) AS aantal
    FROM keyed
    GROUP BY accum_key, reset_key, contract_id, periode
  ),
  cum AS (
    SELECT g.*,
      COALESCE(SUM(g.aantal) OVER (PARTITION BY g.accum_key, g.reset_key ORDER BY g.periode
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS cum_before,
      SUM(g.aantal) OVER (PARTITION BY g.accum_key, g.reset_key ORDER BY g.periode
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_after
    FROM grain g
  ),
  bracketed AS (
    -- maanden met exemplaren: omzet marginaal over de schijven verdelen
    SELECT cu.contract_id, cu.periode,
           cu.omzet
             * (GREATEST(0, LEAST(cu.cum_after, b.upper_units) - GREATEST(cu.cum_before, b.lower_units))::numeric / cu.aantal)
             * b.rate_pct / 100.0 AS cost
    FROM cum cu
    JOIN brk b ON b.contract_id = cu.contract_id
    WHERE cu.aantal > 0
      AND LEAST(cu.cum_after, b.upper_units) > GREATEST(cu.cum_before, b.lower_units)
  ),
  zero_units AS (
    -- retour/credit-maanden (aantal 0, omzet <> 0): tegen de huidige tier
    SELECT cu.contract_id, cu.periode,
           cu.omzet * COALESCE((
             SELECT b.rate_pct FROM brk b
             WHERE b.contract_id = cu.contract_id
               AND cu.cum_before >= b.lower_units AND cu.cum_before < b.upper_units
             ORDER BY b.lower_units LIMIT 1), 0) / 100.0 AS cost
    FROM cum cu
    WHERE cu.aantal = 0 AND cu.omzet <> 0
  ),
  royalty_per AS (
    SELECT contract_id, periode, SUM(cost) AS royalty_cost
    FROM (SELECT * FROM bracketed UNION ALL SELECT * FROM zero_units) z
    GROUP BY contract_id, periode
  ),
  totals AS (
    SELECT contract_id, periode, MAX(boekjaar) AS boekjaar, SUM(omzet) AS omzet, SUM(aantal) AS aantal
    FROM period_agg GROUP BY contract_id, periode
  )
  SELECT t.contract_id, t.periode, t.boekjaar, t.omzet, t.aantal,
         COALESCE(r.royalty_cost, 0),
         CASE WHEN t.omzet <> 0 THEN COALESCE(r.royalty_cost, 0) / t.omzet ELSE 0 END,
         now()
  FROM totals t
  LEFT JOIN royalty_per r ON r.contract_id = t.contract_id AND r.periode = t.periode;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- 3. advance_ledger — voorschot-recoupment per auteur (jaar-op-jaar recurrence).
  INSERT INTO advance_ledger (contract_id, author_id, boekjaar, advance_added, opening_balance, earned, recouped, closing_balance, payout, computed_at)
  WITH RECURSIVE
  scope AS (
    SELECT id FROM contracts c WHERE p_contract_ids IS NULL OR c.id = ANY(p_contract_ids)
  ),
  earned_year AS (
    SELECT am.contract_id, am.boekjaar, SUM(am.royalty_cost) AS contract_earned
    FROM accrual_monthly am JOIN scope s ON s.id = am.contract_id
    GROUP BY am.contract_id, am.boekjaar
  ),
  base AS (
    SELECT ca.contract_id, ca.author_id, y.boekjaar, ca.share,
           COALESCE(e.contract_earned, 0) AS contract_earned,
           COALESCE(e.contract_earned, 0) * ca.share / 100.0 AS earned_author,
           CASE WHEN y.boekjaar = ca.advance_year THEN ca.advance ELSE 0 END AS advance_added
    FROM contract_authors ca
    JOIN scope s ON s.id = ca.contract_id
    JOIN LATERAL (
      SELECT DISTINCT boekjaar FROM earned_year e2 WHERE e2.contract_id = ca.contract_id
      UNION
      SELECT ca.advance_year WHERE ca.advance_year IS NOT NULL
    ) y ON TRUE
    LEFT JOIN earned_year e ON e.contract_id = ca.contract_id AND e.boekjaar = y.boekjaar
  ),
  ordered AS (
    SELECT b.*, ROW_NUMBER() OVER (PARTITION BY contract_id, author_id ORDER BY boekjaar) AS rn
    FROM base b
  ),
  rec AS (
    SELECT o.contract_id, o.author_id, o.boekjaar, o.rn, o.contract_earned, o.earned_author, o.advance_added,
           o.advance_added AS opening_balance,
           LEAST(o.earned_author, o.advance_added) AS recouped,
           o.advance_added - LEAST(o.earned_author, o.advance_added) AS closing_balance
    FROM ordered o WHERE o.rn = 1
    UNION ALL
    SELECT o.contract_id, o.author_id, o.boekjaar, o.rn, o.contract_earned, o.earned_author, o.advance_added,
           r.closing_balance + o.advance_added AS opening_balance,
           LEAST(o.earned_author, r.closing_balance + o.advance_added) AS recouped,
           (r.closing_balance + o.advance_added) - LEAST(o.earned_author, r.closing_balance + o.advance_added) AS closing_balance
    FROM ordered o
    JOIN rec r ON r.contract_id = o.contract_id AND r.author_id = o.author_id AND o.rn = r.rn + 1
  )
  SELECT contract_id, author_id, boekjaar, advance_added, opening_balance, earned_author, recouped, closing_balance,
         round(earned_author - recouped, 2) AS payout, now()
  FROM rec
  WHERE contract_earned <> 0 OR opening_balance > 0;

  -- 4. payout_annual — afgeleid uit de ledger.
  INSERT INTO payout_annual (contract_id, author_id, boekjaar, contract_earned, share, earned_author, payout, computed_at)
  SELECT l.contract_id, l.author_id, l.boekjaar,
         COALESCE(ey.contract_earned, 0), ca.share, l.earned, l.payout, now()
  FROM advance_ledger l
  JOIN contract_authors ca ON ca.contract_id = l.contract_id AND ca.author_id = l.author_id
  LEFT JOIN (
    SELECT contract_id, boekjaar, SUM(royalty_cost) AS contract_earned
    FROM accrual_monthly GROUP BY contract_id, boekjaar
  ) ey ON ey.contract_id = l.contract_id AND ey.boekjaar = l.boekjaar
  WHERE p_contract_ids IS NULL OR l.contract_id = ANY(p_contract_ids);

  RETURN QUERY SELECT v_rows, round(extract(milliseconds FROM clock_timestamp() - t0)::numeric, 1);
END $$;

-- Handige wrappers
CREATE OR REPLACE FUNCTION recompute_all()
RETURNS TABLE(rows_written int, ms numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM recompute(NULL);
$$;

CREATE OR REPLACE FUNCTION recompute_contracts(p_contract_ids uuid[])
RETURNS TABLE(rows_written int, ms numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM recompute(p_contract_ids);
$$;

GRANT EXECUTE ON FUNCTION recompute(uuid[])           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION recompute_all()             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION recompute_contracts(uuid[]) TO authenticated, service_role;
