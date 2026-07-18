// Lichte, dependency-vrije SVG-grafieken (pure server components → geen
// hydratatie, altijd correct gerenderd). Bewust simpel en strak gehouden.

import { formatEuro } from "@/lib/format";

const ACCENT = "#0f766e";
const OMZET = "#cdd8d4";

export function MonthlyTrendChart({
  data,
}: {
  data: Array<{ periode: string; omzet: number; royalty: number }>;
}) {
  const W = 920;
  const H = 260;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;

  const omzetMax = Math.max(...data.map((d) => d.omzet), 1);
  const royMax = Math.max(...data.map((d) => d.royalty), 1);
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yO = (v: number) => padT + plotH - (v / omzetMax) * plotH;
  const yR = (v: number) => padT + plotH - (v / royMax) * plotH;

  const areaTop = data.map((d, i) => `${x(i).toFixed(1)},${yO(d.omzet).toFixed(1)}`).join(" L ");
  const areaPath = `M ${padL},${padT + plotH} L ${areaTop} L ${(padL + plotW).toFixed(1)},${padT + plotH} Z`;
  const linePath = "M " + data.map((d, i) => `${x(i).toFixed(1)},${yR(d.royalty).toFixed(1)}`).join(" L ");

  const gridY = [0.25, 0.5, 0.75, 1].map((f) => padT + plotH - f * plotH);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-72 w-full" preserveAspectRatio="none" role="img" aria-label="Omzet en royalty per maand">
      {gridY.map((gy, i) => (
        <line key={i} x1={padL} x2={padL + plotW} y1={gy} y2={gy} stroke="#eee" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      <path d={areaPath} fill={OMZET} fillOpacity={0.55} stroke="none" />
      <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {data.map((d, i) =>
        i % 6 === 0 ? (
          <text key={i} x={x(i)} y={H - 6} fontSize={11} fill="#a8a29e" textAnchor={i === 0 ? "start" : "middle"}>
            {d.periode}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function HorizontalBars({
  data,
  color = ACCENT,
}: {
  data: Array<{ label: string; value: number; sub?: string }>;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{d.label}</span>
            <span className="tabular shrink-0 text-muted">{formatEuro(d.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          {d.sub && <div className="mt-0.5 text-xs text-faint">{d.sub}</div>}
        </div>
      ))}
    </div>
  );
}
