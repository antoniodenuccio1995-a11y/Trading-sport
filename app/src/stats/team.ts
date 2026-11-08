// Statistiche descrittive di squadre e campionati (stile soccerstats / goalprofits).
import { played, type Match } from "../data/types";

export type Venue = "all" | "home" | "away";

export interface Agg {
  n: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
  o05: number; o15: number; o25: number; o35: number; o45: number;
  btts: number; cs: number; fts: number;
  // primo tempo (solo partite con il risultato del 1° tempo)
  htN: number; htGf: number; htGa: number; ht05: number; ht15: number; htW: number; htD: number; htL: number;
  sh05: number; sh15: number; // secondo tempo
  // statistiche partita (solo dove disponibili)
  coN: number; coF: number; coA: number; soN: number; soF: number; soA: number; yeN: number; yeF: number; yeA: number;
  form: ("V" | "N" | "P")[];
}

export const emptyAgg = (): Agg => ({
  n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, o05: 0, o15: 0, o25: 0, o35: 0, o45: 0, btts: 0, cs: 0, fts: 0,
  htN: 0, htGf: 0, htGa: 0, ht05: 0, ht15: 0, htW: 0, htD: 0, htL: 0, sh05: 0, sh15: 0,
  coN: 0, coF: 0, coA: 0, soN: 0, soF: 0, soA: 0, yeN: 0, yeF: 0, yeA: 0, form: [],
});

/** Aggiunge una partita dal punto di vista di una squadra ("home" = la squadra gioca in casa). */
export function addMatch(g: Agg, m: Match, side: "home" | "away") {
  if (!played(m)) return;
  const f = side === "home" ? m.fh! : m.fa!, a = side === "home" ? m.fa! : m.fh!, t = f + a;
  g.n++; g.gf += f; g.ga += a;
  if (f > a) { g.w++; g.pts += 3; g.form.push("V"); } else if (f === a) { g.d++; g.pts += 1; g.form.push("N"); } else { g.l++; g.form.push("P"); }
  if (t > 0) g.o05++; if (t > 1) g.o15++; if (t > 2) g.o25++; if (t > 3) g.o35++; if (t > 4) g.o45++;
  if (f > 0 && a > 0) g.btts++; if (a === 0) g.cs++; if (f === 0) g.fts++;
  if (m.hh !== null && m.ha !== null) {
    const hf = side === "home" ? m.hh : m.ha, ha = side === "home" ? m.ha : m.hh, ht = hf + ha, s2 = t - ht;
    g.htN++; g.htGf += hf; g.htGa += ha;
    if (ht > 0) g.ht05++; if (ht > 1) g.ht15++;
    if (hf > ha) g.htW++; else if (hf === ha) g.htD++; else g.htL++;
    if (s2 > 0) g.sh05++; if (s2 > 1) g.sh15++;
  }
  const pair = (x: number | null, y: number | null) => (x !== null && y !== null ? (side === "home" ? [x, y] : [y, x]) : null);
  const co = pair(m.coh, m.coa); if (co) { g.coN++; g.coF += co[0]; g.coA += co[1]; }
  const so = pair(m.soh, m.soa); if (so) { g.soN++; g.soF += so[0]; g.soA += so[1]; }
  const ye = pair(m.yeh, m.yea); if (ye) { g.yeN++; g.yeF += ye[0]; g.yeA += ye[1]; }
}

/** Partite giocate di una squadra, filtrate per sede, ordinate dalla più vecchia. */
export function teamMatches(list: Match[], team: number, venue: Venue = "all", opts: { before?: number; lg?: string; season?: string; last?: number } = {}) {
  let out = list.filter((m) => played(m) &&
    (venue === "home" ? m.h === team : venue === "away" ? m.a === team : m.h === team || m.a === team) &&
    (opts.before === undefined || m.d < opts.before) && (!opts.lg || m.lg === opts.lg) && (!opts.season || m.s === opts.season));
  if (opts.last) out = out.slice(-opts.last);
  return out;
}

export function teamAgg(list: Match[], team: number): Agg {
  const g = emptyAgg();
  for (const m of list) addMatch(g, m, m.h === team ? "home" : "away");
  return g;
}

export const pct = (x: number, n: number) => (n ? (100 * x) / n : null);
export const avg = (x: number, n: number) => (n ? x / n : null);

export interface LeagueAgg {
  n: number; hw: number; dr: number; aw: number; hg: number; ag: number;
  o15: number; o25: number; o35: number; btts: number; htN: number; ht05: number; ht15: number;
}
export function leagueAgg(list: Match[]): LeagueAgg {
  const g: LeagueAgg = { n: 0, hw: 0, dr: 0, aw: 0, hg: 0, ag: 0, o15: 0, o25: 0, o35: 0, btts: 0, htN: 0, ht05: 0, ht15: 0 };
  for (const m of list) {
    if (!played(m)) continue;
    const h = m.fh!, a = m.fa!, t = h + a;
    g.n++; g.hg += h; g.ag += a;
    if (h > a) g.hw++; else if (h === a) g.dr++; else g.aw++;
    if (t > 1) g.o15++; if (t > 2) g.o25++; if (t > 3) g.o35++; if (h > 0 && a > 0) g.btts++;
    if (m.hh !== null && m.ha !== null) { g.htN++; if (m.hh + m.ha > 0) g.ht05++; if (m.hh + m.ha > 1) g.ht15++; }
  }
  return g;
}

/** Frequenza dei risultati esatti dal punto di vista della squadra (fatti-subiti). */
export function scorelines(list: Match[], team: number, top = 8) {
  const c = new Map<string, number>();
  for (const m of list) {
    if (!played(m)) continue;
    const k = m.h === team ? `${m.fh}-${m.fa}` : `${m.fa}-${m.fh}`;
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

export function h2h(all: Match[], a: number, b: number, before?: number, last = 10) {
  return all.filter((m) => played(m) && ((m.h === a && m.a === b) || (m.h === b && m.a === a)) && (before === undefined || m.d < before)).slice(-last).reverse();
}
