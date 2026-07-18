"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { bustDataCache, isDemoMode } from "@/lib/data";

export interface CreateContractInput {
  contractNumber: string;
  name: string;
  royaltyModel: "flat" | "tiered";
  flatRatePct: number;
  brackets: Array<{ lowerUnits: number; upperUnits: number | null; ratePct: number }>;
  productIds: string[];
  authors: Array<{ authorId: string; share: number; advance: number; advanceYear: number }>;
  startDate: string | null;
}

export interface ActionResult {
  ok: boolean;
  fout?: string;
  contractId?: string;
}

const NUMMER = /^(RP|CC)_\d{5}$/;

export async function createContract(input: CreateContractInput): Promise<ActionResult> {
  if (isDemoMode) {
    return { ok: false, fout: "Contract toevoegen werkt met een database (Supabase); in demo-modus wordt niets bewaard." };
  }
  if (!NUMMER.test(input.contractNumber)) {
    return { ok: false, fout: "Contractnummer moet RP_ of CC_ zijn gevolgd door 5 cijfers (bijv. RP_10012)." };
  }
  if (!input.name.trim()) return { ok: false, fout: "Naam is verplicht." };
  if (input.productIds.length === 0) return { ok: false, fout: "Kies minstens één product." };
  if (input.authors.length === 0) return { ok: false, fout: "Voeg minstens één auteur toe." };
  if (input.authors.some((a) => !a.authorId)) return { ok: false, fout: "Elke auteur-regel moet een auteur hebben." };

  const db = createAdminClient();

  const { data: existing } = await db.from("contracts").select("id").eq("contract_number", input.contractNumber).maybeSingle();
  if (existing) return { ok: false, fout: `Contractnummer ${input.contractNumber} bestaat al.` };

  const { data: c, error } = await db
    .from("contracts")
    .insert({
      contract_number: input.contractNumber,
      name: input.name.trim(),
      flat_rate_pct: input.flatRatePct,
      royalty_model: input.royaltyModel,
      tier_accumulator: "contract",
      tier_reset: "year",
      status: "active",
      start_date: input.startDate || null,
    })
    .select("id")
    .single();
  if (error || !c) return { ok: false, fout: `Contract aanmaken mislukt: ${error?.message ?? "onbekend"}` };

  const contractId = c.id as string;

  if (input.royaltyModel === "tiered" && input.brackets.length > 0) {
    const { error: be } = await db.from("tier_brackets").insert(
      input.brackets.map((b) => ({ contract_id: contractId, lower_units: b.lowerUnits, upper_units: b.upperUnits, rate_pct: b.ratePct })),
    );
    if (be) return { ok: false, fout: `Staffel opslaan mislukt: ${be.message}` };
  }

  const { error: pe } = await db.from("contract_products").insert(
    input.productIds.map((pid) => ({ contract_id: contractId, product_id: pid })),
  );
  if (pe) return { ok: false, fout: `Producten koppelen mislukt: ${pe.message}` };

  const { error: ae } = await db.from("contract_authors").insert(
    input.authors.map((a) => ({ contract_id: contractId, author_id: a.authorId, share: a.share, advance: a.advance, advance_year: a.advanceYear })),
  );
  if (ae) return { ok: false, fout: `Auteurs koppelen mislukt: ${ae.message}` };

  const { error: re } = await db.rpc("recompute_contracts", { p_contract_ids: [contractId] });
  if (re) return { ok: false, fout: `Herberekenen mislukt: ${re.message}` };

  bustDataCache();
  revalidatePath("/contracten");
  revalidatePath("/");
  return { ok: true, contractId };
}
