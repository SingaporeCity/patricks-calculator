import Link from "next/link";
import { authorName, getAvailableYears, getPayoutRun } from "@/lib/data";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SearchBox } from "@/components/SearchBox";
import { Pagination } from "@/components/Pagination";
import { Card, Money, Page, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";

const PAGE_SIZE = 30;

export default async function UitbetalingenPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; q?: string; page?: string }>;
}) {
  const { jaar, q, page } = await searchParams;
  const years = await getAvailableYears();
  const selected = jaar && years.includes(Number(jaar)) ? Number(jaar) : years[0];
  const pageNum = Math.max(1, Number(page) || 1);
  const run = await getPayoutRun(selected, { q, page: pageNum, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(run.total / PAGE_SIZE));
  const yearHref = (y: number) => `/uitbetalingen?jaar=${y}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <Page>
      <PageHeader
        title="Uitbetalingen"
        description="Jaarlijkse royalty-uitbetaling per auteur, na verrekening van voorschotten."
        right={
          <div className="flex items-center gap-3">
            <SearchBox placeholder="Zoek auteur…" />
            <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
              {years.map((y) => (
                <Link
                  key={y}
                  href={yearHref(y)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    y === selected ? "bg-accent text-white" : "text-muted hover:bg-paper",
                  )}
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label={`Uit te betalen ${selected}`} value={formatEuro(run.totalPayout)} tone="accent" />
        <StatCard label="Auteurs met uitbetaling" value={run.total.toLocaleString("nl-NL")} />
      </div>

      <Card className="mt-6">
        <div className="px-5 pt-5">
          <h2 className="text-sm font-semibold">Per auteur — {selected}</h2>
        </div>
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
                  <Link href={`/uitbetalingen/${a.author.id}/${selected}`} className="text-accent hover:text-accent-strong">
                    bekijk →
                  </Link>
                </Td>
              </tr>
            ))}
            {run.byAuthor.length === 0 && (
              <tr>
                <Td className="text-muted">Geen uitbetalingen gevonden.</Td>
                <Td right> </Td>
                <Td right> </Td>
                <Td right> </Td>
                <Td right> </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <Pagination page={Math.min(pageNum, totalPages)} totalPages={totalPages} totalItems={run.total} />
      </Card>
    </Page>
  );
}
