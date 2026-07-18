import { Download } from "lucide-react";
import { getAccrualTotals, getAvailableYears, getContractsForFilter, getProductAccrual } from "@/lib/data";
import { formatEuro0, formatRatePct } from "@/lib/format";
import { AccrualFilters } from "@/components/AccrualFilters";
import { Pagination } from "@/components/Pagination";
import { Card, Money, Num, Page, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";

const PAGE_SIZE = 100;

export default async function AccrualPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; contract?: string; page?: string }>;
}) {
  const { jaar, contract, page } = await searchParams;
  const years = await getAvailableYears();
  const selectedYear = jaar === "alle" ? null : jaar && years.includes(Number(jaar)) ? Number(jaar) : (years[0] ?? null);
  const selectedContract = contract ?? "";
  const pageNum = Math.max(1, Number(page) || 1);

  const filter = { year: selectedYear ?? undefined, contractId: selectedContract || undefined };
  const [contractOptions, totals, res] = await Promise.all([
    getContractsForFilter(),
    getAccrualTotals(filter),
    getProductAccrual({ ...filter, page: pageNum, pageSize: PAGE_SIZE }),
  ]);
  const totalPages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));

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
        <StatCard label="Omzet (selectie)" value={formatEuro0(totals.omzet)} />
        <StatCard label="Royaltykosten (selectie)" value={formatEuro0(totals.royalty)} tone="accent" />
        <StatCard label="Regels" value={res.total.toLocaleString("nl-NL")} />
      </div>

      <Card className="mt-6">
        <p className="px-5 pt-5 text-xs text-muted">
          Staat een product op meerdere contracten, dan verschijnt het per contract met het eigen percentage. Gebruik{" "}
          <strong>Exporteren (CSV)</strong> voor de volledige selectie in één bestand.
        </p>
        <Table>
          <thead>
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
            {res.rows.map((r, i) => (
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
            {res.rows.length === 0 && (
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
        <Pagination page={Math.min(pageNum, totalPages)} totalPages={totalPages} totalItems={res.total} />
      </Card>
    </Page>
  );
}
