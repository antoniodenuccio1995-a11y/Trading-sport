// Minuti dei gol: in quali fasce di gioco arrivano i gol (stagione in corso, dove la fonte li ha).
import { useMemo } from "preact/hooks";
import { getStore } from "../../data/store";
import type { Match } from "../../data/types";
import { BANDS, goalTimes, median, minuteAgg, minuteLeagues, type MinuteAgg } from "../../stats/minutes";
import { pct } from "../../stats/team";
import { Card, PctTd } from "../components/common";

export interface MinCol { label: string; list: Match[] }

export const MINUTES_NOTE = "Minuti della stagione in corso (fonte Open Matchday): completi per Bundesliga e 2. Bundesliga; per Serie A, Premier League, Liga, Ligue 1 e Champions la fonte ne ha solo una parte e qui contano le sole partite con tutti i minuti. La fonte non dice chi ha segnato: per una squadra si contano tutti i gol delle sue partite.";

function useMinuteLeagues() {
  const s = getStore();
  return useMemo(() => minuteLeagues(s.matches), [s.matches]);
}

/** Sei barre: quota dei gol in ogni fascia, con la linea dell'intervallo. */
function Bars({ a }: { a: MinuteAgg }) {
  const max = Math.max(1, ...a.byBand);
  return (
    <svg class="mbars" viewBox="0 0 96 30" role="img" aria-label={`Gol per fascia: ${a.byBand.join(", ")}`}>
      {a.byBand.map((v, i) => {
        const h = Math.max(1.5, (v / max) * 26);
        return <rect key={i} x={i * 16 + (i > 2 ? 2 : 0)} y={28 - h} width={12} height={h} rx={2} />;
      })}
      <line x1="48" x2="48" y1="0" y2="30" class="ht-line" />
    </svg>
  );
}

export function GoalMinutes({ cols, title = "Minuti dei gol" }: { cols: MinCol[]; title?: string }) {
  const lgs = useMinuteLeagues();
  const aggs = cols.map((c) => minuteAgg(c.list, lgs));
  if (aggs.every((a) => a.n === 0)) {
    return <Card title={title}><p class="muted">Minuti dei gol non disponibili per queste partite.</p><p class="note">{MINUTES_NOTE}</p></Card>;
  }
  const row = (label: string, f: (a: MinuteAgg) => number, invert = false) => (
    <tr><td class="l">{label}</td>{aggs.map((a, i) => <PctTd key={i} v={a.n ? pct(f(a), a.n) : null} n={a.n} invert={invert} />)}</tr>
  );
  return (
    <Card flush title={title}>
      <div class="tw"><table class="t">
        <thead><tr><th class="l">Nelle partite di…</th>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
        <tbody>
          <tr><td class="l">Distribuzione dei gol <span class="muted">(1° | 2° tempo)</span></td>{aggs.map((a, i) => <td key={i}>{a.n ? <Bars a={a} /> : "—"}</td>)}</tr>
          {BANDS.map((b, k) => row(`Gol tra ${b.label}`, (a) => a.matchBand[k]))}
          {row("Primo gol entro il 30'", (a) => a.firstBy30)}
          {row("Almeno un gol dopo il 75'", (a) => a.after75)}
          {row("Gol nel recupero", (a) => a.stoppage)}
          {row("Finite 0-0", (a) => a.noGoal, true)}
          <tr><td class="l">Minuto del primo gol (mediana)</td>{aggs.map((a, i) => { const md = median(a.first); return <td key={i}>{md === null ? "—" : `${Math.round(md)}'`}</td>; })}</tr>
          <tr class="ref"><td class="l">Partite con i minuti</td>{aggs.map((a, i) => <td key={i} class="muted">{a.n}</td>)}</tr>
        </tbody>
      </table></div>
      <p class="note" style="padding:0 14px 12px">Percentuali sulle partite con tutti i minuti dei gol. {MINUTES_NOTE}</p>
    </Card>
  );
}

/** Linea del tempo dei gol di una partita giocata (se la fonte ha i minuti). */
export function GoalTimeline({ m }: { m: Match }) {
  const g = goalTimes(m);
  if (!g || !g.length) return null;
  const pos = (x: { min: number; half: 1 | 2 }) => (x.half === 1 ? Math.min(x.min, 47) / 95 : (Math.max(x.min, 46) + 2) / 95) * 100;
  return (
    <div class="gtl" aria-label={`Minuti dei gol: ${g.map((x) => `${x.min}'`).join(", ")}`}>
      <div class="gtl-track"><span class="gtl-ht" style="left:50.5%" title="Intervallo" />
        {g.map((x, i) => <span key={i} class="gtl-goal" style={`left:${Math.min(99, pos(x)).toFixed(1)}%`} title={`${x.min > 90 ? `90+${x.min - 90}` : x.half === 1 && x.min > 45 ? `45+${x.min - 45}` : x.min}'`}><b>{x.half === 1 && x.min > 45 ? `45+${x.min - 45}` : x.min > 90 ? `90+${x.min - 90}` : x.min}'</b></span>)}
      </div>
      <div class="gtl-scale"><span>0'</span><span>45'</span><span>90'</span></div>
    </div>
  );
}
