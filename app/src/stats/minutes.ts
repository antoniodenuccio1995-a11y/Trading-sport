// Minuti dei gol: quando arrivano i gol nelle partite (dati della stagione in corso, solo dove la fonte li ha).
// Le statistiche sono "nelle partite di" una squadra (gol fatti e subiti): la squadra che segna è nota solo per alcuni campionati.
import { played, type Match } from "../data/types";

export const BANDS: { from: number; to: number; label: string }[] = [
  { from: 1, to: 15, label: "1'–15'" }, { from: 16, to: 30, label: "16'–30'" }, { from: 31, to: 45, label: "31'–45'+" },
  { from: 46, to: 60, label: "46'–60'" }, { from: 61, to: 75, label: "61'–75'" }, { from: 76, to: 90, label: "76'–90'+" },
];

export interface Goal {
  min: number; half: 1 | 2; band: number;
  /** squadra che ha segnato ("h" casa, "a" ospite), null se non si può sapere */
  side: "h" | "a" | null;
  /** punteggio dopo il gol (casa, ospite), null se un gol precedente ha la squadra ignota */
  score: [number, number] | null;
  /** marcatore, se la fonte lo dà */
  by: string | null;
}

/**
 * Gol di una partita finita con il minuto, se la fonte li ha tutti; null altrimenti.
 * La squadra viene dalla fonte quando c'è ("27a"); altrimenti si ricava solo quando è certa:
 * in un tempo in cui ha segnato una sola squadra (dal risultato all'intervallo e finale).
 */
export function goalTimes(m: Match): Goal[] | null {
  if (!played(m) || m.gm === null || m.gm === undefined) return null;
  const fh = m.fh!, fa = m.fa!, goals = fh + fa;
  const toks = m.gm === "" ? [] : m.gm.split(",").map((t) => /^(\d{1,3})([ha])?$/.exec(t.trim()));
  if (toks.length !== goals || toks.some((t) => !t)) return null;
  const mins = toks.map((t) => Number(t![1]));
  const sides: ("h" | "a" | null)[] = toks.map((t) => (t![2] as "h" | "a" | undefined) ?? null);
  // squadre dalla fonte: devono tornare con il risultato finale, altrimenti non si usano
  if (sides.some((x) => x) && (sides.some((x) => !x) || sides.filter((x) => x === "h").length !== fh)) sides.fill(null);
  // i primi gol (in ordine) fino al punteggio dell'intervallo sono del 1° tempo: così i recuperi (45+2) finiscono nel tempo giusto
  const ht = m.hh !== null && m.ha !== null && m.hh + m.ha <= goals && m.hh <= fh && m.ha <= fa ? m.hh + m.ha : null;
  if (!sides.some((x) => x !== null) && goals) {
    // [gol casa, gol ospite] in ogni tratto: se in un tratto ha segnato una sola squadra, i gol sono suoi
    const parts: [number, number, number, number][] = ht !== null
      ? [[0, ht, m.hh!, m.ha!], [ht, goals, fh - m.hh!, fa - m.ha!]]
      : [[0, goals, fh, fa]];
    for (const [from, to, h, a] of parts) if (!h !== !a) for (let k = from; k < to; k++) sides[k] = h ? "h" : "a";
  }
  const by = m.gb ? m.gb.split("|") : [];
  let sh = 0, sa = 0, known = true;
  return mins.map((min, k) => {
    const half: 1 | 2 = ht !== null ? (k < ht ? 1 : 2) : min <= 45 ? 1 : 2;
    const band = half === 1 ? (min <= 15 ? 0 : min <= 30 ? 1 : 2) : (min <= 60 ? 3 : min <= 75 ? 4 : 5);
    const side = sides[k];
    if (side === "h") sh++; else if (side === "a") sa++; else known = false;
    // a fine primo tempo il punteggio torna noto dal risultato all'intervallo
    if (!known && ht !== null && k === ht - 1) { sh = m.hh!; sa = m.ha!; known = true; }
    return { min, half, band, side, score: known && side ? [sh, sa] as [number, number] : null, by: by.length === goals ? (by[k] || null) : null };
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
