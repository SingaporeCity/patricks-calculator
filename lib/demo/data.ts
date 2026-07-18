// ============================================================================
// Demo-data — voorbeelddataset (middelbare-schoolmethodes).
//
// ID-conventies:
//   * producten  : 5-cijferige code
//   * auteurs    : 7-cijferige code
//   * contracten : prefix RP_ of CC_ + 5 cijfers
//
// Laat de belangrijke gevallen zien:
//   * een PRODUCT op meerdere contracten: "Moderne Wiskunde 14" (10001) valt
//     onder RP_10001 (huidige auteurs, 8%) én CC_10002 (oud-auteurs, 2%);
//   * een AUTEUR op meerdere contracten (o.a. de Vries, Post, Bakker, Willems);
//   * vast % en staffel; voorschotten met carry-forward.
// ============================================================================

import type { Author, Contract, Product, RevenueLine } from "@/lib/types";

export const products: Product[] = [
  { id: "p-mw14", code: "10001", title: "Moderne Wiskunde 14" },
  { id: "p-mw13", code: "10002", title: "Moderne Wiskunde 13" },
  { id: "p-gr", code: "10003", title: "Getal & Ruimte" },
  { id: "p-nn", code: "10004", title: "Nieuw Nederlands" },
  { id: "p-ss", code: "10005", title: "Stepping Stones (Engels)" },
  { id: "p-bvj", code: "10006", title: "Biologie voor Jou" },
  { id: "p-nova", code: "10007", title: "Nova Natuurkunde" },
  { id: "p-co", code: "10008", title: "Chemie Overal" },
  { id: "p-fen", code: "10009", title: "Feniks Geschiedenis" },
  { id: "p-bl", code: "10010", title: "BuiteNLand Aardrijkskunde" },
  { id: "p-pe", code: "10011", title: "Praktische Economie" },
  { id: "p-gl", code: "10012", title: "Grandes Lignes (Frans)" },
  { id: "p-nk", code: "10013", title: "Neue Kontakte (Duits)" },
];

export const authors: Author[] = [
  { id: "a-devries", code: "1000001", firstName: "Anne", lastName: "de Vries", email: "anne.devries@example.nl" },
  { id: "a-jansen", code: "1000002", firstName: "Bram", lastName: "Jansen", email: "bram.jansen@example.nl" },
  { id: "a-bakker", code: "1000003", firstName: "Carla", lastName: "Bakker", email: "carla.bakker@example.nl" },
  { id: "a-smit", code: "1000004", firstName: "Daan", lastName: "Smit", email: "daan.smit@example.nl" },
  { id: "a-mulder", code: "1000005", firstName: "Eva", lastName: "Mulder", email: "eva.mulder@example.nl" },
  { id: "a-visser", code: "1000006", firstName: "Femke", lastName: "Visser", email: "femke.visser@example.nl" },
  { id: "a-post", code: "1000007", firstName: "Gijs", lastName: "Post", email: "gijs.post@example.nl" },
  { id: "a-deboer", code: "1000008", firstName: "Hanne", lastName: "de Boer", email: "hanne.deboer@example.nl" },
  { id: "a-vermeer", code: "1000009", firstName: "Iris", lastName: "Vermeer", email: "iris.vermeer@example.nl" },
  { id: "a-willems", code: "1000010", firstName: "Joost", lastName: "Willems", email: "joost.willems@example.nl" },
  { id: "a-hendriks", code: "1000011", firstName: "Karin", lastName: "Hendriks", email: "karin.hendriks@example.nl" },
  { id: "a-vandijk", code: "1000012", firstName: "Lars", lastName: "van Dijk", email: "lars.vandijk@example.nl" },
];

const flat = (n: number): Pick<Contract, "flatRatePct" | "royaltyModel" | "brackets"> => ({
  flatRatePct: n,
  royaltyModel: "flat",
  brackets: [],
});

export const contracts: Contract[] = [
  {
    id: "c-mw14",
    contractNumber: "RP_10001",
    name: "Moderne Wiskunde 14 — auteursteam",
    ...flat(8),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-mw14"],
    authors: [
      { authorId: "a-devries", share: 50, advance: 0, advanceYear: 2025 },
      { authorId: "a-jansen", share: 30, advance: 0, advanceYear: 2025 },
      { authorId: "a-post", share: 20, advance: 0, advanceYear: 2025 },
    ],
    startDate: "2025-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-mwoud",
    contractNumber: "CC_10002",
    name: "Moderne Wiskunde — oud-auteurs (doorbetaling)",
    ...flat(2),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-mw14", "p-mw13"], // 2% van MW14 (+ eigen MW13)
    authors: [
      { authorId: "a-bakker", share: 60, advance: 0, advanceYear: 2024 },
      { authorId: "a-smit", share: 40, advance: 0, advanceYear: 2024 },
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-nn",
    contractNumber: "RP_10003",
    name: "Nieuw Nederlands onderbouw",
    ...flat(10),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-nn"],
    authors: [
      { authorId: "a-devries", share: 40, advance: 0, advanceYear: 2024 }, // de Vries ook op RP_10001
      { authorId: "a-mulder", share: 40, advance: 0, advanceYear: 2024 },
      { authorId: "a-visser", share: 20, advance: 0, advanceYear: 2024 },
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-gr",
    contractNumber: "RP_10004",
    name: "Getal & Ruimte",
    ...flat(9),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-gr"],
    authors: [
      { authorId: "a-jansen", share: 50, advance: 0, advanceYear: 2024 },
      { authorId: "a-hendriks", share: 50, advance: 0, advanceYear: 2024 },
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-ss",
    contractNumber: "RP_10005",
    name: "Stepping Stones Engels (staffel)",
    flatRatePct: 9,
    royaltyModel: "tiered",
    brackets: [
      { lowerUnits: 0, upperUnits: 5000, ratePct: 9 },
      { lowerUnits: 5000, upperUnits: 10000, ratePct: 11 },
      { lowerUnits: 10000, upperUnits: null, ratePct: 13 },
    ],
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-ss"],
    authors: [{ authorId: "a-deboer", share: 100, advance: 10000, advanceYear: 2026 }],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-bvj",
    contractNumber: "CC_10006",
    name: "Biologie voor Jou",
    ...flat(12),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-bvj"],
    authors: [
      { authorId: "a-vermeer", share: 70, advance: 0, advanceYear: 2024 },
      { authorId: "a-willems", share: 30, advance: 0, advanceYear: 2024 },
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-nova",
    contractNumber: "RP_10007",
    name: "Nova Natuurkunde",
    ...flat(9),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-nova"],
    authors: [
      { authorId: "a-willems", share: 50, advance: 0, advanceYear: 2024 }, // Willems ook op CC_10006
      { authorId: "a-hendriks", share: 50, advance: 0, advanceYear: 2024 },
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-co",
    contractNumber: "RP_10008",
    name: "Chemie Overal bovenbouw",
    ...flat(10),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-co"],
    authors: [{ authorId: "a-vandijk", share: 100, advance: 8000, advanceYear: 2025 }],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-fen",
    contractNumber: "CC_10009",
    name: "Feniks Geschiedenis",
    ...flat(11),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-fen"],
    authors: [
      { authorId: "a-post", share: 50, advance: 0, advanceYear: 2024 }, // Post ook op RP_10001
      { authorId: "a-bakker", share: 50, advance: 0, advanceYear: 2024 }, // Bakker ook op CC_10002
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-zaak",
    contractNumber: "RP_10010",
    name: "Zaakvakken (Aardrijkskunde & Economie)",
    ...flat(9),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-bl", "p-pe"],
    authors: [
      { authorId: "a-hendriks", share: 60, advance: 0, advanceYear: 2024 },
      { authorId: "a-willems", share: 40, advance: 0, advanceYear: 2024 },
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
  {
    id: "c-talen",
    contractNumber: "RP_10011",
    name: "Moderne Talen (Frans & Duits)",
    ...flat(10),
    tierAccumulator: "contract",
    tierReset: "year",
    productIds: ["p-gl", "p-nk"],
    authors: [
      { authorId: "a-deboer", share: 50, advance: 0, advanceYear: 2024 }, // de Boer ook op RP_10005
      { authorId: "a-visser", share: 50, advance: 0, advanceYear: 2024 },
    ],
    startDate: "2024-01-01",
    endDate: null,
    status: "active",
  },
];

// --- Deterministische maand-omzet (schoolboek-seizoenspatroon, piek aug/sep) ---

interface ProductProfile {
  price: number;
  baseUnits: number;
  startYear: number;
  decline?: boolean; // oude editie: loopt terug i.p.v. groeien
}

const profiles: Record<string, ProductProfile> = {
  "p-mw14": { price: 32.5, baseUnits: 950, startYear: 2025 }, // nieuwe editie
  "p-mw13": { price: 30.0, baseUnits: 700, startYear: 2024, decline: true }, // oude editie
  "p-gr": { price: 34.0, baseUnits: 400, startYear: 2024 },
  "p-nn": { price: 28.5, baseUnits: 500, startYear: 2024 },
  "p-ss": { price: 31.0, baseUnits: 950, startYear: 2024 }, // kruist staffel-schijven
  "p-bvj": { price: 33.5, baseUnits: 450, startYear: 2024 },
  "p-nova": { price: 36.0, baseUnits: 380, startYear: 2024 },
  "p-co": { price: 35.5, baseUnits: 340, startYear: 2024 },
  "p-fen": { price: 29.5, baseUnits: 420, startYear: 2024 },
  "p-bl": { price: 30.5, baseUnits: 360, startYear: 2024 },
  "p-pe": { price: 27.0, baseUnits: 300, startYear: 2024 },
  "p-gl": { price: 32.0, baseUnits: 320, startYear: 2024 },
  "p-nk": { price: 31.5, baseUnits: 260, startYear: 2024 },
};

const seasonal = [0.7, 0.6, 0.8, 0.9, 1.0, 1.1, 1.6, 2.0, 1.7, 1.1, 0.9, 0.7];
const growUp: Record<number, number> = { 2024: 1.0, 2025: 1.08, 2026: 1.15 };
const growDown: Record<number, number> = { 2024: 1.0, 2025: 0.45, 2026: 0.18 };
const YEARS = [2024, 2025, 2026];

function buildRevenueLines(): RevenueLine[] {
  const lines: RevenueLine[] = [];
  for (const [productId, p] of Object.entries(profiles)) {
    const growth = p.decline ? growDown : growUp;
    for (const year of YEARS) {
      if (year < p.startYear) continue;
      for (let m = 0; m < 12; m++) {
        const aantal = Math.round(p.baseUnits * seasonal[m] * (growth[year] ?? 1));
        if (aantal <= 0) continue;
        const omzet = Math.round(aantal * p.price * 100) / 100;
        lines.push({ productId, periode: `${year}-${String(m + 1).padStart(2, "0")}`, omzet, aantal });
      }
    }
  }
  return lines;
}

export const revenueLines: RevenueLine[] = buildRevenueLines();
