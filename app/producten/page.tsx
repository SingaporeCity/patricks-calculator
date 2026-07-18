import Link from "next/link";
import { getContractSummaries, getProducts } from "@/lib/data";
import { Card, Page, PageHeader, Table, Td, Th } from "@/components/ui";
import type { Contract } from "@/lib/types";

export default async function ProductenPage() {
  const [products, summaries] = await Promise.all([getProducts(), getContractSummaries()]);

  const contractsByProduct = new Map<string, Contract[]>();
  for (const { contract } of summaries) {
    for (const pid of contract.productIds) {
      const arr = contractsByProduct.get(pid) ?? [];
      arr.push(contract);
      contractsByProduct.set(pid, arr);
    }
  }

  return (
    <Page>
      <PageHeader title="Producten" description="Titels waarvan omzet binnenkomt, gekoppeld aan hun contract(en)." />

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
            {products.map((p) => (
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
          </tbody>
        </Table>
      </Card>
    </Page>
  );
}
