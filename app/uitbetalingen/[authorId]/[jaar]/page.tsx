import { notFound } from "next/navigation";
import { authorName, getAuthorStatement } from "@/lib/data";
import { formatEuro } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { Card, Money, Page, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function StatementPage({
  params,
}: {
  params: Promise<{ authorId: string; jaar: string }>;
}) {
  const { authorId, jaar } = await params;
  const statement = await getAuthorStatement(authorId, Number(jaar));
  if (!statement || statement.lines.length === 0) notFound();

  return (
    <Page>
      <PageHeader
        title={`Royalty-afrekening ${statement.year}`}
        back={{ href: `/auteurs/${authorId}`, label: "Terug naar auteur" }}
        right={<PrintButton />}
      />

      <Card className="p-8">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-faint">Afrekening voor</div>
            <div className="mt-1 text-lg font-semibold">{authorName(statement.author)}</div>
            <div className="text-sm text-muted">{statement.author.code}</div>
            <div className="text-sm text-muted">{statement.author.email}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-faint">Boekjaar</div>
            <div className="mt-1 text-lg font-semibold">{statement.year}</div>
            <div className="mt-2 text-xs text-faint">Patricks Calculator</div>
          </div>
        </div>

        <div className="py-6">
          <Table>
            <thead>
              <tr>
                <Th>Contract</Th>
                <Th right>Verdiend</Th>
                <Th right>Voorschot begin</Th>
                <Th right>Verrekend</Th>
                <Th right>Voorschot eind</Th>
                <Th right>Uitbetaling</Th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.map((l) => (
                <tr key={l.contract.id}>
                  <Td>
                    <div className="font-medium">{l.contract.name}</div>
                    <div className="text-xs text-muted">{l.contract.contractNumber}</div>
                  </Td>
                  <Td right>
                    <Money value={l.earnedAuthor} />
                  </Td>
                  <Td right>{l.openingBalance > 0 ? formatEuro(l.openingBalance) : "—"}</Td>
                  <Td right>{l.recouped > 0 ? `−${formatEuro(l.recouped)}` : "—"}</Td>
                  <Td right>{l.closingBalance > 0 ? formatEuro(l.closingBalance) : "—"}</Td>
                  <Td right>
                    <Money value={l.payout} className="font-semibold" />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td className="font-semibold">Totaal</Td>
                <Td right>
                  <Money value={statement.totalEarned} className="font-semibold" />
                </Td>
                <Td right> </Td>
                <Td right>
                  {statement.totalRecouped > 0 ? (
                    <span className="font-semibold text-warn">−{formatEuro(statement.totalRecouped)}</span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td right>
                  {statement.totalOutstanding > 0 ? (
                    <span className="font-semibold text-warn">{formatEuro(statement.totalOutstanding)}</span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td right>
                  <Money value={statement.totalPayout} className="font-semibold" />
                </Td>
              </tr>
            </tfoot>
          </Table>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-accent-soft px-5 py-4">
          <span className="text-sm font-medium text-accent-strong">Totaal uit te betalen {statement.year}</span>
          <span className="tabular text-xl font-semibold text-accent-strong">{formatEuro(statement.totalPayout)}</span>
        </div>

        {statement.totalOutstanding > 0 && (
          <p className="mt-4 text-xs text-muted">
            Er staat nog {formatEuro(statement.totalOutstanding)} aan voorschot open. Dit wordt verrekend met de
            royalty-opbrengst van volgende boekjaren.
          </p>
        )}
      </Card>
    </Page>
  );
}
