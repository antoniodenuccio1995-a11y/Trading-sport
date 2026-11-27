// Scontri diretti: riepilogo dei precedenti tra due squadre (archivio dal 2021/22, tutte le competizioni in archivio).
// Campioni piccoli e squadre che cambiano negli anni: è contesto, non una previsione.
import { played, type Match } from "../data/types";

export interface H2HRecord { n: number; w: number; d: number; l: number }
export interface H2HSummary extends H2HRecord {
  /** gol della squadra "h" (quella di casa nella partita analizzata) e dell'altra */
  gf: number; ga: number;
  o25: number; gg: number;
  /** partite con il risultato all'intervallo e, tra queste, con almeno un gol nel 1° tempo */
  htN: number; ht05: number;
  /** solo i precedenti con le squadre nello stesso campo di oggi */
  same: H2HRecord;
}

/** Riepilogo dal punto di vista di h (vittorie, pareggi, sconfitte di h). */
export function h2hSummary(meetings: Match[], h: number): H2HSummary {
  const s: H2HSummary = { n: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, o25: 0, gg: 0, htN: 0, ht05: 0, same: { n: 0, w: 0, d: 0, l: 0 } };
  for (const m of meetings) {
    if (!played(m)) continue;
    const f = m.h === h ? m.fh! : m.fa!, a = m.h === h ? m.fa! : m.fh!;
    const k = f > a ? "w" : f === a ? "d" : "l";
    s.n++; s[k]++; s.gf += f; s.ga += a;
    if (f + a > 2) s.o25++;
    if (f > 0 && a > 0) s.gg++;
    if (m.hh !== null && m.ha !== null) { s.htN++; if (m.hh + m.ha > 0) s.ht05++; }
    if (m.h === h) { s.same.n++; s.same[k]++; }
  }
  return s;
}
