// ============================================================================
// seed_test.ts — Grote schaal-testdataset in Supabase.
//
//   npm run seed-test
//
// ~600 producten, ~1000 auteurs, 100 contracten (gemiddeld 10 producten en
// 20 auteurs per contract), mix vast/staffel, voorschotten, ~21.600 omzet-
// regels. Deterministisch (seeded RNG) zodat herhaald draaien stabiel is.
// WIPET eerst de bestaande domein-data.
// ============================================================================

import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Ontbrekend: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// --- Deterministische RNG ---------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260718);
const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

// --- Helpers ---------------------------------------------------------------
const chk = (res: { error: PostgrestError | null }, waar: string) => {
  if (res.error) throw new Error(`${waar}: ${res.error.message}`);
};
async function insertAll(table: string, rows: Record<string, unknown>[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) chk(await db.from(table).insert(rows.slice(i, i + chunk)), `${table} insert`);
}
async function selectAll(table: string, cols: string): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from(table).select(cols).range(from, from + page - 1);
    if (error) throw new Error(`${table} select: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

// --- Pools ------------------------------------------------------------------
const subjects = ["Wiskunde", "Nederlands", "Engels", "Biologie", "Natuurkunde", "Scheikunde", "Geschiedenis", "Aardrijkskunde", "Economie", "Frans", "Duits", "Maatschappijleer", "Filosofie", "Informatica", "NaSk", "Techniek", "Latijn", "Grieks", "Bedrijfseconomie", "Kunst"];
const levels = ["vmbo", "havo", "vwo", "onderbouw", "bovenbouw"];
const variants = ["leerboek", "werkboek deel 1", "werkboek deel 2", "practicumboek", "examenbundel", "digitaal"];
const firstNames = ["Anne", "Bram", "Carla", "Daan", "Eva", "Femke", "Gijs", "Hanne", "Iris", "Joost", "Karin", "Lars", "Maud", "Niels", "Olga", "Pim", "Quinten", "Roos", "Sanne", "Tom", "Ulrike", "Vera", "Wouter", "Xander", "Yara", "Zoë", "Bas", "Cato", "Dirk", "Els", "Floris", "Guus", "Hilde", "Ivo", "Jasmijn", "Koen", "Lotte", "Milan", "Noor", "Otto"];
const lastNames = ["de Vries", "Jansen", "Bakker", "Smit", "Mulder", "Visser", "Post", "de Boer", "Vermeer", "Willems", "Hendriks", "van Dijk", "Meijer", "de Jong", "Bos", "Peters", "Kok", "van den Berg", "Dekker", "Brouwer", "van Leeuwen", "Timmermans", "de Groot", "Kuipers", "Scholten", "van der Meer", "Prins", "Huisman", "Verhoeven", "Kramer", "van Dam", "Schouten", "Blom", "Wolters", "Maas", "de Wit", "Evers", "Sanders", "Vos", "Koster"];

const N_PRODUCTS = 600;
const N_AUTHORS = 1000;
const N_CONTRACTS = 100;
const YEARS = [2024, 2025, 2026];
const seasonal = [0.7, 0.6, 0.8, 0.9, 1.0, 1.1, 1.6, 2.0, 1.7, 1.1, 0.9, 0.7];

// verdeel n aandelen die exact op 100 uitkomen (4 decimalen)
function shares(n: number): number[] {
  const w = Array.from({ length: n }, () => 0.5 + rand());
  const tot = w.reduce((s, x) => s + x, 0);
  const raw = w.map((x) => Math.round((x / tot) * 1000000) / 10000); // op 4 decimalen
  const diff = Math.round((100 - raw.reduce((s, x) => s + x, 0)) * 10000) / 10000;
  raw[0] = Math.round((raw[0] + diff) * 10000) / 10000;
  return raw;
}

async function main() {
  console.log("Wipen van bestaande domein-data...");
  const Z = "00000000-0000-0000-0000-000000000000";
  chk(await db.from("contracts").delete().neq("id", Z), "wipe contracts");
  chk(await db.from("products").delete().neq("id", Z), "wipe products");
  chk(await db.from("authors").delete().neq("id", Z), "wipe authors");

  // Producten
  console.log(`Genereren van ${N_PRODUCTS} producten...`);
  const productRows = Array.from({ length: N_PRODUCTS }, (_, i) => {
    const subj = subjects[i % subjects.length];
    return { code: String(10001 + i), title: `${subj} ${pick(levels)} — ${pick(variants)}` };
  });
  await insertAll("products", productRows);

  // Auteurs
  console.log(`Genereren van ${N_AUTHORS} auteurs...`);
  // first = i % 40, last = floor(i/40) % 40 -> 40x40 = 1600 combinaties, dus uniek voor 1000 auteurs.
  const authorRows = Array.from({ length: N_AUTHORS }, (_, i) => ({
    code: String(1000001 + i),
    first_name: firstNames[i % firstNames.length],
    last_name: lastNames[Math.floor(i / firstNames.length) % lastNames.length],
    email: `auteur${1000001 + i}@example.nl`,
  }));
  await insertAll("authors", authorRows);

  // id-maps ophalen (paginerend; >1000 rijen)
  const dbProducts = await selectAll("products", "id, code");
  const dbAuthors = await selectAll("authors", "id, code");
  const productId = new Map(dbProducts.map((p) => [p.code, p.id as string]));
  const authorId = new Map(dbAuthors.map((a) => [a.code, a.id as string]));
  const productCodes = productRows.map((p) => p.code);
  const authorCodes = authorRows.map((a) => a.code);

  // Contracten + koppels
  console.log(`Genereren van ${N_CONTRACTS} contracten (~10 producten, ~20 auteurs elk)...`);
  const contractRows: Record<string, unknown>[] = [];
  for (let i = 0; i < N_CONTRACTS; i++) {
    const tiered = rand() < 0.3;
    const base = ri(6, 14);
    contractRows.push({
      contract_number: `RP_${String(20001 + i)}`,
      name: `${pick(subjects)} methode ${i + 1}`,
      flat_rate_pct: base,
      royalty_model: tiered ? "tiered" : "flat",
      tier_accumulator: "contract",
      tier_reset: "year",
      start_date: `${pick(YEARS)}-01-01`,
      status: "active",
    });
  }
  await insertAll("contracts", contractRows);
  const dbContracts = await selectAll("contracts", "id, contract_number, flat_rate_pct, royalty_model");
  const contractByNr = new Map(dbContracts.map((c) => [c.contract_number, c]));

  const brackets: Record<string, unknown>[] = [];
  const cp: Record<string, unknown>[] = [];
  const ca: Record<string, unknown>[] = [];

  const takeDistinct = (codes: string[], n: number): string[] => {
    const set = new Set<string>();
    let guard = 0;
    while (set.size < n && guard++ < n * 5) set.add(pick(codes));
    return [...set];
  };

  for (const cr of contractRows) {
    const c = contractByNr.get(cr.contract_number as string);
    if (!c) continue;
    const cid = c.id as string;

    if (c.royalty_model === "tiered") {
      const b = Number(c.flat_rate_pct);
      brackets.push(
        { contract_id: cid, lower_units: 0, upper_units: 5000, rate_pct: b },
        { contract_id: cid, lower_units: 5000, upper_units: 10000, rate_pct: b + 2 },
        { contract_id: cid, lower_units: 10000, upper_units: null, rate_pct: b + 4 },
      );
    }

    for (const code of takeDistinct(productCodes, ri(6, 14))) cp.push({ contract_id: cid, product_id: productId.get(code) });

    const authorCodesForContract = takeDistinct(authorCodes, ri(12, 28));
    const sh = shares(authorCodesForContract.length);
    authorCodesForContract.forEach((code, idx) => {
      const hasAdvance = rand() < 0.1;
      ca.push({
        contract_id: cid,
        author_id: authorId.get(code),
        share: sh[idx],
        advance: hasAdvance ? ri(2000, 20000) : 0,
        advance_year: hasAdvance ? pick(YEARS) : Number((cr.start_date as string).slice(0, 4)),
      });
    });
  }
  console.log(`  ${cp.length} product-koppels, ${ca.length} auteur-koppels, ${brackets.length} staffel-schijven.`);
  await insertAll("tier_brackets", brackets);
  await insertAll("contract_products", cp);
  await insertAll("contract_authors", ca);

  // Omzet: elk product 36 maanden
  console.log("Genereren van omzetregels...");
  const revenue: Record<string, unknown>[] = [];
  for (const p of productRows) {
    const price = ri(18, 45) + 0.5;
    const baseUnits = ri(60, 900);
    for (const year of YEARS) {
      const growth = year === 2024 ? 1 : year === 2025 ? 1.08 : 1.15;
      for (let m = 0; m < 12; m++) {
        const aantal = Math.round(baseUnits * seasonal[m] * growth);
        if (aantal <= 0) continue;
        revenue.push({ product_id: productId.get(p.code), periode: `${year}-${String(m + 1).padStart(2, "0")}`, omzet: Math.round(aantal * price * 100) / 100, aantal });
      }
    }
  }
  console.log(`  ${revenue.length} omzetregels plaatsen...`);
  await insertAll("revenue_lines", revenue, 1000);

  console.log("Herberekenen (recompute_all)...");
  const t0 = Date.now();
  const rc = await db.rpc("recompute_all");
  chk(rc, "recompute_all");
  console.log(`Klaar in ${Date.now() - t0}ms (server:`, rc.data, ")");
}

main().catch((e) => {
  console.error("FOUT:", e.message ?? e);
  process.exit(1);
});
