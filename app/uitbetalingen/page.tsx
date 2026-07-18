import Link from "next/link";
import { authorName, getAvailableYears, getPayoutRun } from "@/lib/data";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, Money, Page, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";

export default async function UitbetalingenPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string }>;
}) {
  const years = await getAvailableYears();
  const { jaar } = await searchParams;
  const selected = jaar && years.includes(Number(jaar)) ? Number(jaar) : years[0];
  const run = await getPayoutRun(selected);

  return (
    <Page>
      <PageHeader
        title="Uitbetalingen"
        description="Jaarlijkse royalty-uitbetaling per auteur, na verrekening van voorschotten."
        right={
          <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
            {years.map((y) => (
              <Link
                key={y}
                href={`/uitbetalingen?jaar=${y}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  y === selected ? "bg-accent text-white" : "text-muted hover:bg-paper",
                )}
              >
                {y}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={`Uit te betalen ${selected}`} value={formatEuro(run.totalPayout)} tone="accent" />
        <StatCard label="Auteurs" value={String(run.byAuthor.length)} />
        <StatCard
          label="Openstaand voorschot eind jaar"
          value={formatEuro(run.byAuthor.reduce((s, a) => s + a.outstanding, 0))}
          tone="warn"
        />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Per auteur — {selected}</h2>
        <Table>
          <thead>
            <tr>
              <Th>Auteur</Th>
              <Th right>Verdiend</Th>
              <Th right>Uitbetaling</Th>
              <Th right>Openstaand voorschot</Th>
              <Th right>Afrekening</Th>
            </tr>
          </thead>
          <tbody>
            {run.byAuthor.map((a) => (
              <tr key={a.author.id} className="hover:bg-paper">
                <Td>
                  <Link href={`/auteurs/${a.author.id}`} className="font-medium hover:text-accent-strong">
                    {authorName(a.author)}
                  </Link>
                </Td>
                <Td right>
                  <Money value={a.earned} className="text-muted" />
                </Td>
                <Td right>
                  <Money value={a.payout} />
                </Td>
                <Td right>
                  {a.outstanding > 0 ? <span className="text-warn">{formatEuro(a.outstanding)}</span> : <span className="text-faint">—</span>}
                </Td>
                <Td right>
                  <Link
                    href={`/uitbetalingen/${a.author.id}/${selected}`}
                    className="text-accent hover:text-accent-strong"
                  >
                    bekijk →
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Detail per contract</h2>
        <Table>
          <thead>
            <tr>
              <Th>Auteur</Th>
              <Th>Contract</Th>
              <Th right>Verdiend</Th>
              <Th right>Voorschot verrekend</Th>
              <Th right>Uitbetaling</Th>
            </tr>
          </thead>
          <tbody>
            {run.rows.map((r) => (
              <tr key={`${r.author.id}-${r.contract.id}`} className="hover:bg-paper">
                <Td>{authorName(r.author)}</Td>
                <Td>
                  <span className="text-xs text-muted">{r.contract.contractNumber}</span> {r.contract.name}
                </Td>
                <Td right>
                  <Money value={r.earnedAuthor} className="text-muted" />
                </Td>
                <Td right>
                  {r.recouped > 0 ? <span className="text-warn">−{formatEuro(r.recouped)}</span> : <span className="text-faint">—</span>}
                </Td>
                <Td right>
                  <Money value={r.payout} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Page>
  );
}
