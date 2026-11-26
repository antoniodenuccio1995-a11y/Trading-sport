// Stato dei budget mensili per categoria: speso, residuo, ritmo atteso, proiezione a fine mese.
import type { Budgets, Category, Line } from "../domain/types.ts";
import { addMonths, dayNum, monthBounds, monthIndex } from "./dates.ts";
import { firstMonthOf, groupLookup, isExpenseLine, spendOf, type MonthOptions } from "./common.ts";
import { clamp, median, round2 } from "./stats.ts";

export type BudgetState = "ok" | "attenzione" | "sforato";

export interface BudgetItem {
  categoryId: string;
  label: string;
  icon: string;
  groupId: string;
  budget: number;
  spent: number;
  remaining: number;
  /** spent / budget. */
  pct: number;
  /** Quota di budget "consumabile" a oggi con ritmo lineare. */
  expectedAtToday: number;
  /** Spesa prevista a fine mese. */
  projected: number;
  /** "storico": residuo tipico dei mesi precedenti dopo lo stesso punto del mese; "lineare": speso/giorni × durata; "finale": mese chiuso. */
  projection: "storico" | "lineare" | "finale";
  status: BudgetState;
}

export interface BudgetStatus {
  month: string;
  today: string;
  daysTotal: number;
  daysElapsed: number;
  items: BudgetItem[];
  totals: { budget: number; spent: number; remaining: number; pct: number | null; expectedAtToday: number; projected: number; status: BudgetState };
  /** Spesa del mese nelle categorie senza budget. */
  unbudgetedSpent: number;
}

/** Budget del mese per una categoria: override del mese, altrimenti default (0 se assente). */
export const budgetFor = (budgets: Budgets, month: string, categoryId: string): number =>
  Number(budgets.months?.[month]?.[categoryId] ?? budgets.default?.[categoryId] ?? 0) || 0;

/** sforato: speso oltre il budget; attenzione: la proiezione di fine mese supera il budget; altrimenti ok. */
const stateOf = (spent: number, budget: number, projected: number): BudgetState =>
  spent > budget + 0.005 ? "sforato" : projected > budget + 0.005 ? "attenzione" : "ok";

/**
 * Per ogni categoria di spesa con budget (Budgets.months[mese][id] ?? Budgets.default[id]):
 * speso, residuo, percentuale, atteso a oggi (lineare), proiezione a fine mese e stato.
 * La proiezione usa quanto si è speso di solito nel resto del mese (mediana dei 6 mesi precedenti),
 * scalato per il ritmo attuale (0,5–2×); senza almeno 2 mesi di storico è lineare.
 */
export function budgetStatus(
  lines: readonly Line[],
  budgets: Budgets,
  month: string,
  today: string,
  categories: readonly Category[],
  opts: MonthOptions & { historyMonths?: number } = {},
): BudgetStatus {
  const msd = opts.monthStartDay ?? 1;
  const nHist = opts.historyMonths ?? 6;
  const b = monthBounds(month, msd);
  const daysElapsed = clamp(dayNum(today) - dayNum(b.start) + 1, 0, b.days);
  const frac = b.days ? daysElapsed / b.days : 1;
  const group = groupLookup();

  const budgeted = new Map<string, { cat: Category; budget: number }>();
  for (const c of categories) {
    if (!c.budgetEligible || c.direction !== "expense") continue;
    const v = budgetFor(budgets, month, c.id);
    if (v > 0) budgeted.set(c.id, { cat: c, budget: v });
  }

  const first = firstMonthOf(lines);
  const hist: { month: string; start: number; cutoff: number }[] = [];
  for (let k = 1; k <= nHist; k++) {
    const m = addMonths(month, -k);
    if (!first || monthIndex(m) < monthIndex(first)) break;
    const hb = monthBounds(m, msd);
    hist.push({ month: m, start: dayNum(hb.start), cutoff: frac * hb.days });
  }
  const histIdx = new Map(hist.map((h, i) => [h.month, i]));
  const H = hist.length;
  const spent = new Map<string, number>();
  const toDate = new Map<string, Float64Array>(), rest = new Map<string, Float64Array>();
  let unbudgeted = 0;
  for (const l of lines) {
    if (!isExpenseLine(l)) continue;
    const v = spendOf(l);
    if (l.month === month) {
      if (budgeted.has(l.categoryId)) spent.set(l.categoryId, (spent.get(l.categoryId) ?? 0) + v);
      else unbudgeted += v;
      continue;
    }
    const hi = histIdx.get(l.month);
    if (hi === undefined || !budgeted.has(l.categoryId)) continue;
    let td = toDate.get(l.categoryId), rs = rest.get(l.categoryId);
    if (!td || !rs) { td = new Float64Array(H); rs = new Float64Array(H); toDate.set(l.categoryId, td); rest.set(l.categoryId, rs); }
    const day = dayNum(l.date) - hist[hi].start + 1;
    if (day <= hist[hi].cutoff) td[hi] += v; else rs[hi] += v;
  }

  const items: BudgetItem[] = [];
  for (const [id, { cat, budget }] of budgeted) {
    const s = spent.get(id) ?? 0;
    let projected: number, projection: BudgetItem["projection"];
    if (daysElapsed >= b.days) { projected = s; projection = "finale"; }
    else if (H >= 2) {
      const td = toDate.get(id), rs = rest.get(id);
      const medRest = rs ? median(Array.from(rs)) : 0;
      const medTo = td ? median(Array.from(td)) : 0;
      const ratio = medTo > 5 ? clamp(s / medTo, 0.5, 2) : 1;
      projected = s + Math.max(0, medRest) * ratio;
      projection = "storico";
    } else {
      projected = daysElapsed > 0 ? (s / daysElapsed) * b.days : s;
      projection = "lineare";
    }
    items.push({
      categoryId: id, label: cat.label, icon: cat.icon, groupId: group(id).id,
      budget: round2(budget), spent: round2(s), remaining: round2(budget - s), pct: s / budget,
      expectedAtToday: round2(budget * frac), projected: round2(projected), projection, status: stateOf(s, budget, projected),
    });
  }
  const rank: Record<BudgetState, number> = { sforato: 0, attenzione: 1, ok: 2 };
  items.sort((x, y) => rank[x.status] - rank[y.status] || y.pct - x.pct || x.label.localeCompare(y.label));
  let tb = 0, ts = 0, tp = 0;
  for (const it of items) { tb += it.budget; ts += it.spent; tp += it.projected; }
  return {
    month, today, daysTotal: b.days, daysElapsed, items,
    totals: {
      budget: round2(tb), spent: round2(ts), remaining: round2(tb - ts), pct: tb > 0 ? ts / tb : null,
      expectedAtToday: round2(tb * frac), projected: round2(tp), status: tb > 0 ? stateOf(ts, tb, tp) : "ok",
    },
    unbudgetedSpent: round2(unbudgeted),
  };
}
