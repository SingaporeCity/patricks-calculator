# Architectuur

## Stack

- **Frontend/backend:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4. Server Components voor lezen, Server Actions voor schrijven.
- **Database + auth:** Supabase (Postgres, RLS, Auth). Al het zware rekenwerk gebeurt set-based in Postgres.
- **Deploy:** Vercel, functie-regio `fra1` (Frankfurt, dicht bij de Supabase-database).

## Dual-source data-facade

Alle pagina's halen data via één laag: `lib/data/index.ts`. Die laag heeft twee bronnen achter exact dezelfde async-interface, gekozen op basis van de omgevingsvariabelen:

```
isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL
```

- **Demo-modus** (geen Supabase-env): rekent live via de pure-TS engine (`lib/calc/engine.ts`) over de voorbeelddataset (`lib/demo/data.ts`). Geen database, geen login. Handig om lokaal te bekijken.
- **Supabase-modus** (env gezet): leest de **gematerialiseerde rollups** uit Postgres. Per-request gecachet met React `cache()`.

Doordat beide bronnen dezelfde vorm teruggeven, weet geen enkele pagina welke bron actief is.

## Auth & beveiliging

- `proxy.ts` (Next 16 middleware) → `lib/supabase/proxy-session.ts`: stuurt niet-ingelogde bezoekers naar `/login`. In demo-modus (geen env) wordt alles doorgelaten.
- **Lezen** gebeurt als de **ingelogde gebruiker** via `lib/supabase/server.ts` (cookie-gebaseerd). Daardoor beschermt **RLS** de data én worden de datapagina's automatisch dynamisch gerenderd (deploy-klaar; geen build-time prerender).
- **Schrijven** (bijv. contract toevoegen, herberekenen) gaat via `lib/supabase/admin.ts` (secret key, `server-only`) — dat passeert RLS bewust, en de proxy zorgt dat alleen ingelogde gebruikers bij de schrijf-schermen komen.
- Login-scherm: `app/login/page.tsx` (browser-client, `signInWithPassword`).

## Rekenen & materialiseren (schaal)

De rekenlast (duizenden contracten/auteurs) draait **niet** in de browser of in Node, maar set-based in Postgres:

```
import (xlsx/csv)  ->  revenue_lines (fact)  ->  recompute()  ->  rollups  ->  UI leest rollups
```

- `recompute(p_contract_ids uuid[])` (SQL, `supabase/migrations/0004_calc_functions.sql`) herberekent alle contracten in één set-based pass (window-functions voor de staffel, recursieve CTE voor de voorschot-recoupment) en schrijft de uitkomsten weg in de rollup-tabellen.
- De UI leest uitsluitend die rollups → reads zijn O(1), ook bij grote volumes.
- Zie [REKENMODEL.md](REKENMODEL.md) voor de logica en [DATAMODEL.md](DATAMODEL.md) voor de tabellen.

Voor de **maandelijkse accrual per product** wordt niet uit de rollups gelezen maar direct uit `revenue_lines` × `contract_products` × `contracts` (in `getProductAccrual`), omdat die weergave per product/contract/maand is en een ander tarief-model gebruikt (het vaste contract-%, niet de staffel).

## Kernbestanden

| Pad | Rol |
|---|---|
| `lib/calc/engine.ts` | De reken-engine (pure TS, getest). Spiegel van de SQL. |
| `lib/calc/engine.test.ts` | Golden-number tests (`npm test`). |
| `lib/data/index.ts` | Data-facade (demo óf Supabase), alle afgeleide views. |
| `lib/demo/data.ts` | Voorbeelddataset. |
| `lib/supabase/{client,server,admin,proxy-session}.ts` | Supabase-clients (browser / ingelogd / admin / sessie). |
| `proxy.ts` | Auth-gate. |
| `lib/actions/contracten.ts` | Server Action: contract aanmaken + herberekenen. |
| `supabase/migrations/*.sql` | Schema + reken-engine + import-RPC's. |
| `scripts/{seed,benchmark}.ts` | Data seeden / snelheid meten. |

## Renderoverzicht (productie-build)

- Dynamisch (`ƒ`, per request): `/`, `/accrual`, `/contracten*`, `/auteurs*`, `/producten`, `/uitbetalingen*`, `/api/export/maandaccrual`.
- Statisch (`○`): `/login`, `/import`.
- Middleware: `proxy.ts` (auth-gate).
