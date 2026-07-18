// ============================================================================
// Data-facade — het ENIGE punt waar de UI data vandaan haalt.
//
// SUPABASE-modus: gepagineerde/gescopte queries op aggregatie-views
// (supabase/migrations/0008_views.sql). Elke pagina haalt alleen op wat hij
// toont → schaalt naar 100.000+ contracten.
// DEMO-modus (geen env): rekent live via de pure-TS engine over de kleine
// demo-dataset (in-memory store, JS-paginering).
// ============================================================================

import { computeAnnualPayouts, computeMonthlyAccruals, effectiveBrackets } from "@/lib/calc/engine";
import { authors as demoAuthors, contracts as demoContracts, products as demoProducts, revenueLines } from "@/lib/demo/data";
import type { AnnualPayout, Author, Contract, MonthlyAccrual, Product, RoyaltyModel } from "@/lib/types";

export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

const n = (v: unknown): number => (v == null ? 0 : Number(v));

export function authorName(a: { firstName: string; lastName: string }): string {
  return `${a.firstName} ${a.lastName}`;
}

/** Behouden voor compatibiliteit; met de nieuwe query-aanpak is er geen store-cache meer. */
export function bustDataCache() {}

// --- Paginering-helpers -----------------------------------------------------

export interface PageResult<T> {
  rows: T[];
  total: number;
}
export interface PageOpts {
  q?: string;
  page?: number;
  pageSize?: number;
}

function rangeOf(opts?: PageOpts, defaultSize = 30) {
  const pageSize = Math.max(1, opts?.pageSize ?? defaultSize);
  const page = Math.max(1, opts?.page ?? 1);
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
function paginate<T>(all: T[], opts?: PageOpts, defaultSize = 30): PageResult<T> {
  const pageSize = Math.max(1, opts?.pageSize ?? defaultSize);
  const page = Math.max(1, opts?.page ?? 1);
  return { rows: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
}
function term(q?: string): string {
  return (q ?? "").replace(/[%,()*]/g, " ").trim();
}
async function sdb() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, label: string): Promise<any[]> {
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

// --- Demo-store (klein, in geheugen) ---------------------------------------

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

const demoStore: Store = (() => {
  const accrualsByContract = new Map<string, MonthlyAccrual[]>();
  const payoutsByContract = new Map<string, AnnualPayout[]>();
  for (const c of demoContracts) {
    const acc = computeMonthlyAccruals(c, revenueLines);
    accrualsByContract.set(c.id, acc);
    payoutsByContract.set(c.id, computeAnnualPayouts(c, acc));
  }
  return {
    products: demoProducts,
    authors: demoAuthors,
    contracts: demoContracts,
    accrualsByContract,
    payoutsByContract,
    productById: new Map(demoProducts.map((p) => [p.id, p])),
    authorById: new Map(demoAuthors.map((a) => [a.id, a])),
    contractById: new Map(demoContracts.map((c) => [c.id, c])),
  };
})();

function demoOutstanding(contractId: string, authorId: string): number {
  const rows = (demoStore.payoutsByContract.get(contractId) ?? []).filter((p) => p.authorId === authorId);
  if (rows.length === 0) return 0;
  return rows.reduce((latest, r) => (r.boekjaar > latest.boekjaar ? r : latest)).closingBalance;
}

// --- Types ------------------------------------------------------------------

export interface ContractLite {
  id: string;
  contractNumber: string;
  name: string;
  flatRatePct: number;
  royaltyModel: RoyaltyModel;
  status: "active" | "ended";
}

export interface ContractSummary {
  contract: ContractLite;
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

export interface AuthorSummary {
  author: Author;
  contractCount: number;
  totalEarned: number;
  totalPaid: number;
  outstanding: number;
}

export interface AuthorPayoutRow extends AnnualPayout {
  contractNumber: string;
  contractName: string;
}

export interface AuthorDetail {
  author: Author;
  contracts: Array<{ contract: ContractLite; share: number; advance: number }>;
  payouts: AuthorPayoutRow[];
  totalEarned: number;
  totalPaid: number;
  outstanding: number;
}

export interface PayoutAuthorRow {
  author: { id: string; firstName: string; lastName: string; code: string };
  earned: number;
  payout: number;
  outstanding: number;
}
export interface PayoutRun {
  year: number;
  byAuthor: PayoutAuthorRow[];
  total: number;
  totalPayout: number;
}

export interface AuthorStatement {
  author: Author;
  year: number;
  lines: Array<{ contract: ContractLite; earnedAuthor: number; openingBalance: number; recouped: number; closingBalance: number; payout: number }>;
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
  topContracts: Array<{ name: string; royalty: number }>;
  payoutByYear: Array<{ year: number; payout: number }>;
}

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

// --- Shapers ----------------------------------------------------------------

function authorFrom(a: any): Author {
  return { id: a.id, code: a.code ?? "", firstName: a.first_name, lastName: a.last_name, email: a.email ?? "" };
}
function contractLiteFrom(c: any): ContractLite {
  return { id: c.id, contractNumber: c.contract_number, name: c.name, flatRatePct: n(c.flat_rate_pct), royaltyModel: c.royalty_model, status: c.status };
}
function contractSummaryFrom(r: any): ContractSummary {
  return {
    contract: contractLiteFrom(r),
    totalRevenue: n(r.total_revenue),
    totalRoyalty: n(r.total_royalty),
    productCount: n(r.product_count),
    authorCount: n(r.author_count),
    outstandingAdvance: n(r.outstanding_advance),
  };
}

// ============================================================================
// LIJSTEN (gepagineerd)
// ============================================================================

export async function getContractSummaries(opts?: PageOpts): Promise<PageResult<ContractSummary>> {
  if (isDemoMode) {
    const t = term(opts?.q).toLowerCase();
    const all = demoStore.contracts
      .map((c) => {
        const acc = demoStore.accrualsByContract.get(c.id) ?? [];
        return {
          contract: { id: c.id, contractNumber: c.contractNumber, name: c.name, flatRatePct: c.flatRatePct, royaltyModel: c.royaltyModel, status: c.status } as ContractLite,
          totalRevenue: acc.reduce((x, a) => x + a.omzet, 0),
          totalRoyalty: acc.reduce((x, a) => x + a.royaltyCost, 0),
          productCount: c.productIds.length,
          authorCount: c.authors.length,
          outstandingAdvance: c.authors.reduce((x, ca) => x + demoOutstanding(c.id, ca.authorId), 0),
        };
      })
      .filter((s) => !t || s.contract.contractNumber.toLowerCase().includes(t) || s.contract.name.toLowerCase().includes(t))
      .sort((a, b) => b.totalRoyalty - a.totalRoyalty);
    return paginate(all, opts, 25);
  }

  const db = await sdb();
  const { from, to } = rangeOf(opts, 25);
  let q = db.from("contract_summary").select("*", { count: "exact" });
  const t = term(opts?.q);
  if (t) q = q.or(`contract_number.ilike.%${t}%,name.ilike.%${t}%`);
  const { data, count, error } = await q.order("total_royalty", { ascending: false }).range(from, to);
  if (error) throw new Error(`contract_summary: ${error.message}`);
  return { rows: (data ?? []).map(contractSummaryFrom), total: count ?? 0 };
}

export async function getAuthorSummaries(opts?: PageOpts): Promise<PageResult<AuthorSummary>> {
  if (isDemoMode) {
    const t = term(opts?.q).toLowerCase();
    const byAuthor = new Map<string, AuthorSummary>();
    for (const a of demoStore.authors) byAuthor.set(a.id, { author: a, contractCount: 0, totalEarned: 0, totalPaid: 0, outstanding: 0 });
    for (const c of demoStore.contracts) for (const ca of c.authors) byAuthor.get(ca.authorId)!.contractCount++;
    for (const payouts of demoStore.payoutsByContract.values()) {
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
      for (const [aid, p] of latest) byAuthor.get(aid)!.outstanding += p.closingBalance;
    }
    const all = [...byAuthor.values()]
      .filter((s) => !t || authorName(s.author).toLowerCase().includes(t) || s.author.code.toLowerCase().includes(t) || (s.author.email ?? "").toLowerCase().includes(t))
      .sort((a, b) => authorName(a.author).localeCompare(authorName(b.author)));
    return paginate(all, opts, 30);
  }

  const db = await sdb();
  const { from, to } = rangeOf(opts, 30);
  let q = db.from("author_summary").select("*", { count: "exact" });
  const t = term(opts?.q);
  if (t) q = q.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,code.ilike.%${t}%,email.ilike.%${t}%`);
  const { data, count, error } = await q.order("last_name", { ascending: true }).order("first_name", { ascending: true }).range(from, to);
  if (error) throw new Error(`author_summary: ${error.message}`);
  const rows: AuthorSummary[] = (data ?? []).map((r: any) => ({
    author: authorFrom(r),
    contractCount: n(r.contract_count),
    totalEarned: n(r.total_earned),
    totalPaid: n(r.total_paid),
    outstanding: n(r.outstanding),
  }));
  return { rows, total: count ?? 0 };
}

export interface ProductWithContracts {
  product: Product;
  contracts: Array<{ id: string; contractNumber: string }>;
}

export async function getProductsPage(opts?: PageOpts): Promise<PageResult<ProductWithContracts>> {
  if (isDemoMode) {
    const t = term(opts?.q).toLowerCase();
    const byProduct = new Map<string, Array<{ id: string; contractNumber: string }>>();
    for (const c of demoStore.contracts) for (const pid of c.productIds) {
      const arr = byProduct.get(pid) ?? [];
      arr.push({ id: c.id, contractNumber: c.contractNumber });
      byProduct.set(pid, arr);
    }
    const all = demoStore.products
      .filter((p) => !t || p.title.toLowerCase().includes(t) || p.code.toLowerCase().includes(t))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((product) => ({ product, contracts: byProduct.get(product.id) ?? [] }));
    return paginate(all, opts, 40);
  }

  const db = await sdb();
  const { from, to } = rangeOf(opts, 40);
  let q = db.from("products").select("id, code, title", { count: "exact" });
  const t = term(opts?.q);
  if (t) q = q.or(`code.ilike.%${t}%,title.ilike.%${t}%`);
  const { data, count, error } = await q.order("code", { ascending: true }).range(from, to);
  if (error) throw new Error(`products: ${error.message}`);
  const products: Product[] = (data ?? []).map((p: any) => ({ id: p.id, code: p.code, title: p.title }));

  const byProduct = new Map<string, Array<{ id: string; contractNumber: string }>>();
  if (products.length) {
    const { data: links, error: le } = await db
      .from("contract_products")
      .select("product_id, contracts(id, contract_number)")
      .in("product_id", products.map((p) => p.id));
    if (le) throw new Error(`contract_products: ${le.message}`);
    for (const l of (links ?? []) as any[]) {
      const c = l.contracts;
      if (!c) continue;
      const arr = byProduct.get(l.product_id) ?? [];
      arr.push({ id: c.id, contractNumber: c.contract_number });
      byProduct.set(l.product_id, arr);
    }
  }
  return { rows: products.map((product) => ({ product, contracts: byProduct.get(product.id) ?? [] })), total: count ?? 0 };
}

// Volledige lijsten voor formulier-dropdowns / filters.
export async function getProducts(): Promise<Product[]> {
  if (isDemoMode) return demoStore.products;
  const db = await sdb();
  const rows = await fetchAll((f, t) => db.from("products").select("id, code, title").order("code").range(f, t), "products");
  return rows.map((p) => ({ id: p.id, code: p.code, title: p.title }));
}
export async function getAuthors(): Promise<Author[]> {
  if (isDemoMode) return demoStore.authors;
  const db = await sdb();
  const rows = await fetchAll((f, t) => db.from("authors").select("id, code, first_name, last_name, email").order("last_name").range(f, t), "authors");
  return rows.map(authorFrom);
}
export async function getContractsForFilter(): Promise<Array<{ id: string; label: string }>> {
  if (isDemoMode) return demoStore.contracts.map((c) => ({ id: c.id, label: `${c.contractNumber} — ${c.name}` }));
  const db = await sdb();
  const rows = await fetchAll((f, t) => db.from("contracts").select("id, contract_number, name").order("contract_number").range(f, t), "contracts");
  return rows.map((c) => ({ id: c.id, label: `${c.contract_number} — ${c.name}` }));
}

export async function getAvailableYears(): Promise<number[]> {
  if (isDemoMode) {
    const set = new Set<number>();
    for (const acc of demoStore.accrualsByContract.values()) for (const a of acc) set.add(a.boekjaar);
    return [...set].sort((a, b) => b - a);
  }
  const db = await sdb();
  const { data, error } = await db.from("boekjaren").select("boekjaar");
  if (error) throw new Error(`boekjaren: ${error.message}`);
  return (data ?? []).map((r: any) => n(r.boekjaar)).sort((a, b) => b - a);
}

// ============================================================================
// DETAILS (gescopt)
// ============================================================================

export async function getContractDetail(id: string): Promise<ContractDetail | null> {
  if (isDemoMode) {
    const contract = demoStore.contractById.get(id);
    if (!contract) return null;
    const acc = demoStore.accrualsByContract.get(id) ?? [];
    return {
      contract,
      products: contract.productIds.map((pid) => demoStore.productById.get(pid)).filter((p): p is Product => !!p),
      authors: contract.authors.map((ca) => ({ author: demoStore.authorById.get(ca.authorId)!, share: ca.share, advance: ca.advance, advanceYear: ca.advanceYear, outstanding: demoOutstanding(id, ca.authorId) })),
      accruals: acc,
      payouts: demoStore.payoutsByContract.get(id) ?? [],
      years: [...new Set(acc.map((a) => a.boekjaar))].sort(),
      totalRevenue: acc.reduce((x, a) => x + a.omzet, 0),
      totalRoyalty: acc.reduce((x, a) => x + a.royaltyCost, 0),
      brackets: effectiveBrackets(contract),
    };
  }

  const db = await sdb();
  const { data: c, error } = await db.from("contracts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`contract: ${error.message}`);
  if (!c) return null;

  const [brk, cp, ca, acc, pay, led] = await Promise.all([
    db.from("tier_brackets").select("lower_units, upper_units, rate_pct").eq("contract_id", id),
    db.from("contract_products").select("products(id, code, title)").eq("contract_id", id),
    db.from("contract_authors").select("share, advance, advance_year, authors(id, code, first_name, last_name, email)").eq("contract_id", id),
    db.from("accrual_monthly").select("contract_id, periode, boekjaar, omzet, aantal, royalty_cost, effective_rate").eq("contract_id", id),
    db.from("payout_annual").select("contract_id, author_id, boekjaar, contract_earned, share, earned_author, payout").eq("contract_id", id),
    db.from("advance_ledger").select("author_id, boekjaar, advance_added, opening_balance, recouped, closing_balance").eq("contract_id", id),
  ]);
  for (const r of [brk, cp, ca, acc, pay, led]) if (r.error) throw new Error(`contract-detail: ${r.error.message}`);

  const products: Product[] = (cp.data ?? []).map((x: any) => x.products).filter(Boolean).map((p: any) => ({ id: p.id, code: p.code, title: p.title }));
  const contract: Contract = {
    id: c.id, contractNumber: c.contract_number, name: c.name, flatRatePct: n(c.flat_rate_pct),
    royaltyModel: c.royalty_model, tierAccumulator: c.tier_accumulator, tierReset: c.tier_reset,
    brackets: (brk.data ?? []).map((b: any) => ({ lowerUnits: n(b.lower_units), upperUnits: b.upper_units == null ? null : n(b.upper_units), ratePct: n(b.rate_pct) })),
    productIds: products.map((p) => p.id),
    authors: (ca.data ?? []).map((x: any) => ({ authorId: x.authors?.id, share: n(x.share), advance: n(x.advance), advanceYear: x.advance_year ?? 0 })),
    startDate: c.start_date ?? "", endDate: c.end_date, status: c.status,
  };

  // openstaand voorschot per auteur = closing van laatste boekjaar
  const latestLed = new Map<string, any>();
  for (const l of (led.data ?? []) as any[]) {
    const cur = latestLed.get(l.author_id);
    if (!cur || l.boekjaar > cur.boekjaar) latestLed.set(l.author_id, l);
  }
  const ledByKey = new Map((led.data ?? []).map((l: any) => [`${l.author_id}|${l.boekjaar}`, l]));

  const authors = (ca.data ?? []).map((x: any) => ({
    author: authorFrom(x.authors),
    share: n(x.share),
    advance: n(x.advance),
    advanceYear: x.advance_year ?? 0,
    outstanding: n(latestLed.get(x.authors?.id)?.closing_balance),
  }));

  const accruals: MonthlyAccrual[] = (acc.data ?? []).map((a: any) => ({ contractId: a.contract_id, periode: a.periode, boekjaar: a.boekjaar, omzet: n(a.omzet), aantal: n(a.aantal), royaltyCost: n(a.royalty_cost), effectiveRate: n(a.effective_rate) })).sort((x, y) => x.periode.localeCompare(y.periode));
  const payouts: AnnualPayout[] = (pay.data ?? []).map((p: any) => {
    const l = ledByKey.get(`${p.author_id}|${p.boekjaar}`);
    return { contractId: p.contract_id, authorId: p.author_id, boekjaar: p.boekjaar, contractEarned: n(p.contract_earned), share: n(p.share), earnedAuthor: n(p.earned_author), advanceAdded: n(l?.advance_added), openingBalance: n(l?.opening_balance), recouped: n(l?.recouped), closingBalance: n(l?.closing_balance), payout: n(p.payout) };
  });

  return {
    contract, products, authors, accruals, payouts,
    years: [...new Set(accruals.map((a) => a.boekjaar))].sort(),
    totalRevenue: accruals.reduce((x, a) => x + a.omzet, 0),
    totalRoyalty: accruals.reduce((x, a) => x + a.royaltyCost, 0),
    brackets: effectiveBrackets(contract),
  };
}

export async function getAuthorDetail(id: string): Promise<AuthorDetail | null> {
  if (isDemoMode) {
    const author = demoStore.authorById.get(id);
    if (!author) return null;
    const onContracts = demoStore.contracts.filter((c) => c.authors.some((ca) => ca.authorId === id));
    const payouts: AuthorPayoutRow[] = [];
    for (const c of onContracts) for (const p of demoStore.payoutsByContract.get(c.id) ?? []) {
      if (p.authorId === id) payouts.push({ ...p, contractNumber: c.contractNumber, contractName: c.name });
    }
    payouts.sort((a, b) => (a.boekjaar === b.boekjaar ? a.contractNumber.localeCompare(b.contractNumber) : a.boekjaar - b.boekjaar));
    return {
      author,
      contracts: onContracts.map((c) => ({ contract: { id: c.id, contractNumber: c.contractNumber, name: c.name, flatRatePct: c.flatRatePct, royaltyModel: c.royaltyModel, status: c.status }, share: c.authors.find((x) => x.authorId === id)!.share, advance: c.authors.find((x) => x.authorId === id)!.advance })),
      payouts,
      totalEarned: payouts.reduce((x, p) => x + p.earnedAuthor, 0),
      totalPaid: payouts.reduce((x, p) => x + p.payout, 0),
      outstanding: onContracts.reduce((x, c) => x + demoOutstanding(c.id, id), 0),
    };
  }

  const db = await sdb();
  const { data: au, error } = await db.from("authors").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`author: ${error.message}`);
  if (!au) return null;

  const [ca, pay, led] = await Promise.all([
    db.from("contract_authors").select("share, advance, contracts(id, contract_number, name, flat_rate_pct, royalty_model, status)").eq("author_id", id),
    db.from("payout_annual").select("contract_id, author_id, boekjaar, contract_earned, share, earned_author, payout, contracts(contract_number, name)").eq("author_id", id),
    db.from("advance_ledger").select("contract_id, boekjaar, advance_added, opening_balance, recouped, closing_balance").eq("author_id", id),
  ]);
  for (const r of [ca, pay, led]) if (r.error) throw new Error(`author-detail: ${r.error.message}`);

  const ledByKey = new Map((led.data ?? []).map((l: any) => [`${l.contract_id}|${l.boekjaar}`, l]));
  const payouts: AuthorPayoutRow[] = (pay.data ?? []).map((p: any) => {
    const l = ledByKey.get(`${p.contract_id}|${p.boekjaar}`);
    return { contractId: p.contract_id, authorId: p.author_id, boekjaar: p.boekjaar, contractEarned: n(p.contract_earned), share: n(p.share), earnedAuthor: n(p.earned_author), advanceAdded: n(l?.advance_added), openingBalance: n(l?.opening_balance), recouped: n(l?.recouped), closingBalance: n(l?.closing_balance), payout: n(p.payout), contractNumber: p.contracts?.contract_number ?? "", contractName: p.contracts?.name ?? "" };
  });
  payouts.sort((a, b) => (a.boekjaar === b.boekjaar ? a.contractNumber.localeCompare(b.contractNumber) : a.boekjaar - b.boekjaar));

  // openstaand per contract = closing van laatste boekjaar
  const latestByContract = new Map<string, any>();
  for (const l of (led.data ?? []) as any[]) {
    const cur = latestByContract.get(l.contract_id);
    if (!cur || l.boekjaar > cur.boekjaar) latestByContract.set(l.contract_id, l);
  }
  const outstanding = [...latestByContract.values()].reduce((x, l) => x + n(l.closing_balance), 0);

  return {
    author: authorFrom(au),
    contracts: (ca.data ?? []).map((x: any) => ({ contract: contractLiteFrom(x.contracts), share: n(x.share), advance: n(x.advance) })),
    payouts,
    totalEarned: payouts.reduce((x, p) => x + p.earnedAuthor, 0),
    totalPaid: payouts.reduce((x, p) => x + p.payout, 0),
    outstanding,
  };
}

export async function getAuthorStatement(authorId: string, year: number): Promise<AuthorStatement | null> {
  if (isDemoMode) {
    const author = demoStore.authorById.get(authorId);
    if (!author) return null;
    const lines: AuthorStatement["lines"] = [];
    for (const c of demoStore.contracts) for (const p of demoStore.payoutsByContract.get(c.id) ?? []) {
      if (p.authorId === authorId && p.boekjaar === year) {
        lines.push({ contract: { id: c.id, contractNumber: c.contractNumber, name: c.name, flatRatePct: c.flatRatePct, royaltyModel: c.royaltyModel, status: c.status }, earnedAuthor: p.earnedAuthor, openingBalance: p.openingBalance, recouped: p.recouped, closingBalance: p.closingBalance, payout: p.payout });
      }
    }
    return statementTotals(author, year, lines);
  }

  const db = await sdb();
  const { data: au, error } = await db.from("authors").select("*").eq("id", authorId).maybeSingle();
  if (error) throw new Error(`author: ${error.message}`);
  if (!au) return null;
  const [pay, led] = await Promise.all([
    db.from("payout_annual").select("contract_id, earned_author, payout, contracts(id, contract_number, name, flat_rate_pct, royalty_model, status)").eq("author_id", authorId).eq("boekjaar", year),
    db.from("advance_ledger").select("contract_id, opening_balance, recouped, closing_balance").eq("author_id", authorId).eq("boekjaar", year),
  ]);
  for (const r of [pay, led]) if (r.error) throw new Error(`statement: ${r.error.message}`);
  const ledByContract = new Map((led.data ?? []).map((l: any) => [l.contract_id, l]));
  const lines: AuthorStatement["lines"] = (pay.data ?? []).map((p: any) => {
    const l = ledByContract.get(p.contract_id);
    return { contract: contractLiteFrom(p.contracts), earnedAuthor: n(p.earned_author), openingBalance: n(l?.opening_balance), recouped: n(l?.recouped), closingBalance: n(l?.closing_balance), payout: n(p.payout) };
  });
  return statementTotals(authorFrom(au), year, lines);
}

function statementTotals(author: Author, year: number, lines: AuthorStatement["lines"]): AuthorStatement {
  return {
    author, year, lines,
    totalEarned: lines.reduce((x, l) => x + l.earnedAuthor, 0),
    totalRecouped: lines.reduce((x, l) => x + l.recouped, 0),
    totalPayout: lines.reduce((x, l) => x + l.payout, 0),
    totalOutstanding: lines.reduce((x, l) => x + l.closingBalance, 0),
  };
}

// ============================================================================
// UITBETALINGEN (per jaar, gepagineerd)
// ============================================================================

export async function getPayoutRun(year: number, opts?: PageOpts): Promise<PayoutRun> {
  if (isDemoMode) {
    const byAuthor = new Map<string, PayoutAuthorRow>();
    for (const payouts of demoStore.payoutsByContract.values()) for (const p of payouts) {
      if (p.boekjaar !== year) continue;
      const a = demoStore.authorById.get(p.authorId)!;
      const cur = byAuthor.get(p.authorId) ?? { author: { id: a.id, firstName: a.firstName, lastName: a.lastName, code: a.code }, earned: 0, payout: 0, outstanding: 0 };
      cur.earned += p.earnedAuthor;
      cur.payout += p.payout;
      cur.outstanding += p.closingBalance;
      byAuthor.set(p.authorId, cur);
    }
    const t = term(opts?.q).toLowerCase();
    const all = [...byAuthor.values()]
      .filter((r) => !t || authorName(r.author).toLowerCase().includes(t) || r.author.code.toLowerCase().includes(t))
      .sort((a, b) => authorName(a.author).localeCompare(authorName(b.author)));
    const totalPayout = [...byAuthor.values()].reduce((x, r) => x + r.payout, 0);
    const pageRes = paginate(all, opts, 30);
    return { year, byAuthor: pageRes.rows, total: pageRes.total, totalPayout };
  }

  const db = await sdb();
  const { from, to } = rangeOf(opts, 30);
  let q = db.from("payout_author_year").select("*", { count: "exact" }).eq("boekjaar", year);
  const t = term(opts?.q);
  if (t) q = q.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,code.ilike.%${t}%`);
  const [{ data, count, error }, totalRes] = await Promise.all([
    q.order("last_name", { ascending: true }).order("first_name", { ascending: true }).range(from, to),
    db.from("payout_by_year").select("payout").eq("boekjaar", year).maybeSingle(),
  ]);
  if (error) throw new Error(`payout_author_year: ${error.message}`);
  const byAuthor: PayoutAuthorRow[] = (data ?? []).map((r: any) => ({
    author: { id: r.author_id, firstName: r.first_name, lastName: r.last_name, code: r.code },
    earned: n(r.earned),
    payout: n(r.payout),
    outstanding: n(r.outstanding),
  }));
  return { year, byAuthor, total: count ?? 0, totalPayout: n(totalRes.data?.payout) };
}

// ============================================================================
// DASHBOARD
// ============================================================================

export async function getDashboard(): Promise<Dashboard> {
  if (isDemoMode) {
    const summaries = await getContractSummaries({ pageSize: 100000 });
    const trendMap = new Map<string, { omzet: number; royalty: number }>();
    for (const acc of demoStore.accrualsByContract.values()) for (const a of acc) {
      const cur = trendMap.get(a.periode) ?? { omzet: 0, royalty: 0 };
      cur.omzet += a.omzet;
      cur.royalty += a.royaltyCost;
      trendMap.set(a.periode, cur);
    }
    const payoutYearMap = new Map<number, number>();
    for (const payouts of demoStore.payoutsByContract.values()) for (const p of payouts) payoutYearMap.set(p.boekjaar, (payoutYearMap.get(p.boekjaar) ?? 0) + p.payout);
    return {
      contractsCount: demoStore.contracts.length,
      authorsCount: demoStore.authors.length,
      productsCount: demoStore.products.length,
      totalRevenue: summaries.rows.reduce((x, y) => x + y.totalRevenue, 0),
      totalRoyalty: summaries.rows.reduce((x, y) => x + y.totalRoyalty, 0),
      outstandingAdvances: summaries.rows.reduce((x, y) => x + y.outstandingAdvance, 0),
      monthlyTrend: [...trendMap.entries()].map(([periode, v]) => ({ periode, ...v })).sort((a, b) => a.periode.localeCompare(b.periode)),
      topContracts: summaries.rows.map((s) => ({ name: s.contract.name, royalty: s.totalRoyalty })).sort((a, b) => b.royalty - a.royalty).slice(0, 10),
      payoutByYear: [...payoutYearMap.entries()].map(([year, payout]) => ({ year, payout })).sort((a, b) => a.year - b.year),
    };
  }

  const db = await sdb();
  const [kpi, trend, top, py] = await Promise.all([
    db.from("dashboard_kpis").select("*").maybeSingle(),
    db.from("monthly_trend").select("*"),
    db.from("contract_summary").select("name, total_royalty").order("total_royalty", { ascending: false }).limit(10),
    db.from("payout_by_year").select("*"),
  ]);
  for (const r of [kpi, trend, top, py]) if (r.error) throw new Error(`dashboard: ${r.error.message}`);
  const k = kpi.data ?? {};
  return {
    contractsCount: n(k.contracts_count),
    authorsCount: n(k.authors_count),
    productsCount: n(k.products_count),
    totalRevenue: n(k.total_revenue),
    totalRoyalty: n(k.total_royalty),
    outstandingAdvances: n(k.outstanding_advances),
    monthlyTrend: (trend.data ?? []).map((t: any) => ({ periode: t.periode, omzet: n(t.omzet), royalty: n(t.royalty) })).sort((a, b) => a.periode.localeCompare(b.periode)),
    topContracts: (top.data ?? []).map((t: any) => ({ name: t.name, royalty: n(t.total_royalty) })),
    payoutByYear: (py.data ?? []).map((r: any) => ({ year: n(r.boekjaar), payout: n(r.payout) })).sort((a, b) => a.year - b.year),
  };
}

// ============================================================================
// MAANDELIJKSE ACCRUAL (per product, gepagineerd + export)
// ============================================================================

function demoAccrualAll(opts?: { year?: number; contractId?: string }): ProductAccrualRow[] {
  const prodById = new Map(demoProducts.map((p) => [p.id, p]));
  const rows: ProductAccrualRow[] = [];
  for (const c of demoContracts) {
    if (opts?.contractId && c.id !== opts.contractId) continue;
    const pset = new Set(c.productIds);
    for (const rl of revenueLines) {
      if (!pset.has(rl.productId)) continue;
      const boekjaar = Number(rl.periode.slice(0, 4));
      if (opts?.year && boekjaar !== opts.year) continue;
      const p = prodById.get(rl.productId)!;
      rows.push({ productCode: p.code, productTitle: p.title, contractNumber: c.contractNumber, contractName: c.name, periode: rl.periode, boekjaar, omzet: rl.omzet, aantal: rl.aantal, ratePct: c.flatRatePct, royaltyCost: Math.round(rl.omzet * c.flatRatePct) / 100 });
    }
  }
  return rows.sort((a, b) => (a.productCode !== b.productCode ? a.productCode.localeCompare(b.productCode) : a.contractNumber !== b.contractNumber ? a.contractNumber.localeCompare(b.contractNumber) : a.periode.localeCompare(b.periode)));
}
function accrualRowFrom(r: any): ProductAccrualRow {
  return { productCode: r.product_code, productTitle: r.product_title, contractNumber: r.contract_number, contractName: r.contract_name, periode: r.periode, boekjaar: n(r.boekjaar), omzet: n(r.omzet), aantal: n(r.aantal), ratePct: n(r.rate_pct), royaltyCost: n(r.royalty_cost) };
}
function accrualQuery(db: any, opts?: { year?: number; contractId?: string }) {
  let q = db.from("product_accrual").select("*", { count: "exact" });
  if (opts?.year) q = q.eq("boekjaar", opts.year);
  if (opts?.contractId) q = q.eq("contract_id", opts.contractId);
  return q.order("product_code", { ascending: true }).order("contract_number", { ascending: true }).order("periode", { ascending: true });
}

export async function getProductAccrual(opts?: { year?: number; contractId?: string; page?: number; pageSize?: number }): Promise<PageResult<ProductAccrualRow>> {
  if (isDemoMode) return paginate(demoAccrualAll(opts), opts, 100);
  const db = await sdb();
  const { from, to } = rangeOf(opts, 100);
  const { data, count, error } = await accrualQuery(db, opts).range(from, to);
  if (error) throw new Error(`product_accrual: ${error.message}`);
  return { rows: (data ?? []).map(accrualRowFrom), total: count ?? 0 };
}

export async function getProductAccrualAll(opts?: { year?: number; contractId?: string }): Promise<ProductAccrualRow[]> {
  if (isDemoMode) return demoAccrualAll(opts);
  const db = await sdb();
  const rows = await fetchAll((f, t) => {
    let q = db.from("product_accrual").select("*").order("product_code").order("contract_number").order("periode").range(f, t);
    if (opts?.year) q = q.eq("boekjaar", opts.year);
    if (opts?.contractId) q = q.eq("contract_id", opts.contractId);
    return q;
  }, "product_accrual");
  return rows.map(accrualRowFrom);
}

export async function getAccrualTotals(opts?: { year?: number; contractId?: string }): Promise<{ omzet: number; royalty: number }> {
  if (isDemoMode) {
    const rows = demoAccrualAll(opts);
    return { omzet: rows.reduce((s, r) => s + r.omzet, 0), royalty: rows.reduce((s, r) => s + r.royaltyCost, 0) };
  }
  const db = await sdb();
  let q = db.from("product_accrual_totals").select("omzet, royalty");
  if (opts?.year) q = q.eq("boekjaar", opts.year);
  if (opts?.contractId) q = q.eq("contract_id", opts.contractId);
  const { data, error } = await q;
  if (error) throw new Error(`product_accrual_totals: ${error.message}`);
  const rows = (data ?? []) as any[];
  return { omzet: rows.reduce((s, r) => s + n(r.omzet), 0), royalty: rows.reduce((s, r) => s + n(r.royalty), 0) };
}
