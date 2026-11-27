// Flussi per il diagramma di Sankey: categorie di entrata -> Entrate -> gruppi di spesa (-> categorie), risparmio e investimenti.
import type { Category, Line } from "../domain/types.ts";
import { GROUPS } from "../domain/categories.ts";
import { categoryLookup, groupLookup, inPeriod, investedOf, isExpenseLine, isIncomeLine, isInvestLine, spendOf, type Period } from "./common.ts";

export type SankeyNodeKind = "income" | "hub" | "group" | "category" | "saving" | "invest" | "refund" | "adjustment";

export interface SankeyNode {
  id: string;
  label: string;
  kind: SankeyNodeKind;
  /** Slot di colore del gruppo (GROUPS.slot) per gruppi e loro categorie. */
  slot?: number;
  /** Flusso che attraversa il nodo (€). */
  value: number;
}

export interface SankeyLink { source: string; target: string; value: number }

export interface CashflowSankey {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totals: {
    /** Entrate nette del periodo. */
    income: number;
    /** Spesa netta del periodo. */
    expense: number;
    net: number;
    /** Capitale investito netto nel periodo (negativo = disinvestimento). */
    invested: number;
    /** Nodo "Risparmio" (0 se assente). */
    saved: number;
    /** Nodo "Dal risparmio" (0 se assente). */
    fromSavings: number;
  };
}

export interface SankeyOptions {
  /** Categorie mostrate dentro ogni gruppo (0 = solo gruppi). Default 0. */
  categoriesPerGroup?: number;
  /** Includere i nodi Investito/Disinvestito. Default true. */
  includeInvestments?: boolean;
}

export const HUB_ID = "entrate";

/**
 * Nodi e collegamenti del Sankey dei flussi, in centesimi interi per un bilancio esatto al nodo "Entrate":
 * entrate + rimborsi netti + disinvestito + "Dal risparmio" = gruppi di spesa + rettifiche + investito + "Risparmio".
 */
export function cashflowSankey(lines: readonly Line[], period: Period, categories: readonly Category[], opts: SankeyOptions = {}): CashflowSankey {
  const perGroup = Math.max(0, opts.categoriesPerGroup ?? 0);
  const withInv = opts.includeInvestments ?? true;
  const inP = inPeriod(period);
  const inc = new Map<string, number>(), exp = new Map<string, number>();
  let investedF = 0;
  for (const l of lines) {
    if (!inP(l)) continue;
    if (isExpenseLine(l)) exp.set(l.categoryId, (exp.get(l.categoryId) ?? 0) + spendOf(l));
    else if (isIncomeLine(l)) inc.set(l.categoryId, (inc.get(l.categoryId) ?? 0) + l.amount);
    else if (withInv && isInvestLine(l)) investedF += investedOf(l);
  }
  const cents = (v: number) => Math.round(v * 100);
  const eur = (c: number) => c / 100;
  const info = categoryLookup(categories);
  const group = groupLookup(categories);

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const link = (source: string, target: string, c: number) => { if (c > 0) links.push({ source, target, value: eur(c) }); };
  const node = (id: string, label: string, kind: SankeyNodeKind, c: number, slot?: number) => {
    if (c > 0) nodes.push(slot === undefined ? { id, label, kind, value: eur(c) } : { id, label, kind, value: eur(c), slot });
  };

  // Lato entrate.
  let incomePos = 0, incomeNeg = 0;
  const incomeItems: [string, number][] = [];
  for (const [id, v] of inc) {
    const c = cents(v);
    if (c > 0) { incomeItems.push([id, c]); incomePos += c; } else incomeNeg -= c;
  }
  incomeItems.sort((a, b) => b[1] - a[1]);
  // Lato uscite: categorie positive per gruppo; quelle in negativo (resi > spese) diventano "Rimborsi netti".
  let refunds = 0, expensePos = 0;
  const byGroup = new Map<string, [string, number][]>();
  for (const [id, v] of exp) {
    const c = cents(v);
    if (c < 0) { refunds -= c; continue; }
    if (c === 0) continue;
    expensePos += c;
    const g = group(id).id;
    let arr = byGroup.get(g);
    if (!arr) { arr = []; byGroup.set(g, arr); }
    arr.push([id, c]);
  }
  const inv = cents(investedF);
  const invOut = inv > 0 ? inv : 0, invIn = inv < 0 ? -inv : 0;
  const remaining = incomePos + refunds + invIn - expensePos - incomeNeg - invOut;
  const saved = remaining > 0 ? remaining : 0, fromSavings = remaining < 0 ? -remaining : 0;
  const hub = incomePos + refunds + invIn + fromSavings;

  for (const [id, c] of incomeItems) { node("inc:" + id, info(id).label, "income", c); link("inc:" + id, HUB_ID, c); }
  node("rimborsi", "Rimborsi netti", "refund", refunds); link("rimborsi", HUB_ID, refunds);
  node("disinvestito", "Disinvestito", "invest", invIn); link("disinvestito", HUB_ID, invIn);
  node("dal_risparmio", "Dal risparmio", "saving", fromSavings); link("dal_risparmio", HUB_ID, fromSavings);
  node(HUB_ID, "Entrate", "hub", hub);

  const groupTotals = GROUPS.map((g) => {
    const items = (byGroup.get(g.id) ?? []).sort((a, b) => b[1] - a[1]);
    return { g, items, total: items.reduce((s, x) => s + x[1], 0) };
  }).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
  const catNodes: SankeyNode[] = [], catLinks: SankeyLink[] = [];
  for (const { g, items, total } of groupTotals) {
    const gid = "grp:" + g.id;
    node(gid, g.label, "group", total, g.slot);
    link(HUB_ID, gid, total);
    if (!perGroup) continue;
    const shown = items.length <= perGroup + 1 ? items : items.slice(0, perGroup);
    for (const [id, c] of shown) {
      catNodes.push({ id: "cat:" + id, label: info(id).label, kind: "category", value: eur(c), slot: g.slot });
      catLinks.push({ source: gid, target: "cat:" + id, value: eur(c) });
    }
    const rest = items.slice(shown.length).reduce((s, x) => s + x[1], 0);
    if (rest > 0) {
      const id = "cat:altro:" + g.id;
      catNodes.push({ id, label: `Altro (${g.label})`, kind: "category", value: eur(rest), slot: g.slot });
      catLinks.push({ source: gid, target: id, value: eur(rest) });
    }
  }
  node("rettifiche", "Rettifiche entrate", "adjustment", incomeNeg); link(HUB_ID, "rettifiche", incomeNeg);
  node("investito", "Investito", "invest", invOut); link(HUB_ID, "investito", invOut);
  node("risparmio", "Risparmio", "saving", saved); link(HUB_ID, "risparmio", saved);
  nodes.push(...catNodes);
  links.push(...catLinks);

  return {
    nodes, links,
    totals: {
      income: eur(incomePos - incomeNeg), expense: eur(expensePos - refunds), net: eur(incomePos - incomeNeg - expensePos + refunds),
      invested: withInv ? eur(inv) : 0, saved: eur(saved), fromSavings: eur(fromSavings),
    },
  };
}
