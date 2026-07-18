# Handleiding

Korte rondleiding per scherm. Live: https://patricks-calculator.vercel.app

## Inloggen

Ga naar de app-URL en log in met je e-mail + wachtwoord. Nog geen account? Vraag de beheerder om je toe te voegen (zie [DEPLOY.md](DEPLOY.md) → *Collega's toegang geven*). Rechtsonder in de zijbalk kun je uitloggen.

## Dashboard

Overzicht: totale omzet, royaltykosten, openstaand voorschot, aantallen. Een grafiek met omzet & royalty per maand, royalty per contract, en uitbetaling per boekjaar.

## Contracten

- **Lijst**: alle contracten met model (vast % of staffel), aantal producten/auteurs, omzet, royalty en openstaand voorschot.
- **Detail**: de royaltyafspraak (vast tarief of staffel-schijven), de auteurs met hun aandeel/voorschot, de gekoppelde producten, royalty per boekjaar, de uitbetaling per auteur en de maandelijkse berekening.
- **Nieuw contract** (knop rechtsboven): vul een contractnummer in (`RP_` of `CC_` + 5 cijfers, bijv. `RP_10012`), een naam, het model (vast % of staffel), kies producten en voeg auteurs toe met aandeel, voorschot en voorschot-jaar. Na opslaan wordt meteen herberekend en kom je op het contract uit. De som van de aandelen moet 100% zijn (je krijgt een waarschuwing).

## Maandelijkse accrual

Royaltykost **per product per maand** = maandomzet × het royalty% van het contract. Filter op boekjaar en/of contract. Staat een product op meerdere contracten, dan zie je het per contract met het eigen percentage. Met **Exporteren (CSV)** download je de (gefilterde) selectie als Excel-vriendelijk bestand.

## Auteurs

- **Lijst**: per auteur het totaal verdiend, uitbetaald en openstaand voorschot over alle contracten.
- **Detail**: de contracten waarop de auteur zit (met aandeel/voorschot) en de uitbetaling per boekjaar, met een link naar de afrekening.

## Uitbetalingen

Kies een boekjaar; je ziet per auteur wat er wordt uitbetaald (na verrekening van voorschotten) en het openstaand voorschot eind jaar, plus een detail per contract. Via **bekijk** open je de **printbare afrekening** per auteur (knop *Afdrukken*).

## Producten

Alle titels met hun code en de contract(en) waaraan ze gekoppeld zijn.

## Import

Het formaat voor omzet-import is `product_id | periode (JJJJ-MM) | omzet | aantal`. Een periode opnieuw uploaden vervangt die maand netjes (idempotent), waarna de geraakte contracten automatisch herberekend worden. De import-RPC's staan klaar in de database; het upload-scherm is nog niet gebouwd — omzet vul je nu via `npm run seed` of rechtstreeks in de database.
