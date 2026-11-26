// Predicati sulle righe, periodi e piccoli aiuti condivisi dai moduli di analisi.
import type { Category, Line } from "../domain/types.ts";
import { isEconomic, monthKey } from "../domain/movement.ts";
import { GROUPS, groupOf, type Group } from "../domain/categories.ts";
import { addDays, addMonths, dayNum, monthBounds } from "./dates.ts";

/** Opzioni comuni: giorno di inizio del mese contabile (Settings.monthStartDay). */
export interface MonthOptions { monthStartDay?: number }

/** Uscita reale (spesa o reso) che entra nei KPI. */
export const isExpenseLine = (l: Line): boolean => l.type === "expense" && !!l.date && isEconomic(l);

/** Entrata reale che entra nei KPI. */
export const isIncomeLine = (l: Line): boolean => l.type === "income" && !!l.date && isEconomic(l);

/** Spesa netta della riga: positiva per un acquisto, negativa per un reso/rimborso nella categoria. */
export const spendOf = (l: Line): number => -l.amount;

/** Riga di investimento (acquisto o vendita). */
export const isInvestLine = (l: Line): boolean => l.type === "invest_buy" || l.type === "invest_sell";

/** Capitale investito netto della riga: + contanti verso investimenti, − contanti rientrati. */
export const investedOf = (l: Line): number => -l.amount;

/**
 * Periodo di analisi: un mese contabile "YYYY-MM" (usa Line.month) oppure un
 * intervallo di date ISO inclusivo { from, to } (usa Line.date).
 */
export type Period = string | { from: string; to: string };

export interface ResolvedPeriod {
  /** Mese contabile se il periodo è un mese, altrimenti null. */
  month: string | null;
  from: string;
  to: string;
  days: number;
}

/** Date di inizio/fine e durata di un periodo. */
export function resolvePeriod(p: Period, monthStartDay = 1): ResolvedPeriod {
  if (typeof p === "string") {
    const b = monthBounds(p, monthStartDay);
    return { month: p, from: b.start, to: b.end, days: b.days };
  }
  return { month: null, from: p.from, to: p.to, days: Math.max(0, dayNum(p.to) - dayNum(p.from) + 1) };
}

/** Predicato di appartenenza al periodo (per mese usa Line.month, per intervallo Line.date). */
export function inPeriod(p: Period): (l: Line) => boolean {
  if (typeof p === "string") return (l) => l.month === p;
  const { from, to } = p;
  return (l) => l.date >= from && l.date <= to;
}

/** Periodo precedente di pari durata (mese precedente, o intervallo che finisce il giorno prima). */
export function previousPeriod(p: Period): Period {
  if (typeof p === "string") return addMonths(p, -1);
  const len = dayNum(p.to) - dayNum(p.from) + 1;
  return { from: addDays(p.from, -len), to: addDays(p.from, -1) };
}

/** Mese contabile di riferimento del periodo (il mese stesso, o quello che contiene `from`). */
export const periodMonth = (p: Period, monthStartDay = 1): string =>
  typeof p === "string" ? p : monthKey(p.from, monthStartDay);

/** Primo mese con dati (qualsiasi tipo di riga), "" se nessuna riga. */
export function firstMonthOf(lines: readonly Line[]): string {
  let m = "";
  for (const l of lines) if (l.month && (m === "" || l.month < m)) m = l.month;
  return m;
}

/** Prima e ultima data presenti (qualsiasi tipo di riga). */
export function dateExtent(lines: readonly Line[]): { first: string; last: string } | null {
  let first = "", last = "";
  for (const l of lines) {
    if (!l.date) continue;
    if (first === "" || l.date < first) first = l.date;
    if (last === "" || l.date > last) last = l.date;
  }
  return first ? { first, last } : null;
}

export interface CategoryInfo { id: string; label: string; icon: string; color: string; groupId: string; budgetEligible: boolean }

/** Indice id -> informazioni di categoria, con un'etichetta di ripiego per id sconosciuti. */
export function categoryLookup(categories: readonly Category[] = []): (id: string) => CategoryInfo {
  const byId = new Map<string, CategoryInfo>();
  for (const c of categories) {
    byId.set(c.id, { id: c.id, label: c.label, icon: c.icon, color: c.color, groupId: groupOf(c.id).id, budgetEligible: c.budgetEligible });
  }
  return (id) => {
    const hit = byId.get(id);
    if (hit) return hit;
    const info: CategoryInfo = { id, label: id ? id : "Senza categoria", icon: id ? "•" : "❔", color: "", groupId: groupOf(id).id, budgetEligible: false };
    byId.set(id, info);
    return info;
  };
}

/** Gruppo di spesa di una categoria, con mappa locale per evitare ricerche ripetute. */
export function groupLookup(): (categoryId: string) => Group {
  const cache = new Map<string, Group>();
  return (id) => {
    let g = cache.get(id);
    if (!g) { g = groupOf(id); cache.set(id, g); }
    return g;
  };
}

/** I gruppi definiti nel dominio, per id. */
export const groupById = (id: string): Group | undefined => GROUPS.find((g) => g.id === id);
