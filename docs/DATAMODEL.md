# Datamodel

Engelse identifiers, Nederlandse comments. Geld `NUMERIC(14,2)`, percentages `NUMERIC(5,2)` (aandeel `NUMERIC(7,4)`, zodat 100% past), aantallen `INTEGER`/`BIGINT`.

## ID-conventies

| Entiteit | Veld | Formaat | Voorbeeld |
|---|---|---|---|
| Product | `code` | 5 cijfers | `10001` |
| Auteur | `code` | 7 cijfers | `1000001` |
| Contract | `contract_number` | `RP_` of `CC_` + 5 cijfers | `RP_10001`, `CC_10002` |

Het contractnummer wordt gevalideerd op `^(RP|CC)_\d{5}$` (in `lib/actions/contracten.ts` en het formulier).

## Tabellen

**Domein**
- `products` — `id`, `code` (uniek), `title`.
- `authors` — `id`, `code` (uniek), `first_name`, `last_name`, `email`.
- `contracts` — `id`, `contract_number` (uniek), `name`, `flat_rate_pct`, `royalty_model` (`flat`/`tiered`), `tier_accumulator` (`contract`/`product`), `tier_reset` (`year`/`lifetime`), `start_date`, `end_date`, `status`.
- `contract_products` (join) — `PK (contract_id, product_id)`. Many-to-many: een product mag op meerdere contracten staan.
- `contract_authors` (join) — `share` (aandeel %), `advance` (voorschot), `advance_year`. `UNIQUE (contract_id, author_id)`. Een auteur mag op meerdere contracten zitten.
- `tier_brackets` — staffel-schijven per contract (`lower_units`, `upper_units` NULL=∞, `rate_pct`).

**Fact + import**
- `revenue_lines` — de omzet-fact-tabel: `product_id`, `periode` (`YYYY-MM`), `omzet`, `aantal`. Generated: `period_month`, `boekjaar`. `UNIQUE (product_id, periode)`. Indexes: btree `(product_id, periode)` + BRIN `(period_month)`.
- `import_batches`, `revenue_staging` — voor de import-pipeline (stage → validate → apply).

**Gematerialiseerde rollups (UI leest deze)**
- `accrual_monthly` — royaltykost per contract per maand (staffel-based).
- `advance_ledger` — voorschot-saldo per (contract, auteur, boekjaar): opening/recouped/closing/payout.
- `payout_annual` — uitbetaling per auteur per jaar.
- `recompute_runs` — status van (achtergrond-)herberekeningen.

## Herberekenen

`recompute(p_contract_ids uuid[])` (NULL = alle) leegt en vult de rollups voor de betreffende contracten in één transactie. Wrappers: `recompute_all()`, `recompute_contracts(uuid[])`. Wordt aangeroepen na een import en na het toevoegen/wijzigen van een contract.

## RLS

Intern, single-org: ingelogde gebruikers (`is_staff()` = `authenticated`) mogen alle tabellen **lezen**; schrijven gaat via `SECURITY DEFINER`-functies of de admin/secret-key-client. De app leest als de ingelogde gebruiker (RLS actief); schrijven en herberekenen via de admin-client.

## Migraties (volgorde)

Draai in de Supabase SQL-editor op volgorde — zie `supabase/migrations/README.md`.

| # | Bestand | Inhoud |
|---|---|---|
| 1 | `0001_initial_schema.sql` | Domein, `revenue_lines`, indexes, helpers, RLS |
| 2 | `0002_tier_brackets.sql` | Staffel-schijven |
| 3 | `0003_rollups.sql` | Rollup-tabellen |
| 4 | `0004_calc_functions.sql` | **Reken-engine** (`recompute`) |
| 5 | `0005_import_rpc.sql` | Import-pipeline-RPC's |
| 6–7 | `0006_partitioning.sql`, `0007_cron.sql` | Optioneel (schaal / achtergrond-worker) |

## Valkuilen (gefixt)

- **Generated column `period_month`** moet `make_date(...)` gebruiken — `to_date()`/`::date` zijn niet IMMUTABLE en geven `42P17`.
- **`share`** is `NUMERIC(7,4)` (niet `6,4`): `6,4` kan maximaal 99,9999, dus een aandeel van 100% faalde stil bij insert.
