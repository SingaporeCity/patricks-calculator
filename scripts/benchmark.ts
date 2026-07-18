// Meet de wandkloktijd van een volledige herberekening tegen je Supabase-DB.
// Draai eerst scripts/seed_synthetic.sql in de SQL-editor.
//
//   npm run benchmark

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Ontbrekend: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { count } = await db.from("revenue_lines").select("*", { count: "exact", head: true });
  console.log(`Omzetregels in de database: ${count?.toLocaleString("nl-NL") ?? "?"}`);

  console.log("recompute_all() draaien...");
  const t0 = Date.now();
  const { data, error } = await db.rpc("recompute_all");
  const wall = Date.now() - t0;
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const serverMs = Number(row?.ms ?? 0);
  console.log(`\nServer-tijd (recompute):  ${serverMs.toLocaleString("nl-NL")} ms`);
  console.log(`Wandklok (incl. netwerk): ${wall.toLocaleString("nl-NL")} ms`);
  if (count && serverMs > 0) {
    console.log(`Doorvoer: ${Math.round(count / (serverMs / 1000)).toLocaleString("nl-NL")} regels/seconde`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
