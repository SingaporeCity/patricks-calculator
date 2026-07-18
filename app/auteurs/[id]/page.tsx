import Link from "next/link";
import { notFound } from "next/navigation";
import { authorName, getAuthorDetail } from "@/lib/data";
import { formatEuro, formatRatePct } from "@/lib/format";
import { Badge, Card, Money, Page, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function AuthorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getAuthorDetail(id);
  if (!d) notFound();

  return (
    <Page>
      <PageHeader
        title={authorName(d.author)}
        description={`${d.author.code} · ${d.author.email}`}
        back={{ href: "/auteurs", label: "Auteurs" }}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">Totaal verdiend</div>
          <div className="tabular mt-1.5 text-xl font-semibold">{formatEuro(d.totalEarned)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">Totaal uitbetaald</div>
          <div className="tabular mt-1.5 text-xl font-semibold text-accent-strong">{formatEuro(d.totalPaid)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">Openstaand voorschot</div>
          <div className="tabular mt-1.5 text-xl font-semibold text-warn">{formatEuro(d.outstanding)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">Contracten</div>
          <div className="tabular mt-1.5 text-xl font-semibold">{d.contracts.length}</div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Contracten</h2>
        <div className="flex flex-wrap gap-2">
          {d.contracts.map((c) => (
            <Link
              key={c.contract.id}
              href={`/contracten/${c.contract.id}`}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm hover:border-accent"
            >
              <span className="font-medium">{c.contract.name}</span>
              <span className="ml-2 text-xs text-muted">aandeel {formatRatePct(c.share)}</span>
              {c.advance > 0 && (
                <span className="ml-2">
                  <Badge tone="warn">voorschot {formatEuro(c.advance)}</Badge>
                </span>
              )}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Uitbetaling per boekjaar</h2>
        <Table>
          <thead>
            <tr>
              <Th>Boekjaar</Th>
              <Th>Contract</Th>
              <Th right>Aandeel</Th>
              <Th right>Verdiend</Th>
              <Th right>Voorschot verrekend</Th>
              <Th right>Openstaand</Th>
              <Th right>Uitbetaling</Th>
              <Th right>Afrekening</Th>
            </tr>
          </thead>
          <tbody>
            {d.payouts.map((p) => (
              <tr key={`${p.contractId}-${p.boekjaar}`} className="hover:bg-paper">
                <Td>{p.boekjaar}</Td>
                <Td>
                  <span className="text-xs text-muted">{p.contractNumber}</span> {p.contractName}
                </Td>
                <Td right>{formatRatePct(p.share)}</Td>
                <Td right>
                  <Money value={p.earnedAuthor} className="text-muted" />
                </Td>
                <Td right>
                  {p.recouped > 0 ? <span className="text-warn">−{formatEuro(p.recouped)}</span> : <span className="text-faint">—</span>}
                </Td>
                <Td right>
                  {p.closingBalance > 0 ? <span className="text-warn">{formatEuro(p.closingBalance)}</span> : <span className="text-faint">—</span>}
                </Td>
                <Td right>
                  <Money value={p.payout} />
                </Td>
                <Td right>
                  <Link href={`/uitbetalingen/${d.author.id}/${p.boekjaar}`} className="text-accent hover:text-accent-strong">
                    bekijk
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Page>
  );
}
