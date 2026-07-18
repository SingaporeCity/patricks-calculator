-- =============================================================================
-- verify_calc.sql — Correctheids-check van de SQL reken-engine (Supabase SQL-editor).
--
-- Draai dit NA de migraties. Plak het geheel en klik Run. Je krijgt één
-- resultaat-tabel met een 'status'-kolom (OK / FOUT). Herhaald draaien mag:
-- de test-data wordt bovenaan eerst opgeruimd.
--
-- Scenario (identiek aan de geteste TypeScript-engine, lib/calc/engine.test.ts):
--   Staffel: 0-5000 @10%, 5000-10000 @12%, >10000 @14% (prijs 10/exemplaar)
--   2026-01: 3000 stuks / 30000 omzet
--   2026-02: 4000 stuks / 40000 omzet   (cum 3000 -> 7000, kruist 5000)
--   2026-03: 5000 stuks / 50000 omzet   (cum 7000 -> 12000, kruist 10000)
--   Auteurs: A 60% (voorschot 5000 in 2026), B 40%
-- =============================================================================

-- 0. Eventuele vorige test-data opruimen (maakt herhaald draaien veilig).
DELETE FROM contracts WHERE contract_number = 'TEST-001';
DELETE FROM products  WHERE code = 'TEST-PROD';
DELETE FROM authors   WHERE code IN ('VERIF-A', 'VERIF-B');

-- 1. Test-scenario invoeren.
INSERT INTO products (id, code, title)
VALUES ('11111111-1111-1111-1111-111111111111', 'TEST-PROD', 'Testproduct');

INSERT INTO authors (id, code, first_name, last_name)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'VERIF-A', 'Auteur', 'A'),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'VERIF-B', 'Auteur', 'B');

INSERT INTO contracts (id, contract_number, name, flat_rate_pct, royalty_model, tier_accumulator, tier_reset)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'TEST-001', 'Testcontract', 10, 'tiered', 'contract', 'year');

INSERT INTO tier_brackets (contract_id, lower_units, upper_units, rate_pct) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 0, 5000, 10),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 5000, 10000, 12),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 10000, NULL, 14);

INSERT INTO contract_products (contract_id, product_id)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');

INSERT INTO contract_authors (contract_id, author_id, share, advance, advance_year) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60, 5000, 2026),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 40, 0, 2026);

INSERT INTO revenue_lines (product_id, periode, omzet, aantal) VALUES
  ('11111111-1111-1111-1111-111111111111', '2026-01', 30000, 3000),
  ('11111111-1111-1111-1111-111111111111', '2026-02', 40000, 4000),
  ('11111111-1111-1111-1111-111111111111', '2026-03', 50000, 5000);

-- 2. Herberekenen.
SELECT recompute(ARRAY['cccccccc-cccc-cccc-cccc-cccccccccccc']::uuid[]);

-- 3. Uitslag (dit is de tabel die je ziet). Alle rijen moeten status = OK geven.
SELECT check_naam, verwacht, round(gevonden, 2) AS gevonden,
       CASE WHEN round(gevonden, 2) = verwacht THEN 'OK' ELSE 'FOUT' END AS status
FROM (
  SELECT 'accrual 2026-01' AS check_naam, 3000::numeric AS verwacht,
         (SELECT royalty_cost FROM accrual_monthly WHERE contract_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND periode = '2026-01') AS gevonden, 1 AS ord
  UNION ALL SELECT 'accrual 2026-02', 4400,
         (SELECT royalty_cost FROM accrual_monthly WHERE contract_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND periode = '2026-02'), 2
  UNION ALL SELECT 'accrual 2026-03', 6400,
         (SELECT royalty_cost FROM accrual_monthly WHERE contract_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND periode = '2026-03'), 3
  UNION ALL SELECT 'payout auteur A (60%, voorschot 5000)', 3280,
         (SELECT payout FROM payout_annual WHERE contract_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND author_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 4
  UNION ALL SELECT 'payout auteur B (40%)', 5520,
         (SELECT payout FROM payout_annual WHERE contract_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND author_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 5
) q
ORDER BY ord;

-- 4. Opruimen kan met (los draaien):
--   DELETE FROM contracts WHERE contract_number = 'TEST-001';
--   DELETE FROM products  WHERE code = 'TEST-PROD';
--   DELETE FROM authors   WHERE code IN ('VERIF-A', 'VERIF-B');
