# Rekenmodel

De kern staat in `lib/calc/engine.ts` (pure TypeScript, getest met golden numbers in `lib/calc/engine.test.ts`) en is 1-op-1 gespiegeld in SQL (`supabase/migrations/0004_calc_functions.sql`). `supabase/verify_calc.sql` bewijst dat de SQL dezelfde uitkomsten geeft als de TS-engine.

Er zijn twee losse berekeningen met een verschillend doel.

## 1. Maandelijkse accrual per product (kosten)

Voor de kostenkant per maand: **maandomzet × het (vaste) royalty% van het contract**, granulair **per product**.

- Bron: `getProductAccrual()` in `lib/data/index.ts` (leest `revenue_lines` × `contract_products` × `contracts`).
- Formule per (product, contract, maand): `royaltykost = omzet × contracts.flat_rate_pct / 100`.
- Staat een product op **meerdere contracten**, dan komt er per contract een regel met het eigen percentage. Voorbeeld: *Moderne Wiskunde 14* onder `RP_10001` (8%) én `CC_10002` (2%) → twee regels per maand.
- Bewust **vlak** (niet de staffel): dit is de maandelijkse kostenraming. De staffel is voor de jaarafrekening hieronder.
- Exporteerbaar naar CSV via `/api/export/maandaccrual` (puntkomma-scheiding, komma-decimalen, UTF-8 BOM — Excel-NL-vriendelijk).

## 2. Jaarlijkse uitbetaling per auteur

Aan het eind van het jaar: contract-royalty × aandeel per auteur, daarna voorschot-recoupment. Dit is de "belangrijke" berekening en gebruikt wél de staffel.

### 2a. Marginale staffel op cumulatief aantal exemplaren

De maandomzet wordt **proportioneel over de staffel-schijven verdeeld** naar hoeveel exemplaren van die maand in elke schijf vallen (marginaal — elke schijf telt tegen zijn eigen tarief, niet "alles springt naar de bovenste rate"). Instelbaar per contract: teller per `contract`/`product`, reset per `year`/`lifetime` (standaard contract + jaar). Een vast contract = één schijf `[0, oneindig)` tegen `flat_rate_pct`, dus vast en staffel delen exact hetzelfde codepad.

**Voorbeeld** (staffel 0–5.000 @10%, 5.000–10.000 @12%, >10.000 @14%, prijs €10/exemplaar):

| Maand | Aantal | Cumulatief | Berekening | Royaltykost |
|---|---|---|---|---|
| jan | 3.000 | 0→3.000 | 3.000 @10% | € 3.000 |
| feb | 4.000 | 3.000→7.000 | 2.000 @10% + 2.000 @12% | € 4.400 |
| mrt | 5.000 | 7.000→12.000 | 3.000 @12% + 2.000 @14% | € 6.400 |
| **jaar** | | | | **€ 13.800** |

### 2b. Voorschot-recoupment per auteur (carry-forward)

Per auteur: `verdiend = contract-royalty × aandeel/100`. Daarna wordt het voorschot verrekend, jaar-op-jaar:

```
openingBalance = openstaand voorschot dit jaar (carry vorig jaar + nieuw voorschot dit jaar)
recouped       = min(verdiend, openingBalance)
closingBalance = openingBalance − recouped        (schuift door naar volgend jaar)
uitbetaling    = round(verdiend − recouped)        (>= 0)
```

Belangrijk: een voorschot dat in jaar Y opent, wordt **alleen verrekend met verdiensten vanaf jaar Y** — niet met eerdere jaren die de auteur al uitbetaald kreeg. (De eerdere "closed-form" `cumAdvance − cumEarned` was hierin fout; de jaar-op-jaar recurrence is correct.)

**Voorbeeld** (auteur, aandeel 100%, voorschot €10.000 in 2026; verdiend 2026 = €8.000, 2027 = €12.000):

| Jaar | Verdiend | Opening | Verrekend | Uitbetaling | Closing |
|---|---|---|---|---|---|
| 2026 | € 8.000 | € 10.000 | € 8.000 | € 0 | € 2.000 |
| 2027 | € 12.000 | € 2.000 | € 2.000 | € 10.000 | € 0 |

## Afronding

`royalty_cost` wordt onafgerond bewaard (`NUMERIC(16,4)`); pas de **eindafrekening per auteur** wordt op centen afgerond, zodat er geen maand-op-maand-drift ontstaat.

## Verificatie

- `npm test` — 7 golden-number tests van de TS-engine.
- `supabase/verify_calc.sql` — draai in de Supabase SQL-editor; bevestigt dat de SQL-engine exact dezelfde getallen produceert (accrual 3000/4400/6400, uitbetaling 3280/5520 in het staffel-+voorschot-scenario).
