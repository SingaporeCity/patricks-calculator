# Patricks Calculator

Een royalty-reken-engine voor uitgeverij-methodes — een eigen variant op wat **Alliant/Rightsline** intern doet. Het systeem beheert contracten met producten en auteurs, berekent maandelijkse royaltykosten per product, en berekent aan het eind van het jaar de uitbetaling per auteur (met staffels en voorschotten). Gebouwd op snelheid en schaal: het rekenwerk draait set-based in Postgres.

**Live:** https://patricks-calculator.vercel.app (inloggen vereist)

## Wat het doet

- **Contracten** met een royalty% of een **staffel** (oplopend tarief per cumulatief aantal exemplaren), gekoppeld aan producten en auteurs. Een product mag op meerdere contracten staan (bijv. huidige auteurs 8% + oud-auteurs 2% op dezelfde titel); een auteur mag op meerdere contracten zitten.
- **Contract toevoegen** via de UI, met validatie op het contractnummer.
- **Maandelijkse accrual**: royaltykost per product per maand (maandomzet × contract-royalty%), met CSV-export.
- **Jaarlijkse uitbetaling per auteur**: contract-royalty × aandeel, daarna voorschot-recoupment met carry-forward. Printbare afrekening per auteur.
- **Login** (Supabase Auth) zodat collega's persoonlijk toegang hebben; data is RLS-beschermd.

## Snel starten

**Demo-modus (geen database nodig):**
```bash
npm install
npm run dev        # http://localhost:5290
```
Zonder Supabase-omgevingsvariabelen draait de app met een voorbeelddataset (13 methodes, 12 auteurs, 11 contracten), live doorgerekend door de reken-engine — geen login.

**Met echte database (Supabase):** zie [docs/DEPLOY.md](docs/DEPLOY.md).

```bash
npm test           # golden-number tests van de reken-engine
npm run build      # productie-build
```

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/ARCHITECTUUR.md](docs/ARCHITECTUUR.md) | Stack, dual-source data-facade, auth, rendering, data-flow, kernbestanden |
| [docs/REKENMODEL.md](docs/REKENMODEL.md) | De reken-engine: maandaccrual, marginale staffel, voorschot-recoupment (met voorbeelden) |
| [docs/DATAMODEL.md](docs/DATAMODEL.md) | Tabellen, relaties, ID-conventies, rollups, RLS, migraties |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Supabase opzetten, env-vars, Vercel-deploy, collega-accounts, valkuilen |
| [docs/HANDLEIDING.md](docs/HANDLEIDING.md) | Gebruikershandleiding per scherm |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth) · Vercel (regio `fra1`). Volgt de conventies van het `lerend-kwalificeren`-project.
