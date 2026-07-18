// ============================================================================
// Domein-types — gedeeld door de reken-engine, demo-data en de UI.
// Engelse identifiers, Nederlandse UI-copy. Bedragen in euro's (number).
// ============================================================================

export type ISBN = string;

/** Een product (bv. een titel/ISBN) waarvan omzet binnenkomt. */
export interface Product {
  id: string;
  code: string; // business-key uit de import (bv. ISBN)
  title: string;
}

/** Een auteur die op een of meer contracten meedeelt. */
export interface Author {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Koppeling auteur <-> contract: aandeel (%) + optioneel voorschot. */
export interface ContractAuthor {
  authorId: string;
  /** Aandeel in het contract, in procenten (0..100). */
  share: number;
  /** Voorschot (voorschot/advance) dat eerst terugverdiend moet worden. */
  advance: number;
  /** Boekjaar waarin het voorschot opent (verrekening start). */
  advanceYear: number;
}

/** Een staffel-schijf: [lowerUnits, upperUnits) tegen ratePct. */
export interface TierBracket {
  lowerUnits: number;
  /** null = oneindig (bovenste schijf). */
  upperUnits: number | null;
  ratePct: number;
}

export type RoyaltyModel = "flat" | "tiered";
export type TierAccumulator = "contract" | "product";
export type TierReset = "year" | "lifetime";

export interface Contract {
  id: string;
  contractNumber: string;
  name: string;
  /** Basis-royalty% (ook gebruikt als enige schijf bij een vast contract). */
  flatRatePct: number;
  royaltyModel: RoyaltyModel;
  /** Telt de staffel per contract of per product? Standaard 'contract'. */
  tierAccumulator: TierAccumulator;
  /** Reset de staffelteller per boekjaar of loopt hij levenslang door? */
  tierReset: TierReset;
  /** Staffel-schijven (leeg bij een vast contract). */
  brackets: TierBracket[];
  productIds: string[];
  authors: ContractAuthor[];
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  status: "active" | "ended";
}

/** Ruwe omzetregel uit de import: omzet + aantal per product per maand. */
export interface RevenueLine {
  productId: string;
  periode: string; // YYYY-MM
  omzet: number;
  aantal: number;
}

// --- Reken-resultaten (spiegelen de gematerialiseerde rollups in Postgres) ---

/** accrual_monthly: maandelijkse royalty-kost per contract. */
export interface MonthlyAccrual {
  contractId: string;
  periode: string; // YYYY-MM
  boekjaar: number;
  omzet: number;
  aantal: number;
  royaltyCost: number; // onafgerond
  effectiveRate: number; // royaltyCost / omzet (0..1)
}

/** payout_annual + advance_ledger samengevoegd: uitbetaling per auteur per jaar. */
export interface AnnualPayout {
  contractId: string;
  authorId: string;
  boekjaar: number;
  contractEarned: number; // totale royalty op het contract dat jaar
  share: number; // aandeel auteur (%)
  earnedAuthor: number; // contractEarned * share/100
  advanceAdded: number; // voorschot dat dit jaar opent
  openingBalance: number; // openstaand voorschot begin jaar
  recouped: number; // dit jaar verrekend
  closingBalance: number; // openstaand voorschot eind jaar (schuift door)
  payout: number; // daadwerkelijke uitbetaling (afgerond, >= 0)
}
