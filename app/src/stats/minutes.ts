// Minuti dei gol: quando arrivano i gol nelle partite (dati della stagione in corso, solo dove la fonte li ha).
// La fonte non dice quale squadra ha segnato: le statistiche sono "nelle partite di" una squadra, non "gol fatti".
import { played, type Match } from "../data/types";

export const BANDS: { from: number; to: number; label: string }[] = [
  { from: 1, to: 15, label: "1'–15'" }, { from: 16, to: 30, label: "16'–30'" }, { from: 31, to: 45, label: "31'–45'+" },
  { from: 46, to: 60, label: "46'–60'" }, { from: 61, to: 75, label: "61'–75'" }, { from: 76, to: 90, label: "76'–90'+" },
];

export interface Goal { min: number; half: 1 | 2; band: number }

/** Gol di una partita finita con il minuto, se la fonte li ha tutti; null altrimenti. */
export function goalTimes(m: Match): Goal[] | null {
  if (!played(m) || m.gm === null || m.gm === undefined) return null;
  const goals = m.fh! + m.fa!;
  const mins = m.gm === "" ? [] : m.gm.split(",").map(Number);
  if (mins.length !== goals || mins.some((x) => !Number.isFinite(x))) return null;
  // i primi gol (in ordine) fino al punteggio dell'intervallo sono del 1° tempo: così i recuperi (45+2) finiscono nel tempo giusto
  const ht = m.hh !== null && m.ha !== null && m.hh + m.ha <= goals ? m.hh + m.ha : null;
  return mins.map((min, k) => {
    const half: 1 | 2 = ht !== null ? (k < ht ? 1 : 2) : min <= 45 ? 1 : 2;
    const band = half === 1 ? (min <= 15 ? 0 : min <= 30 ? 1 : 2) : (min <= 60 ? 3 : min <= 75 ? 4 : 5);
    return { min, half, band };
  });
}

/** Campionati/stagioni in cui la fonte dà i minuti (almeno una partita con gol e minuti). */
export function minuteLeagues(matches: Match[]): Set<string> {
  const out = new Set<string>();
  for (const m of matches) if (m.gm) out.add(`${m.lg}|${m.s}`);
  return out;
}

export interface MinuteAgg {
  n: number;              // partite con i minuti completi
  goals: number;
  byBand: number[];       // gol per fascia
  matchBand: number[];    // partite con almeno un gol nella fascia
  first: number[];        // minuto del primo gol (partite con almeno un gol)
  noGoal: number;         // 0-0
  firstBy30: number;      // primo gol entro il 30'
  after75: number;        // almeno un gol dal 76' in poi
  stoppage: number;       // almeno un gol nel recupero (1° o 2° tempo)
}

export function minuteAgg(list: Match[], leagues: Set<string>): MinuteAgg {
  const a: MinuteAgg = { n: 0, goals: 0, byBand: [0, 0, 0, 0, 0, 0], matchBand: [0, 0, 0, 0, 0, 0], first: [], noGoal: 0, firstBy30: 0, after75: 0, stoppage: 0 };
  for (const m of list) {
    if (!leagues.has(`${m.lg}|${m.s}`)) continue;
    const g = goalTimes(m);
    if (!g) continue;
    a.n++; a.goals += g.length;
    const seen = new Set<number>();
    for (const x of g) { a.byBand[x.band]++; seen.add(x.band); }
    seen.forEach((b) => a.matchBand[b]++);
    if (!g.length) { a.noGoal++; continue; }
    a.first.push(g[0].min);
    if (g[0].half === 1 && g[0].min <= 30) a.firstBy30++;
    if (g.some((x) => x.half === 2 && x.min > 75)) a.after75++;
    if (g.some((x) => (x.half === 1 && x.min > 45) || x.min > 90)) a.stoppage++;
  }
  return a;
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((p, q) => p - q), k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};
