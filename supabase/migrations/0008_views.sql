-- =============================================================================
-- 0008_views.sql — Aggregatie-views voor schaalbare, gepagineerde reads.
--
-- Hiermee doet de app geen "laad alles en reken in JS" meer, maar haalt per
-- pagina alleen de zichtbare, voorgerekende rijen op. Zo blijft elke pagina
-- even snel bij 100 of 100.000 contracten.
--
-- security_invoker = on: de views draaien met de rechten van de INGELOGDE
-- gebruiker, dus RLS van de onderliggende tabellen blijft gelden (PG15+).
--
-- Draai dit in de Supabase SQL-editor.
-- =============================================================================

-- Per contract: totalen + tellingen + openstaand voorschot.
CREATE OR REPLACE VIEW contract_summary WITH (security_invoker = on) AS
SELECT
  c.id, c.contract_number, c.name, c.flat_rate_pct, c.royalty_model, c.status, c.start_date,
  COALESCE(a.total_revenue, 0)  AS total_revenue,
  COALESCE(a.total_royalty, 0)  AS total_royalty,
  COALESCE(pc.product_count, 0) AS product_count,
  COALESCE(ac.author_count, 0)  AS author_count,
  COALESCE(o.outstanding, 0)    AS outstanding_advance
FROM contracts c
LEFT JOIN (SELECT contract_id, SUM(omzet) AS total_revenue, SUM(royalty_cost) AS total_royalty FROM accrual_monthly GROUP BY contract_id) a ON a.contract_id = c.id
LEFT JOIN (SELECT contract_id, COUNT(*) AS product_count FROM contract_products GROUP BY contract_id) pc ON pc.contract_id = c.id
LEFT JOIN (SELECT contract_id, COUNT(*) AS author_count FROM contract_authors GROUP BY contract_id) ac ON ac.contract_id = c.id
LEFT JOIN (
  SELECT contract_id, SUM(closing_balance) AS outstanding
  FROM (SELECT DISTINCT ON (contract_id, author_id) contract_id, closing_balance FROM advance_ledger ORDER BY contract_id, author_id, boekjaar DESC) l
  GROUP BY contract_id
) o ON o.contract_id = c.id;

-- Per auteur: aantal contracten + verdiend/uitbetaald + openstaand voorschot.
CREATE OR REPLACE VIEW author_summary WITH (security_invoker = on) AS
SELECT
  au.id, au.code, au.first_name, au.last_name, au.email,
  COALESCE(cc.contract_count, 0) AS contract_count,
  COALESCE(p.total_earned, 0)    AS total_earned,
  COALESCE(p.total_paid, 0)      AS total_paid,
  COALESCE(o.outstanding, 0)     AS outstanding
FROM authors au
LEFT JOIN (SELECT author_id, COUNT(*) AS contract_count FROM contract_authors GROUP BY author_id) cc ON cc.author_id = au.id
LEFT JOIN (SELECT author_id, SUM(earned_author) AS total_earned, SUM(payout) AS total_paid FROM payout_annual GROUP BY author_id) p ON p.author_id = au.id
LEFT JOIN (
  SELECT author_id, SUM(closing_balance) AS outstanding
  FROM (SELECT DISTINCT ON (contract_id, author_id) author_id, closing_balance FROM advance_ledger ORDER BY contract_id, author_id, boekjaar DESC) l
  GROUP BY author_id
) o ON o.author_id = au.id;

-- Maandelijkse accrual per product per contract (omzet x vast contract-%).
CREATE OR REPLACE VIEW product_accrual WITH (security_invoker = on) AS
SELECT
  rl.id AS revenue_line_id,
  p.code AS product_code, p.title AS product_title,
  c.id AS contract_id, c.contract_number, c.name AS contract_name,
  rl.periode, rl.boekjaar, rl.omzet, rl.aantal,
  c.flat_rate_pct AS rate_pct,
  round(rl.omzet * c.flat_rate_pct / 100.0, 2) AS royalty_cost
FROM revenue_lines rl
JOIN contract_products cp ON cp.product_id = rl.product_id
JOIN contracts c ON c.id = cp.contract_id
JOIN products p ON p.id = rl.product_id;

-- Accrual-totalen per boekjaar/contract (voor de selectie-totalen zonder alle rijen te laden).
CREATE OR REPLACE VIEW product_accrual_totals WITH (security_invoker = on) AS
SELECT boekjaar, contract_id, SUM(omzet) AS omzet, SUM(royalty_cost) AS royalty
FROM product_accrual GROUP BY boekjaar, contract_id;

-- Dashboard-aggregaten.
CREATE OR REPLACE VIEW dashboard_kpis WITH (security_invoker = on) AS
SELECT
  (SELECT COALESCE(SUM(omzet), 0) FROM accrual_monthly)        AS total_revenue,
  (SELECT COALESCE(SUM(royalty_cost), 0) FROM accrual_monthly) AS total_royalty,
  (SELECT COALESCE(SUM(closing_balance), 0) FROM (SELECT DISTINCT ON (contract_id, author_id) closing_balance FROM advance_ledger ORDER BY contract_id, author_id, boekjaar DESC) l) AS outstanding_advances,
  (SELECT COUNT(*) FROM contracts) AS contracts_count,
  (SELECT COUNT(*) FROM authors)   AS authors_count,
  (SELECT COUNT(*) FROM products)  AS products_count;

CREATE OR REPLACE VIEW monthly_trend WITH (security_invoker = on) AS
SELECT periode, SUM(omzet) AS omzet, SUM(royalty_cost) AS royalty
FROM accrual_monthly GROUP BY periode;

CREATE OR REPLACE VIEW payout_by_year WITH (security_invoker = on) AS
SELECT boekjaar, SUM(payout) AS payout FROM payout_annual GROUP BY boekjaar;

-- Uitbetaling per auteur per boekjaar (voor de uitbetalingen-pagina, gepagineerd).
CREATE OR REPLACE VIEW payout_author_year WITH (security_invoker = on) AS
SELECT
  pa.author_id, pa.boekjaar,
  au.first_name, au.last_name, au.code,
  SUM(pa.earned_author)          AS earned,
  SUM(pa.payout)                 AS payout,
  COALESCE(SUM(al.closing_balance), 0) AS outstanding
FROM payout_annual pa
JOIN authors au ON au.id = pa.author_id
LEFT JOIN advance_ledger al ON al.contract_id = pa.contract_id AND al.author_id = pa.author_id AND al.boekjaar = pa.boekjaar
GROUP BY pa.author_id, pa.boekjaar, au.first_name, au.last_name, au.code;

-- Beschikbare boekjaren.
CREATE OR REPLACE VIEW boekjaren WITH (security_invoker = on) AS
SELECT DISTINCT boekjaar FROM accrual_monthly;

GRANT SELECT ON
  contract_summary, author_summary, product_accrual, product_accrual_totals, dashboard_kpis,
  monthly_trend, payout_by_year, payout_author_year, boekjaren
TO authenticated, service_role;
