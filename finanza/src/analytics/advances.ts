// Anticipi pagati per conto di altri e rimborsi ricevuti, per controparte.
import type { Line } from "../domain/types.ts";
import { norm } from "../domain/movement.ts";
import { round2 } from "./stats.ts";

export interface AdvanceItem {
  /** Nome della controparte come scritto nell'ultimo movimento. */
  counterparty: string;
  /** Chiave normalizzata usata per raggruppare. */
  key: string;
  /** Totale anticipato (positivo). */
  advanced: number;
  /** Totale rimborsato (positivo). */
  refunded: number;
  /** advanced − refunded: positivo = credito ancora aperto, negativo = rimborsato più dell'anticipato. */
  outstanding: number;
  status: "aperto" | "chiuso" | "eccedenza";
  firstDate: string;
  lastDate: string;
  count: number;
  lineIds: string[];
}

export interface OpenAdvances {
  items: AdvanceItem[];
  totals: { advanced: number; refunded: number; outstanding: number };
  openCount: number;
}

/** Anticipi (advance_out) e rimborsi (refund_in) per controparte: anticipato, rimborsato, ancora da recuperare, ultima data. */
export function openAdvances(lines: readonly Line[]): OpenAdvances {
  const acc = new Map<string, AdvanceItem>();
  for (const l of lines) {
    if (l.type !== "advance_out" && l.type !== "refund_in") continue;
    const name = (l.counterparty || "").trim() || "Senza nome";
    const key = norm(name);
    let a = acc.get(key);
    if (!a) {
      a = { counterparty: name, key, advanced: 0, refunded: 0, outstanding: 0, status: "chiuso", firstDate: l.date, lastDate: l.date, count: 0, lineIds: [] };
      acc.set(key, a);
    }
    if (l.type === "advance_out") a.advanced += -l.amount; else a.refunded += l.amount;
    a.count++;
    a.lineIds.push(l.id);
    if (l.date && (!a.firstDate || l.date < a.firstDate)) a.firstDate = l.date;
    if (l.date >= a.lastDate) { a.lastDate = l.date; a.counterparty = name; }
  }
  const items = [...acc.values()].map((a) => {
    const outstanding = round2(a.advanced - a.refunded);
    return {
      ...a, advanced: round2(a.advanced), refunded: round2(a.refunded), outstanding,
      status: outstanding > 0.005 ? "aperto" : outstanding < -0.005 ? "eccedenza" : "chiuso",
    } as AdvanceItem;
  });
  items.sort((x, y) => {
    const ox = x.status === "aperto" ? 0 : 1, oy = y.status === "aperto" ? 0 : 1;
    return ox - oy || (ox === 0 ? y.outstanding - x.outstanding : 0) || (x.lastDate < y.lastDate ? 1 : x.lastDate > y.lastDate ? -1 : 0);
  });
  let adv = 0, ref = 0, out = 0, open = 0;
  for (const it of items) {
    adv += it.advanced; ref += it.refunded;
    if (it.status === "aperto") { out += it.outstanding; open++; }
  }
  return { items, totals: { advanced: round2(adv), refunded: round2(ref), outstanding: round2(out) }, openCount: open };
}
