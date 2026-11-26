// Analisi memorizzate per versione dei dati + parametri. Nessun calcolo a ogni render.
import * as An from "../analytics/index.ts";
import type { Period } from "../analytics/common.ts";
import { getSnap, latestMonth, lines, memo } from "./store.ts";
import { todayIso } from "../ui/format.ts";

const opts = () => ({ monthStartDay: getSnap().settings.monthStartDay || 1 });
const pk = (p: Period) => (typeof p === "string" ? p : p.from + "_" + p.to);

/** "Oggi" per le analisi: la data reale, ma mai oltre l'ultimo movimento + 45 giorni (archivi non aggiornati). */
export const today = () => memo("today", () => {
  const t = todayIso();
  const ls = lines();
  let last = "";
  for (const l of ls) if (l.date > last) last = l.date;
  if (!last) return t;
  const lim = new Date(Date.parse(last + "T00:00:00Z") + 45 * 86400000).toISOString().slice(0, 10);
  return t > lim ? last : t;
});
export const currentMonth = () => memo("curmonth", () => { const t = today(); const m = latestMonth(); return t.slice(0, 7) > m ? t.slice(0, 7) : m; });
/** Data di riferimento per un mese: oggi se è il mese corrente, altrimenti l'ultimo giorno del mese. */
export const refDate = (month: string) => {
  const t = today();
  if (t.slice(0, 7) === month) return t;
  const b = An.monthBounds(month, opts().monthStartDay);
  return b.end < t ? b.end : t;
};

export const series = () => memo("series", () => An.monthlySeries(lines()));
export const breakdown = (p: Period, kind: "expense" | "income" = "expense") => memo("bd" + pk(p) + kind, () => An.categoryBreakdown(lines(), p, getSnap().categories, { ...opts(), kind }));
export const recurring = () => memo("rec", () => An.detectRecurring(lines(), today()));
export const pace = (month: string) => memo("pace" + month, () => An.spendingPace(lines(), month, refDate(month), opts()));
export const forecast = (month: string) => memo("fc" + month, () => An.monthEndForecast(lines(), month, refDate(month), recurring(), opts()));
export const budget = (month: string) => memo("bud" + month, () => An.budgetStatus(lines(), getSnap().budgets, month, refDate(month), getSnap().categories, opts()));
export const kpis = () => memo("kpis", () => An.kpis(lines(), getSnap().accounts, today(), opts()));
export const insights = () => memo("ins", () => An.insights(lines(), getSnap().accounts, getSnap().budgets, getSnap().categories, today(), { ...opts(), recurring: recurring() }));
export const anomalies = (month: string) => memo("anom" + month, () => An.findAnomalies(lines(), month, { ...opts(), categories: getSnap().categories }));
export const sankey = (p: Period, perGroup = 3) => memo("sk" + pk(p) + perGroup, () => An.cashflowSankey(lines(), p, getSnap().categories, { categoriesPerGroup: perGroup, includeInvestments: true }));
export const daily = (p: Period) => memo("day" + pk(p), () => An.dailyTotals(lines(), p, opts()));
export const weekdays = (p: Period) => memo("wd" + pk(p), () => An.weekdayPattern(lines(), p, opts()));
export const merchants = (p: Period, n = 12) => memo("mer" + pk(p) + n, () => An.topMerchants(lines(), p, n));
export const netWorth = () => memo("nw", () => An.netWorthSeries(lines(), getSnap().accounts, { granularity: "month" }));
