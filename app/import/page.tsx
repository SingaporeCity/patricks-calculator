import { Upload } from "lucide-react";
import { isDemoMode } from "@/lib/data";
import { Badge, Card, Page, PageHeader, Table, Td, Th } from "@/components/ui";

export default function ImportPage() {
  return (
    <Page>
      <PageHeader
        title="Omzet importeren"
        description="Upload maandelijks een Excel- of CSV-bestand met omzet en aantal per product."
        right={isDemoMode ? <Badge tone="accent">Demo-modus</Badge> : undefined}
      />

      <Card className="p-8">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-paper py-12 text-center">
          <Upload className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm font-medium">Sleep een .xlsx of .csv hierheen</p>
          <p className="mt-1 text-xs text-muted">
            {isDemoMode
              ? "In demo-modus is de import uitgeschakeld — de 3 voorbeeldcontracten zijn al doorgerekend."
              : "Of klik om een bestand te kiezen."}
          </p>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Verwacht formaat</h2>
        <Table>
          <thead>
            <tr>
              <Th>product_id</Th>
              <Th>periode</Th>
              <Th right>omzet</Th>
              <Th right>aantal</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td className="tabular">9789001000035</Td>
              <Td className="tabular">2026-01</Td>
              <Td right>12.450,00</Td>
              <Td right>665</Td>
            </tr>
            <tr>
              <Td className="tabular">9789001000042</Td>
              <Td className="tabular">2026-01</Td>
              <Td right>3.200,50</Td>
              <Td right>210</Td>
            </tr>
          </tbody>
        </Table>
        <ul className="mt-4 space-y-1.5 text-xs text-muted">
          <li>
            • <span className="font-medium text-ink">product_id</span> is de productcode (bijv. ISBN); moet bestaan.
          </li>
          <li>
            • <span className="font-medium text-ink">periode</span> in formaat JJJJ-MM.
          </li>
          <li>• Een periode opnieuw uploaden vervangt die maand netjes (idempotent).</li>
          <li>• Na de import worden alle geraakte contracten automatisch herberekend.</li>
        </ul>
      </Card>
    </Page>
  );
}
