// Movimenti di quota: come cambia il mercato tra l'apertura (prime quote rilevate) e la chiusura (calcio d'inizio).
// Una quota che scende = il mercato crede di più in quell'esito. Le probabilità sono senza margine del bookmaker.
import { played, type Match } from "../data/types";
import { implied } from "./poisson";

export type MoveSel = "1" | "X" | "2" | "o25" | "u25";
export const MOVE_LABEL: Record<MoveSel, string> = { "1": "1 · casa", X: "X · pareggio", "2": "2 · ospite", o25: "Over 2,5", u25: "Under 2,5" };
/** Variazione di probabilità (in punti) oltre la quale il movimento è "forte". */
export const STRONG = 0.04;

export interface Move { sel: MoveSel; early: number; close: number; pEarly: number; pClose: number; dP: number; dOdd: number; strong: boolean }

const ou = (o: number | null, u: number | null) => (o && u ? (1 / o) / (1 / o + 1 / u) : null);

function make(sel: MoveSel, early: number, close: number, pEarly: number, pClose: number): Move {
  const dP = pClose - pEarly;
  return { sel, early, close, pEarly, pClose, dP, dOdd: close / early - 1, strong: Math.abs(dP) >= STRONG };
}

/** Quote di due momenti (es. apertura e chiusura, o prima e ultima rilevazione) → movimenti per selezione. */
export function movesBetween(a: OddsPoint, b: OddsPoint): Move[] {
  const out: Move[] = [];
  const e = implied(a.h, a.d, a.a), c = implied(b.h, b.d, b.a);
  if (e && c) {
    out.push(make("1", a.h!, b.h!, e.home, c.home), make("X", a.d!, b.d!, e.draw, c.draw), make("2", a.a!, b.a!, e.away, c.away));
  }
  const eo = ou(a.o, a.u), co = ou(b.o, b.u);
  if (eo !== null && co !== null) out.push(make("o25", a.o!, b.o!, eo, co), make("u25", a.u!, b.u!, 1 - eo, 1 - co));
  return out;
}

export interface OddsPoint { h: number | null; d: number | null; a: number | null; o: number | null; u: number | null }
export const earlyOf = (m: Match): OddsPoint => ({ h: m.oh, d: m.od, a: m.oa, o: m.oo, u: m.ou });
export const closeOf = (m: Match): OddsPoint => ({ h: m.ch, d: m.cd, a: m.ca, o: m.co, u: m.cu });

/** Apertura → chiusura di una partita (medie dei bookmaker, football-data). */
export const openCloseMoves = (m: Match) => movesBetween(earlyOf(m), closeOf(m));

export function selWon(sel: MoveSel, m: Match): boolean {
  const h = m.fh!, a = m.fa!;
  return sel === "1" ? h > a : sel === "X" ? h === a : sel === "2" ? a > h : sel === "o25" ? h + a > 2.5 : h + a < 2.5;
}

export interface Bucket { label: string; lo: number; hi: number; n: number; wins: number; pEarly: number; pClose: number; roiEarly: number; roiClose: number }
export const BUCKETS: { label: string; lo: number; hi: number }[] = [
  { label: "Quota scesa molto", lo: 0.05, hi: Infinity },
  { label: "Quota scesa", lo: 0.02, hi: 0.05 },
  { label: "Stabile", lo: -0.02, hi: 0.02 },
  { label: "Quota salita", lo: -0.05, hi: -0.02 },
  { label: "Quota salita molto", lo: -Infinity, hi: -0.05 },
];

/**
 * Studio storico: per ogni fascia di movimento (in punti di probabilità), quante volte l'esito è uscito
 * e quanto avrebbe reso puntarlo (back a quota media) all'apertura e alla chiusura.
 */
export function moveStudy(list: Match[], sel: MoveSel): Bucket[] {
  const b = BUCKETS.map((x) => ({ ...x, n: 0, wins: 0, pEarly: 0, pClose: 0, roiEarly: 0, roiClose: 0 }));
  for (const m of list) {
    if (!played(m)) continue;
    const mv = openCloseMoves(m).find((x) => x.sel === sel);
    if (!mv) continue;
    const k = b.find((x) => mv.dP >= x.lo && mv.dP < x.hi)!;
    const won = selWon(sel, m);
    k.n++; if (won) k.wins++;
    k.pEarly += mv.pEarly; k.pClose += mv.pClose;
    k.roiEarly += won ? mv.early - 1 : -1;
    k.roiClose += won ? mv.close - 1 : -1;
  }
  return b.map((x) => (x.n ? { ...x, pEarly: x.pEarly / x.n, pClose: x.pClose / x.n, roiEarly: x.roiEarly / x.n, roiClose: x.roiClose / x.n } : x));
}
