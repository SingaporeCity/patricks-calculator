# Deploy & opzetten

De app draait live op Vercel: **https://patricks-calculator.vercel.app**. Hieronder hoe je van nul een omgeving opzet en deployt.

## 1. Supabase-project

1. Maak een project op https://supabase.com/dashboard. Kies regio **Central EU (Frankfurt)** (dicht bij de Vercel-functie-regio `fra1`).
2. Draai de migraties `0001` t/m `0005` in de **SQL-editor**, op volgorde (`supabase/migrations/README.md`). `0006`/`0007` zijn optioneel.
3. (Optioneel) Draai `supabase/verify_calc.sql` om te bevestigen dat de reken-engine correct is (alle rijen `status = OK`).
4. Data vullen: `npm run seed` (zet de voorbeelddataset in de database), of gebruik later de import-pipeline.

## 2. Omgevingsvariabelen

Kopieer `.env.example` → `.env.local` en vul in (Supabase → Project Settings → API Keys / Data API):

| Variabele | Waarde |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | de **kale Project-URL**, bijv. `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | de `sb_publishable_...` key (browser-veilig) |
| `SUPABASE_SECRET_KEY` | de `sb_secret_...` key (**alleen server-side**, nooit delen/committen) |
| `NEXT_PUBLIC_SITE_URL` | de app-URL (optioneel) |

> **Valkuil:** gebruik bij `NEXT_PUBLIC_SUPABASE_URL` de **kale** URL, dus **niet** de Data-API-URL met `/rest/v1/` erachter. `supabase-js` plakt dat pad er zelf achter; anders krijg je `PGRST125 "Invalid path"`.

`.env.local` staat in `.gitignore` en gaat dus niet mee naar GitHub.

## 3. Vercel

1. **Repo op GitHub** — push de projectmap naar een (privé) repo.
2. **Importeren** op https://vercel.com/new → kies de repo. Next.js wordt herkend; regio `fra1` staat in `vercel.json`.
3. **Env-vars** invullen (dezelfde drie/vier als hierboven) **vóór** de eerste deploy — de `NEXT_PUBLIC_`-waarden worden tijdens het bouwen vastgezet.
4. **Deploy.** Elke volgende `git push` naar `main` triggert automatisch een nieuwe deploy.

> **Valkuil (opgelost):** krijg je bij de build `Error: No Output Directory named "public" found`, dan staat de **Framework Preset** verkeerd (op "Other"). `vercel.json` forceert daarom `"framework": "nextjs"`. Alternatief: Vercel → Settings → Build & Deployment → Framework Preset → **Next.js** → Redeploy.
>
> Voeg je env-vars **ná** een build toe, klik dan **Redeploy** zodat de nieuwe build ze meekrijgt. Zonder env-vars valt de app terug op demo-modus (voorbeelddata, geen login).

## 4. Collega's toegang geven

Login is Supabase Auth (e-mail + wachtwoord). Er is bewust geen zelf-registratie; de beheerder maakt accounts aan:

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**.
2. E-mail + wachtwoord invullen en **Auto Confirm User** aanvinken (anders moet de gebruiker eerst een bevestigingsmail bevestigen).
3. Deel de app-URL + de inloggegevens. Voor wachtwoord-login hoef je in Supabase niets aan redirect-URL's te wijzigen.

## Scripts

| Commando | Wat |
|---|---|
| `npm run dev` | Lokaal draaien (poort 5290) |
| `npm run build` | Productie-build |
| `npm test` | Reken-engine-tests |
| `npm run seed` | Voorbeelddataset in Supabase zetten + herberekenen |
| `npm run benchmark` | Snelheid van `recompute_all()` meten (na `scripts/seed_synthetic.sql`) |
