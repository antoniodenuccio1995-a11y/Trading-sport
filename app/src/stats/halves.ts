// Gol per tempo: dal risultato all'intervallo e da quello finale (2° tempo = finale − intervallo).
import type { Match } from "../data/types";
import type { Venue } from "./team";

export interface HalfAgg {
  n: number;                  // partite con risultato all'intervallo
  f1: number; a1: number;     // gol fatti / subiti nel 1° tempo
  f2: number; a2: number;     // gol fatti / subiti nel 2° tempo
  g1: number; g1o15: number;  // partite con gol nel 1T, con almeno 2 gol nel 1T
  g2: number; g2o15: number;
  s1: number; c1: number; s2: number; c2: number; // segna / subisce in ciascun tempo
  zero1: number;              // 0-0 all'intervallo
  more1: number; more2: number; same: number;     // tempo con più gol
  /** intervallo → finale dal punto di vista della squadra: chiave "V>V", "N>P", … */
  htft: Record<string, number>;
}

export const emptyHalf = (): HalfAgg => ({
  n: 0, f1: 0, a1: 0, f2: 0, a2: 0, g1: 0, g1o15: 0, g2: 0, g2o15: 0, s1: 0, c1: 0, s2: 0, c2: 0, zero1: 0, more1: 0, more2: 0, same: 0, htft: {},
});

const res = (f: number, a: number) => (f > a ? "V" : f === a ? "N" : "P");

export function addHalf(g: HalfAgg, m: Match, side: "home" | "away") {
  if (m.fh === null || m.fa === null || m.hh === null || m.ha === null) return;
  if (m.hh > m.fh || m.ha > m.fa) return; // dato incoerente
  const F = side === "home" ? m.fh : m.fa, A = side === "home" ? m.fa : m.fh;
  const f1 = side === "home" ? m.hh : m.ha, a1 = side === "home" ? m.ha : m.hh;
  const f2 = F - f1, a2 = A - a1, t1 = f1 + a1, t2 = f2 + a2;
  g.n++; g.f1 += f1; g.a1 += a1; g.f2 += f2; g.a2 += a2;
  if (t1 > 0) g.g1++; if (t1 > 1) g.g1o15++; if (t2 > 0) g.g2++; if (t2 > 1) g.g2o15++;
  if (f1 > 0) g.s1++; if (a1 > 0) g.c1++; if (f2 > 0) g.s2++; if (a2 > 0) g.c2++;
  if (t1 === 0) g.zero1++;
  if (t1 > t2) g.more1++; else if (t2 > t1) g.more2++; else g.same++;
  const k = `${res(f1, a1)}>${res(F, A)}`;
  g.htft[k] = (g.htft[k] ?? 0) + 1;
}

/** Profilo per tempo di una squadra (partite già filtrate). */
export function halfTeam(list: Match[], team: number): HalfAgg {
  const g = emptyHalf();
  for (const m of list) addHalf(g, m, m.h === team ? "home" : "away");
  return g;
}

/** "Squadra media" del campionato: in casa, in trasferta o entrambe. */
export function halfLeague(list: Match[], venue: Venue = "all"): HalfAgg {
  const g = emptyHalf();
  for (const m of list) {
    if (venue !== "away") addHalf(g, m, "home");
    if (venue !== "home") addHalf(g, m, "away");
  }
  return g;
}
