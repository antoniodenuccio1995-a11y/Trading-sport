// Ripartizione per categoria e per gruppo, con confronti col periodo precedente e con le medie storiche.
import type { Category, Line } from "../domain/types.ts";
import { GROUPS } from "../domain/categories.ts";
import { AVG_MONTH_DAYS, monthIndex } from "./dates.ts";
import {
  categoryLookup, firstMonthOf, groupLookup, inPeriod, isExpenseLine, isIncomeLine, periodMonth, previousPeriod, resolvePeriod, spendOf,
  type MonthOptions, type Period, type ResolvedPeriod,
} from "./common.ts";
import { pctChange, round2 } from "./stats.ts";

export interface Comparison {
  /** Valore di riferimento (periodo precedente o media). */
  base: number;
  /** total − base. */
  delta: number;
  /** delta / base, null se base ≈ 0. */
  pct: number | null;
}

export interface BreakdownItem {
  id: string;
  label: string;
  icon: string;
  /** Gruppo di spesa (solo per le uscite). */
  groupId: string;
  total: number;
  /** Quota sul totale del periodo, null se il totale è ≤ 0. */
  share: number | null;
  count: number;
  previous: Comparison;
  /** Media mensile dei 3/6/12 mesi precedenti (riscalata alla durata se il periodo non è un mese); null senza storico. */
  avg3: Comparison | null;
  avg6: Comparison | null;
  avg12: Comparison | null;
}

export interface GroupBreakdownItem extends BreakdownItem { slot: number; categoryIds: string[] }

export interface CategoryBreakdown {
  kind: "expense" | "income";
  period: ResolvedPeriod;
  previousPeriod: ResolvedPeriod;
  total: number;
  count: number;
  previousTotal: number;
  categories: BreakdownItem[];
  /** Gruppi di GROUPS con movimenti (vuoto per le entrate). */
  groups: GroupBreakdownItem[];
}

interface Acc { cur: number; prev: number; count: number; hist: Float64Array }

const HIST = 12;

/** Spesa (o entrate) per categoria e per gruppo nel periodo, con quota, conteggio e confronti con periodo precedente e medie 3/6/12 mesi. */
export function categoryBreakdown(
  lines: readonly Line[],
  period: Period,
  categories: readonly Category[],
  opts: MonthOptions & { kind?: "expense" | "income" } = {},
): CategoryBreakdown {
  const kind = opts.kind ?? "expense";
  const msd = opts.monthStartDay ?? 1;
  const pick = kind === "expense" ? isExpenseLine : isIncomeLine;
  const value = kind === "expense" ? spendOf : (l: Line) => l.amount;
  const cur = resolvePeriod(period, msd);
  const prevP = previousPeriod(period);
  const prev = resolvePeriod(prevP, msd);
  const inCur = inPeriod(period), inPrev = inPeriod(prevP);
  const refIdx = monthIndex(periodMonth(period, msd));
  const first = firstMonthOf(lines);
  // Mesi di storico realmente disponibili (non si contano come "zero" i mesi prima dell'archivio).
  const available = first ? Math.max(0, Math.min(HIST, refIdx - monthIndex(first))) : 0;
  const scale = cur.month ? 1 : cur.days / AVG_MONTH_DAYS;

  const byCat = new Map<string, Acc>();
  const get = (id: string) => {
    let a = byCat.get(id);
    if (!a) { a = { cur: 0, prev: 0, count: 0, hist: new Float64Array(HIST) }; byCat.set(id, a); }
    return a;
  };
  for (const l of lines) {
    if (!pick(l)) continue;
    const v = value(l);
    const c = inCur(l), p = inPrev(l);
    const k = refIdx - monthIndex(l.month);
    if (!c && !p && !(k >= 1 && k <= HIST)) continue;
    const a = get(l.categoryId);
    if (c) { a.cur += v; a.count++; }
    if (p) a.prev += v;
    if (k >= 1 && k <= HIST) a.hist[k - 1] += v;
  }

  const avgCmp = (total: number, hist: Float64Array, months: number): Comparison | null => {
    const n = Math.min(months, available);
    if (n <= 0) return null;
    let s = 0;
    for (let i = 0; i < n; i++) s += hist[i];
    const base = (s / n) * scale;
    return { base: round2(base), delta: round2(total - base), pct: pctChange(total, base) };
  };
  const build = (id: string, label: string, icon: string, groupId: string, a: Acc, total: number): BreakdownItem => ({
    id, label, icon, groupId,
    total: round2(a.cur),
    share: total > 0.005 ? a.cur / total : null,
    count: a.count,
    previous: { base: round2(a.prev), delta: round2(a.cur - a.prev), pct: pctChange(a.cur, a.prev) },
    avg3: avgCmp(a.cur, a.hist, 3),
    avg6: avgCmp(a.cur, a.hist, 6),
    avg12: avgCmp(a.cur, a.hist, 12),
  });

  const info = categoryLookup(categories);
  const group = groupLookup(categories);
  let total = 0, count = 0, prevTotal = 0;
  for (const a of byCat.values()) { total += a.cur; count += a.count; prevTotal += a.prev; }

  const items: BreakdownItem[] = [];
  const groupAcc = new Map<string, Acc & { ids: string[] }>();
  for (const [id, a] of byCat) {
    const ci = info(id);
    const g = kind === "expense" ? group(id) : null;
    if (g) {
      let ga = groupAcc.get(g.id);
      if (!ga) { ga = { cur: 0, prev: 0, count: 0, hist: new Float64Array(HIST), ids: [] }; groupAcc.set(g.id, ga); }
      ga.cur += a.cur; ga.prev += a.prev; ga.count += a.count;
      for (let i = 0; i < HIST; i++) ga.hist[i] += a.hist[i];
      if (a.count || Math.abs(a.prev) > 0.005) ga.ids.push(id);
    }
    if (!a.count && Math.abs(a.prev) < 0.005) continue; // solo storico: non è nel periodo né in quello prima
    items.push(build(id, ci.label, ci.icon, g ? g.id : "", a, total));
  }
  const byTotal = (x: BreakdownItem, y: BreakdownItem) => y.total - x.total || x.label.localeCompare(y.label);
  items.sort(byTotal);

  const groups: GroupBreakdownItem[] = [];
  const order = new Map(items.map((it, i) => [it.id, i]));
  for (const g of GROUPS) {
    const ga = groupAcc.get(g.id);
    if (!ga || (!ga.count && Math.abs(ga.prev) < 0.005)) continue;
    ga.ids.sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0));
    groups.push({ ...build(g.id, g.label, g.icon, g.id, ga, total), slot: g.slot, categoryIds: ga.ids });
  }
  groups.sort(byTotal);

  return { kind, period: cur, previousPeriod: prev, total: round2(total), count, previousTotal: round2(prevTotal), categories: items, groups };
}
