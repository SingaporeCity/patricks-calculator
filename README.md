# Patricks Calculator

Een royalty-reken-engine (een eigen variant op wat **Alliant/Rightsline** intern doet): contracten met producten en auteurs, een royalty% of **staffel**, en aan het eind van het jaar de **uitbetaling per auteur** na verrekening van **voorschotten**. Gebouwd op snelheid en schaal — de rekenlast draait set-based in Postgres.

## Meteen bekijken (demo-modus, geen database nodig)

```bash
npm install
npm run dev        # http://localhost:5290
```

Zonder Supabase-omgevingsvariabelen draait de app in **demo-modus** met **3 voorgevulde contracten**, live doorgerekend door de echte reken-engine:

| Contract | Model | Laat zien |
|----------|-------|-----------|
| Biologie-methode Onderbouw | vast 12% | omzet → royalty, 2 auteurs 70/30 |
| NaSk Compleet | **staffel** 10 / 12,5 / 15% | marginale schijven op cumulatief aantal |
| Wiskunde Bovenbouw | vast 14% | **voorschot** dat over meerdere jaren recoupt |

Loop door Dashboard → Contracten → Auteurs → Uitbetalingen (met printbare afrekening per auteur).

## Hoe de berekening werkt

De kern staat in `lib/calc/engine.ts` (pure TypeScript, getest met golden numbers) en is 1-op-1 gespiegeld in SQL (`supabase/migrations/0004_calc_functions.sql`):

- **Maandelijkse accrual per contract** = omzet × royalty%, met een **marginale staffel**: elke maand-omzet wordt proportioneel over de schijven verdeeld naar hoeveel exemplaren in elke schijf vallen. Instelbaar per contract: teller per `contract`/`product`, reset `year`/`lifetime`.
- **Jaarlijkse uitbetaling per auteur** = contract-royalty × aandeel, daarna **voorschot-recoupment per auteur** met carry-forward: een voorschot dat in jaar Y opent wordt alléén verrekend met verdiensten vanaf Y; niet-terugverdiend saldo schuift door.

```bash
npm test          # 7 golden-number tests van de reken-engine
```

## Schaal & snelheid

De zware berekening gebeurt **set-based in Postgres** (één `recompute()` rekent alle contracten tegelijk via window-functions en een recursieve CTE), en de uitkomsten worden **gematerialiseerd** in rollup-tabellen (`accrual_monthly`, `advance_ledger`, `payout_annual`). De UI leest uitsluitend die rollups → instant, ook bij duizenden contracten/auteurs. Zie `scripts/seed_synthetic.sql` (~3M omzetregels) + `npm run benchmark` voor de meting; `supabase/migrations/0006_partitioning.sql` is de escape-hatch bij verdere groei.

## Naar productie (echte database op Supabase)

1. **Maak een Supabase-project** op https://supabase.com/dashboard.
2. **Draai de migraties** in de SQL-editor, op volgorde — zie `supabase/migrations/README.md`.
3. **Controleer de reken-engine**: draai `supabase/verify_calc.sql` (rolt terug; toont de gouden getallen).
4. **Env**: kopieer `.env.example` → `.env.local` en vul `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
5. **Data**: `npm run seed` zet de 3 demo-contracten in de database (of gebruik de import-pipeline).
6. **Deploy**: Vercel, regio `fra1` (`vercel.json`). Import-route op Node-runtime i.v.m. `xlsx`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres) · Vercel (`fra1`). Volgt de conventies van het bestaande `lerend-kwalificeren`-project.

## Status & vervolg

Volledig af en verifieerbaar: reken-engine (TS + SQL, getest), demo-modus met 3 contracten, alle lees-schermen, printbare afrekening, de SQL-migraties, import-RPC's en de seed/benchmark-scripts.

Resterende integratie (productie-inschakeling): de data-facade (`lib/data/index.ts`) leest nu de demo-dataset; koppel de Supabase-lees-implementatie achter dezelfde async-interface, plus login/auth (`lib/supabase/*` + `proxy.ts` staan klaar) en de xlsx-upload-UI op de import-RPC's. De schermen en de RPC's veranderen daarbij niet.
