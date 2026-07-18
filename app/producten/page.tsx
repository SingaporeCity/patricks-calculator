import Link from "next/link";
import { getContractSummaries, getProducts } from "@/lib/data";
import { SearchBox } from "@/components/SearchBox";
import { Pagination } from "@/components/Pagination";
import { Card, Page, PageHeader, Table, Td, Th } from "@/components/ui";
import type { Contract } from "@/lib/types";

const PAGE_SIZE = 40;

export default async function ProductenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const [products, summaries] = await Promise.all([getProducts(), getContractSummaries()]);

  const contractsByProduct = new Map<string, Contract[]>();
  for (const { contract } of summaries) {
    for (const pid of contract.productIds) {
      const arr = contractsByProduct.get(pid) ?? [];
      arr.push(contract);
      contractsByProduct.set(pid, arr);
    }
  }

  const query = (q ?? "").toLowerCase().trim();
  const filtered = (query
    ? products.filter((p) => p.title.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
    : products
  ).sort((a, b) => a.code.localeCompare(b.code));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageNum = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const rows = filtered.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);

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
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-paper">
                <Td className="tabular text-muted">{p.code}</Td>
                <Td>
                  <span className="font-medium">{p.title}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {(contractsByProduct.get(p.id) ?? []).map((c) => (
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
        <Pagination page={pageNum} totalPages={totalPages} totalItems={filtered.length} />
      </Card>
    </Page>
  );
}
