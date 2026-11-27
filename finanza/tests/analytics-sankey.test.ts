import { describe, expect, it } from "vitest";
import type { Line, MovementType } from "../src/domain/types.ts";
import { defaultCategories, GROUPS, groupOf } from "../src/domain/categories.ts";
import { cashflowSankey, HUB_ID, type CashflowSankey } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, categoryId: string, type?: MovementType): Line {
  const id = "k" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: "X", merchant: "X", isSplit: false, unbalanced: false, deferredWallet: false,
  };
}
const cats = defaultCategories();
const flow = (s: CashflowSankey, dir: "in" | "out", id = HUB_ID) =>
  Math.round(s.links.filter((l) => (dir === "in" ? l.target : l.source) === id).reduce((x, l) => x + l.value, 0) * 100) / 100;
const node = (s: CashflowSankey, id: string) => s.nodes.find((n) => n.id === id);

describe("cashflowSankey", () => {
  it("netto positivo: Risparmio, Investito, Rimborsi netti; bilanciato all'hub", () => {
    const lines = [
      mk("2026-10-27", 2000, "inc.salary"), mk("2026-10-05", 100, "inc.other"),
      mk("2026-10-03", -300, "exp.groceries"), mk("2026-10-04", -100, "exp.dining"), mk("2026-10-01", -800, "exp.housing"),
      mk("2026-10-06", -100, "exp.clothing"), mk("2026-10-09", 150, "exp.clothing", "expense"),
      mk("2026-10-10", -200, "", "invest_buy"), mk("2026-10-11", -400, "", "transfer_out"),
      mk("2026-09-30", -999, "exp.groceries"),
    ];
    const s = cashflowSankey(lines, "2026-10", cats);
    expect(flow(s, "in")).toBe(2150);
    expect(flow(s, "out")).toBe(2150);
    expect(node(s, HUB_ID)!.value).toBe(2150);
    expect(node(s, "risparmio")!.value).toBe(750);
    expect(node(s, "investito")!.value).toBe(200);
    expect(node(s, "rimborsi")!.value).toBe(50);
    expect(node(s, "dal_risparmio")).toBeUndefined();
    expect(node(s, "inc:inc.salary")).toMatchObject({ label: "Stipendio", kind: "income", value: 2000 });
    const food = groupOf("exp.groceries");
    expect(node(s, "grp:" + food.id)).toMatchObject({ value: 300, slot: food.slot, kind: "group" });
    expect(node(s, "grp:svago")).toMatchObject({ value: 100, kind: "group" }); // Ristorazione
    expect(s.totals).toEqual({ income: 2100, expense: 1150, net: 950, invested: 200, saved: 750, fromSavings: 0 });
    expect(s.links.every((l) => l.value > 0)).toBe(true);
    expect(s.nodes.every((n) => n.value > 0)).toBe(true);
    for (const n of s.nodes.filter((x) => x.kind === "group")) expect(GROUPS.some((g) => "grp:" + g.id === n.id)).toBe(true);
  });

  it("netto negativo: Dal risparmio", () => {
    const s = cashflowSankey([mk("2026-10-27", 1000, "inc.salary"), mk("2026-10-03", -1500, "exp.travel")], "2026-10", cats);
    expect(node(s, "dal_risparmio")!.value).toBe(500);
    expect(node(s, "risparmio")).toBeUndefined();
    expect(flow(s, "in")).toBe(1500);
    expect(flow(s, "out")).toBe(1500);
    expect(s.totals).toMatchObject({ net: -500, fromSavings: 500, saved: 0 });
  });

  it("categorie dentro i gruppi con 'Altro' per le minori", () => {
    expect(groupOf("exp.utilities").id).toBe(groupOf("exp.housing").id);
    expect(groupOf("exp.home").id).toBe(groupOf("exp.housing").id);
    const g = groupOf("exp.housing");
    const lines = [mk("2026-10-27", 3000, "inc.salary"), mk("2026-10-01", -800, "exp.housing"), mk("2026-10-02", -100, "exp.utilities"), mk("2026-10-03", -60, "exp.home")];
    const s = cashflowSankey(lines, { from: "2026-10-01", to: "2026-10-31" }, cats, { categoriesPerGroup: 1 });
    expect(flow(s, "out", "grp:" + g.id)).toBe(960);
    expect(node(s, "cat:exp.housing")!.value).toBe(800);
    expect(node(s, "cat:altro:" + g.id)!.value).toBe(160);
    const two = cashflowSankey(lines, "2026-10", cats, { categoriesPerGroup: 2 });
    expect(node(two, "cat:exp.home")!.value).toBe(60); // con una sola categoria in più non serve "Altro"
  });

  it("disinvestimento come entrata dell'hub; investimenti esclusi su richiesta", () => {
    const lines = [mk("2026-10-27", 1000, "inc.salary"), mk("2026-10-03", -1200, "exp.travel"), mk("2026-10-15", 500, "", "invest_sell")];
    const s = cashflowSankey(lines, "2026-10", cats);
    expect(node(s, "disinvestito")!.value).toBe(500);
    expect(node(s, "risparmio")!.value).toBe(300);
    expect(flow(s, "in")).toBe(flow(s, "out"));
    const noInv = cashflowSankey(lines, "2026-10", cats, { includeInvestments: false });
    expect(node(noInv, "dal_risparmio")!.value).toBe(200);
  });

  it("periodo vuoto", () => {
    expect(cashflowSankey([], "2026-10", cats)).toMatchObject({ nodes: [], links: [] });
  });
});
