"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, Users, BookOpen, Calculator, Upload, CalendarClock, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const items = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/contracten", label: "Contracten", icon: FileText },
  { href: "/accrual", label: "Maandelijkse accrual", icon: CalendarClock },
  { href: "/auteurs", label: "Auteurs", icon: Users },
  { href: "/producten", label: "Producten", icon: BookOpen },
  { href: "/uitbetalingen", label: "Uitbetalingen", icon: Calculator },
  { href: "/import", label: "Import", icon: Upload },
];

export function Sidebar({ demoMode }: { demoMode: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Patricks</div>
          <div className="text-xs text-muted">Calculator</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-accent-soft text-accent-strong"
                : "text-muted hover:bg-paper hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {demoMode ? (
        <div className="m-3 rounded-lg border border-line bg-paper px-3 py-2.5">
          <div className="text-xs font-semibold text-accent-strong">Demo-modus</div>
          <p className="mt-0.5 text-xs leading-snug text-muted">
            Voorbeeldcontracten, live doorgerekend. Voeg Supabase toe voor echte data.
          </p>
        </div>
      ) : (
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            window.location.assign("/login");
          }}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-paper hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
          Uitloggen
        </button>
      )}
    </aside>
  );
}
