import Link from "next/link";
import { notFound } from "next/navigation";
import { authorName, getContractDetail } from "@/lib/data";
import { formatEuro, formatFractionPct, formatNumber, formatRatePct } from "@/lib/format";
import { Badge, Card, Money, Num, Page, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getContractDetail(id);
  if (!detail) notFound();

  const { contract, products, authors, accruals, payouts, totalRevenue, totalRoyalty, brackets } = detail;
  const nameById = new Map(authors.map((a) => [a.author.id, authorName(a.author)]));

  // Per boekjaar samenvatten.
  const byYear = new Map<number, { omzet: number; aantal: number; royalty: number }>();
  for (const a of accruals) {
    const cur = byYear.get(a.boekjaar) ?? { omzet: 0, aantal: 0, royalty: 0 };
    cur.omzet += a.omzet;
    cur.aantal += a.aantal;
    cur.royalty += a.royaltyCost;
    byYear.set(a.boekjaar, cur);
  }
  const yearRows = [...byYear.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <Page>
      <PageHeader
        title={contract.name}
        description={contract.startDate ? `${contract.contractNumber} · gestart ${contract.startDate}` : contract.contractNumber}
        back={{ href: "/contracten", label: "Contracten" }}
        right={
          contract.royaltyModel === "tiered" ? (
            <Badge tone="accent">Staffel</Badge>
          ) : (
            <Badge>Vast {formatRatePct(contract.flatRatePct)}</Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatMini label="Omzet" value={formatEuro(totalRevenue)} />
        <StatMini label="Royalty-kosten" value={formatEuro(totalRoyalty)} accent />
        <StatMini label="Gem. effectief tarief" value={formatFractionPct(totalRevenue ? totalRoyalty / totalRevenue : 0)} />
        <StatMini
          label="Openstaand voorschot"
          value={formatEuro(authors.reduce((s, a) => s + a.outstanding, 0))}
          warn
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Royaltyafspraak */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Royaltyafspraak</h2>
          {contract.royaltyModel === "tiered" ? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Schijf (exemplaren)</Th>
                    <Th right>Tarief</Th>
                  </tr>
                </thead>
                <tbody>
                  {brackets.map((b, i) => (
                    <tr key={i}>
                      <Td>
                        {formatNumber(b.lowerUnits)} – {b.upperUnits === null ? "∞" : formatNumber(b.upperUnits)}
                      </Td>
                      <Td right>{formatRatePct(b.ratePct)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="mt-3 text-xs text-muted">
                Staffel telt per {contract.tierAccumulator === "contract" ? "contract" : "product"}, reset{" "}
                {contract.tierReset === "year" ? "per boekjaar" : "levenslang (loopt door)"}. Marginaal: elke schijf
                telt tegen zijn eigen tarief.
              </p>
            </>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold text-accent-strong">{formatRatePct(contract.flatRatePct)}</span>
              <span className="text-sm text-muted">van de omzet</span>
            </div>
          )}
        </Card>

        {/* Auteurs & aandeel */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Auteurs & aandeel</h2>
            <span className="text-xs text-muted">
              som {formatRatePct(authors.reduce((s, a) => s + a.share, 0))}
            </span>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Auteur</Th>
                <Th right>Aandeel</Th>
                <Th right>Voorschot</Th>
                <Th right>Openstaand</Th>
              </tr>
            </thead>
            <tbody>
              {authors.map((a) => (
                <tr key={a.author.id} className="hover:bg-paper">
                  <Td>
                    <Link href={`/auteurs/${a.author.id}`} className="font-medium hover:text-accent-strong">
                      {authorName(a.author)}
                    </Link>
                  </Td>
                  <Td right>{formatRatePct(a.share)}</Td>
                  <Td right>{a.advance > 0 ? formatEuro(a.advance) : <span className="text-faint">—</span>}</Td>
                  <Td right>
                    {a.outstanding > 0 ? <span className="text-warn">{formatEuro(a.outstanding)}</span> : <span className="text-faint">—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* Producten */}
      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Producten ({products.length})</h2>
        <div className="flex flex-wrap gap-2">
          {products.map((p) => (
            <Link
              key={p.id}
              href="/producten"
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm hover:border-accent"
            >
              <span className="font-medium">{p.title}</span>
              <span className="ml-2 text-xs text-muted">{p.code}</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* Royalty per boekjaar */}
      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Royalty per boekjaar</h2>
        <Table>
          <thead>
            <tr>
              <Th>Boekjaar</Th>
              <Th right>Aantal exemplaren</Th>
              <Th right>Omzet</Th>
              <Th right>Royalty-kosten</Th>
              <Th right>Effectief tarief</Th>
            </tr>
          </thead>
          <tbody>
            {yearRows.map(([year, v]) => (
              <tr key={year} className="hover:bg-paper">
                <Td>{year}</Td>
                <Td right>
                  <Num value={v.aantal} />
                </Td>
                <Td right>
                  <Money value={v.omzet} className="text-muted" />
                </Td>
                <Td right>
                  <Money value={v.royalty} />
                </Td>
                <Td right>{formatFractionPct(v.omzet ? v.royalty / v.omzet : 0)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Uitbetaling per auteur */}
      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Uitbetaling per auteur</h2>
        <Table>
          <thead>
            <tr>
              <Th>Boekjaar</Th>
              <Th>Auteur</Th>
              <Th right>Aandeel</Th>
              <Th right>Verdiend</Th>
              <Th right>Voorschot verrekend</Th>
              <Th right>Uitbetaling</Th>
            </tr>
          </thead>
          <tbody>
            {payouts
              .slice()
              .sort((a, b) => (a.boekjaar === b.boekjaar ? 0 : a.boekjaar - b.boekjaar))
              .map((p) => (
                <tr key={`${p.authorId}-${p.boekjaar}`} className="hover:bg-paper">
                  <Td>{p.boekjaar}</Td>
                  <Td>{nameById.get(p.authorId)}</Td>
                  <Td right>{formatRatePct(p.share)}</Td>
                  <Td right>
                    <Money value={p.earnedAuthor} className="text-muted" />
                  </Td>
                  <Td right>
                    {p.recouped > 0 ? <span className="text-warn">−{formatEuro(p.recouped)}</span> : <span className="text-faint">—</span>}
                  </Td>
                  <Td right>
                    <Money value={p.payout} />
                  </Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </Card>

      {/* Maandelijkse berekening */}
      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Maandelijkse berekening</h2>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <thead>
              <tr>
                <Th>Periode</Th>
                <Th right>Aantal</Th>
                <Th right>Omzet</Th>
                <Th right>Royalty-kost</Th>
                <Th right>Effectief tarief</Th>
              </tr>
            </thead>
            <tbody>
              {accruals.map((a) => (
                <tr key={a.periode} className="hover:bg-paper">
                  <Td>{a.periode}</Td>
                  <Td right>
                    <Num value={a.aantal} />
                  </Td>
                  <Td right>
                    <Money value={a.omzet} className="text-muted" />
                  </Td>
                  <Td right>
                    <Money value={a.royaltyCost} />
                  </Td>
                  <Td right>{formatFractionPct(a.effectiveRate)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </Page>
  );
}

function StatMini({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div
        className={`tabular mt-1.5 text-xl font-semibold ${accent ? "text-accent-strong" : ""} ${warn ? "text-warn" : ""}`}
      >
        {value}
      </div>
    </Card>
  );
}
