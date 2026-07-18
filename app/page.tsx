import Link from "next/link";
import { getDashboard } from "@/lib/data";
import { formatEuro, formatEuro0 } from "@/lib/format";
import { HorizontalBars, MonthlyTrendChart } from "@/components/charts";
import { Card, Money, Page, PageHeader, StatCard } from "@/components/ui";

export default async function DashboardPage() {
  const d = await getDashboard();

  return (
    <Page>
      <PageHeader title="Dashboard" description="Overzicht van omzet, royalty-kosten en uitbetalingen." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Totale omzet" value={formatEuro0(d.totalRevenue)} hint="alle contracten, alle jaren" />
        <StatCard label="Royalty-kosten" value={formatEuro0(d.totalRoyalty)} tone="accent" hint="berekend over de omzet" />
        <StatCard
          label="Openstaand voorschot"
          value={formatEuro0(d.outstandingAdvances)}
          tone="warn"
          hint="nog te verrekenen"
        />
        <StatCard
          label="In beheer"
          value={`${d.contractsCount} contracten`}
          hint={`${d.authorsCount} auteurs · ${d.productsCount} producten`}
        />
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Omzet & royalty per maand</h2>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#cbd5cf" }} /> Omzet
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#0f766e" }} /> Royalty
            </span>
          </div>
        </div>
        <MonthlyTrendChart data={d.monthlyTrend} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Royalty per contract</h2>
          <HorizontalBars
            data={d.topContracts.map((t) => ({ label: t.contract.name, value: t.royalty }))}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Uitbetaling per boekjaar</h2>
          <div className="space-y-3">
            {d.payoutByYear.map((y) => {
              const max = Math.max(...d.payoutByYear.map((x) => x.payout), 1);
              return (
                <div key={y.year}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{y.year}</span>
                    <Money value={y.payout} className="text-muted" />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(y.payout / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            href="/uitbetalingen"
            className="mt-5 inline-block text-sm font-medium text-accent hover:text-accent-strong"
          >
            Naar uitbetalingen →
          </Link>
        </Card>
      </div>
    </Page>
  );
}
