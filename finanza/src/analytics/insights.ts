// Frasi brevi e fattuali in italiano sui dati del mese, ordinate per rilevanza.
import type { Account, Budgets, Category, Line } from "../domain/types.ts";
import { monthKey } from "../domain/movement.ts";
import { addMonths, dayNum } from "./dates.ts";
import type { MonthOptions } from "./common.ts";
import { formatEUR, formatNumber1, formatPct, formatSignedEUR, inMonth, longDate, ofMonth } from "./format.ts";
import { spendingPace } from "./pace.ts";
import { categoryBreakdown } from "./breakdown.ts";
import { detectRecurring, type RecurringItem } from "./recurring.ts";
import { budgetStatus } from "./budget.ts";
import { monthEndForecast } from "./forecast.ts";
import { kpis } from "./kpis.ts";
import { findAnomalies } from "./anomalies.ts";
import { openAdvances } from "./advances.ts";

export type InsightKind = "good" | "warn" | "info";

export interface Insight {
  id: string;
  kind: InsightKind;
  text: string;
  /** Rilevanza 0–100 usata per l'ordinamento. */
  score: number;
  topic: "ritmo" | "categorie" | "abbonamenti" | "ricorrenze" | "budget" | "previsione" | "risparmio" | "anomalie" | "liquidita" | "anticipi";
}

export interface InsightOptions extends MonthOptions {
  /** Numero massimo di frasi (default 8). */
  max?: number;
  /** Ricorrenze già calcolate con detectRecurring(lines, today), per non ricalcolarle. */
  recurring?: readonly RecurringItem[];
}

const MAX_PER_TOPIC = 2;

/** Fino a ~8 osservazioni in italiano, neutre e fattuali, ordinate per rilevanza, con tipo good/warn/info. */
export function insights(
  lines: readonly Line[],
  accounts: readonly Account[],
  budgets: Budgets,
  categories: readonly Category[],
  today: string,
  opts: InsightOptions = {},
): Insight[] {
  if (!lines.length) return [];
  const msd = opts.monthStartDay ?? 1;
  const max = opts.max ?? 8;
  const M = monthKey(today, msd), P = addMonths(M, -1);
  const year = M.slice(0, 4);
  const out: Insight[] = [];
  const add = (i: Insight) => out.push(i);
  const t = dayNum(today);

  // Ritmo di spesa rispetto al mese precedente.
  const pace = spendingPace(lines, M, today, { monthStartDay: msd });
  const vp = pace.vsPrevious;
  if (vp && pace.day >= 3 && pace.day < pace.days && Math.abs(vp.diff) >= Math.max(30, 0.1 * vp.reference)) {
    const strength = Math.min(30, Math.abs(vp.pct ?? 1) * 50);
    add(vp.diff > 0
      ? { id: "pace", kind: "warn", topic: "ritmo", score: 55 + strength, text: `Sei in anticipo di ${formatEUR(vp.diff)} sul ritmo di spesa ${ofMonth(P, year)}` }
      : { id: "pace", kind: "good", topic: "ritmo", score: 45 + strength, text: `Hai speso ${formatEUR(-vp.diff)} in meno rispetto allo stesso punto ${ofMonth(P, year)}` });
  }

  // Categorie del mese corrente già sopra la media di 6 mesi (anche se il mese non è finito).
  const cur = categoryBreakdown(lines, M, categories, { monthStartDay: msd });
  const ups = cur.categories
    .filter((c) => c.avg6 && c.avg6.pct !== null && c.total >= 50 && c.avg6.pct >= 0.25 && c.avg6.delta >= 30)
    .sort((a, b) => b.avg6!.delta - a.avg6!.delta)
    .slice(0, 2);
  for (const c of ups) {
    add({
      id: "cat-up:" + c.id, kind: "warn", topic: "categorie", score: 55 + Math.min(30, c.avg6!.pct! * 30),
      text: `${c.label}: ${formatEUR(c.total)} ${inMonth(M, year)}, ${formatPct(c.avg6!.pct!, true)} rispetto alla media di 6 mesi`,
    });
  }
  // Mese precedente chiuso: la categoria scesa di più.
  const prev = categoryBreakdown(lines, P, categories, { monthStartDay: msd });
  const down = prev.categories
    .filter((c) => c.avg6 && c.avg6.pct !== null && c.avg6.base >= 50 && c.avg6.pct <= -0.2 && c.avg6.delta <= -30)
    .sort((a, b) => a.avg6!.delta - b.avg6!.delta)[0];
  if (down) {
    add({
      id: "cat-down:" + down.id, kind: "good", topic: "categorie", score: 40 + Math.min(20, -down.avg6!.pct! * 30),
      text: `${down.label}: ${formatEUR(down.total)} ${inMonth(P, year)}, ${formatPct(down.avg6!.pct!, true)} rispetto alla media di 6 mesi`,
    });
  }

  // Abbonamenti e ricorrenze.
  const rec = opts.recurring ?? detectRecurring(lines, today);
  const subs = rec.filter((r) => r.direction === "out" && r.kind === "subscription" && r.status !== "ended");
  if (subs.length) {
    const monthly = subs.reduce((s, r) => s + r.monthly, 0);
    const raised = subs
      .filter((r) => r.priceChange && r.priceChange.pct > 0.05 && t - dayNum(r.priceChange.since) <= 120)
      .sort((a, b) => b.priceChange!.pct - a.priceChange!.pct)[0];
    const head = `Abbonamenti: ${subs.length} ${subs.length === 1 ? "attivo" : "attivi"} per ${formatEUR(monthly)}/mese`;
    add(raised
      ? { id: "subs", kind: "warn", topic: "abbonamenti", score: 60, text: `${head}; ${raised.label} è aumentato del ${formatPct(raised.priceChange!.pct)}` }
      : { id: "subs", kind: "info", topic: "abbonamenti", score: 35, text: head });
  }
  const late = rec.filter((r) => r.status === "late").sort((a, b) => (b.direction === "in" ? 1 : 0) - (a.direction === "in" ? 1 : 0) || b.monthly - a.monthly).slice(0, 2);
  for (const r of late) {
    const what = r.direction === "in" ? `entrata ${r.cadenceLabel} attesa` : `addebito ${r.cadenceLabel} atteso`;
    const notYet = r.direction === "in" ? "non ancora arrivata" : "non ancora registrato";
    add({ id: "late:" + r.id, kind: r.direction === "in" ? "warn" : "info", topic: "ricorrenze", score: r.direction === "in" ? 62 : 42,
      text: `${r.label}: ${what} il ${longDate(r.nextExpected)}, ${notYet}` });
  }
  const ended = rec
    .filter((r) => r.direction === "out" && r.kind === "subscription" && r.status === "ended" && t - dayNum(r.last) <= 120)
    .sort((a, b) => b.monthly - a.monthly)[0];
  if (ended) {
    add({ id: "ended:" + ended.id, kind: "info", topic: "abbonamenti", score: 30,
      text: `${ended.label} sembra disdetto: ultimo addebito il ${longDate(ended.last)} (${formatEUR(ended.monthly)}/mese)` });
  }

  // Budget.
  const bs = budgetStatus(lines, budgets, M, today, categories, { monthStartDay: msd });
  for (const it of bs.items.filter((i) => i.status === "sforato").slice(0, 2)) {
    add({ id: "budget-over:" + it.categoryId, kind: "warn", topic: "budget", score: 70 + Math.min(20, (it.pct - 1) * 40),
      text: `Budget ${it.label} superato: ${formatEUR(it.spent)} su ${formatEUR(it.budget)} (${formatPct(it.pct)})` });
  }
  for (const it of bs.items.filter((i) => i.status === "attenzione" && i.projected > i.budget).slice(0, 1)) {
    add({ id: "budget-risk:" + it.categoryId, kind: "warn", topic: "budget", score: 52,
      text: `${it.label}: previsti ${formatEUR(it.projected)} a fine mese su un budget di ${formatEUR(it.budget)}` });
  }
  if (bs.items.length && bs.items.every((i) => i.status === "ok") && bs.daysElapsed >= 10) {
    add({ id: "budget-ok", kind: "good", topic: "budget", score: 32,
      text: `Budget in linea: ${formatEUR(bs.totals.spent)} spesi su ${formatEUR(bs.totals.budget)} (${formatPct(bs.totals.pct ?? 0)})` });
  }

  // Previsione di fine mese.
  const fc = monthEndForecast(lines, M, today, rec, { monthStartDay: msd });
  if (fc.daysRemaining > 0 && fc.daysElapsed >= 5 && (fc.actual.income > 0 || fc.actual.expense > 0)) {
    add({ id: "forecast", kind: fc.projected.net >= 0 ? "info" : "warn", topic: "previsione", score: fc.projected.net >= 0 ? 44 : 58,
      text: `Previsione di fine mese: saldo ${formatSignedEUR(fc.projected.net)} (tra ${formatSignedEUR(fc.low.net)} e ${formatSignedEUR(fc.high.net)})` });
  }

  // Tasso di risparmio del mese chiuso rispetto agli ultimi 12 mesi.
  const k = kpis(lines, accounts, today, { monthStartDay: msd });
  if (k.lastMonth.months && k.lastMonth.savingsRate !== null && k.last12.months >= 3 && k.last12.savingsRate !== null) {
    const better = k.lastMonth.savingsRate >= k.last12.savingsRate;
    add({ id: "savings", kind: better ? "good" : "info", topic: "risparmio", score: 38,
      text: `Tasso di risparmio ${ofMonth(P, year)}: ${formatPct(k.lastMonth.savingsRate)} (media 12 mesi: ${formatPct(k.last12.savingsRate)})` });
  }

  // Anomalie del mese.
  const an = findAnomalies(lines, M, { categories, monthStartDay: msd }).filter((a) => a.severity !== "low" && a.kind !== "category").slice(0, 2);
  for (const a of an) {
    add({ id: "anomaly:" + (a.lineId ?? a.categoryId), kind: "warn", topic: "anomalie", score: a.severity === "high" ? 57 : 46, text: a.reason });
  }

  // Fondo di emergenza.
  if (k.emergencyFundMonths !== null && k.avgMonthlyExpense6) {
    const m = k.emergencyFundMonths;
    add({ id: "emergency", kind: m < 3 ? "warn" : "info", topic: "liquidita", score: m < 3 ? 50 : 22,
      text: `La liquidità copre ${formatNumber1(Math.max(0, m))} mesi di spesa media (${formatEUR(k.avgMonthlyExpense6)}/mese)` });
  }

  // Anticipi da recuperare.
  const adv = openAdvances(lines);
  if (adv.openCount > 0) {
    const open = adv.items.filter((i) => i.status === "aperto");
    const who = open.length === 1 ? `da ${open[0].counterparty}` : `da ${open.length} persone (${open[0].counterparty} ${formatEUR(open[0].outstanding)})`;
    add({ id: "advances", kind: "info", topic: "anticipi", score: 28, text: `Anticipi da recuperare: ${formatEUR(adv.totals.outstanding)} ${who}` });
  }

  out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const perTopic = new Map<string, number>();
  const picked: Insight[] = [];
  for (const i of out) {
    const n = perTopic.get(i.topic) ?? 0;
    if (n >= MAX_PER_TOPIC) continue;
    perTopic.set(i.topic, n + 1);
    picked.push({ ...i, score: Math.round(i.score) });
    if (picked.length >= max) break;
  }
  return picked;
}
