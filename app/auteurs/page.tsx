import Link from "next/link";
import { authorName, getAuthorDetail, getAuthors } from "@/lib/data";
import { Card, Money, Page, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function AuteursPage() {
  const authors = await getAuthors();
  const details = await Promise.all(authors.map((a) => getAuthorDetail(a.id)));

  return (
    <Page>
      <PageHeader title="Auteurs" description="Wat elke auteur verdient en uitbetaald krijgt, over alle contracten." />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Auteur</Th>
              <Th>Contracten</Th>
              <Th right>Totaal verdiend</Th>
              <Th right>Totaal uitbetaald</Th>
              <Th right>Openstaand voorschot</Th>
            </tr>
          </thead>
          <tbody>
            {details.map((d) => {
              if (!d) return null;
              return (
                <tr key={d.author.id} className="group hover:bg-paper">
                  <Td>
                    <Link href={`/auteurs/${d.author.id}`} className="block">
                      <div className="font-medium group-hover:text-accent-strong">{authorName(d.author)}</div>
                      <div className="text-xs text-muted">{d.author.email}</div>
                    </Link>
                  </Td>
                  <Td>{d.contracts.length}</Td>
                  <Td right>
                    <Money value={d.totalEarned} className="text-muted" />
                  </Td>
                  <Td right>
                    <Money value={d.totalPaid} />
                  </Td>
                  <Td right>
                    {d.outstanding > 0 ? <span className="text-warn">{"€ " + d.outstanding.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : <span className="text-faint">—</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </Page>
  );
}
