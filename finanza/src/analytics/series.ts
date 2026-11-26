// Serie temporali: mesi, giorni (heatmap) e giorni della settimana.
import type { Line } from "../domain/types.ts";
import { dayNum, fromDayNum, monthFromIndex, monthIndex, weekdayOf } from "./dates.ts";
import { WEEKDAYS_IT, WEEKDAYS_SHORT_IT } from "./format.ts";
import { dateExtent, isExpenseLine, isIncomeLine, resolvePeriod, spendOf, type MonthOptions, type Period } from "./common.ts";
import { quantileSorted, round2 } from "./stats.ts";

// ───────────────────────────── monthlySeries ─────────────────────────────

export interface MonthlyPoint {
  month: string;
  income: number;
  /** Spesa netta del mese (positiva; i resi la riducono). */
  expense: number;
  net: number;
  /** net / income, null se le entrate sono ≤ 0. */
  savingsRate: number | null;
  /** Righe economiche (entrate + uscite) del mese. */
  count: number;
}

export interface MonthlySeries {
  months: string[];
  points: MonthlyPoint[];
  /** categoryId -> spesa per mese (allineata a `months`). */
  expenseByCategory: Record<string, number[]>;
  /** categoryId -> entrate per mese (allineata a `months`). */
  incomeByCategory: Record<string, number[]>;
  /** Categorie di spesa ordinate per totale decrescente. */
  expenseCategoryIds: string[];
  incomeCategoryIds: string[];
  totals: { income: number; expense: number; net: number; savingsRate: number | null; count: number };
}

const rate = (net: number, income: number) => (income > 0.005 ? net / income : null);

/** Serie mensile continua (mesi vuoti a zero) di entrate, uscite, netto e tasso di risparmio, con matrice mese × categoria. */
export function monthlySeries(lines: readonly Line[], opts: { from?: string; to?: string } = {}): MonthlySeries {
  let lo = opts.from ?? "", hi = opts.to ?? "";
  if (!opts.from || !opts.to) {
    for (const l of lines) {
      if (!l.month || !(isExpenseLine(l) || isIncomeLine(l))) continue;
      if (!opts.from && (lo === "" || l.month < lo)) lo = l.month;
      if (!opts.to && (hi === "" || l.month > hi)) hi = l.month;
    }
  }
  const empty: MonthlySeries = {
    months: [], points: [], expenseByCategory: {}, incomeByCategory: {}, expenseCategoryIds: [], incomeCategoryIds: [],
    totals: { income: 0, expense: 0, net: 0, savingsRate: null, count: 0 },
  };
  if (!lo || !hi || lo > hi) return empty;
  const base = monthIndex(lo), n = monthIndex(hi) - base + 1;
  const income = new Float64Array(n), expense = new Float64Array(n), count = new Uint32Array(n);
  const exp = new Map<string, Float64Array>(), inc = new Map<string, Float64Array>();
  for (const l of lines) {
    const isExp = isExpenseLine(l);
    if (!isExp && !isIncomeLine(l)) continue;
    if (l.month < lo || l.month > hi) continue;
    const i = monthIndex(l.month) - base;
    count[i]++;
    const target = isExp ? exp : inc;
    let row = target.get(l.categoryId);
    if (!row) { row = new Float64Array(n); target.set(l.categoryId, row); }
    if (isExp) { const v = spendOf(l); expense[i] += v; row[i] += v; }
    else { income[i] += l.amount; row[i] += l.amount; }
  }
  const months: string[] = [], points: MonthlyPoint[] = [];
  let tIn = 0, tOut = 0, tCount = 0;
  for (let i = 0; i < n; i++) {
    const m = monthFromIndex(base + i);
    months.push(m);
    const net = income[i] - expense[i];
    points.push({ month: m, income: round2(income[i]), expense: round2(expense[i]), net: round2(net), savingsRate: rate(net, income[i]), count: count[i] });
    tIn += income[i]; tOut += expense[i]; tCount += count[i];
  }
  const toRecord = (src: Map<string, Float64Array>) => {
    const rec: Record<string, number[]> = {};
    const totals: [string, number][] = [];
    for (const [id, row] of src) {
      rec[id] = Array.from(row, round2);
      let s = 0; for (const v of row) s += v;
      totals.push([id, s]);
    }
    totals.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { rec, ids: totals.map((t) => t[0]) };
  };
  const e = toRecord(exp), c = toRecord(inc);
  return {
    months, points, expenseByCategory: e.rec, incomeByCategory: c.rec, expenseCategoryIds: e.ids, incomeCategoryIds: c.ids,
    totals: { income: round2(tIn), expense: round2(tOut), net: round2(tIn - tOut), savingsRate: rate(tIn - tOut, tIn), count: tCount },
  };
}

// ───────────────────────────── dailyTotals ─────────────────────────────

export interface DayTotal {
  date: string;
  /** Spesa netta del giorno (può essere negativa per un reso). */
  expense: number;
  income: number;
  /** Righe economiche del giorno. */
  count: number;
  /** Livello 0–4 per la heatmap (0 = nessuna spesa). */
  level: number;
}

export interface DailyTotals {
  from: string;
  to: string;
  /** Data -> totali (solo i giorni con movimenti). */
  byDate: Record<string, DayTotal>;
  /** Tutti i giorni del periodo, anche vuoti, in ordine. */
  days: DayTotal[];
  /** Soglie (25°, 50°, 75° percentile della spesa nei giorni con spesa) per i livelli 1–4. */
  thresholds: number[];
  maxExpense: number;
}

/** Livello di heatmap 0–4 di una spesa giornaliera date le soglie di dailyTotals. */
export function heatLevel(value: number, thresholds: readonly number[]): number {
  if (!(value > 0.005)) return 0;
  let lvl = 1;
  for (const t of thresholds) if (value > t) lvl++;
  return Math.min(lvl, 4);
}

/** Totali giornalieri di spesa ed entrate per la heatmap del calendario, con soglie a quantili per 5 livelli. */
export function dailyTotals(lines: readonly Line[], period: Period, opts: MonthOptions = {}): DailyTotals {
  const p = resolvePeriod(period, opts.monthStartDay);
  const d0 = dayNum(p.from), n = Math.max(0, dayNum(p.to) - d0 + 1);
  const expense = new Float64Array(n), income = new Float64Array(n), count = new Uint32Array(n);
  for (const l of lines) {
    if (!l.date || l.date < p.from || l.date > p.to) continue;
    const isExp = isExpenseLine(l);
    if (!isExp && !isIncomeLine(l)) continue;
    const i = dayNum(l.date) - d0;
    count[i]++;
    if (isExp) expense[i] += spendOf(l); else income[i] += l.amount;
  }
  const positive: number[] = [];
  for (let i = 0; i < n; i++) if (expense[i] > 0.005) positive.push(expense[i]);
  const sorted = Float64Array.from(positive).sort();
  const thresholds = sorted.length ? [0.25, 0.5, 0.75].map((q) => round2(quantileSorted(sorted, q))) : [];
  const byDate: Record<string, DayTotal> = {}, days: DayTotal[] = [];
  for (let i = 0; i < n; i++) {
    const date = fromDayNum(d0 + i);
    const t: DayTotal = { date, expense: round2(expense[i]), income: round2(income[i]), count: count[i], level: heatLevel(expense[i], thresholds) };
    days.push(t);
    if (count[i]) byDate[date] = t;
  }
  return { from: p.from, to: p.to, byDate, days, thresholds, maxExpense: sorted.length ? round2(sorted[sorted.length - 1]) : 0 };
}

// ───────────────────────────── weekdayPattern ─────────────────────────────

export interface WeekdayStat {
  /** 0 = lunedì … 6 = domenica. */
  weekday: number;
  label: string;
  short: string;
  total: number;
  /** Giorni di calendario di quel tipo nel periodo effettivo. */
  occurrences: number;
  /** Spesa media per giorno di quel tipo (total / occurrences). */
  average: number;
  count: number;
  share: number | null;
}

export interface WeekdayPattern { from: string; to: string; days: WeekdayStat[]; total: number; busiest: number | null }

/**
 * Spesa media per giorno della settimana (lunedì primo). Il periodo è ristretto
 * alle date coperte dai dati, così i giorni prima/dopo l'archivio non diluiscono la media.
 * Line ha solo la data: nessuna analisi per ora del giorno.
 */
export function weekdayPattern(lines: readonly Line[], period: Period, opts: MonthOptions = {}): WeekdayPattern {
  const p = resolvePeriod(period, opts.monthStartDay);
  const ext = dateExtent(lines);
  const from = ext && ext.first > p.from ? ext.first : p.from;
  const to = ext && ext.last < p.to ? ext.last : p.to;
  const totals = new Float64Array(7), counts = new Uint32Array(7), occ = new Uint32Array(7);
  const d0 = dayNum(from), d1 = dayNum(to);
  if (ext && d1 >= d0) {
    const span = d1 - d0 + 1, w0 = weekdayOf(from);
    for (let k = 0; k < 7; k++) occ[(w0 + k) % 7] = Math.floor(span / 7) + (k < span % 7 ? 1 : 0);
    for (const l of lines) {
      if (!isExpenseLine(l) || l.date < from || l.date > to) continue;
      const w = weekdayOf(l.date);
      totals[w] += spendOf(l);
      counts[w]++;
    }
  }
  let total = 0;
  for (const t of totals) total += t;
  const days: WeekdayStat[] = [];
  let busiest: number | null = null;
  for (let w = 0; w < 7; w++) {
    const average = occ[w] ? totals[w] / occ[w] : 0;
    days.push({ weekday: w, label: WEEKDAYS_IT[w], short: WEEKDAYS_SHORT_IT[w], total: round2(totals[w]), occurrences: occ[w], average: round2(average), count: counts[w], share: total > 0.005 ? totals[w] / total : null });
    if (counts[w] && (busiest === null || average > days[busiest].average)) busiest = w;
  }
  return { from, to, days, total: round2(total), busiest };
}
