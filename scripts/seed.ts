// Seedt de demo-dataset in je Supabase-database, zodat je met echte data
// (i.p.v. de in-memory demo-modus) kunt draaien. Idempotent op natuurlijke keys.
//
//   npm run seed
//
// Vereist .env.local met NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY.

import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { config } from "dotenv";
import { authors, contracts, products, revenueLines } from "../lib/demo/data";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Ontbrekend: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const fmt = (e: PostgrestError, waar: string) => `${waar}: ${e.message}${e.hint ? ` (hint: ${e.hint})` : ""}`;

/** Schrijf-actie: gooit alleen bij een fout (data mag null zijn). */
function chk<T>(res: { data: T; error: PostgrestError | null }, waar: string): void {
  if (res.error) throw new Error(fmt(res.error, waar));
}
/** Lees-actie: gooit bij fout én bij ontbrekende data. */
function req<T>(res: { data: T; error: PostgrestError | null }, waar: string): NonNullable<T> {
  if (res.error) throw new Error(fmt(res.error, waar));
  if (res.data == null) throw new Error(`${waar}: geen data teruggekregen`);
  return res.data as NonNullable<T>;
}

async function main() {
  console.log(`Seeden: ${products.length} producten, ${authors.length} auteurs, ${contracts.length} contracten...`);

  chk(await db.from("products").upsert(products.map((p) => ({ code: p.code, title: p.title })), { onConflict: "code" }), "products upsert");
  const dbProducts = req(await db.from("products").select("id, code"), "products select");
  const productIdByCode = new Map(dbProducts.map((p) => [p.code, p.id]));
  const codeByDemoProductId = new Map(products.map((p) => [p.id, p.code]));
  const dbProductId = (demoId: string) => productIdByCode.get(codeByDemoProductId.get(demoId)!)!;

  chk(
    await db.from("authors").upsert(
      authors.map((a) => ({ code: a.code, first_name: a.firstName, last_name: a.lastName, email: a.email })),
      { onConflict: "code" },
    ),
    "authors upsert",
  );
  const dbAuthors = req(await db.from("authors").select("id, code"), "authors select");
  const authorIdByCode = new Map(dbAuthors.map((a) => [a.code, a.id]));
  const codeByDemoAuthorId = new Map(authors.map((a) => [a.id, a.code]));
  const dbAuthorId = (demoId: string) => authorIdByCode.get(codeByDemoAuthorId.get(demoId)!)!;

  for (const c of contracts) {
    chk(
      await db.from("contracts").upsert(
        {
          contract_number: c.contractNumber,
          name: c.name,
          flat_rate_pct: c.flatRatePct,
          royalty_model: c.royaltyModel,
          tier_accumulator: c.tierAccumulator,
          tier_reset: c.tierReset,
          start_date: c.startDate,
          end_date: c.endDate,
          status: c.status,
        },
        { onConflict: "contract_number" },
      ),
      `contract ${c.contractNumber} upsert`,
    );
    const row = req(await db.from("contracts").select("id").eq("contract_number", c.contractNumber).single(), `contract ${c.contractNumber} select`);
    const contractId = row.id;

    await db.from("tier_brackets").delete().eq("contract_id", contractId);
    await db.from("contract_products").delete().eq("contract_id", contractId);
    await db.from("contract_authors").delete().eq("contract_id", contractId);

    if (c.brackets.length) {
      chk(
        await db.from("tier_brackets").insert(
          c.brackets.map((b) => ({ contract_id: contractId, lower_units: b.lowerUnits, upper_units: b.upperUnits, rate_pct: b.ratePct })),
        ),
        `tier_brackets ${c.contractNumber}`,
      );
    }
    chk(await db.from("contract_products").insert(c.productIds.map((pid) => ({ contract_id: contractId, product_id: dbProductId(pid) }))), `contract_products ${c.contractNumber}`);
    chk(
      await db.from("contract_authors").insert(
        c.authors.map((ca) => ({ contract_id: contractId, author_id: dbAuthorId(ca.authorId), share: ca.share, advance: ca.advance, advance_year: ca.advanceYear })),
      ),
      `contract_authors ${c.contractNumber}`,
    );
  }

  const rows = revenueLines.map((rl) => ({ product_id: dbProductId(rl.productId), periode: rl.periode, omzet: rl.omzet, aantal: rl.aantal }));
  for (let i = 0; i < rows.length; i += 500) {
    chk(await db.from("revenue_lines").upsert(rows.slice(i, i + 500), { onConflict: "product_id,periode" }), "revenue_lines upsert");
  }
  console.log(`  ${rows.length} omzetregels geplaatst.`);

  console.log("Herberekenen...");
  const rc = await db.rpc("recompute_all");
  chk(rc, "recompute_all");
  console.log("Klaar:", rc.data);
}

main().catch((e) => {
  console.error("FOUT:", e.message ?? e);
  process.exit(1);
});
