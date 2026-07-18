import { Download } from "lucide-react";
import { getAvailableYears, getContractSummaries, getProductAccrual } from "@/lib/data";
import { formatEuro0, formatRatePct } from "@/lib/format";
import { AccrualFilters } from "@/components/AccrualFilters";
import { Card, Money, Num, Page, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";

const ROW_CAP = 1500;

export default async function AccrualPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; contract?: string }>;
}) {
  const { jaar, contract } = await searchParams;
  const years = await getAvailableYears();
  // Standaard het nieuwste jaar (begrensd); "alle" = alle jaren.
  const selectedYear = jaar === "alle" ? null : jaar && years.includes(Number(jaar)) ? Number(jaar) : (years[0] ?? null);
  const selectedContract = contract ?? "";

  const summaries = await getContractSummaries();
  const contractOptions = summaries.map((s) => ({ id: s.contract.id, label: `${s.contract.contractNumber} — ${s.contract.name}` }));

  const rows = await getProductAccrual({ year: selectedYear ?? undefined, contractId: selectedContract || undefined });
  const totalOmzet = rows.reduce((s, r) => s + r.omzet, 0);
  const totalRoyalty = rows.reduce((s, r) => s + r.royaltyCost, 0);
  const shown = rows.slice(0, ROW_CAP);
  const capped = rows.length > ROW_CAP;

  const exportParams = new URLSearchParams();
  exportParams.set("jaar", selectedYear ? String(selectedYear) : "alle");
  if (selectedContract) exportParams.set("contract", selectedContract);
  const exportHref = `/api/export/maandaccrual?${exportParams}`;

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
          Staat een product op meerdere contracten, dan verschijnt het per contract met het eigen percentage.
          {capped && (
            <>
              {" "}
              Er zijn <strong>{rows.length.toLocaleString("nl-NL")}</strong> regels in deze selectie; hieronder de eerste{" "}
              {ROW_CAP.toLocaleString("nl-NL")}. Gebruik <strong>Exporteren (CSV)</strong> of een filter voor de volledige lijst.
            </>
          )}
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
              {shown.map((r, i) => (
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
          </Table>
        </div>
      </Card>
    </Page>
  );
}
