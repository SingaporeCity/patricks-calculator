import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatEuro, formatNumber } from "@/lib/format";

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">{children}</div>;
}

export function PageHeader({
  title,
  description,
  right,
  back,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm font-medium text-accent hover:text-accent-strong">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warn";
}) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div
        className={cn(
          "tabular mt-2 text-2xl font-semibold",
          tone === "accent" && "text-accent-strong",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warn" | "positive";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-paper text-muted",
        tone === "accent" && "bg-accent-soft text-accent-strong",
        tone === "warn" && "bg-amber-50 text-warn",
        tone === "positive" && "bg-emerald-50 text-positive",
      )}
    >
      {children}
    </span>
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn("tabular", className)}>{formatEuro(value)}</span>;
}

export function Num({ value, className }: { value: number; className?: string }) {
  return <span className={cn("tabular", className)}>{formatNumber(value)}</span>;
}

// --- Tabel-helpers ----------------------------------------------------------

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-faint",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={cn("border-b border-line px-4 py-2.5", right && "text-right tabular", className)}>{children}</td>
  );
}
