// Confronto tra quote di mercato (exchange o bookmaker) e probabilità del modello.

export interface Sel { key: string; label: string; p: number | null }
export interface Group { title: string; sels: Sel[] }
export interface Quote { b?: number | null; l?: number | null }

const ok = (x?: number | null): x is number => typeof x === "number" && x > 1;

/**
 * Probabilità del mercato per un gruppo di esiti che si escludono (1X2, Over/Under…).
 * Con back e lay usa il prezzo medio; se tutte le quote del gruppo sono presenti
 * toglie il margine (metodo proporzionale), altrimenti usa 1/quota.
 */
export function marketProbs(qs: Quote[]): { probs: (number | null)[]; margin: number | null; complete: boolean } {
  const raw = qs.map((q) => (ok(q.b) && ok(q.l) ? (1 / q.b + 1 / q.l) / 2 : ok(q.b) ? 1 / q.b : ok(q.l) ? 1 / q.l : null));
  const complete = raw.length > 1 && raw.every((x) => x !== null);
  if (!complete) return { probs: raw, margin: null, complete };
  const s = (raw as number[]).reduce((a, b) => a + b, 0);
  return { probs: (raw as number[]).map((x) => x / s), margin: s - 1, complete };
}

/** Valore atteso per 1 € a rischio, commissione c (es. 0.05) sulle vincite. */
export const evBack = (p: number, q: number, c: number) => p * (q - 1) * (1 - c) - (1 - p);
export const evLay = (p: number, l: number, c: number) => ((1 - p) * (1 - c) - p * (l - 1)) / (l - 1);
/** Quota back minima e lay massima perché il valore atteso sia ≥ 0 secondo il modello. */
export const minBack = (p: number, c: number) => 1 + (1 - p) / (p * (1 - c));
export const maxLay = (p: number, c: number) => 1 + ((1 - p) * (1 - c)) / p;

export type Verdict = "linea" | "back" | "lay";
/** Differenza modello − mercato in punti percentuali e lettura sintetica. */
export function verdict(model: number, market: number, tol = 0.025): { diff: number; v: Verdict } {
  const diff = model - market;
  return { diff, v: Math.abs(diff) < tol ? "linea" : diff > 0 ? "back" : "lay" };
}

/** Quanto il mercato rispecchia il modello: media delle differenze assolute. */
export function agreement(diffs: number[]): { avg: number; level: "alta" | "media" | "bassa" } | null {
  if (!diffs.length) return null;
  const avg = diffs.reduce((s, d) => s + Math.abs(d), 0) / diffs.length;
  return { avg, level: avg < 0.03 ? "alta" : avg < 0.06 ? "media" : "bassa" };
}
