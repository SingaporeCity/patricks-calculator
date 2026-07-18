import Link from "next/link";
import { Plus } from "lucide-react";
import { getContractSummaries } from "@/lib/data";
import { formatRatePct } from "@/lib/format";
import { Badge, Card, Money, Page, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function ContractenPage() {
  const summaries = await getContractSummaries();

  return (
    <Page>
      <PageHeader
        title="Contracten"
        description="Elk contract koppelt producten en auteurs aan een royalty-afspraak."
        right={
          <Link
            href="/contracten/nieuw"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" />
            Nieuw contract
          </Link>
        }
      />

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Contract</Th>
              <Th>Model</Th>
              <Th right>Producten</Th>
              <Th right>Auteurs</Th>
              <Th right>Omzet</Th>
              <Th right>Royalty</Th>
              <Th right>Openstaand voorschot</Th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ contract, totalRevenue, totalRoyalty, productCount, authorCount, outstandingAdvance }) => (
              <tr key={contract.id} className="group hover:bg-paper">
                <Td>
                  <Link href={`/contracten/${contract.id}`} className="block">
                    <div className="font-medium text-ink group-hover:text-accent-strong">{contract.name}</div>
                    <div className="text-xs text-muted">{contract.contractNumber}</div>
                  </Link>
                </Td>
                <Td>
                  {contract.royaltyModel === "tiered" ? (
                    <Badge tone="accent">Staffel</Badge>
                  ) : (
                    <Badge>Vast {formatRatePct(contract.flatRatePct)}</Badge>
                  )}
                </Td>
                <Td right>{productCount}</Td>
                <Td right>{authorCount}</Td>
                <Td right>
                  <Money value={totalRevenue} className="text-muted" />
                </Td>
                <Td right>
                  <Money value={totalRoyalty} />
                </Td>
                <Td right>
                  {outstandingAdvance > 0 ? (
                    <Money value={outstandingAdvance} className="text-warn" />
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Page>
  );
}
