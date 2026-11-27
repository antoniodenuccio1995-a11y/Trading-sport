// Classifica degli esercenti e storico di un singolo esercente.
import type { Line } from "../domain/types.ts";
import { norm } from "../domain/movement.ts";
import { monthsBetween } from "./dates.ts";
import { inPeriod, isExpenseLine, isIncomeLine, spendOf, type Period } from "./common.ts";
import { median, round2 } from "./stats.ts";

export interface MerchantStat {
  merchant: string;
  /** Spesa netta (acquisti − resi). */
  total: number;
  /** Numero di acquisti (movimenti distinti: le quote di uno stesso movimento contano una volta). */
  count: number;
  /** Scontrino medio degli acquisti. */
  average: number;
  /** Categoria più frequente. */
  categoryId: string;
  share: number | null;
  first: string;
  last: string;
}

export interface TopMerchants {
  items: MerchantStat[];
  total: number;
  others: { total: number; count: number; merchants: number };
}

const keyOf = (l: Line) => l.merchant || "(senza descrizione)";

/** Primi `n` esercenti per spesa netta nel periodo, con conteggio, scontrino medio, categoria prevalente e quota. */
export function topMerchants(lines: readonly Line[], period: Period, n = 10): TopMerchants {
  const inP = inPeriod(period);
  interface Acc { total: number; gross: number; parents: Set<string>; cats: Map<string, number>; first: string; last: string }
  const acc = new Map<string, Acc>();
  let total = 0;
  for (const l of lines) {
    if (!isExpenseLine(l) || !inP(l)) continue;
    const k = keyOf(l), v = spendOf(l);
    let a = acc.get(k);
    if (!a) { a = { total: 0, gross: 0, parents: new Set(), cats: new Map(), first: l.date, last: l.date }; acc.set(k, a); }
    a.total += v;
    total += v;
    if (v > 0) { a.gross += v; a.parents.add(l.parentId || l.id); }
    a.cats.set(l.categoryId, (a.cats.get(l.categoryId) ?? 0) + 1);
    if (l.date < a.first) a.first = l.date;
    if (l.date > a.last) a.last = l.date;
  }
  const all: MerchantStat[] = [];
  for (const [merchant, a] of acc) {
    let cat = "", best = -1;
    for (const [c, k] of a.cats) if (k > best) { best = k; cat = c; }
    const count = a.parents.size;
    all.push({
      merchant, total: round2(a.total), count, average: count ? round2(a.gross / count) : 0, categoryId: cat,
      share: total > 0.005 ? a.total / total : null, first: a.first, last: a.last,
    });
  }
  all.sort((x, y) => y.total - x.total || x.merchant.localeCompare(y.merchant));
  const items = all.slice(0, Math.max(0, n));
  const rest = all.slice(items.length);
  let rTotal = 0, rCount = 0;
  for (const r of rest) { rTotal += r.total; rCount += r.count; }
  return { items, total: round2(total), others: { total: round2(rTotal), count: rCount, merchants: rest.length } };
}

export interface MerchantHistory {
  merchant: string;
  /** Righe economiche dell'esercente, dalla più recente. */
  lines: Line[];
  spent: number;
  received: number;
  count: number;
  first: string;
  last: string;
  /** Importo medio e mediano degli acquisti. */
  average: number;
  median: number;
  /** Spesa netta per mese, continua dal primo all'ultimo mese. */
  byMonth: { month: string; total: number; count: number }[];
}

/** Storico di un esercente: righe, totali, importo medio/mediano e spesa mensile continua. */
export function merchantHistory(lines: readonly Line[], merchant: string): MerchantHistory {
  const target = norm(merchant);
  const own: Line[] = [];
  for (const l of lines) {
    if (!(isExpenseLine(l) || isIncomeLine(l))) continue;
    if (l.merchant === merchant || l.merchant === target) own.push(l);
  }
  own.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  let spent = 0, received = 0;
  const purchases: number[] = [];
  const monthly = new Map<string, { total: number; count: number }>();
  for (const l of own) {
    if (l.type === "expense") {
      const v = spendOf(l);
      spent += v;
      if (v > 0) purchases.push(v);
      const m = monthly.get(l.month) ?? { total: 0, count: 0 };
      m.total += v; m.count++;
      monthly.set(l.month, m);
    } else received += l.amount;
  }
  const months = own.length ? monthsBetween(own[own.length - 1].month, own[0].month) : [];
  return {
    merchant: own[0]?.merchant ?? target,
    lines: own,
    spent: round2(spent),
    received: round2(received),
    count: own.length,
    first: own.length ? own[own.length - 1].date : "",
    last: own.length ? own[0].date : "",
    average: purchases.length ? round2(purchases.reduce((x, y) => x + y, 0) / purchases.length) : 0,
    median: purchases.length ? round2(median(purchases)) : 0,
    byMonth: months.map((month) => {
      const m = monthly.get(month);
      return { month, total: round2(m?.total ?? 0), count: m?.count ?? 0 };
    }),
  };
}
