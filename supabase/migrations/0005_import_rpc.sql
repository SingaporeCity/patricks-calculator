-- =============================================================================
-- 0005_import_rpc.sql — Import-pipeline (stage -> validate -> apply)
--
-- De Next.js-laag parseert het xlsx/csv en stuurt de rijen als JSONB naar
-- stage_import_rows (één round-trip). Daarna validate en apply. Apply is
-- idempotent: een periode opnieuw uploaden vervangt die maand netjes.
-- =============================================================================

-- 1. Rijen stagen (JSONB-array van {row_no, product_code, periode, omzet, aantal}).
CREATE OR REPLACE FUNCTION stage_import_rows(p_batch_id uuid, p_rows jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO revenue_staging (batch_id, row_no, product_code, periode, omzet, aantal)
  SELECT p_batch_id, r.row_no, r.product_code, r.periode, r.omzet, r.aantal
  FROM jsonb_to_recordset(p_rows)
       AS r(row_no int, product_code text, periode text, omzet numeric, aantal int);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE import_batches SET total_rows = v_count, status = 'staged' WHERE id = p_batch_id;
  RETURN v_count;
END $$;

-- 2. Valideren: onbekende code / fout periode / negatieve of ontbrekende waarden.
CREATE OR REPLACE FUNCTION validate_import_batch(p_batch_id uuid)
RETURNS TABLE(valid_rows int, error_rows int) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_valid int; v_error int;
BEGIN
  UPDATE revenue_staging s SET
    error = CASE
      WHEN s.periode !~ '^\d{4}-\d{2}$' THEN 'periode moet JJJJ-MM zijn'
      WHEN NOT EXISTS (SELECT 1 FROM products p WHERE p.code = s.product_code) THEN 'onbekende product_id'
      WHEN s.omzet IS NULL THEN 'omzet ontbreekt'
      WHEN s.aantal IS NULL THEN 'aantal ontbreekt'
      WHEN s.aantal < 0 THEN 'aantal mag niet negatief zijn'
      ELSE NULL END,
    is_valid = FALSE
  WHERE s.batch_id = p_batch_id;

  UPDATE revenue_staging s SET is_valid = (error IS NULL) WHERE s.batch_id = p_batch_id;

  SELECT count(*) FILTER (WHERE is_valid), count(*) FILTER (WHERE NOT is_valid)
    INTO v_valid, v_error
  FROM revenue_staging WHERE batch_id = p_batch_id;

  UPDATE import_batches SET
    valid_rows = v_valid, error_rows = v_error,
    error_summary = (
      SELECT jsonb_agg(jsonb_build_object('row_no', row_no, 'error', error) ORDER BY row_no)
      FROM revenue_staging WHERE batch_id = p_batch_id AND NOT is_valid
    )
  WHERE id = p_batch_id;

  RETURN QUERY SELECT v_valid, v_error;
END $$;

-- 3. Toepassen (idempotent, periode-scoped) + herbereken de geraakte contracten.
CREATE OR REPLACE FUNCTION apply_import_batch(p_batch_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_applied int;
  v_contracts uuid[];
BEGIN
  UPDATE import_batches SET status = 'applying' WHERE id = p_batch_id;

  -- Vervang de betrokken (product, periode)-combinaties schoon.
  DELETE FROM revenue_lines rl
  USING revenue_staging s
  JOIN products p ON p.code = s.product_code
  WHERE s.batch_id = p_batch_id AND s.is_valid
    AND rl.product_id = p.id AND rl.periode = s.periode;

  INSERT INTO revenue_lines (product_id, periode, omzet, aantal, import_batch_id)
  SELECT p.id, s.periode, s.omzet, s.aantal, p_batch_id
  FROM revenue_staging s
  JOIN products p ON p.code = s.product_code
  WHERE s.batch_id = p_batch_id AND s.is_valid;
  GET DIAGNOSTICS v_applied = ROW_COUNT;

  -- Contracten die deze producten raken.
  SELECT array_agg(DISTINCT cp.contract_id) INTO v_contracts
  FROM revenue_staging s
  JOIN products p ON p.code = s.product_code
  JOIN contract_products cp ON cp.product_id = p.id
  WHERE s.batch_id = p_batch_id AND s.is_valid;

  UPDATE import_batches SET status = 'applied', applied_rows = v_applied, applied_at = now(),
    period_from = (SELECT min(periode) FROM revenue_staging WHERE batch_id = p_batch_id AND is_valid),
    period_to   = (SELECT max(periode) FROM revenue_staging WHERE batch_id = p_batch_id AND is_valid)
  WHERE id = p_batch_id;

  IF v_contracts IS NOT NULL THEN
    PERFORM recompute(v_contracts);
  END IF;

  RETURN v_applied;
END $$;

GRANT EXECUTE ON FUNCTION stage_import_rows(uuid, jsonb)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION validate_import_batch(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION apply_import_batch(uuid)        TO authenticated, service_role;
