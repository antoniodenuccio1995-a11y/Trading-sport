import { useState } from "preact/hooks";
import { Tip, nearest, niceTicks, useWidth } from "./base.tsx";

export interface Series {
  id: string;
  label: string;
  color: string;
  values: (number | null)[]; // un valore per ogni x; null = assente (linea interrotta)
  dashed?: boolean;
  area?: boolean;
  width?: number;
}
export interface Band { lo: (number | null)[]; hi: (number | null)[]; color: string; label: string }

interface Props {
  xLabels: string[]; // etichetta di ogni x (tooltip)
  tickEvery?: number; // ogni quante x mostrare un'etichetta sull'asse
  axisLabel?: (i: number) => string;
  series: Series[];
  band?: Band;
  height?: number;
  yFormat: (v: number) => string;
  yTick?: (v: number) => string;
  zero?: boolean; // includi sempre lo zero
  markers?: { x: number; label: string }[];
  /** Clic su un punto dell'asse x (es. apre i movimenti di quel giorno o mese). */
  onPick?: (i: number) => void;
  pickHint?: string;
}

export function LineChart({ xLabels, tickEvery = 1, axisLabel, series, band, height = 240, yFormat, yTick, zero = true, markers = [], onPick, pickHint = "Clicca per vedere i movimenti" }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = xLabels.length;
  const pad = { l: 52, r: 12, t: 14, b: 26 };
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const all: number[] = [];
  for (const s of series) for (const v of s.values) if (v != null) all.push(v);
  if (band) for (const v of [...band.lo, ...band.hi]) if (v != null) all.push(v);
  let min = all.length ? Math.min(...all) : 0, max = all.length ? Math.max(...all) : 1;
  if (zero) { min = Math.min(0, min); max = Math.max(0, max); }
  const ticks = niceTicks(min, max, 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1] || 1;
  const X = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = (v: number) => pad.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const xs = Array.from({ length: n }, (_, i) => X(i));

  const path = (vals: (number | null)[]) => {
    let d = "", pen = false;
    vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); pen = true; });
    return d;
  };
  const areaPath = (vals: (number | null)[]) => {
    const idx = vals.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
    if (!idx.length) return "";
    const base = Y(Math.max(y0, Math.min(0, y1)));
    return path(vals) + `L${X(idx.at(-1)!).toFixed(1)},${base}L${X(idx[0]).toFixed(1)},${base}Z`;
  };
  const bandPath = band ? (() => {
    const pts = band.hi.map((v, i) => (v == null || band.lo[i] == null ? null : i)).filter((i): i is number => i != null);
    if (!pts.length) return "";
    return "M" + pts.map((i) => `${X(i).toFixed(1)},${Y(band.hi[i]!).toFixed(1)}`).join("L") + "L" + [...pts].reverse().map((i) => `${X(i).toFixed(1)},${Y(band.lo[i]!).toFixed(1)}`).join("L") + "Z";
  })() : "";

  const onMove = (e: PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    setHover(nearest(xs, e.clientX - r.left));
  };
  const gid = "g" + series.map((s) => s.id).join("").replace(/\W/g, "").slice(0, 12);
  const hv = hover != null ? series.map((s) => ({ s, v: s.values[hover] })).filter((x) => x.v != null) : [];
  const topY = hv.length ? Math.min(...hv.map((x) => Y(x.v!))) : 0;

  return (
    <div class="chart-wrap" ref={ref}>
      <svg class="chart" width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={onPick ? { cursor: "pointer" } : undefined}
        onClick={(e) => { if (!onPick) return; const r = (e.currentTarget as SVGElement).getBoundingClientRect(); onPick(nearest(xs, e.clientX - r.left)); }}>
        <defs>
          {series.filter((s) => s.area).map((s) => (
            <linearGradient id={gid + s.id} x1="0" x2="0" y1="0" y2="1" key={s.id}>
              <stop offset="0%" stop-color={s.color} stop-opacity="0.32" />
              <stop offset="100%" stop-color={s.color} stop-opacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line class={t === 0 ? "axis-l" : "grid-l"} x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} />
            <text x={pad.l - 8} y={Y(t) + 4} text-anchor="end">{(yTick ?? yFormat)(t)}</text>
          </g>
        ))}
        {xLabels.map((_, i) => (i % tickEvery === 0 || i === n - 1) && (n < 3 || i !== n - 1 || (n - 1) % tickEvery > tickEvery / 2) ? (
          <text key={i} x={X(i)} y={height - 6} text-anchor="middle">{axisLabel ? axisLabel(i) : xLabels[i]}</text>
        ) : null)}
        {markers.map((m) => (
          <g key={m.x}>
            <line x1={X(m.x)} x2={X(m.x)} y1={pad.t} y2={pad.t + ih} stroke="var(--text-3)" stroke-dasharray="2 4" />
            <text x={X(m.x) + 4} y={pad.t + 10}>{m.label}</text>
          </g>
        ))}
        {band && bandPath && <path d={bandPath} fill={band.color} opacity="0.14" class="area-in" />}
        {series.map((s) => s.area && <path key={"a" + s.id} d={areaPath(s.values)} fill={`url(#${gid + s.id})`} class="area-in" />)}
        {series.map((s) => (
          <path key={s.id} d={path(s.values)} fill="none" stroke={s.color} stroke-width={s.width ?? 2} stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray={s.dashed ? "5 5" : undefined} pathLength={s.dashed ? undefined : 1} class={s.dashed ? "area-in" : "draw"} />
        ))}
        {hover != null && (
          <g>
            <line x1={xs[hover]} x2={xs[hover]} y1={pad.t} y2={pad.t + ih} stroke="var(--text-3)" stroke-width="1" />
            {hv.map(({ s, v }) => <circle key={s.id} cx={xs[hover]} cy={Y(v!)} r="4.5" fill={s.color} stroke="var(--surface-1)" stroke-width="2" />)}
          </g>
        )}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" />
      </svg>
      {hover != null && hv.length > 0 && (
        <Tip x={Math.min(Math.max(xs[hover], 90), w - 90)} y={topY}>
          <b>{xLabels[hover]}</b>
          {hv.map(({ s, v }) => (
            <div class="r" key={s.id}><span><i class="swatch" style={{ background: s.color }} />{s.label}</span><span class="money">{yFormat(v!)}</span></div>
          ))}
          {band && band.lo[hover] != null && <div class="r faint"><span>{band.label}</span><span class="money">{yFormat(band.lo[hover]!)} – {yFormat(band.hi[hover]!)}</span></div>}
          {onPick && <div class="tip-hint">{pickHint}</div>}
        </Tip>
      )}
      {series.length > 1 && (
        <div class="legend">
          {series.map((s) => <span key={s.id}><i class={s.dashed ? "dash" : ""} style={{ background: s.color }} />{s.label}</span>)}
          {band && <span><i style={{ background: band.color, opacity: 0.3 }} />{band.label}</span>}
        </div>
      )}
    </div>
  );
}
