// Ritmo di spesa del mese: curva cumulativa giornaliera confrontata con il mese prima e con la media di 6 mesi.
import type { Line } from "../domain/types.ts";
import { monthKey } from "../domain/movement.ts";
import { addMonths, dayNum, monthBounds, monthIndex, type MonthBounds } from "./dates.ts";
import { firstMonthOf, isExpenseLine, spendOf, type MonthOptions } from "./common.ts";
import { round2 } from "./stats.ts";

/**
 * Spesa giornaliera (netta) dei mesi richiesti: un array per mese, indice 0 = primo giorno del mese contabile.
 * Le righe fuori dai mesi indicati sono ignorate.
 */
export function dailySpendByMonth(lines: readonly Line[], months: readonly string[], monthStartDay = 1, pick: (l: Line) => boolean = () => true): Map<string, { bounds: MonthBounds; daily: Float64Array }> {
  const out = new Map<string, { bounds: MonthBounds; daily: Float64Array }>();
  for (const m of months) {
    const bounds = monthBounds(m, monthStartDay);
    out.set(m, { bounds, daily: new Float64Array(bounds.days) });
  }
  const starts = new Map<string, number>();
  for (const [m, v] of out) starts.set(m, dayNum(v.bounds.start));
  for (const l of lines) {
    if (!isExpenseLine(l)) continue;
    const slot = out.get(l.month);
    if (!slot || !pick(l)) continue;
    const i = Math.min(Math.max(dayNum(l.date) - starts.get(l.month)!, 0), slot.daily.length - 1);
    slot.daily[i] += spendOf(l);
  }
  return out;
}

/** Cumulata di un array giornaliero. */
export function cumulative(daily: ArrayLike<number>): number[] {
  const out = new Array<number>(daily.length);
  let s = 0;
  for (let i = 0; i < daily.length; i++) { s += daily[i]; out[i] = s; }
  return out;
}

/** Ricampiona una cumulata giornaliera su un mese di `targetDays` giorni (normalizzazione per la durata del mese). */
export function resampleCumulative(cum: readonly number[], targetDays: number): number[] {
  const src = cum.length;
  const at = (x: number) => {
    if (x <= 0 || src === 0) return 0;
    if (x >= src) return cum[src - 1];
    const i = Math.floor(x), f = x - i;
    const a = i === 0 ? 0 : cum[i - 1], b = cum[i];
    return a + (b - a) * f;
  };
  const out = new Array<number>(targetDays);
  for (let d = 1; d <= targetDays; d++) out[d - 1] = at((d * src) / targetDays);
  return out;
}

export interface PaceDelta {
  day: number;
  current: number;
  reference: number;
  /** current − reference: positivo = si sta spendendo più in fretta ("in anticipo"). */
  diff: number;
  pct: number | null;
  status: "ahead" | "behind" | "inline";
}

export interface SpendingPace {
  month: string;
  previousMonth: string;
  start: string;
  end: string;
  days: number;
  /** Giorno del mese corrispondente a `today` (0 se il mese non è iniziato, `days` se è finito). */
  day: number;
  /** Cumulata del mese, null per i giorni futuri. */
  current: (number | null)[];
  /** Cumulata del mese precedente, normalizzata sulla durata di questo mese (null senza dati). */
  previous: number[] | null;
  /** Media delle cumulate dei 6 mesi precedenti (normalizzate). */
  average: number[] | null;
  averageMonths: number;
  vsPrevious: PaceDelta | null;
  vsAverage: PaceDelta | null;
}

const delta = (day: number, current: number, reference: number): PaceDelta => {
  const diff = current - reference;
  const tol = Math.max(10, 0.05 * Math.abs(reference));
  return {
    day, current: round2(current), reference: round2(reference), diff: round2(diff),
    pct: Math.abs(reference) > 0.005 ? diff / Math.abs(reference) : null,
    status: Math.abs(diff) < tol ? "inline" : diff > 0 ? "ahead" : "behind",
  };
};

/** Curva cumulativa della spesa del mese contro il mese precedente e la media dei 6 precedenti, con lo scarto al giorno di oggi. */
export function spendingPace(lines: readonly Line[], month: string, today: string, opts: MonthOptions & { averageMonths?: number } = {}): SpendingPace {
  const msd = opts.monthStartDay ?? 1;
  const nAvg = opts.averageMonths ?? 6;
  const first = firstMonthOf(lines);
  const hist: string[] = [];
  for (let k = 1; k <= nAvg; k++) {
    const m = addMonths(month, -k);
    if (first && monthIndex(m) >= monthIndex(first)) hist.push(m);
  }
  const data = dailySpendByMonth(lines, [month, ...hist], msd);
  const cur = data.get(month)!;
  const D = cur.bounds.days;
  const tm = monthKey(today, msd);
  const day = tm < month ? 0 : tm > month ? D : dayNum(today) - dayNum(cur.bounds.start) + 1;
  const curCum = cumulative(cur.daily);
  const current = curCum.map((v, i) => (i < day ? round2(v) : null));

  const prevMonth = addMonths(month, -1);
  const resampled = hist.map((m) => resampleCumulative(cumulative(data.get(m)!.daily), D));
  const prevIdx = hist.indexOf(prevMonth);
  const previous = prevIdx >= 0 ? resampled[prevIdx].map(round2) : null;
  let average: number[] | null = null;
  if (resampled.length) {
    average = new Array<number>(D).fill(0);
    for (const r of resampled) for (let i = 0; i < D; i++) average[i] += r[i];
    average = average.map((v) => round2(v / resampled.length));
  }
  const at = day >= 1 ? curCum[day - 1] : null;
  return {
    month, previousMonth: prevMonth, start: cur.bounds.start, end: cur.bounds.end, days: D, day, current, previous, average,
    averageMonths: resampled.length,
    vsPrevious: at !== null && previous ? delta(day, at, previous[day - 1]) : null,
    vsAverage: at !== null && average ? delta(day, at, average[day - 1]) : null,
  };
}
