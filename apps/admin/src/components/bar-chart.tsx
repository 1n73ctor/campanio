'use client';

import { useMemo, useState } from 'react';

interface Datum {
  label: string;
  value: number;
}

/**
 * Single-series column chart (no legend — the title names the series).
 * Specs: ≤24px columns, 4px rounded data-end / square baseline, hairline recessive grid,
 * per-column hover tooltip with a full-band hit target, "view as table" for accessibility.
 */
export function BarChart({ title, data, color, format = (n) => n.toLocaleString('en-IN') }: { title: string; data: Datum[]; color: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const W = 560;
  const H = 200;
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const { max, ticks } = useMemo(() => {
    const raw = Math.max(1, ...data.map((d) => d.value));
    const step = niceStep(raw / 4);
    const top = Math.ceil(raw / step) * step;
    return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
  }, [data]);

  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <figure className="rounded-blob border-3 border-ink bg-white p-4 shadow-brutal">
      <figcaption className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-base font-extrabold">{title}</span>
        <button className="text-xs font-semibold text-ink-soft underline" onClick={() => setAsTable((t) => !t)}>
          {asTable ? 'View chart' : 'View as table'}
        </button>
      </figcaption>
      {asTable ? (
        <table className="w-full text-sm">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-ink/10">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E8E4DC" strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6b6b6b">
                  {compact(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = pad.l + band * i + band / 2;
              const x = cx - barW / 2;
              const top = y(d.value);
              const h = pad.t + plotH - top;
              const r = Math.min(4, h, barW / 2);
              const path = h > 0 ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z` : '';
              return (
                <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                  <rect x={pad.l + band * i} y={pad.t} width={band} height={plotH} fill={hover === i ? '#14141408' : 'transparent'} />
                  {path && <path d={path} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />}
                  {i % 2 === 0 && (
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="#6b6b6b">
                      {d.label}
                    </text>
                  )}
                  {i === peak && d.value > 0 && hover === null && (
                    <text x={cx} y={top - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#141414">
                      {compact(d.value)}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="#141414" strokeWidth={1} />
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 rounded-lg border-2 border-ink bg-white px-2.5 py-1.5 text-xs shadow-brutal-sm"
              style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%`, top: 0 }}
            >
              <p className="font-semibold text-ink-soft">{data[hover].label}</p>
              <p className="font-display text-sm font-extrabold tabular-nums">{format(data[hover].value)}</p>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

function niceStep(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1))));
  const n = x / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const compact = (n: number) => (n >= 100000 ? `${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : String(n));
