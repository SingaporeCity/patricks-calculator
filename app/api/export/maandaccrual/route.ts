import { getAvailableYears, getProductAccrualAll } from "@/lib/data";

export const dynamic = "force-dynamic";

// nl-vriendelijke getallen (komma-decimaal) + puntkomma-scheiding voor Excel-NL.
function nl(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
function cell(value: string | number): string {
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jaarParam = url.searchParams.get("jaar");
  const contractId = url.searchParams.get("contract") || undefined;
  const years = await getAvailableYears();
  const year = jaarParam && years.includes(Number(jaarParam)) ? Number(jaarParam) : undefined;

  const rows = await getProductAccrualAll({ year, contractId });

  const header = ["productcode", "product", "contractnummer", "contract", "periode", "omzet", "aantal", "tarief_pct", "royaltykost"];
  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [
        cell(r.productCode),
        cell(r.productTitle),
        cell(r.contractNumber),
        cell(r.contractName),
        cell(r.periode),
        nl(r.omzet),
        String(r.aantal),
        nl(r.ratePct),
        nl(r.royaltyCost),
      ].join(";"),
    );
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM zodat Excel UTF-8 herkent
  const naam = `maandaccrual_${year ?? "alle"}${contractId ? "_gefilterd" : ""}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${naam}"`,
    },
  });
}
