// Previsione di fine mese: ricorrenze attese non ancora arrivate + ritmo robusto della spesa variabile.
import type { Line } from "../domain/types.ts";
import { addMonths, dayNum, monthBounds, monthIndex } from "./dates.ts";
import { firstMonthOf, isExpenseLine, isIncomeLine, spendOf, type MonthOptions } from "./common.ts";
import { detectRecurring, nextByCadence, type RecurringItem } from "./recurring.ts";
import { quantileSorted, round2 } from "./stats.ts";

export interface ForecastFigures { income: number; expense: number; net: number }

export interface PendingRecurring {
  id: string;
  label: string;
  date: string;
  /** Importo con segno (+ entrata, − uscita). */
  amount: number;
  direction: "in" | "out";
  /** "late" = già in ritardo: conta solo nella banda (pessimistica per le uscite, ottimistica per le entrate). */
  status: "active" | "late";
  categoryId: string;
}

export interface MonthEndForecast {
  month: string;
  today: string;
  start: string;
  end: string;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  /** Movimenti già registrati nel mese. */
  actual: ForecastFigures;
  pending: PendingRecurring[];
  variable: {
    /** Spesa variabile (non ricorrente) del mese finora. */
    spent: number;
    /** Ritmo giornaliero del mese corrente (esclusi gli importi eccezionali). */
    currentDailyRate: number;
    /** Mediana dei ritmi giornalieri dei mesi precedenti (null senza storico). */
    historicalDailyRate: number | null;
    /** Ritmo usato: media pesata corrente/storico con peso = frazione di mese trascorsa. */
    dailyRate: number;
    projectedRemaining: number;
    historyMonths: number;
    /** Soglia oltre la quale una singola spesa non entra nel ritmo. */
    bigTicket: number;
  };
  projected: ForecastFigures;
  /** Estremo inferiore di ciascuna grandezza (net = entrate basse − uscite alte). */
  low: ForecastFigures;
  /** Estremo superiore di ciascuna grandezza (net = entrate alte − uscite basse). */
  high: ForecastFigures;
}

const fig = (income: number, expense: number): ForecastFigures => ({ income: round2(income), expense: round2(expense), net: round2(income - expense) });

/**
 * Previsione di entrate, uscite e netto a fine mese.
 * Metodo: effettivo finora + ricorrenze attese nel resto del mese (attive nella stima centrale,
 * in ritardo solo nella banda) + spesa variabile al ritmo r = w·r_corrente + (1−w)·mediana(r_storici),
 * con w = giorni trascorsi / giorni del mese; la banda usa il 25° e 75° percentile dei ritmi storici.
 * Le entrate non ricorrenti non vengono proiettate.
 */
export function monthEndForecast(
  lines: readonly Line[],
  month: string,
  today: string,
  recurring?: readonly RecurringItem[],
  opts: MonthOptions & { historyMonths?: number } = {},
): MonthEndForecast {
  const msd = opts.monthStartDay ?? 1;
  const nHist = opts.historyMonths ?? 6;
  const rec = recurring ?? detectRecurring(lines, today);
  const b = monthBounds(month, msd);
  const t = dayNum(today), s = dayNum(b.start);
  const daysElapsed = Math.min(Math.max(t - s + 1, 0), b.days);
  const daysRemaining = b.days - daysElapsed;

  const recurringIds = new Set<string>();
  for (const r of rec) if (r.direction === "out") for (const id of r.lineIds) recurringIds.add(id);

  const first = firstMonthOf(lines);
  const histMonths: string[] = [];
  for (let k = 1; k <= nHist; k++) {
    const m = addMonths(month, -k);
    if (first && monthIndex(m) >= monthIndex(first)) histMonths.push(m);
  }
  const histIdx = new Map(histMonths.map((m, i) => [m, i]));
  const histVariable = new Float64Array(histMonths.length);
  const histTickets: number[] = [];
  const curTickets: number[] = [];
  let actIn = 0, actOut = 0;
  for (const l of lines) {
    const exp = isExpenseLine(l);
    if (!exp && !isIncomeLine(l)) continue;
    if (l.month === month) {
      if (exp) actOut += spendOf(l); else actIn += l.amount;
      if (exp && !recurringIds.has(l.id)) curTickets.push(spendOf(l));
      continue;
    }
    const hi = histIdx.get(l.month);
    if (hi !== undefined && exp && !recurringIds.has(l.id)) histTickets.push(spendOf(l), hi);
  }
  // Soglia "importo eccezionale": 95° percentile delle spese variabili storiche, almeno 250 €.
  const histValues: number[] = [];
  for (let i = 0; i < histTickets.length; i += 2) if (histTickets[i] > 0) histValues.push(histTickets[i]);
  const q95 = histValues.length >= 20 ? quantileSorted(Float64Array.from(histValues).sort(), 0.95) : 0;
  const bigTicket = Math.max(250, q95);
  for (let i = 0; i < histTickets.length; i += 2) {
    const v = histTickets[i];
    if (v <= bigTicket) histVariable[histTickets[i + 1]] += v;
  }
  let curVariable = 0, curVariableAll = 0;
  for (const v of curTickets) { curVariableAll += v; if (v <= bigTicket) curVariable += v; }

  const rates = Float64Array.from(histMonths.map((m, i) => Math.max(0, histVariable[i]) / monthBounds(m, msd).days)).sort();
  const w = b.days ? daysElapsed / b.days : 0;
  const rCur = daysElapsed ? Math.max(0, curVariable) / daysElapsed : 0;
  const blend = (h: number) => (rates.length ? w * rCur + (1 - w) * h : rCur);
  const rate = blend(rates.length ? quantileSorted(rates, 0.5) : 0);
  const rateLow = rates.length ? blend(quantileSorted(rates, 0.25)) : rCur * 0.8;
  const rateHigh = rates.length ? blend(quantileSorted(rates, 0.75)) : rCur * 1.2;

  // Ricorrenze attese nel resto del mese.
  const pending: PendingRecurring[] = [];
  if (daysRemaining > 0) {
    const end = b.end;
    for (const r of rec) {
      if (r.status === "ended") continue;
      let d = r.nextExpected, guard = 0;
      const push = (date: string, status: "active" | "late") =>
        pending.push({ id: r.id, label: r.label, date, amount: r.direction === "in" ? r.expectedAmount : -r.expectedAmount, direction: r.direction, status, categoryId: r.categoryId });
      if (d <= today) {
        // Già dovuta e non arrivata: attesa nei giorni restanti (solo se il mese è in corso).
        if (t >= s) push(today, r.status === "late" ? "late" : "active");
        while (d <= today && guard++ < 400) d = nextByCadence(d, r.cadence);
      }
      while (d <= end && guard++ < 400) {
        if (d >= b.start) push(d, "active");
        d = nextByCadence(d, r.cadence);
      }
    }
    pending.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  }
  let pInA = 0, pInL = 0, pOutA = 0, pOutL = 0;
  for (const p of pending) {
    const v = Math.abs(p.amount);
    if (p.direction === "in") { if (p.status === "active") pInA += v; else pInL += v; }
    else if (p.status === "active") pOutA += v; else pOutL += v;
  }
  const varCentral = rate * daysRemaining, varLow = rateLow * daysRemaining, varHigh = rateHigh * daysRemaining;
  const incomeC = actIn + pInA, incomeHi = actIn + pInA + pInL;
  const expenseC = actOut + pOutA + varCentral, expenseLo = actOut + pOutA + varLow, expenseHi = actOut + pOutA + pOutL + varHigh;
  return {
    month, today, start: b.start, end: b.end, daysTotal: b.days, daysElapsed, daysRemaining,
    actual: fig(actIn, actOut),
    pending,
    variable: {
      spent: round2(curVariableAll),
      currentDailyRate: round2(rCur),
      historicalDailyRate: rates.length ? round2(quantileSorted(rates, 0.5)) : null,
      dailyRate: round2(rate),
      projectedRemaining: round2(varCentral),
      historyMonths: rates.length,
      bigTicket: round2(bigTicket),
    },
    projected: fig(incomeC, expenseC),
    low: { income: round2(incomeC), expense: round2(expenseLo), net: round2(incomeC - expenseHi) },
    high: { income: round2(incomeHi), expense: round2(expenseHi), net: round2(incomeHi - expenseLo) },
  };
}
