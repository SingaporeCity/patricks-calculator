import Link from "next/link";
import { getProductsPage } from "@/lib/data";
import { SearchBox } from "@/components/SearchBox";
import { Pagination } from "@/components/Pagination";
import { Card, Page, PageHeader, Table, Td, Th } from "@/components/ui";

const PAGE_SIZE = 40;

export default async function ProductenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const { rows, total } = await getProductsPage({ q, page: pageNum, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Page>
      <PageHeader
        title="Producten"
        description="Titels waarvan omzet binnenkomt, gekoppeld aan hun contract(en)."
        right={<SearchBox placeholder="Zoek titel of code…" />}
      />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Titel</Th>
              <Th>Contract(en)</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, contracts }) => (
              <tr key={product.id} className="hover:bg-paper">
                <Td className="tabular text-muted">{product.code}</Td>
                <Td>
                  <span className="font-medium">{product.title}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {contracts.map((c) => (
                      <Link
                        key={c.id}
                        href={`/contracten/${c.id}`}
                        className="rounded-md bg-paper px-2 py-0.5 text-xs font-medium text-muted hover:text-accent-strong"
                      >
                        {c.contractNumber}
                      </Link>
                    ))}
                  </div>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <Td className="text-muted">Geen producten gevonden.</Td>
                <Td> </Td>
                <Td> </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <Pagination page={Math.min(pageNum, totalPages)} totalPages={totalPages} totalItems={total} />
      </Card>
    </Page>
  );
}
