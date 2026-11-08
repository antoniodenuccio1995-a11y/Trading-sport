// Grafici SVG leggeri: seguono i colori del tema (variabili CSS) e si adattano alla larghezza.
import type { ComponentChildren } from "preact";
import type { Zone } from "../../stats/zones";

export const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];

export interface Series { name: string; color: string; values: (number | null)[]; info?: (i: number) => string }

/** Posizione in classifica nel tempo: 1° in alto. */
export function RankChart({ x, series, max, zones = [], height = 260, label }: {
  x: string[]; series: Series[]; max: number; zones?: Zone[]; height?: number; label: string;
}) {
  const W = 720, H = height, m = { l: 34, r: 30, t: 12, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, top = Math.max(2, max);
  const X = (i: number) => m.l + (x.length <= 1 ? iw / 2 : (iw * i) / (x.length - 1));
  const Y = (r: number) => m.t + ((r - 1) / (top - 1)) * ih;
  const step = top <= 12 ? 1 : top <= 24 ? 2 : 5;
  const ticks: number[] = [];
  for (let r = 1; r <= top; r += step) ticks.push(r);
  if (ticks[ticks.length - 1] !== top) {
    if (top - ticks[ticks.length - 1] < step) ticks.pop(); // evita etichette sovrapposte (es. 19° e 20°)
    ticks.push(top);
  }
  const xt = new Set<number>();
  const nx = Math.min(6, x.length);
  for (let k = 0; k < nx; k++) xt.add(Math.round((k * (x.length - 1)) / Math.max(1, nx - 1)));
  const band = ih / (top - 1);
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {zones.map((z) => {
        const y0 = Math.max(m.t - band / 2, Y(z.from) - band / 2), y1 = Math.min(m.t + ih + band / 2, Y(z.to) + band / 2);
        return (
          <g key={`${z.label}${z.from}`} class={`zone z-${z.tone}`}>
            <rect x={m.l} width={iw} y={y0} height={Math.max(2, y1 - y0)} class="zone-band"><title>{`${z.label}: ${z.from}°–${z.to}°`}</title></rect>
            <rect x={m.l - 30} width={5} y={y0 + 1} height={Math.max(2, y1 - y0 - 2)} rx={2} class="zone-strip"><title>{z.label}</title></rect>
          </g>
        );
      })}
      {ticks.map((r) => (
        <g key={r}>
          <line x1={m.l} x2={W - m.r} y1={Y(r)} y2={Y(r)} class={r === 1 ? "axis" : "grid"} />
          <text x={m.l - 8} y={Y(r) + 4} text-anchor="end" class="tick">{r}°</text>
        </g>
      ))}
      {[...xt].map((i) => <text key={i} x={X(i)} y={H - 8} text-anchor="middle" class="tick">{x[i]}</text>)}
      {series.map((s) => {
        const pts = s.values.map((v, i) => (v === null ? null : [X(i), Y(v)] as const));
        const segs: string[] = [];
        let cur: string[] = [];
        pts.forEach((p) => { if (p) cur.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); else { if (cur.length > 1) segs.push(cur.join(" ")); cur = []; } });
        if (cur.length > 1) segs.push(cur.join(" "));
        const lastI = s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop();
        return (
          <g key={s.name} style={`color:${s.color}`}>
            {segs.map((p, k) => <polyline key={k} points={p} class="line" />)}
            {pts.map((p, i) => p && (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === lastI ? 4.5 : x.length > 40 ? 0 : 2.6} class="dot">
                <title>{`${s.name} · ${x[i]} · ${s.values[i]}°${s.info ? ` · ${s.info(i)}` : ""}`}</title>
              </circle>
            ))}
            {lastI !== undefined && <text x={X(lastI) + 8} y={Y(s.values[lastI]!) + 4} class="end-label">{s.values[lastI]}°</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return <div class="legend">{items.map((i) => <span key={i.name}><i style={`background:${i.color}`} />{i.name}</span>)}</div>;
}

/** Barra divisa in due (es. gol 1° tempo / 2° tempo). */
export function SplitBar({ a, b, la, lb }: { a: number; b: number; la: string; lb: string }) {
  const t = a + b;
  if (!t) return <div class="split empty">—</div>;
  const pa = (100 * a) / t;
  return (
    <div class="split" role="img" aria-label={`${la} ${Math.round(pa)}%, ${lb} ${Math.round(100 - pa)}%`}>
      <div class="s1" style={`width:${pa}%`}>{pa >= 18 ? `${la} ${Math.round(pa)}%` : ""}</div>
      <div class="s2" style={`width:${100 - pa}%`}>{100 - pa >= 18 ? `${lb} ${Math.round(100 - pa)}%` : ""}</div>
    </div>
  );
}

/** Barra orizzontale di una percentuale, con un segno di riferimento (es. media lega). */
export function PctBar({ v, mark, color = "var(--accent)", children }: { v: number | null; mark?: number | null; color?: string; children?: ComponentChildren }) {
  return (
    <div class="pbar">
      <div class="pbar-track">
        {v !== null && <div class="pbar-fill" style={`width:${Math.max(0, Math.min(100, v))}%;background:${color}`} />}
        {mark !== null && mark !== undefined && <div class="pbar-ref" style={`left:${Math.max(0, Math.min(100, mark))}%`} title={`Media lega ${Math.round(mark)}%`} />}
      </div>
      <span class="pbar-val">{v === null ? "—" : `${Math.round(v)}%`}</span>
      {children}
    </div>
  );
}

/** Legenda delle zone di classifica. */
export function ZoneLegend({ zones }: { zones: Zone[] }) {
  const seen = new Set<string>();
  const items = zones.filter((z) => (seen.has(z.label) ? false : (seen.add(z.label), true)));
  if (!items.length) return null;
  return <div class="legend zones">{items.map((z) => <span key={z.label}><i class={`z-${z.tone}`} />{z.label} ({z.from === z.to ? `${z.from}°` : `${z.from}°–${z.to}°`})</span>)}</div>;
}
