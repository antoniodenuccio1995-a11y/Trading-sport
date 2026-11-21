// Tabella statistiche squadra con confronto rispetto alla media del campionato.
import { avg, pct, type Agg } from "../../stats/team";
import { fmtNum, fmtPct, heat } from "../components/common";

export interface Col { label: string; agg: Agg; ref?: Agg | null; isRef?: boolean }
type Kind = "num" | "pct" | "inv" | "plain";
const ROWS: [string, (g: Agg) => number | null, Kind][] = [
  ["Punti a partita", (g) => avg(g.pts, g.n), "num"],
  ["Vittorie", (g) => pct(g.w, g.n), "pct"],
  ["Pareggi", (g) => pct(g.d, g.n), "plain"],
  ["Sconfitte", (g) => pct(g.l, g.n), "inv"],
  ["Gol fatti (media)", (g) => avg(g.gf, g.n), "num"],
  ["Gol subiti (media)", (g) => avg(g.ga, g.n), "num"],
  ["Gol totali (media)", (g) => avg(g.gf + g.ga, g.n), "num"],
  ["Over 0,5", (g) => pct(g.o05, g.n), "pct"],
  ["Over 1,5", (g) => pct(g.o15, g.n), "pct"],
  ["Over 2,5", (g) => pct(g.o25, g.n), "pct"],
  ["Over 3,5", (g) => pct(g.o35, g.n), "pct"],
  ["Entrambe segnano (GG)", (g) => pct(g.btts, g.n), "pct"],
  ["Porta inviolata", (g) => pct(g.cs, g.n), "pct"],
  ["Non ha segnato", (g) => pct(g.fts, g.n), "inv"],
  ["1° tempo: gol medi", (g) => avg(g.htGf + g.htGa, g.htN), "num"],
  ["1° tempo: Over 0,5", (g) => pct(g.ht05, g.htN), "pct"],
  ["1° tempo: Over 1,5", (g) => pct(g.ht15, g.htN), "pct"],
  ["In vantaggio all'intervallo", (g) => pct(g.htW, g.htN), "pct"],
  ["2° tempo: Over 0,5", (g) => pct(g.sh05, g.htN), "pct"],
  ["2° tempo: Over 1,5", (g) => pct(g.sh15, g.htN), "pct"],
  ["Corner a favore (media)", (g) => avg(g.coF, g.coN), "num"],
  ["Corner contro (media)", (g) => avg(g.coA, g.coN), "num"],
  ["Tiri in porta a favore", (g) => avg(g.soF, g.soN), "num"],
  ["Tiri in porta contro", (g) => avg(g.soA, g.soN), "num"],
  ["Cartellini gialli (media)", (g) => avg(g.yeF, g.yeN), "num"],
];

function Delta({ v, r, kind, refName }: { v: number | null; r: number | null; kind: Kind; refName: string }) {
  if (v === null || r === null) return null;
  const d = v - r, isPct = kind !== "num";
  if (Math.abs(d) < (isPct ? 1 : 0.05)) return <span class="delta">=</span>;
  const txt = `${d > 0 ? "▲" : "▼"}${isPct ? Math.round(Math.abs(d)) : Math.abs(d).toFixed(2)}`;
  return <span class="delta" title={`${d > 0 ? "Sopra" : "Sotto"} ${refName} (${isPct ? fmtPct(r) : fmtNum(r)})`}>{txt}</span>;
}

export function StatTable({ cols, refCol, refName = "la media lega" }: { cols: Col[]; refCol?: { label: string; agg: Agg }; refName?: string }) {
  return (
    <div class="tw"><table class="t">
      <thead><tr><th class="l">Statistica</th>{cols.map((c) => <th key={c.label} class={c.isRef ? "ref" : ""}>{c.label}</th>)}{refCol && <th class="ref">{refCol.label}</th>}</tr></thead>
      <tbody>
        <tr><td class="l">Partite</td>{cols.map((c, i) => <td key={i} class={c.isRef ? "ref" : ""}>{c.agg.n}</td>)}{refCol && <td class="ref">—</td>}</tr>
        {ROWS.map(([label, f, kind]) => (
          <tr key={label}><td class="l">{label}</td>
            {cols.map((c, i) => {
              const v = f(c.agg), r = c.ref ? f(c.ref) : null;
              const cls = c.isRef ? "ref" : kind === "pct" ? heat(v) : kind === "inv" ? heat(v, true) : "";
              return <td key={i} class={cls}>{kind === "num" ? fmtNum(v) : fmtPct(v)}<Delta v={v} r={r} kind={kind} refName={refName} /></td>;
            })}
            {refCol && <td class="ref">{kind === "num" ? fmtNum(f(refCol.agg)) : fmtPct(f(refCol.agg))}</td>}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}
