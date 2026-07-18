"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createContract } from "@/lib/actions/contracten";
import type { Author, Product } from "@/lib/types";

const NUMMER = /^(RP|CC)_\d{5}$/;
const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none";

interface AuthorRow {
  authorId: string;
  share: string;
  advance: string;
  advanceYear: string;
}
interface BracketRow {
  lower: string;
  upper: string;
  rate: string;
}

export function NewContractForm({ products, authors, demoMode }: { products: Product[]; authors: Author[]; demoMode: boolean }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();

  const [contractNumber, setContractNumber] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [model, setModel] = useState<"flat" | "tiered">("flat");
  const [rate, setRate] = useState("10");
  const [brackets, setBrackets] = useState<BracketRow[]>([
    { lower: "0", upper: "5000", rate: "10" },
    { lower: "5000", upper: "", rate: "12" },
  ]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [authorRows, setAuthorRows] = useState<AuthorRow[]>([{ authorId: "", share: "100", advance: "0", advanceYear: String(thisYear) }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nummerOk = NUMMER.test(contractNumber);
  const shareSum = authorRows.reduce((s, a) => s + (parseFloat(a.share) || 0), 0);

  const toggleProduct = (id: string) =>
    setProductIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

  async function submit() {
    setError(null);
    if (!nummerOk) return setError("Contractnummer moet RP_ of CC_ + 5 cijfers zijn (bijv. RP_10012).");
    if (!name.trim()) return setError("Naam is verplicht.");
    if (productIds.length === 0) return setError("Kies minstens één product.");
    if (authorRows.some((a) => !a.authorId)) return setError("Elke auteur-regel moet een auteur hebben.");

    setSubmitting(true);
    const res = await createContract({
      contractNumber,
      name,
      royaltyModel: model,
      flatRatePct: num(rate),
      brackets:
        model === "tiered"
          ? brackets.map((b) => ({ lowerUnits: num(b.lower), upperUnits: b.upper.trim() === "" ? null : num(b.upper), ratePct: num(b.rate) }))
          : [],
      productIds,
      authors: authorRows.map((a) => ({ authorId: a.authorId, share: num(a.share), advance: num(a.advance), advanceYear: num(a.advanceYear) })),
      startDate: startDate || null,
    });
    setSubmitting(false);
    if (!res.ok) return setError(res.fout ?? "Er ging iets mis.");
    router.push(`/contracten/${res.contractId}`);
  }

  return (
    <div className="space-y-6">
      {demoMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-warn">
          Je draait in demo-modus (geen database). Opslaan lukt pas met Supabase-omgevingsvariabelen.
        </div>
      )}

      {/* Basis */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Contractgegevens</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Contractnummer</span>
            <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value.toUpperCase())} placeholder="RP_10012" className={inputCls} />
            {contractNumber && !nummerOk && <span className="mt-1 block text-xs text-warn">Formaat: RP_ of CC_ + 5 cijfers.</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Naam</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="bijv. Moderne Wiskunde 15" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Startdatum (optioneel)</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              {model === "flat" ? "Royalty%" : "Basis-royalty% (fallback)"}
            </span>
            <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-xs font-medium text-muted">Model</span>
          <div className="flex gap-2">
            {(["flat", "tiered"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${model === m ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-muted hover:bg-paper"}`}
              >
                {m === "flat" ? "Vast %" : "Staffel"}
              </button>
            ))}
          </div>
        </div>

        {model === "tiered" && (
          <div className="mt-4">
            <span className="mb-2 block text-xs font-medium text-muted">Staffel-schijven (cumulatief aantal exemplaren)</span>
            <div className="space-y-2">
              {brackets.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input placeholder="van" type="number" value={b.lower} onChange={(e) => setBrackets((c) => c.map((x, j) => (j === i ? { ...x, lower: e.target.value } : x)))} className={inputCls} />
                  <span className="text-muted">–</span>
                  <input placeholder="tot (leeg = ∞)" type="number" value={b.upper} onChange={(e) => setBrackets((c) => c.map((x, j) => (j === i ? { ...x, upper: e.target.value } : x)))} className={inputCls} />
                  <input placeholder="%" type="number" step="0.01" value={b.rate} onChange={(e) => setBrackets((c) => c.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} className="w-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
                  <button type="button" onClick={() => setBrackets((c) => c.filter((_, j) => j !== i))} className="text-faint hover:text-warn">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setBrackets((c) => [...c, { lower: "", upper: "", rate: "" }])} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong">
              <Plus className="h-4 w-4" /> Schijf
            </button>
          </div>
        )}
      </div>

      {/* Producten */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Producten ({productIds.length} gekozen)</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${productIds.includes(p.id) ? "border-accent bg-accent-soft" : "border-line hover:bg-paper"}`}>
              <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="accent-[color:var(--color-accent)]" />
              <span className="tabular text-xs text-muted">{p.code}</span>
              <span className="truncate">{p.title}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Auteurs */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Auteurs & aandeel</h2>
          <span className={`text-xs ${shareSum === 100 ? "text-positive" : "text-warn"}`}>som {shareSum}%{shareSum !== 100 ? " (moet 100 zijn)" : ""}</span>
        </div>
        <div className="space-y-2">
          {authorRows.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_6rem_6rem_auto] items-center gap-2">
              <select value={a.authorId} onChange={(e) => setAuthorRows((c) => c.map((x, j) => (j === i ? { ...x, authorId: e.target.value } : x)))} className={inputCls}>
                <option value="">— kies auteur —</option>
                {authors.map((au) => (
                  <option key={au.id} value={au.id}>
                    {au.firstName} {au.lastName} ({au.code})
                  </option>
                ))}
              </select>
              <input title="aandeel %" type="number" step="0.01" value={a.share} onChange={(e) => setAuthorRows((c) => c.map((x, j) => (j === i ? { ...x, share: e.target.value } : x)))} className="rounded-lg border border-line bg-surface px-2 py-2 text-sm" placeholder="%" />
              <input title="voorschot €" type="number" step="0.01" value={a.advance} onChange={(e) => setAuthorRows((c) => c.map((x, j) => (j === i ? { ...x, advance: e.target.value } : x)))} className="rounded-lg border border-line bg-surface px-2 py-2 text-sm" placeholder="voorschot" />
              <input title="voorschot-jaar" type="number" value={a.advanceYear} onChange={(e) => setAuthorRows((c) => c.map((x, j) => (j === i ? { ...x, advanceYear: e.target.value } : x)))} className="rounded-lg border border-line bg-surface px-2 py-2 text-sm" placeholder="jaar" />
              <button type="button" onClick={() => setAuthorRows((c) => c.filter((_, j) => j !== i))} className="text-faint hover:text-warn">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setAuthorRows((c) => [...c, { authorId: "", share: "0", advance: "0", advanceYear: String(thisYear) }])} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-strong">
          <Plus className="h-4 w-4" /> Auteur
        </button>
        <p className="mt-2 text-xs text-muted">Kolommen: aandeel %, voorschot (€), voorschot-jaar. Voorschot 0 = geen voorschot.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={submitting} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
          {submitting ? "Opslaan…" : "Contract opslaan"}
        </button>
        <button onClick={() => router.push("/contracten")} className="text-sm font-medium text-muted hover:text-ink">
          Annuleren
        </button>
      </div>
    </div>
  );
}
