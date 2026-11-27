import { useState } from "preact/hooks";
import { Tip, niceTicks, useWidth } from "./base.tsx";

export interface FlowBar { key: string; label: string; short: string; income: number; expense: number }

/** Colonne divergenti: entrate sopra lo zero, uscite sotto; un solo asse. */
export function FlowBars({ data, height = 250, format, tick, selected, onSelect }: {
  data: FlowBar[]; height?: number; format: (v: number) => string; tick: (v: number) => string; selected?: string;
  /** Clic: "in" sulla barra delle entrate, "out" su quella delle uscite, "all" sul resto della colonna. */
  onSelect?: (key: string, part: "in" | "out" | "all") => void;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 8, t: 12, b: 26 };
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const maxIn = Math.max(1, ...data.map((d) => d.income)), maxOut = Math.max(1, ...data.map((d) => d.expense));
  const ticks = niceTicks(-maxOut, maxIn, 4);
  const lo = ticks[0], hi = ticks.at(-1)!;
  const Y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(26, slot * 0.56));
  const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 46)));
  const h = hover != null ? data[hover] : null;
  return (
    <div class="chart-wrap" ref={ref}>
      <svg class="chart" width={w} height={height} role="img" aria-label="Entrate e uscite per mese" onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line class={t === 0 ? "axis-l" : "grid-l"} x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} />
            <text x={pad.l - 8} y={Y(t) + 4} text-anchor="end">{tick(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2;
          const dim = (hover != null && hover !== i) || (selected && selected !== d.key && hover == null);
          const net = d.income - d.expense;
          return (
            <g key={d.key} opacity={dim ? 0.45 : 1} style={{ transition: "opacity 150ms ease" }}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" style={{ cursor: onSelect ? "pointer" : "default" }}
                onPointerEnter={() => setHover(i)} onClick={() => onSelect?.(d.key, "all")} />
              {d.income > 0 && <rect class="bar-in hit" style={{ animationDelay: i * 18 + "ms" }} x={cx - bw / 2} y={Y(d.income)} width={bw} height={Math.max(1, Y(0) - Y(d.income) - 1)} rx="4" fill="var(--in)"
                onPointerEnter={() => setHover(i)} onClick={() => onSelect?.(d.key, "in")} />}
              {d.expense > 0 && <rect class="bar-in neg hit" style={{ animationDelay: i * 18 + "ms" }} x={cx - bw / 2} y={Y(0) + 1} width={bw} height={Math.max(1, Y(-d.expense) - Y(0) - 1)} rx="4" fill="var(--out)"
                onPointerEnter={() => setHover(i)} onClick={() => onSelect?.(d.key, "out")} />}
              <circle cx={cx} cy={Y(net)} r="3.5" fill="var(--text)" stroke="var(--surface-1)" stroke-width="2" pointer-events="none" />
              {(i % every === 0) && <text x={cx} y={height - 6} text-anchor="middle">{d.short}</text>}
            </g>
          );
        })}
      </svg>
      {h && (
        <Tip x={Math.min(Math.max(pad.l + slot * hover! + slot / 2, 90), w - 90)} y={Y(h.income) }>
          <b>{h.label}</b>
          <div class="r"><span><i class="swatch" style={{ background: "var(--in)" }} />Entrate</span><span class="money">{format(h.income)}</span></div>
          <div class="r"><span><i class="swatch" style={{ background: "var(--out)" }} />Uscite</span><span class="money">{format(h.expense)}</span></div>
          <div class="r"><span><i class="swatch" style={{ background: "var(--text)", borderRadius: "50%" }} />Risparmio</span><span class="money">{format(h.income - h.expense)}</span></div>
          {onSelect && <div class="tip-hint">Clicca una barra per i movimenti</div>}
        </Tip>
      )}
      <div class="legend">
        <span><i style={{ background: "var(--in)" }} />Entrate</span>
        <span><i style={{ background: "var(--out)" }} />Uscite</span>
        <span><i style={{ background: "var(--text)", borderRadius: "50%" }} />Risparmio (entrate − uscite)</span>
      </div>
    </div>
  );
}

/** Colonne semplici (es. spesa media per giorno della settimana). */
export function SimpleBars({ data, height = 160, format, color = "var(--accent)", onPick }: { data: { label: string; value: number; note?: string }[]; height?: number; format: (v: number) => string; color?: string; onPick?: (i: number) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { t: 18, b: 22 };
  const ih = height - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = w / Math.max(1, data.length), bw = Math.min(34, slot * 0.6);
  const top = Math.max(...data.map((d) => d.value));
  return (
    <div class="chart-wrap" ref={ref}>
      <svg class="chart" width={w} height={height} onPointerLeave={() => setHover(null)}>
        <line class="axis-l" x1="0" x2={w} y1={pad.t + ih} y2={pad.t + ih} />
        {data.map((d, i) => {
          const hgt = (d.value / max) * ih, cx = slot * i + slot / 2;
          return (
            <g key={d.label} onPointerEnter={() => setHover(i)} onClick={() => onPick?.(i)} style={onPick ? { cursor: "pointer" } : undefined}>
              <rect class="bar-in" style={{ animationDelay: i * 20 + "ms" }} x={cx - bw / 2} y={pad.t + ih - hgt} width={bw} height={Math.max(1, hgt)} rx="4"
                fill={color} opacity={d.value === top ? 1 : 0.55} />
              {d.value === top && <text x={cx} y={pad.t + ih - hgt - 5} text-anchor="middle" style={{ fill: "var(--text-2)" }}>{format(d.value)}</text>}
              <text x={cx} y={height - 5} text-anchor="middle">{d.label}</text>
              <rect x={slot * i} y="0" width={slot} height={height} fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <Tip x={Math.min(Math.max(slot * hover + slot / 2, 80), w - 80)} y={pad.t + ih - (data[hover].value / max) * ih}>
          <b>{data[hover].label}</b>
          <div class="r"><span>Media</span><span class="money">{format(data[hover].value)}</span></div>
          {data[hover].note && <div class="r faint"><span>{data[hover].note}</span></div>}
          {onPick && <div class="tip-hint">Clicca per i movimenti</div>}
        </Tip>
      )}
    </div>
  );
}
