// ============================================================================
// Reken-engine (pure functies) — DE KERN van Patricks Calculator.
//
// Deze TypeScript-implementatie is 1-op-1 de logica die in productie set-based
// in Postgres draait (supabase/migrations/0004_calc_functions.sql). Ze dient
// hier twee doelen:
//   1. de demo-modus rekent hiermee de 3 voorgevulde contracten door;
//   2. ze is de correctheids-"oracle" waartegen de SQL getest wordt.
//
// Twee berekeningen:
//   a) maandelijkse royalty-kost per contract, met MARGINALE staffel op
//      cumulatief aantal exemplaren;
//   b) jaarlijkse uitbetaling per auteur = contract-royalty * aandeel, daarna
//      voorschot-recoupment PER AUTEUR met carry-forward naar volgend jaar.
// ============================================================================

import type {
  AnnualPayout,
  Contract,
  MonthlyAccrual,
  RevenueLine,
  TierBracket,
} from "@/lib/types";

const CENTS = 2;

function round(value: number, decimals = CENTS): number {
  const f = 10 ** decimals;
  // +Number.EPSILON tempert binaire drijvende-komma-artefacten bij .5-grenzen.
  return Math.round((value + Number.EPSILON) * f) / f;
}

function boekjaarVan(periode: string): number {
  return Number(periode.slice(0, 4));
}

/**
 * Effectieve schijven voor een contract. Een VAST contract (of een contract
 * zonder staffel-rijen) wordt één degeneratieve schijf [0, oneindig) tegen het
 * basis-royalty%, zodat vast en staffel exact hetzelfde codepad delen.
 */
export function effectiveBrackets(contract: Contract): TierBracket[] {
  if (contract.royaltyModel === "tiered" && contract.brackets.length > 0) {
    return [...contract.brackets].sort((a, b) => a.lowerUnits - b.lowerUnits);
  }
  return [{ lowerUnits: 0, upperUnits: null, ratePct: contract.flatRatePct }];
}

/** Rate van de schijf die `units` bevat (voor de nul-exemplaren edge-case). */
function rateAtUnits(brackets: TierBracket[], units: number): number {
  for (const b of brackets) {
    const hi = b.upperUnits ?? Infinity;
    if (units >= b.lowerUnits && units < hi) return b.ratePct;
  }
  // Voorbij de bovenste grens: gebruik de bovenste schijf.
  return brackets[brackets.length - 1]?.ratePct ?? 0;
}

interface GrainRow {
  accumKey: string;
  resetKey: number;
  periode: string;
  boekjaar: number;
  omzet: number;
  aantal: number;
}

/**
 * (a) Maandelijkse royalty-accrual per contract.
 *
 * De omzet-per-exemplaar is binnen een maand uniform, dus de maand-omzet wordt
 * PROPORTIONEEL over de staffel-schijven verdeeld naar hoeveel exemplaren van
 * die maand in elke schijf vallen (marginaal, niet "alles springt naar de
 * bovenste rate").
 */
export function computeMonthlyAccruals(
  contract: Contract,
  revenueLines: RevenueLine[],
): MonthlyAccrual[] {
  const brackets = effectiveBrackets(contract);
  const productSet = new Set(contract.productIds);

  // 1. Aggregeer per accumulatie-grain (contract of product) per periode.
  const grainMap = new Map<string, GrainRow>();
  for (const rl of revenueLines) {
    if (!productSet.has(rl.productId)) continue;
    const boekjaar = boekjaarVan(rl.periode);
    const accumKey =
      contract.tierAccumulator === "product"
        ? `${contract.id}:${rl.productId}`
        : contract.id;
    const resetKey = contract.tierReset === "year" ? boekjaar : 0;
    const key = `${accumKey}|${resetKey}|${rl.periode}`;
    const existing = grainMap.get(key);
    if (existing) {
      existing.omzet += rl.omzet;
      existing.aantal += rl.aantal;
    } else {
      grainMap.set(key, {
        accumKey,
        resetKey,
        periode: rl.periode,
        boekjaar,
        omzet: rl.omzet,
        aantal: rl.aantal,
      });
    }
  }

  // 2. Per (accumKey, resetKey) op periode sorteren en cumulatief aantal
  //    bijhouden; elke maand marginaal over de schijven verdelen.
  const byPartition = new Map<string, GrainRow[]>();
  for (const row of grainMap.values()) {
    const pkey = `${row.accumKey}|${row.resetKey}`;
    const arr = byPartition.get(pkey) ?? [];
    arr.push(row);
    byPartition.set(pkey, arr);
  }

  // accrualPerPeriode verzamelt royaltyCost + omzet + aantal per contract×periode.
  const accrual = new Map<string, MonthlyAccrual>();
  const addAccrual = (row: GrainRow, royaltyCost: number) => {
    const existing = accrual.get(row.periode);
    if (existing) {
      existing.omzet += row.omzet;
      existing.aantal += row.aantal;
      existing.royaltyCost += royaltyCost;
    } else {
      accrual.set(row.periode, {
        contractId: contract.id,
        periode: row.periode,
        boekjaar: row.boekjaar,
        omzet: row.omzet,
        aantal: row.aantal,
        royaltyCost,
        effectiveRate: 0,
      });
    }
  };

  for (const rows of byPartition.values()) {
    rows.sort((a, b) => (a.periode < b.periode ? -1 : a.periode > b.periode ? 1 : 0));
    let cumBefore = 0;
    for (const row of rows) {
      const cumAfter = cumBefore + row.aantal;
      let royaltyCost = 0;
      if (row.aantal > 0) {
        for (const b of brackets) {
          const hi = b.upperUnits ?? Infinity;
          const unitsInBracket =
            Math.min(cumAfter, hi) - Math.max(cumBefore, b.lowerUnits);
          if (unitsInBracket > 0) {
            royaltyCost += row.omzet * (unitsInBracket / row.aantal) * (b.ratePct / 100);
          }
        }
      } else if (row.omzet !== 0) {
        // Nul-exemplaren met omzet (retour/credit): belast tegen de huidige tier.
        royaltyCost = row.omzet * (rateAtUnits(brackets, cumBefore) / 100);
      }
      addAccrual(row, royaltyCost);
      cumBefore = cumAfter;
    }
  }

  const result = [...accrual.values()];
  for (const a of result) {
    a.effectiveRate = a.omzet !== 0 ? a.royaltyCost / a.omzet : 0;
  }
  result.sort((x, y) => (x.periode < y.periode ? -1 : x.periode > y.periode ? 1 : 0));
  return result;
}

/**
 * (b) Jaarlijkse uitbetaling per auteur, met voorschot-recoupment per auteur
 * en carry-forward naar volgend jaar.
 *
 * Jaar-op-jaar recurrence (per auteur, oplopend op boekjaar). Een voorschot dat
 * in jaar Y opent, wordt alléén verrekend met verdiensten van jaar Y en later —
 * niet met verdiensten uit eerdere jaren die de auteur al uitbetaald kreeg:
 *   openingBalance = openstaand voorschot dit jaar  (= carry vorig jaar + nieuw)
 *   recouped       = min(earnedAuthor, openingBalance)
 *   closingBalance = openingBalance - recouped        (schuift door)
 *   payout         = round(earnedAuthor - recouped)   (>= 0)
 */
export function computeAnnualPayouts(
  contract: Contract,
  accruals: MonthlyAccrual[],
): AnnualPayout[] {
  // contract-royalty per boekjaar
  const earnedByYear = new Map<number, number>();
  for (const a of accruals) {
    earnedByYear.set(a.boekjaar, (earnedByYear.get(a.boekjaar) ?? 0) + a.royaltyCost);
  }

  const out: AnnualPayout[] = [];

  for (const ca of contract.authors) {
    // Jaren met omzet of met een voorschot dat opent, oplopend.
    const years = new Set<number>(earnedByYear.keys());
    years.add(ca.advanceYear);
    const sortedYears = [...years].sort((a, b) => a - b);

    let carried = 0; // openstaand voorschot uit vorig jaar
    for (const jaar of sortedYears) {
      const contractEarned = earnedByYear.get(jaar) ?? 0;
      const earnedAuthor = contractEarned * (ca.share / 100);
      const advanceAdded = jaar === ca.advanceYear ? ca.advance : 0;

      const openingBalance = carried + advanceAdded;
      const recouped = Math.min(earnedAuthor, openingBalance);
      const closingBalance = openingBalance - recouped;
      const payout = round(earnedAuthor - recouped);
      carried = closingBalance;

      // Sla alleen jaren op die er toe doen (omzet of open voorschot-saldo).
      if (contractEarned !== 0 || openingBalance > 0) {
        out.push({
          contractId: contract.id,
          authorId: ca.authorId,
          boekjaar: jaar,
          contractEarned,
          share: ca.share,
          earnedAuthor,
          advanceAdded,
          openingBalance,
          recouped,
          closingBalance,
          payout,
        });
      }
    }
  }

  out.sort((a, b) =>
    a.authorId === b.authorId ? a.boekjaar - b.boekjaar : a.authorId < b.authorId ? -1 : 1,
  );
  return out;
}
