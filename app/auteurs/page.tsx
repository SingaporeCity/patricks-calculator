import Link from "next/link";
import { authorName, getAuthorSummaries } from "@/lib/data";
import { formatEuro } from "@/lib/format";
import { SearchBox } from "@/components/SearchBox";
import { Pagination } from "@/components/Pagination";
import { Card, Money, Page, PageHeader, Table, Td, Th } from "@/components/ui";

const PAGE_SIZE = 30;

export default async function AuteursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const all = await getAuthorSummaries();

  const query = (q ?? "").toLowerCase().trim();
  const filtered = query
    ? all.filter(
        (s) =>
          authorName(s.author).toLowerCase().includes(query) ||
          s.author.code.toLowerCase().includes(query) ||
          (s.author.email ?? "").toLowerCase().includes(query),
      )
    : all;
  filtered.sort((a, b) => authorName(a.author).localeCompare(authorName(b.author)));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageNum = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const rows = filtered.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);

  return (
    <Page>
      <PageHeader
        title="Auteurs"
        description="Wat elke auteur verdient en uitbetaald krijgt, over alle contracten."
        right={<SearchBox placeholder="Zoek auteur, code of e-mail…" />}
      />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Auteur</Th>
              <Th right>Contracten</Th>
              <Th right>Totaal verdiend</Th>
              <Th right>Totaal uitbetaald</Th>
              <Th right>Openstaand voorschot</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.author.id} className="group hover:bg-paper">
                <Td>
                  <Link href={`/auteurs/${s.author.id}`} className="block">
                    <div className="font-medium group-hover:text-accent-strong">{authorName(s.author)}</div>
                    <div className="text-xs text-muted">
                      <span className="tabular">{s.author.code}</span> · {s.author.email}
                    </div>
                  </Link>
                </Td>
                <Td right>{s.contractCount}</Td>
                <Td right>
                  <Money value={s.totalEarned} className="text-muted" />
                </Td>
                <Td right>
                  <Money value={s.totalPaid} />
                </Td>
                <Td right>
                  {s.outstanding > 0 ? <span className="text-warn">{formatEuro(s.outstanding)}</span> : <span className="text-faint">—</span>}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <Td className="text-muted">Geen auteurs gevonden.</Td>
                <Td right> </Td>
                <Td right> </Td>
                <Td right> </Td>
                <Td right> </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <Pagination page={pageNum} totalPages={totalPages} totalItems={filtered.length} />
      </Card>
    </Page>
  );
}
