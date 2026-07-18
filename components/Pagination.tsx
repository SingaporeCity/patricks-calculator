"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, totalPages, totalItems }: { page: number; totalPages: number; totalItems: number }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  };

  if (totalPages <= 1) {
    return <div className="px-4 py-3 text-xs text-muted">{totalItems.toLocaleString("nl-NL")} resultaten</div>;
  }

  // Compact venster van paginanummers rond de huidige pagina.
  const win = 2;
  const pages: number[] = [];
  for (let p = Math.max(1, page - win); p <= Math.min(totalPages, page + win); p++) pages.push(p);

  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm";

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs text-muted">{totalItems.toLocaleString("nl-NL")} resultaten · pagina {page} van {totalPages}</span>
      <div className="flex items-center gap-1">
        {page > 1 && (
          <Link href={href(page - 1)} className={cn(btn, "text-muted hover:bg-paper")} aria-label="Vorige">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        {pages[0] > 1 && (
          <>
            <Link href={href(1)} className={cn(btn, "text-muted hover:bg-paper")}>1</Link>
            {pages[0] > 2 && <span className="px-1 text-faint">…</span>}
          </>
        )}
        {pages.map((p) => (
          <Link
            key={p}
            href={href(p)}
            className={cn(btn, p === page ? "bg-accent font-medium text-white" : "text-muted hover:bg-paper")}
          >
            {p}
          </Link>
        ))}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-faint">…</span>}
            <Link href={href(totalPages)} className={cn(btn, "text-muted hover:bg-paper")}>{totalPages}</Link>
          </>
        )}
        {page < totalPages && (
          <Link href={href(page + 1)} className={cn(btn, "text-muted hover:bg-paper")} aria-label="Volgende">
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
