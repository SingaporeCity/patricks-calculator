// ============================================================================
// Data-facade — het ENIGE punt waar de UI data vandaan haalt.
//
// Twee bronnen achter exact dezelfde async-interface:
//   * DEMO-modus (geen Supabase-env): rekent live via de pure-TS engine over
//     de demo-dataset.
//   * SUPABASE-modus (env gezet): leest server-side de gematerialiseerde
//     rollups via de secret key (bypasst RLS; nog geen login).
// Pagina's importeren alleen deze functies en merken het verschil niet.
// ============================================================================

import { cache } from "react";
import { computeAnnualPayouts, computeMonthlyAccruals, effectiveBrackets } from "@/lib/calc/engine";
import { authors as demoAuthors, contracts as demoContracts, products as demoProducts, revenueLines } from "@/lib/demo/data";
import type { AnnualPayout, Author, Contract, MonthlyAccrual, Product } from "@/lib/types";

export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/** Haalt alle rijen op, paginerend langs de PostgREST-limiet van 1000 per query. */
async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  label: string,
): Promise<any[]> {
  const page = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(`${label} lezen mislukt: ${error.message}`);
    const rows = (data ?? []) as any[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export function authorName(a: Author): string {
  return `${a.firstName} ${a.lastName}`;
}

// --- Store: alle data die de shapers nodig hebben --------------------------

interface Store {
  products: Product[];
  authors: Author[];
  contracts: Contract[];
  accrualsByContract: Map<string, MonthlyAccrual[]>;
  payoutsByContract: Map<string, AnnualPayout[]>;
  productById: Map<string, Product>;
  authorById: Map<string, Author>;
  contractById: Map<string, Contract>;
}

function indexStore(base: Omit<Store, "productById" | "authorById" | "contractById">): Store {
  return {
    ...base,
    productById: new Map(base.products.map((p) => [p.id, p])),
    authorById: new Map(base.authors.map((a) => [a.id, a])),
    contractById: new Map(base.contracts.map((c) => [c.id, c])),
  };
}

// --- Demo-store (eenmalig gerekend) ----------------------------------------

const demoStore: Store = (() => {
  const accrualsByContract = new Map<string, MonthlyAccrual[]>();
  const payoutsByContract = new Map<string, AnnualPayout[]>();
  for (const c of demoContracts) {
    const acc = computeMonthlyAccruals(c, revenueLines);
    accrualsByContract.set(c.id, acc);
    payoutsByContract.set(c.id, computeAnnualPayouts(c, acc));
  }
  return indexStore({ products: demoProducts, authors: demoAuthors, contracts: demoContracts, accrualsByContract, payoutsByContract });
})();

// --- Supabase-store (per request gecachet) ---------------------------------

const loadSupabaseStore = cache(async (): Promise<Store> => {
  // Lezen gebeurt als de INGELOGDE gebruiker (RLS beschermt de data).
  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();

  // PostgREST geeft standaard max 1000 rijen terug; paginerend alles ophalen.
  const [prodD, authD, contrD, brkD, cpD, caD, accD, payD, ledD] = await Promise.all([
    fetchAll((f, t) => db.from("products").select("id, code, title").range(f, t), "products"),
    fetchAll((f, t) => db.from("authors").select("id, code, first_name, last_name, email").range(f, t), "authors"),
    fetchAll((f, t) => db.from("contracts").select("*").range(f, t), "contracts"),
    fetchAll((f, t) => db.from("tier_brackets").select("contract_id, lower_units, upper_units, rate_pct").range(f, t), "tier_brackets"),
    fetchAll((f, t) => db.from("contract_products").select("contract_id, product_id").range(f, t), "contract_products"),
    fetchAll((f, t) => db.from("contract_authors").select("contract_id, author_id, share, advance, advance_year").range(f, t), "contract_authors"),
    fetchAll((f, t) => db.from("accrual_monthly").select("contract_id, periode, boekjaar, omzet, aantal, royalty_cost, effective_rate").range(f, t), "accrual_monthly"),
    fetchAll((f, t) => db.from("payout_annual").select("contract_id, author_id, boekjaar, contract_earned, share, earned_author, payout").range(f, t), "payout_annual"),
    fetchAll((f, t) => db.from("advance_ledger").select("contract_id, author_id, boekjaar, advance_added, opening_balance, recouped, closing_balance").range(f, t), "advance_ledger"),
  ]);

  const products: Product[] = prodD.map((p) => ({ id: p.id, code: p.code, title: p.title }));
  const authors: Author[] = authD.map((a) => ({ id: a.id, code: a.code ?? "", firstName: a.first_name, lastName: a.last_name, email: a.email ?? "" }));

  const groupBy = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const arr = m.get(key(r)) ?? [];
      arr.push(r);
      m.set(key(r), arr);
    }
    return m;
  };
  const brkByC = groupBy(brkD, (b) => b.contract_id);
  const cpByC = groupBy(cpD, (x) => x.contract_id);
  const caByC = groupBy(caD, (x) => x.contract_id);

  const contracts: Contract[] = contrD.map((c) => ({
    id: c.id,
    contractNumber: c.contract_number,
    name: c.name,
    flatRatePct: n(c.flat_rate_pct),
    royaltyModel: c.royalty_model,
    tierAccumulator: c.tier_accumulator,
    tierReset: c.tier_reset,
    brackets: (brkByC.get(c.id) ?? []).map((b) => ({ lowerUnits: n(b.lower_units), upperUnits: b.upper_units == null ? null : n(b.upper_units), ratePct: n(b.rate_pct) })),
    productIds: (cpByC.get(c.id) ?? []).map((x) => x.product_id),
    authors: (caByC.get(c.id) ?? []).map((x) => ({ authorId: x.author_id, share: n(x.share), advance: n(x.advance), advanceYear: x.advance_year ?? 0 })),
    startDate: c.start_date ?? "",
    endDate: c.end_date,
    status: c.status,
  }));

  const accrualsByContract = new Map<string, MonthlyAccrual[]>();
  for (const a of accD) {
    const arr = accrualsByContract.get(a.contract_id) ?? [];
    arr.push({ contractId: a.contract_id, periode: a.periode, boekjaar: a.boekjaar, omzet: n(a.omzet), aantal: n(a.aantal), royaltyCost: n(a.royalty_cost), effectiveRate: n(a.effective_rate) });
    accrualsByContract.set(a.contract_id, arr);
  }
  for (const arr of accrualsByContract.values()) arr.sort((x, y) => x.periode.localeCompare(y.periode));

  const ledByKey = new Map(ledD.map((l) => [`${l.contract_id}|${l.author_id}|${l.boekjaar}`, l]));
  const payoutsByContract = new Map<string, AnnualPayout[]>();
  for (const p of payD) {
    const l = ledByKey.get(`${p.contract_id}|${p.author_id}|${p.boekjaar}`);
    const arr = payoutsByContract.get(p.contract_id) ?? [];
    arr.push({
      contractId: p.contract_id, authorId: p.author_id, boekjaar: p.boekjaar,
      contractEarned: n(p.contract_earned), share: n(p.share), earnedAuthor: n(p.earned_author),
      advanceAdded: n(l?.advance_added), openingBalance: n(l?.opening_balance),
      recouped: n(l?.recouped), closingBalance: n(l?.closing_balance), payout: n(p.payout),
    });
    payoutsByContract.set(p.contract_id, arr);
  }

  return indexStore({ products, authors, contracts, accrualsByContract, payoutsByContract });
});

function store(): Promise<Store> | Store {
  return isDemoMode ? demoStore : loadSupabaseStore();
}

// --- Afgeleide types --------------------------------------------------------

export interface ContractSummary {
  contract: Contract;
  totalRevenue: number;
  totalRoyalty: number;
  productCount: number;
  authorCount: number;
  outstandingAdvance: number;
}

export interface ContractDetail {
  contract: Contract;
  products: Product[];
  authors: Array<{ author: Author; share: number; advance: number; advanceYear: number; outstanding: number }>;
  accruals: MonthlyAccrual[];
  payouts: AnnualPayout[];
  years: number[];
  totalRevenue: number;
  totalRoyalty: number;
  brackets: ReturnType<typeof effectiveBrackets>;
}

export interface AuthorPayoutRow extends AnnualPayout {
  contractNumber: string;
  contractName: string;
}

export interface AuthorDetail {
  author: Author;
  contracts: Array<{ contract: Contract; share: number; advance: number }>;
  payouts: AuthorPayoutRow[];
  totalEarned: number;
  totalPaid: number;
  outstanding: number;
}

export interface PayoutRunRow {
  author: Author;
  contract: Contract;
  earnedAuthor: number;
  openingBalance: number;
  recouped: number;
  closingBalance: number;
  payout: number;
}

export interface PayoutRun {
  year: number;
  rows: PayoutRunRow[];
  byAuthor: Array<{ author: Author; earned: number; payout: number; outstanding: number }>;
  totalPayout: number;
}

export interface AuthorStatement {
  author: Author;
  year: number;
  lines: Array<{ contract: Contract; earnedAuthor: number; openingBalance: number; recouped: number; closingBalance: number; payout: number }>;
  totalEarned: number;
  totalRecouped: number;
  totalPayout: number;
  totalOutstanding: number;
}

export interface Dashboard {
  contractsCount: number;
  authorsCount: number;
  productsCount: number;
  totalRevenue: number;
  totalRoyalty: number;
  outstandingAdvances: number;
  monthlyTrend: Array<{ periode: string; omzet: number; royalty: number }>;
  topContracts: Array<{ contract: Contract; royalty: number }>;
  payoutByYear: Array<{ year: number; payout: number }>;
}

// --- Shapers (werken op een Store) -----------------------------------------

function outstandingFor(s: Store, contractId: string, authorId: string): number {
  const rows = (s.payoutsByContract.get(contractId) ?? []).filter((p) => p.authorId === authorId);
  if (rows.length === 0) return 0;
  return rows.reduce((latest, r) => (r.boekjaar > latest.boekjaar ? r : latest)).closingBalance;
}

function summarize(s: Store, contract: Contract): ContractSummary {
  const acc = s.accrualsByContract.get(contract.id) ?? [];
  return {
    contract,
    totalRevenue: acc.reduce((x, a) => x + a.omzet, 0),
    totalRoyalty: acc.reduce((x, a) => x + a.royaltyCost, 0),
    productCount: contract.productIds.length,
    authorCount: contract.authors.length,
    outstandingAdvance: contract.authors.reduce((x, ca) => x + outstandingFor(s, contract.id, ca.authorId), 0),
  };
}

// --- Publieke async getters -------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  return (await store()).products;
}

export async function getAuthors(): Promise<Author[]> {
  return (await store()).authors;
}

export async function getContractSummaries(): Promise<ContractSummary[]> {
  const s = await store();
  return s.contracts.map((c) => summarize(s, c)).sort((a, b) => b.totalRoyalty - a.totalRoyalty);
}

export async function getContractDetail(id: string): Promise<ContractDetail | null> {
  const s = await store();
  const contract = s.contractById.get(id);
  if (!contract) return null;
  const acc = s.accrualsByContract.get(id) ?? [];
  return {
    contract,
    products: contract.productIds.map((pid) => s.productById.get(pid)).filter((p): p is Product => !!p),
    authors: contract.authors.map((ca) => ({
      author: s.authorById.get(ca.authorId)!,
      share: ca.share,
      advance: ca.advance,
      advanceYear: ca.advanceYear,
      outstanding: outstandingFor(s, id, ca.authorId),
    })),
    accruals: acc,
    payouts: s.payoutsByContract.get(id) ?? [],
    years: [...new Set(acc.map((a) => a.boekjaar))].sort(),
    totalRevenue: acc.reduce((x, a) => x + a.omzet, 0),
    totalRoyalty: acc.reduce((x, a) => x + a.royaltyCost, 0),
    brackets: effectiveBrackets(contract),
  };
}

export async function getAuthorDetail(id: string): Promise<AuthorDetail | null> {
  const s = await store();
  const author = s.authorById.get(id);
  if (!author) return null;
  const onContracts = s.contracts.filter((c) => c.authors.some((ca) => ca.authorId === id));
  const payouts: AuthorPayoutRow[] = [];
  for (const c of onContracts) {
    for (const p of s.payoutsByContract.get(c.id) ?? []) {
      if (p.authorId !== id) continue;
      payouts.push({ ...p, contractNumber: c.contractNumber, contractName: c.name });
    }
  }
  payouts.sort((a, b) => (a.boekjaar === b.boekjaar ? a.contractNumber.localeCompare(b.contractNumber) : a.boekjaar - b.boekjaar));
  return {
    author,
    contracts: onContracts.map((c) => {
      const ca = c.authors.find((x) => x.authorId === id)!;
      return { contract: c, share: ca.share, advance: ca.advance };
    }),
    payouts,
    totalEarned: payouts.reduce((x, p) => x + p.earnedAuthor, 0),
    totalPaid: payouts.reduce((x, p) => x + p.payout, 0),
    outstanding: onContracts.reduce((x, c) => x + outstandingFor(s, c.id, id), 0),
  };
}

export interface AuthorSummary {
  author: Author;
  contractCount: number;
  totalEarned: number;
  totalPaid: number;
  outstanding: number;
}

/** Per-auteur totalen in één pass (schaalt naar duizenden auteurs). */
export async function getAuthorSummaries(): Promise<AuthorSummary[]> {
  const s = await store();
  const byAuthor = new Map<string, AuthorSummary>();
  for (const a of s.authors) byAuthor.set(a.id, { author: a, contractCount: 0, totalEarned: 0, totalPaid: 0, outstanding: 0 });
  for (const c of s.contracts)
    for (const ca of c.authors) {
      const sum = byAuthor.get(ca.authorId);
      if (sum) sum.contractCount++;
    }
  for (const payouts of s.payoutsByContract.values()) {
    const latest = new Map<string, AnnualPayout>();
    for (const p of payouts) {
      const sum = byAuthor.get(p.authorId);
      if (sum) {
        sum.totalEarned += p.earnedAuthor;
        sum.totalPaid += p.payout;
      }
      const cur = latest.get(p.authorId);
      if (!cur || p.boekjaar > cur.boekjaar) latest.set(p.authorId, p);
    }
    for (const [aid, p] of latest) {
      const sum = byAuthor.get(aid);
      if (sum) sum.outstanding += p.closingBalance;
    }
  }
  return [...byAuthor.values()];
}

export async function getAvailableYears(): Promise<number[]> {
  const s = await store();
  const set = new Set<number>();
  for (const acc of s.accrualsByContract.values()) for (const a of acc) set.add(a.boekjaar);
  return [...set].sort((a, b) => b - a);
}

export async function getPayoutRun(year: number): Promise<PayoutRun> {
  const s = await store();
  const rows: PayoutRunRow[] = [];
  for (const c of s.contracts) {
    for (const p of s.payoutsByContract.get(c.id) ?? []) {
      if (p.boekjaar !== year) continue;
      rows.push({
        author: s.authorById.get(p.authorId)!,
        contract: c,
        earnedAuthor: p.earnedAuthor,
        openingBalance: p.openingBalance,
        recouped: p.recouped,
        closingBalance: p.closingBalance,
        payout: p.payout,
      });
    }
  }
  rows.sort((a, b) => authorName(a.author).localeCompare(authorName(b.author)));

  const byAuthorMap = new Map<string, { author: Author; earned: number; payout: number; outstanding: number }>();
  for (const r of rows) {
    const cur = byAuthorMap.get(r.author.id) ?? { author: r.author, earned: 0, payout: 0, outstanding: 0 };
    cur.earned += r.earnedAuthor;
    cur.payout += r.payout;
    cur.outstanding += r.closingBalance;
    byAuthorMap.set(r.author.id, cur);
  }
  return {
    year,
    rows,
    byAuthor: [...byAuthorMap.values()].sort((a, b) => authorName(a.author).localeCompare(authorName(b.author))),
    totalPayout: rows.reduce((x, r) => x + r.payout, 0),
  };
}

export async function getAuthorStatement(authorId: string, year: number): Promise<AuthorStatement | null> {
  const s = await store();
  const author = s.authorById.get(authorId);
  if (!author) return null;
  const lines: AuthorStatement["lines"] = [];
  for (const c of s.contracts) {
    for (const p of s.payoutsByContract.get(c.id) ?? []) {
      if (p.authorId !== authorId || p.boekjaar !== year) continue;
      lines.push({
        contract: c,
        earnedAuthor: p.earnedAuthor,
        openingBalance: p.openingBalance,
        recouped: p.recouped,
        closingBalance: p.closingBalance,
        payout: p.payout,
      });
    }
  }
  return {
    author,
    year,
    lines,
    totalEarned: lines.reduce((x, l) => x + l.earnedAuthor, 0),
    totalRecouped: lines.reduce((x, l) => x + l.recouped, 0),
    totalPayout: lines.reduce((x, l) => x + l.payout, 0),
    totalOutstanding: lines.reduce((x, l) => x + l.closingBalance, 0),
  };
}

export async function getDashboard(): Promise<Dashboard> {
  const s = await store();
  const summaries = s.contracts.map((c) => summarize(s, c));

  const trendMap = new Map<string, { omzet: number; royalty: number }>();
  for (const acc of s.accrualsByContract.values()) {
    for (const a of acc) {
      const cur = trendMap.get(a.periode) ?? { omzet: 0, royalty: 0 };
      cur.omzet += a.omzet;
      cur.royalty += a.royaltyCost;
      trendMap.set(a.periode, cur);
    }
  }
  const monthlyTrend = [...trendMap.entries()].map(([periode, v]) => ({ periode, ...v })).sort((a, b) => a.periode.localeCompare(b.periode));

  const payoutYearMap = new Map<number, number>();
  for (const payouts of s.payoutsByContract.values()) {
    for (const p of payouts) payoutYearMap.set(p.boekjaar, (payoutYearMap.get(p.boekjaar) ?? 0) + p.payout);
  }

  return {
    contractsCount: s.contracts.length,
    authorsCount: s.authors.length,
    productsCount: s.products.length,
    totalRevenue: summaries.reduce((x, y) => x + y.totalRevenue, 0),
    totalRoyalty: summaries.reduce((x, y) => x + y.totalRoyalty, 0),
    outstandingAdvances: summaries.reduce((x, y) => x + y.outstandingAdvance, 0),
    monthlyTrend,
    topContracts: summaries.map((x) => ({ contract: x.contract, royalty: x.totalRoyalty })).sort((a, b) => b.royalty - a.royalty),
    payoutByYear: [...payoutYearMap.entries()].map(([year, payout]) => ({ year, payout })).sort((a, b) => a.year - b.year),
  };
}

// --- Maandelijkse accrual per product (omzet x contract-royalty%) -----------
// Bewust de EENVOUDIGE maandkost: maandomzet x het (vaste) contract-royalty%,
// granulair per product. Een product op meerdere contracten levert per contract
// een regel (elk met eigen %). De staffel is voor de jaarlijkse auteur-payout,
// niet voor deze maandkost.

export interface ProductAccrualRow {
  productCode: string;
  productTitle: string;
  contractNumber: string;
  contractName: string;
  periode: string;
  boekjaar: number;
  omzet: number;
  aantal: number;
  ratePct: number;
  royaltyCost: number;
}

function sortAccrual(rows: ProductAccrualRow[]): ProductAccrualRow[] {
  return rows.sort((a, b) =>
    a.productCode !== b.productCode
      ? a.productCode.localeCompare(b.productCode)
      : a.contractNumber !== b.contractNumber
        ? a.contractNumber.localeCompare(b.contractNumber)
        : a.periode.localeCompare(b.periode),
  );
}

export async function getProductAccrual(opts?: { year?: number; contractId?: string }): Promise<ProductAccrualRow[]> {
  const rows: ProductAccrualRow[] = [];

  if (isDemoMode) {
    const prodById = new Map(demoProducts.map((p) => [p.id, p]));
    for (const c of demoContracts) {
      if (opts?.contractId && c.id !== opts.contractId) continue;
      const pset = new Set(c.productIds);
      for (const rl of revenueLines) {
        if (!pset.has(rl.productId)) continue;
        const boekjaar = Number(rl.periode.slice(0, 4));
        if (opts?.year && boekjaar !== opts.year) continue;
        const p = prodById.get(rl.productId)!;
        rows.push({
          productCode: p.code, productTitle: p.title,
          contractNumber: c.contractNumber, contractName: c.name,
          periode: rl.periode, boekjaar,
          omzet: rl.omzet, aantal: rl.aantal,
          ratePct: c.flatRatePct, royaltyCost: Math.round(rl.omzet * c.flatRatePct) / 100,
        });
      }
    }
    return sortAccrual(rows);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const db = await createClient();
  const [revD, cpD, contrD] = await Promise.all([
    fetchAll((f, t) => {
      const q = db.from("revenue_lines").select("product_id, periode, boekjaar, omzet, aantal, products(code, title)").range(f, t);
      return opts?.year ? q.eq("boekjaar", opts.year) : q;
    }, "revenue_lines"),
    fetchAll((f, t) => db.from("contract_products").select("contract_id, product_id").range(f, t), "contract_products"),
    fetchAll((f, t) => db.from("contracts").select("id, contract_number, name, flat_rate_pct").range(f, t), "contracts"),
  ]);

  const contractById = new Map(contrD.map((c) => [c.id, c]));
  const contractsByProduct = new Map<string, Array<{ id: string; contract_number: string; name: string; flat_rate_pct: unknown }>>();
  for (const x of cpD) {
    if (opts?.contractId && x.contract_id !== opts.contractId) continue;
    const c = contractById.get(x.contract_id);
    if (!c) continue;
    const arr = contractsByProduct.get(x.product_id) ?? [];
    arr.push(c);
    contractsByProduct.set(x.product_id, arr);
  }

  for (const r of revD) {
    const product = (r.products ?? {}) as { code?: string; title?: string };
    for (const c of contractsByProduct.get(r.product_id) ?? []) {
      const rate = n(c.flat_rate_pct);
      rows.push({
        productCode: product.code ?? "", productTitle: product.title ?? "",
        contractNumber: c.contract_number, contractName: c.name,
        periode: r.periode, boekjaar: r.boekjaar,
        omzet: n(r.omzet), aantal: n(r.aantal),
        ratePct: rate, royaltyCost: Math.round(n(r.omzet) * rate) / 100,
      });
    }
  }
  return sortAccrual(rows);
}
