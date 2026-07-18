-- =============================================================================
-- seed_synthetic.sql — Grote synthetische dataset voor de snelheidsbenchmark.
--
-- Maakt ~5.000 contracten, 50.000 producten, 5.000 auteurs en ~3.000.000
-- omzetregels (50.000 producten × 60 maanden). Draai in de SQL-editor OP EEN
-- APART/TEST-PROJECT (dit is testdata). Kan enkele minuten duren.
--
-- Daarna: `npm run benchmark` (of `SELECT * FROM recompute_all();`) om de
-- wandkloktijd van een volledige herberekening te meten.
-- =============================================================================

INSERT INTO products (code, title)
SELECT 'SYN-' || g, 'Synthetic ' || g FROM generate_series(1, 50000) g;

INSERT INTO authors (code, first_name, last_name)
SELECT 'SYNA-' || g, 'Auteur', g::text FROM generate_series(1, 5000) g;

INSERT INTO contracts (contract_number, name, flat_rate_pct, royalty_model, tier_accumulator, tier_reset)
SELECT 'SYN-C-' || g, 'Contract ' || g, 10 + (g % 5),
       CASE WHEN g % 2 = 0 THEN 'tiered' ELSE 'flat' END, 'contract', 'year'
FROM generate_series(1, 5000) g;

-- 10 producten per contract
WITH p AS (SELECT id, row_number() OVER (ORDER BY code) rn FROM products   WHERE code LIKE 'SYN-%'),
     c AS (SELECT id, row_number() OVER (ORDER BY contract_number) rn FROM contracts WHERE contract_number LIKE 'SYN-C-%')
INSERT INTO contract_products (contract_id, product_id)
SELECT c.id, p.id FROM p JOIN c ON c.rn = ceil(p.rn / 10.0);

-- 3 staffel-schijven voor de tiered-contracten
INSERT INTO tier_brackets (contract_id, lower_units, upper_units, rate_pct)
SELECT id, 0, 5000, 10 FROM contracts WHERE contract_number LIKE 'SYN-C-%' AND royalty_model = 'tiered'
UNION ALL SELECT id, 5000, 10000, 12 FROM contracts WHERE contract_number LIKE 'SYN-C-%' AND royalty_model = 'tiered'
UNION ALL SELECT id, 10000, NULL, 14 FROM contracts WHERE contract_number LIKE 'SYN-C-%' AND royalty_model = 'tiered';

-- 1 auteur per contract (100%), voorschot op elk 10e contract
WITH c AS (SELECT id, row_number() OVER (ORDER BY contract_number) rn FROM contracts WHERE contract_number LIKE 'SYN-C-%'),
     a AS (SELECT id, row_number() OVER (ORDER BY code) rn FROM authors WHERE code LIKE 'SYNA-%')
INSERT INTO contract_authors (contract_id, author_id, share, advance, advance_year)
SELECT c.id, a.id, 100, CASE WHEN c.rn % 10 = 0 THEN 10000 ELSE 0 END, 2021
FROM c JOIN a ON a.rn = ((c.rn - 1) % 5000) + 1;

-- ~3M omzetregels: 50.000 producten × 60 maanden (2021-2025)
INSERT INTO revenue_lines (product_id, periode, omzet, aantal)
SELECT p.id, to_char(d, 'YYYY-MM'), (aantal * 25)::numeric(14,2), aantal
FROM products p
CROSS JOIN generate_series('2021-01-01'::date, '2025-12-01'::date, interval '1 month') d
CROSS JOIN LATERAL (SELECT (200 + floor(random() * 800))::int AS aantal) x
WHERE p.code LIKE 'SYN-%';

ANALYZE revenue_lines;
