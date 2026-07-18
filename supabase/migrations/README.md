# Migraties — Patricks Calculator

Draai deze bestanden **op volgorde** in de Supabase SQL-editor (Dashboard → SQL Editor) op een schoon project. Elk bestand is idempotent-vriendelijk waar mogelijk; draai ze precies één keer op een lege database.

| # | Bestand | Inhoud |
|---|---------|--------|
| 1 | `0001_initial_schema.sql` | Domein (producten, auteurs, contracten + koppels), `revenue_lines` (fact), import-staging, indexes (btree + BRIN), helpers, RLS |
| 2 | `0002_tier_brackets.sql` | Staffel-schijven per contract |
| 3 | `0003_rollups.sql` | Gematerialiseerde uitkomsten: `accrual_monthly`, `advance_ledger`, `payout_annual`, `recompute_runs` |
| 4 | `0004_calc_functions.sql` | **De reken-engine**: `recompute()` (marginale staffel + recoupment-recurrence) |
| 5 | `0005_import_rpc.sql` | Import-pipeline: `stage_import_rows` / `validate_import_batch` / `apply_import_batch` |
| 6 | `0006_partitioning.sql` | **Optioneel** — fact-tabel partitioneren per boekjaar (alleen bij schaalnood) |
| 7 | `0007_cron.sql` | **Optioneel** — pg_cron achtergrond-worker voor grote recomputes |

## Na de migraties

1. Maak een eerste gebruiker aan (Dashboard → Authentication → Users) om in te loggen.
2. Vul data (via de import-pipeline of de seed-scripts) en draai `SELECT recompute();`.
3. De UI leest daarna uitsluitend de rollups → instant.

## Correctheid controleren

`verify_calc.sql` (in de map `supabase/`) draait een handberekend staffel-+voorschot-scenario binnen een transactie die aan het eind terugrolt (geen blijvende data). Verwachte uitkomsten:

- `accrual_monthly.royalty_cost`: **2026-01 = 3000**, **2026-02 = 4400**, **2026-03 = 6400** (jaartotaal 13800)
- Auteur A (60%, voorschot 5000): verdiend **8280**, verrekend **5000**, uitbetaling **3280**
- Auteur B (40%): uitbetaling **5520**

Dit zijn exact dezelfde gouden getallen als de geteste TypeScript-engine (`npm test`).

## Snelheid meten

`scripts/benchmark.ts` seedt miljoenen `revenue_lines` en meet de wandkloktijd van één `recompute_all()`. Zie de root-README.
