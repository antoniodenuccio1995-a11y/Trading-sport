// Anomalie del mese: importi insoliti per esercente o categoria, nuovi esercenti con importi alti, categorie fuori scala.
import type { Category, Line } from "../domain/types.ts";
import { monthIndex } from "./dates.ts";
import { categoryLookup, firstMonthOf, isExpenseLine, spendOf, type MonthOptions } from "./common.ts";
import { displayName, formatEUR, formatPct, inMonth, shortDate } from "./format.ts";
import { median, quantileSorted, robustScale, round2 } from "./stats.ts";

export type Severity = "low" | "medium" | "high";

export interface Anomaly {
  kind: "transaction" | "new_merchant" | "category";
  severity: Severity;
  /** Breve spiegazione in italiano. */
  reason: string;
  /** Importo osservato (spesa della riga o totale della categoria nel mese). */
  amount: number;
  /** Valore tipico di riferimento (mediana), null per i nuovi esercenti. */
  expected: number | null;
  /** Eccedenza rispetto al riferimento, usata per l'ordinamento. */
  excess: number;
  /** Scarto robusto (in unità di MAD scalata), se calcolabile. */
  score: number | null;
  lineId?: string;
  date?: string;
  merchant?: string;
  categoryId: string;
}

export interface AnomalyOptions extends MonthOptions {
  categories?: readonly Category[];
  /** Mesi di storico confrontati (default 12). */
  historyMonths?: number;
  /** Importo minimo di una riga per essere segnalata (default 20 €). */
  minAmount?: number;
}

const RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

/** Movimenti e categorie insoliti nel mese, con motivo in italiano e gravità; stime robuste (mediana + MAD). */
export function findAnomalies(lines: readonly Line[], month: string, opts: AnomalyOptions = {}): Anomaly[] {
  const H = opts.historyMonths ?? 12;
  const minAmount = opts.minAmount ?? 20;
  const info = categoryLookup(opts.categories);
  const refIdx = monthIndex(month);
  const first = firstMonthOf(lines);
  const available = first ? Math.max(0, Math.min(H, refIdx - monthIndex(first))) : 0;
  const year = month.slice(0, 4);

  const current: Line[] = [];
  const merchantHist = new Map<string, number[]>();
  const merchantEver = new Set<string>();
  const catHist = new Map<string, number[]>();
  const catMonthly = new Map<string, Float64Array>();
  const catCurrent = new Map<string, number>();
  const allHist: number[] = [];
  for (const l of lines) {
    if (!isExpenseLine(l)) continue;
    const v = spendOf(l);
    if (l.month === month) {
      current.push(l);
      catCurrent.set(l.categoryId, (catCurrent.get(l.categoryId) ?? 0) + v);
      continue;
    }
    if (l.month > month) continue;
    merchantEver.add(l.merchant);
    const k = refIdx - monthIndex(l.month);
    if (k < 1 || k > H) continue;
    let cm = catMonthly.get(l.categoryId);
    if (!cm) { cm = new Float64Array(H); catMonthly.set(l.categoryId, cm); }
    cm[k - 1] += v;
    if (v <= 0) continue;
    allHist.push(v);
    let mh = merchantHist.get(l.merchant);
    if (!mh) { mh = []; merchantHist.set(l.merchant, mh); }
    mh.push(v);
    let ch = catHist.get(l.categoryId);
    if (!ch) { ch = []; catHist.set(l.categoryId, ch); }
    ch.push(v);
  }

  const out: Anomaly[] = [];
  const overallMed = allHist.length ? median(allHist) : 0;
  const newMerchantMin = Math.max(100, 3 * overallMed);
  const catStats = new Map<string, { med: number; scale: number; max: number; n: number }>();
  const statsOf = (id: string) => {
    let st = catStats.get(id);
    if (!st) {
      const xs = Float64Array.from(catHist.get(id) ?? []).sort();
      const med = quantileSorted(xs, 0.5);
      st = { med, scale: xs.length ? robustScale(Array.from(xs), med) : 0, max: xs.length ? xs[xs.length - 1] : 0, n: xs.length };
      catStats.set(id, st);
    }
    return st;
  };
  const seenNew = new Set<string>();
  const ordered = [...current].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const l of ordered) {
    const x = spendOf(l);
    if (x < minAmount) continue;
    const name = displayName(l.merchant || l.description || "?");
    const hist = merchantHist.get(l.merchant);
    if (hist && hist.length >= 4) {
      const med = median(hist);
      const scale = Math.max(robustScale(hist, med), 0.1 * med, 2);
      const z = (x - med) / scale;
      if (z >= 4 && x - med >= Math.max(20, 0.5 * med)) {
        const ratio = med > 0 ? x / med : Infinity;
        const severity: Severity = z >= 10 || ratio >= 5 ? "high" : z >= 6 || ratio >= 2.5 ? "medium" : "low";
        out.push({
          kind: "transaction", severity, amount: round2(x), expected: round2(med), excess: round2(x - med), score: z,
          reason: `${name}: ${formatEUR(x)} il ${shortDate(l.date)}, di solito ${formatEUR(med)}`,
          lineId: l.id, date: l.date, merchant: l.merchant, categoryId: l.categoryId,
        });
      }
      continue;
    }
    if (!merchantEver.has(l.merchant) && allHist.length >= 30 && !seenNew.has(l.merchant)) {
      seenNew.add(l.merchant);
      if (x >= newMerchantMin) {
        const ratio = overallMed > 0 ? x / overallMed : Infinity;
        const severity: Severity = x >= 1000 || ratio >= 20 ? "high" : x >= 300 || ratio >= 8 ? "medium" : "low";
        out.push({
          kind: "new_merchant", severity, amount: round2(x), expected: null, excess: round2(x - newMerchantMin), score: null,
          reason: `Nuovo esercente: ${name}, ${formatEUR(x)} il ${shortDate(l.date)}`,
          lineId: l.id, date: l.date, merchant: l.merchant, categoryId: l.categoryId,
        });
        continue;
      }
    }
    // Poco storico per l'esercente: confronto con la categoria.
    const st = statsOf(l.categoryId);
    if (st.n >= 10 && x > st.max) {
      const scale = Math.max(st.scale, 0.1 * st.med, 2);
      const z = (x - st.med) / scale;
      if (z >= 5 && x - st.med >= Math.max(50, st.med)) {
        const severity: Severity = z >= 12 ? "high" : z >= 8 ? "medium" : "low";
        out.push({
          kind: "transaction", severity, amount: round2(x), expected: round2(st.med), excess: round2(x - st.med), score: z,
          reason: `${name}: ${formatEUR(x)} in ${info(l.categoryId).label}, la spesa più alta degli ultimi ${H} mesi (mediana ${formatEUR(st.med)})`,
          lineId: l.id, date: l.date, merchant: l.merchant, categoryId: l.categoryId,
        });
      }
    }
  }

  // Categorie con un totale mensile molto sopra la propria mediana.
  if (available >= 3) {
    for (const [id, total] of catCurrent) {
      if (total < 50) continue;
      const hist = catMonthly.get(id);
      const months = Array.from({ length: available }, (_, i) => (hist ? hist[i] : 0));
      const med = median(months);
      const scale = robustScale(months, med);
      const threshold = med + Math.max(50, 3 * scale, 0.5 * med);
      if (total <= threshold) continue;
      const ratio = med > 0.005 ? total / med : Infinity;
      const severity: Severity = ratio >= 3 ? (med > 0.005 || total >= 200 ? "high" : "medium") : ratio >= 2 ? "medium" : "low";
      const label = info(id).label;
      const tail = med > 0.005 ? `mediana ${formatEUR(med)} (${formatPct((total - med) / med, true)})` : `di solito nulla`;
      out.push({
        kind: "category", severity, amount: round2(total), expected: round2(med), excess: round2(total - med),
        score: scale > 0 ? (total - med) / scale : null,
        reason: `${label}: ${formatEUR(total)} ${inMonth(month, year)}, ${tail}`,
        categoryId: id,
      });
    }
  }
  out.sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.excess - a.excess);
  return out;
}
