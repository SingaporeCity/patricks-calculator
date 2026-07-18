"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function AccrualFilters({
  years,
  contracts,
  selectedYear,
  selectedContract,
}: {
  years: number[];
  contracts: Array<{ id: string; label: string }>;
  selectedYear: number | null;
  selectedContract: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.push(`/accrual?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
        <button
          onClick={() => go({ jaar: "alle" })}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            selectedYear === null ? "bg-accent text-white" : "text-muted hover:bg-paper",
          )}
        >
          Alle jaren
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => go({ jaar: String(y) })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              selectedYear === y ? "bg-accent text-white" : "text-muted hover:bg-paper",
            )}
          >
            {y}
          </button>
        ))}
      </div>

      <select
        value={selectedContract}
        onChange={(e) => go({ contract: e.target.value || null })}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">Alle contracten</option>
        {contracts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
