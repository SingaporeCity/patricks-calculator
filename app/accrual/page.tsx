import { Download } from "lucide-react";
import { getAvailableYears, getContractSummaries, getProductAccrual } from "@/lib/data";
import { formatEuro, formatEuro0, formatRatePct } from "@/lib/format";
import { AccrualFilters } from "@/components/AccrualFilters";
import { Card, Money, Num, Page, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";

export default async function AccrualPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; contract?: string }>;
}) {
  const { jaar, contract } = await searchParams;
  const years = await getAvailableYears();
  const selectedYear = jaar && years.includes(Number(jaar)) ? Number(jaar) : null;
  const selectedContract = contract ?? "";

  const summaries = await getContractSummaries();
  const contractOptions = summaries.map((s) => ({ id: s.contract.id, label: `${s.contract.contractNumber} — ${s.contract.name}` }));

  const rows = await getProductAccrual({ year: selectedYear ?? undefined, contractId: selectedContract || undefined });
  const totalOmzet = rows.reduce((s, r) => s + r.omzet, 0);
  const totalRoyalty = rows.reduce((s, r) => s + r.royaltyCost, 0);

  const exportParams = new URLSearchParams();
  if (selectedYear) exportParams.set("jaar", String(selectedYear));
  if (selectedContract) exportParams.set("contract", selectedContract);
  const exportHref = `/api/export/maandaccrual${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <Page>
      <PageHeader
        title="Maandelijkse accrual"
        description="Royaltykosten per product per maand: maandomzet × het royalty% van het contract."
        right={
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            <Download className="h-4 w-4" />
            Exporteren (CSV)
          </a>
        }
      />

      <div className="mb-6">
        <AccrualFilters years={years} contracts={contractOptions} selectedYear={selectedYear} selectedContract={selectedContract} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Omzet (selectie)" value={formatEuro0(totalOmzet)} />
        <StatCard label="Royaltykosten (selectie)" value={formatEuro0(totalRoyalty)} tone="accent" />
        <StatCard label="Regels" value={rows.length.toLocaleString("nl-NL")} />
      </div>

      <Card className="mt-6 p-5">
        <p className="mb-3 text-xs text-muted">
          Staat een product op meerdere contracten (bijv. Moderne Wiskunde 14 op RP_10001 én CC_10002), dan verschijnt het
          per contract met het eigen percentage.
        </p>
        <div className="max-h-[32rem] overflow-y-auto">
          <Table>
            <thead className="sticky top-0 bg-surface">
              <tr>
                <Th>Product</Th>
                <Th>Contract</Th>
                <Th>Periode</Th>
                <Th right>Omzet</Th>
                <Th right>Aantal</Th>
                <Th right>Tarief</Th>
                <Th right>Royaltykost</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-paper">
                  <Td>
                    <span className="tabular text-muted">{r.productCode}</span> <span className="font-medium">{r.productTitle}</span>
                  </Td>
                  <Td className="tabular text-muted">{r.contractNumber}</Td>
                  <Td className="tabular">{r.periode}</Td>
                  <Td right>
                    <Money value={r.omzet} className="text-muted" />
                  </Td>
                  <Td right>
                    <Num value={r.aantal} />
                  </Td>
                  <Td right>{formatRatePct(r.ratePct)}</Td>
                  <Td right>
                    <Money value={r.royaltyCost} />
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <Td className="text-muted">Geen regels voor deze selectie.</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td right> </Td>
                  <Td right> </Td>
                  <Td right> </Td>
                  <Td right> </Td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-surface">
                <tr>
                  <Td className="font-semibold">Totaal</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td right>
                    <Money value={totalOmzet} className="font-semibold" />
                  </Td>
                  <Td right> </Td>
                  <Td right> </Td>
                  <Td right>
                    <Money value={totalRoyalty} className="font-semibold" />
                  </Td>
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </Card>
    </Page>
  );
}
