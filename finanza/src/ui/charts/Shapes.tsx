import { useMemo, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { Tip, useGrow, useWidth } from "./base.tsx";

// ---------- ciambella ----------
export interface Seg { id: string; label: string; value: number; color: string }
export function Donut({ segs, size = 190, thickness = 20, center, format, onPick }: { segs: Seg[]; size?: number; thickness?: number; center?: ComponentChildren; format: (v: number) => string; onPick?: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segs.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const r = (size - thickness) / 2, c = size / 2;
  let acc = 0;
  const gap = segs.length > 1 ? 0.7 : 0;
  const h = segs.find((s) => s.id === hover);
  const k = useGrow(900);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `rotate(${-90 - (1 - k) * 60}deg)` }} role="img" aria-label="Ripartizione">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-3)" stroke-width={thickness} />
        {segs.map((s) => {
          const len = (Math.max(0, s.value) / total) * 100 * k;
          const shown = Math.max(0.01, len - gap);
          const el = (
            <circle key={s.id} cx={c} cy={c} r={r} fill="none" stroke={s.color} stroke-width={hover === s.id ? thickness + 4 : thickness}
              pathLength={100} stroke-dasharray={`${shown} ${100 - shown}`} stroke-dashoffset={-acc}
              opacity={hover && hover !== s.id ? 0.35 : 1} style={{ transition: "opacity 150ms ease, stroke-width 150ms ease", cursor: onPick ? "pointer" : "default" }}
              onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)} onClick={() => onPick?.(s.id)} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: thickness + 6, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
        {h ? <div><div class="faint" style={{ fontSize: "11.5px" }}>{h.label}</div><div class="mid money" style={{ fontSize: "19px" }}>{format(h.value)}</div><div class="faint" style={{ fontSize: "11.5px" }}>{Math.round((h.value / total) * 100)}%</div></div> : center}
      </div>
    </div>
  );
}

// ---------- sparkline ----------
export function Spark({ values, color = "var(--accent)", height = 44, width = 140, area = true, fluid = false }: { values: number[]; color?: string; height?: number; width?: number; area?: boolean; fluid?: boolean }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const X = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const Y = (v: number) => height - 3 - ((v - min) / span) * (height - 8);
  const d = values.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join("");
  const id = "sp" + Math.abs(values.reduce((h, v) => (h * 31 + Math.round(v)) | 0, 7));
  return (
    <svg class="chart" style={{ width: fluid ? "100%" : width + "px" }} width={fluid ? "100%" : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color={color} stop-opacity=".28" /><stop offset="1" stop-color={color} stop-opacity="0" /></linearGradient></defs>
      {area && <path d={d + `L${X(values.length - 1)},${height}L${X(0)},${height}Z`} fill={`url(#${id})`} class="area-in" />}
      <path d={d} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength={1} class="draw" vector-effect="non-scaling-stroke" />
      {!fluid && <circle cx={X(values.length - 1)} cy={Y(values.at(-1)!)} r="3" fill={color} />}
    </svg>
  );
}

// ---------- anello di avanzamento ----------
export function Ring({ pct, size = 46, stroke = 5, color }: { pct: number; size?: number; stroke?: number; color: string }) {
  const k = useGrow(1000, 150);
  const r = (size - stroke) / 2, p = Math.max(0, Math.min(1, pct)) * k;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flex: "none" }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" stroke-width={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round" pathLength={100}
        stroke-dasharray={`${p * 100} 100`} />
    </svg>
  );
}

// ---------- calendario (heatmap) ----------
export function Heatmap({ days, end, weeks = 26, format, levels, onPick }: { days: Map<string, number>; end: string; weeks?: number; format: (v: number) => string; levels?: number[]; onPick?: (date: string) => void }) {
  const [tip, setTip] = useState<{ x: number; y: number; d: string; v: number } | null>(null);
  const cells = useMemo(() => {
    const e = new Date(end + "T00:00:00Z");
    const dow = (e.getUTCDay() + 6) % 7; // lunedì = 0
    const startT = e.getTime() - ((weeks - 1) * 7 + dow) * 86400000;
    const out: { d: string; v: number }[] = [];
    for (let t = startT; t <= e.getTime() + (6 - dow) * 86400000; t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      out.push({ d, v: t > e.getTime() ? -1 : days.get(d) ?? 0 });
    }
    return out;
  }, [days, end, weeks]);
  const th = levels ?? (() => {
    const vals = cells.map((c) => c.v).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 0;
    return [q(0.2), q(0.4), q(0.6), q(0.8)];
  })();
  const lvl = (v: number) => (v <= 0 ? 0 : v <= th[0] ? 1 : v <= th[1] ? 2 : v <= th[2] ? 3 : v <= th[3] ? 4 : 5);
  const MS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const monthCols: { col: number; label: string }[] = [];
  cells.forEach((c, i) => { if (i % 7 === 0) { const day = Number(c.d.slice(8, 10)); if (day <= 7) monthCols.push({ col: i / 7, label: MS[Number(c.d.slice(5, 7)) - 1] }); } });
  return (
    <div class="chart-wrap" style={{ overflowX: "auto" }} onPointerLeave={() => setTip(null)}>
      <div style={{ display: "grid", gridTemplateColumns: `22px repeat(${weeks}, 16px)`, fontSize: "10.5px", color: "var(--text-3)", marginBottom: "4px" }}>
        <span />{Array.from({ length: weeks }, (_, i) => <span key={i}>{monthCols.find((m) => m.col === i)?.label ?? ""}</span>)}
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <div style={{ display: "grid", gridTemplateRows: "repeat(7, 13px)", gap: "3px", fontSize: "10px", color: "var(--text-3)", width: "16px" }}>
          {["L", "", "M", "", "V", "", "D"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div class="heat">
          {cells.map((c, i) => (
            <i key={c.d} class={onPick && c.v > 0 ? "hit" : undefined} onClick={() => { if (onPick && c.v > 0) onPick(c.d); }}
              style={{ background: c.v < 0 ? "transparent" : `var(--seq-${lvl(c.v)})`, animationDelay: Math.floor(i / 7) * 12 + "ms" }}
              onPointerEnter={(e) => { if (c.v < 0) return; const r = (e.currentTarget as HTMLElement); setTip({ x: r.offsetLeft + 28, y: r.offsetTop + 16, d: c.d, v: c.v }); }} />
          ))}
        </div>
      </div>
      <div class="legend" style={{ alignItems: "center" }}>
        <span>meno</span>{[0, 1, 2, 3, 4, 5].map((l) => <i key={l} style={{ background: `var(--seq-${l})`, width: "12px", height: "12px" }} />)}<span>più</span>
      </div>
      {tip && <Tip x={tip.x} y={tip.y}><b>{new Date(tip.d + "T12:00:00Z").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</b><div class="r"><span>Spese</span><span class="money">{format(tip.v)}</span></div>{onPick && tip.v > 0 && <div class="tip-hint">Clicca per i movimenti</div>}</Tip>}
    </div>
  );
}

// ---------- Sankey ----------
export interface SNode { id: string; label: string; color: string; col?: number }
const short = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
export interface SLink { source: string; target: string; value: number }
export function Sankey({ nodes, links, height = 380, format, onPick }: { nodes: SNode[]; links: SLink[]; height?: number; format: (v: number) => string; onPick?: (nodeId: string) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ kind: "n" | "l"; id: string; x: number; y: number } | null>(null);
  const layout = useMemo(() => {
    const L = links.filter((l) => l.value > 0.5);
    const ids = new Set(L.flatMap((l) => [l.source, l.target]));
    const N = nodes.filter((n) => ids.has(n.id));
    // colonna = lunghezza del cammino più lungo dalle sorgenti
    const col = new Map<string, number>(N.map((n) => [n.id, n.col ?? 0]));
    if (!N.some((n) => n.col != null)) for (let k = 0; k < N.length; k++) for (const l of L) col.set(l.target, Math.max(col.get(l.target)!, col.get(l.source)! + 1));
    const ncol = Math.max(...col.values()) + 1;
    const inV = new Map<string, number>(), outV = new Map<string, number>();
    for (const l of L) { outV.set(l.source, (outV.get(l.source) ?? 0) + l.value); inV.set(l.target, (inV.get(l.target) ?? 0) + l.value); }
    const val = (id: string) => Math.max(inV.get(id) ?? 0, outV.get(id) ?? 0);
    const cols: SNode[][] = Array.from({ length: ncol }, () => []);
    for (const n of N) cols[col.get(n.id)!].push(n);
    const gap = 10, padT = 4;
    const k = Math.min(...cols.map((c) => (height - padT * 2 - gap * Math.max(0, c.length - 1)) / Math.max(1, c.reduce((s, n) => s + val(n.id), 0))));
    const pos = new Map<string, { x: number; y: number; h: number; c: number }>();
    const lastChars = Math.max(8, ...cols[ncol - 1].map((n) => short(n.label).length + 8));
    const nodeW = 12, labelRoom = Math.min(w < 560 ? 110 : 250, lastChars * 6.3 + 12);
    cols.forEach((c, ci) => {
      const total = c.reduce((s, n) => s + val(n.id), 0) * k + gap * Math.max(0, c.length - 1);
      let y = padT + (height - padT * 2 - total) / 2;
      const x = ncol === 1 ? 0 : (ci / (ncol - 1)) * (w - nodeW - labelRoom) + (ci === ncol - 1 ? 0 : 0);
      for (const n of c) { const h = Math.max(2, val(n.id) * k); pos.set(n.id, { x, y, h, c: ci }); y += h + gap; }
    });
    const so = new Map<string, number>(), to = new Map<string, number>();
    const paths = L.map((l) => {
      const s = pos.get(l.source)!, t = pos.get(l.target)!, lw = Math.max(1, l.value * k);
      const sy = s.y + (so.get(l.source) ?? 0) + lw / 2, ty = t.y + (to.get(l.target) ?? 0) + lw / 2;
      so.set(l.source, (so.get(l.source) ?? 0) + lw); to.set(l.target, (to.get(l.target) ?? 0) + lw);
      const x0 = s.x + nodeW, x1 = t.x, mx = (x0 + x1) / 2;
      return { l, d: `M${x0},${sy}C${mx},${sy} ${mx},${ty} ${x1},${ty}`, lw, sy, ty, x0, x1 };
    });
    return { N, pos, paths, nodeW, ncol, val };
  }, [nodes, links, w, height]);
  const color = (id: string) => nodes.find((n) => n.id === id)?.color ?? "var(--s0)";
  const hl = (p: { l: SLink }) => !hover || (hover.kind === "l" ? hover.id === p.l.source + ">" + p.l.target : hover.id === p.l.source || hover.id === p.l.target);
  return (
    <div class="chart-wrap" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg class="chart" width={w} height={height} role="img" aria-label="Flusso di cassa">
        {layout.paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={color(p.l.source === "in" ? p.l.target : p.l.source)} stroke-width={p.lw}
            opacity={hl(p) ? 0.38 : 0.08} style={{ transition: "opacity 150ms ease", animation: `fade 700ms var(--ease-out) ${100 + i * 15}ms both`, cursor: onPick ? "pointer" : "default" }}
            onClick={() => onPick?.(p.l.target === "entrate" ? p.l.source : p.l.target)}
            onPointerMove={(e) => { const r = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect(); setHover({ kind: "l", id: p.l.source + ">" + p.l.target, x: e.clientX - r.left, y: e.clientY - r.top }); }} />
        ))}
        {layout.N.map((n) => {
          const p = layout.pos.get(n.id)!;
          const last = p.c === layout.ncol - 1;
          return (
            <g key={n.id} onPointerEnter={() => setHover({ kind: "n", id: n.id, x: p.x + 6, y: p.y })} onClick={() => onPick?.(n.id)} style={onPick ? { cursor: "pointer" } : undefined}>
              <rect x={p.x} y={p.y} width={layout.nodeW} height={p.h} rx="3" fill={n.color} style={{ animation: "fade 400ms var(--ease-out) both" }} />
              {p.h >= 11 && (w >= 600 || last || p.c === 0) && (
                <text x={last ? p.x + layout.nodeW + 6 : p.x + layout.nodeW + 6} y={p.y + p.h / 2 + 4} style={{ fill: "var(--text)", fontWeight: 600, paintOrder: "stroke", stroke: "var(--surface-1)", strokeWidth: 3 }}>
                  {short(n.label, w < 600 ? 13 : last ? 24 : 18)} <tspan style={{ fill: "var(--text-3)", fontWeight: 500 }}>{format(layout.val(n.id))}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (() => {
        if (hover.kind === "n") { const n = nodes.find((x) => x.id === hover.id)!; return <Tip x={Math.min(Math.max(hover.x, 90), w - 90)} y={hover.y}><b>{n.label}</b><div class="r"><span>Totale</span><span class="money">{format(layout.val(n.id))}</span></div></Tip>; }
        const p = layout.paths.find((x) => x.l.source + ">" + x.l.target === hover.id)!;
        const lab = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
        return <Tip x={Math.min(Math.max(hover.x, 90), w - 90)} y={hover.y}><b>{lab(p.l.source)} → {lab(p.l.target)}</b><div class="r"><span>Importo</span><span class="money">{format(p.l.value)}</span></div></Tip>;
      })()}
    </div>
  );
}
