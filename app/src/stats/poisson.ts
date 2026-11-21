// Modello di Poisson: forza d'attacco/difesa casa-trasferta rispetto alla media della lega.
import { played, type Match } from "../data/types";

export interface Forecast {
  lh: number; la: number;             // gol attesi casa / trasferta
  home: number; draw: number; away: number;
  o15: number; o25: number; o35: number; btts: number;
  ht05: number; ht15: number;
  top: { score: string; p: number }[];
  sample: { league: number; home: number; away: number };
  /** modello separato per primo e secondo tempo (null se mancano i risultati all'intervallo) */
  halves: Halves | null;
}

export interface HalfProb { lh: number; la: number; goal: number; o15: number; home: number; away: number }
export interface Halves {
  h1: HalfProb; h2: HalfProb;
  /** probabilità che il 2° tempo abbia più gol del 1°, meno, o uguali */
  more2: number; more1: number; same: number;
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
  const base = probabilities(lh, la);
  const halves = forecastHalves(league, hm, am);
  return {
    lh, la, ...base,
    ht05: halves ? halves.h1.goal : base.ht05, ht15: halves ? halves.h1.o15 : base.ht15,
    halves, sample: { league: league.length, home: hm.length, away: am.length },
  };
}

const hasHT = (m: Match) => m.hh !== null && m.ha !== null && m.hh <= m.fh! && m.ha <= m.fa!;

function halfProb(lh: number, la: number): HalfProb {
  const l = lh + la;
  return { lh, la, goal: 1 - Math.exp(-l), o15: 1 - Math.exp(-l) * (1 + l), home: 1 - Math.exp(-lh), away: 1 - Math.exp(-la) };
}

/**
 * Poisson per tempo: stesse regole del modello finale, ma con i gol del 1° tempo
 * (risultato all'intervallo) e del 2° tempo (finale − intervallo).
 */
export function forecastHalves(league: Match[], hm: Match[], am: Match[]): Halves | null {
  const L = league.filter(hasHT), H = hm.filter(hasHT), A = am.filter(hasHT);
  if (L.length < 30 || H.length < 3 || A.length < 3) return null;
  const mean = (l: Match[], f: (m: Match) => number) => l.reduce((s, m) => s + f(m), 0) / l.length;
  const h1 = (m: Match) => m.hh!, a1 = (m: Match) => m.ha!, h2 = (m: Match) => m.fh! - m.hh!, a2 = (m: Match) => m.fa! - m.ha!;
  const lam = (fh: (m: Match) => number, fa: (m: Match) => number) => {
    const avgH = mean(L, fh), avgA = mean(L, fa);
    if (avgH <= 0 || avgA <= 0) return null;
    const attH = shrink(mean(H, fh) / avgH, H.length), defH = shrink(mean(H, fa) / avgA, H.length);
    const attA = shrink(mean(A, fa) / avgA, A.length), defA = shrink(mean(A, fh) / avgH, A.length);
    return [attH * defA * avgH, attA * defH * avgA] as const;
  };
  const x1 = lam(h1, a1), x2 = lam(h2, a2);
  if (!x1 || !x2) return null;
  // confronto tra gol totali dei due tempi (due Poisson indipendenti)
  const l1 = x1[0] + x1[1], l2 = x2[0] + x2[1];
  let more2 = 0, more1 = 0, same = 0;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
    const p = pois(i, l1) * pois(j, l2);
    if (j > i) more2 += p; else if (i > j) more1 += p; else same += p;
  }
  return { h1: halfProb(x1[0], x1[1]), h2: halfProb(x2[0], x2[1]), more2, more1, same, sample: { league: L.length, home: H.length, away: A.length } };
}

/** Probabilità implicite delle quote 1X2 senza margine del bookmaker. */
export function implied(oh: number | null, od: number | null, oa: number | null) {
  if (!oh || !od || !oa) return null;
  const s = 1 / oh + 1 / od + 1 / oa;
  return { home: 1 / oh / s, draw: 1 / od / s, away: 1 / oa / s, margin: s - 1 };
}
