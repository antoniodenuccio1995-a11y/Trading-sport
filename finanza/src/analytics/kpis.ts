// Indicatori sintetici per la home: mese corrente, ultimi 12 mesi, spesa media, fondo di emergenza, patrimonio.
import type { Account, Line } from "../domain/types.ts";
import { monthKey } from "../domain/movement.ts";
import { addMonths, monthIndex } from "./dates.ts";
import { firstMonthOf, isExpenseLine, isIncomeLine, spendOf, type MonthOptions } from "./common.ts";
import { currentBalances } from "./balances.ts";
import { openAdvances } from "./advances.ts";
import { round2 } from "./stats.ts";

export interface PeriodKpi {
  /** Primo e ultimo mese contabile del periodo (inclusi). */
  from: string;
  to: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
  /** Mesi del periodo coperti dai dati. */
  months: number;
}

export interface Kpis {
  today: string;
  month: string;
  thisMonth: PeriodKpi;
  lastMonth: PeriodKpi;
  /** I 12 mesi completi prima del mese corrente. */
  last12: PeriodKpi;
  /** Da gennaio al mese corrente incluso. */
  yearToDate: PeriodKpi;
  /** Spesa media mensile degli ultimi 6 mesi completi con dati (null senza storico). */
  avgMonthlyExpense6: number | null;
  avgMonthlyIncome6: number | null;
  /** Liquidità alla data di oggi (somma dei saldi). */
  liquidity: number;
  /** Capitale investito netto (versato − rientrato). */
  investedNet: number;
  /** Liquidità + capitale investito al costo. */
  netWorth: number;
  /** Mesi di spesa media coperti dalla liquidità. */
  emergencyFundMonths: number | null;
  /** Anticipi ancora da recuperare. */
  advancesOutstanding: number;
}

/** KPI principali: entrate/uscite/netto/tasso di risparmio del mese e degli ultimi 12 mesi, spesa media, fondo di emergenza, capitale investito. */
export function kpis(lines: readonly Line[], accounts: readonly Account[], today: string, opts: MonthOptions = {}): Kpis {
  const msd = opts.monthStartDay ?? 1;
  const month = monthKey(today, msd);
  const ref = monthIndex(month);
  const N = 13; // mese corrente + 12 precedenti
  const inc = new Float64Array(N), exp = new Float64Array(N);
  const year = month.slice(0, 4);
  let ytdIn = 0, ytdOut = 0;
  for (const l of lines) {
    const e = isExpenseLine(l);
    if (!e && !isIncomeLine(l)) continue;
    const k = ref - monthIndex(l.month);
    const v = e ? spendOf(l) : l.amount;
    if (k >= 0 && k < N) { if (e) exp[k] += v; else inc[k] += v; }
    if (k >= 0 && l.month.slice(0, 4) === year) { if (e) ytdOut += v; else ytdIn += v; }
  }
  const first = firstMonthOf(lines);
  const available = first ? Math.max(0, ref - monthIndex(first)) : 0; // mesi completi con dati
  const sumRange = (k0: number, k1: number) => {
    let i = 0, o = 0;
    for (let k = k0; k <= k1; k++) { i += inc[k]; o += exp[k]; }
    return [i, o];
  };
  const pk = (k0: number, k1: number, months: number): PeriodKpi => {
    const [i, o] = sumRange(k0, k1);
    return { from: addMonths(month, -k1), to: addMonths(month, -k0), income: round2(i), expense: round2(o), net: round2(i - o), savingsRate: i > 0.005 ? (i - o) / i : null, months };
  };
  const ytdMonths = +month.slice(5, 7);
  const ytd: PeriodKpi = {
    from: `${year}-01`, to: month, income: round2(ytdIn), expense: round2(ytdOut), net: round2(ytdIn - ytdOut),
    savingsRate: ytdIn > 0.005 ? (ytdIn - ytdOut) / ytdIn : null, months: first ? Math.min(ytdMonths, ref - monthIndex(first) + 1) : 0,
  };
  const n6 = Math.min(6, available);
  let avgExp: number | null = null, avgInc: number | null = null;
  if (n6 > 0) {
    const [i, o] = sumRange(1, n6);
    avgExp = round2(o / n6);
    avgInc = round2(i / n6);
  }
  const bal = currentBalances(lines, accounts, today);
  return {
    today, month,
    thisMonth: pk(0, 0, first && first <= month ? 1 : 0),
    lastMonth: pk(1, 1, available >= 1 ? 1 : 0),
    last12: pk(1, 12, Math.min(12, available)),
    yearToDate: ytd,
    avgMonthlyExpense6: avgExp,
    avgMonthlyIncome6: avgInc,
    liquidity: bal.liquidity,
    investedNet: bal.invested,
    netWorth: bal.netWorth,
    emergencyFundMonths: avgExp && avgExp > 0 ? bal.liquidity / avgExp : null,
    advancesOutstanding: openAdvances(lines).totals.outstanding,
  };
}
