// Modello di Poisson: forza d'attacco/difesa casa-trasferta rispetto alla media della lega.
import { played, type Match } from "../data/types";

export interface Forecast {
  lh: number; la: number;             // gol attesi casa / trasferta
  home: number; draw: number; away: number;
  o15: number; o25: number; o35: number; btts: number;
  ht05: number; ht15: number;
  top: { score: string; p: number }[];
  sample: { league: number; home: number; away: number };
}

const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
const pois = (k: number, l: number) => (Math.exp(-l) * l ** k) / fact[k];
/** Restringe verso 1 le forze calcolate su pochi dati. */
const shrink = (x: number, n: number, k = 4) => (n * x + k) / (n + k);

export function matrix(lh: number, la: number, max = 10) {
  const m: number[][] = [];
  for (let i = 0; i <= max; i++) { m.push([]); for (let j = 0; j <= max; j++) m[i].push(pois(i, lh) * pois(j, la)); }
  return m;
}

export function probabilities(lh: number, la: number) {
  const m = matrix(lh, la);
  let home = 0, draw = 0, away = 0, o15 = 0, o25 = 0, o35 = 0, btts = 0;
  const scores: { score: string; p: number }[] = [];
  m.forEach((row, i) => row.forEach((p, j) => {
    if (i > j) home += p; else if (i === j) draw += p; else away += p;
    const t = i + j;
    if (t > 1) o15 += p; if (t > 2) o25 += p; if (t > 3) o35 += p; if (i > 0 && j > 0) btts += p;
    scores.push({ score: `${i}-${j}`, p });
  }));
  // primo tempo: circa il 45% dei gol
  const ht = (lh + la) * 0.45;
  const ht05 = 1 - Math.exp(-ht), ht15 = 1 - Math.exp(-ht) * (1 + ht);
  scores.sort((a, b) => b.p - a.p);
  return { home, draw, away, o15, o25, o35, btts, ht05, ht15, top: scores.slice(0, 6) };
}

/**
 * Stima per la partita (lega, giorno, casa, trasferta) usando solo dati precedenti al giorno.
 * Media lega: ultimi 365 giorni. Squadre: ultime 19 partite in casa / in trasferta nella stessa lega.
 */
export function forecast(all: Match[], lg: string, day: number, home: number, away: number): Forecast | null {
  const league = all.filter((m) => m.lg === lg && played(m) && m.d < day && m.d >= day - 365);
  if (league.length < 30) return null;
  const avgH = league.reduce((s, m) => s + m.fh!, 0) / league.length;
  const avgA = league.reduce((s, m) => s + m.fa!, 0) / league.length;
  const hm = all.filter((m) => m.lg === lg && played(m) && m.d < day && m.h === home).slice(-19);
  const am = all.filter((m) => m.lg === lg && played(m) && m.d < day && m.a === away).slice(-19);
  if (!hm.length || !am.length || avgH <= 0 || avgA <= 0) return null;
  const attH = shrink(hm.reduce((s, m) => s + m.fh!, 0) / hm.length / avgH, hm.length);
  const defH = shrink(hm.reduce((s, m) => s + m.fa!, 0) / hm.length / avgA, hm.length);
  const attA = shrink(am.reduce((s, m) => s + m.fa!, 0) / am.length / avgA, am.length);
  const defA = shrink(am.reduce((s, m) => s + m.fh!, 0) / am.length / avgH, am.length);
  const lh = attH * defA * avgH, la = attA * defH * avgA;
  return { lh, la, ...probabilities(lh, la), sample: { league: league.length, home: hm.length, away: am.length } };
}

/** Probabilità implicite delle quote 1X2 senza margine del bookmaker. */
export function implied(oh: number | null, od: number | null, oa: number | null) {
  if (!oh || !od || !oa) return null;
  const s = 1 / oh + 1 / od + 1 / oa;
  return { home: 1 / oh / s, draw: 1 / od / s, away: 1 / oa / s, margin: s - 1 };
}
