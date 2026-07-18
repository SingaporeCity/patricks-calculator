// Nederlandse notatie voor bedragen, aantallen en percentages.

const euro2 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const euro0 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const nf = new Intl.NumberFormat("nl-NL");

/** € 1.234,56 */
export function formatEuro(value: number): string {
  return euro2.format(value);
}

/** € 1.235 (afgerond, voor dashboards) */
export function formatEuro0(value: number): string {
  return euro0.format(value);
}

/** 1.234 */
export function formatNumber(value: number): string {
  return nf.format(value);
}

/** Verwacht een fractie (0..1) -> "12,3%". */
export function formatFractionPct(fraction: number): string {
  return `${nf.format(Math.round(fraction * 1000) / 10)}%`;
}

/** Verwacht een percentage (0..100) -> "12,5%". */
export function formatRatePct(pct: number): string {
  return `${nf.format(pct)}%`;
}
