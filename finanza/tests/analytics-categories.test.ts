import { describe, expect, it } from "vitest";
import type { Line, MovementType } from "../src/domain/types.ts";
import { defaultCategories, GROUPS, groupOf } from "../src/domain/categories.ts";
import { categoryBreakdown, merchantHistory, topMerchants } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, categoryId = "exp.other", merchant = "X", type?: MovementType, extra: Partial<Line> = {}): Line {
  const id = "c" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: merchant, merchant, isSplit: false, unbalanced: false, deferredWallet: false, ...extra,
  };
}
const cats = defaultCategories();

describe("categoryBreakdown", () => {
  const lines: Line[] = [];
  // Storico: 200 €/mese di alimentari e 100 €/mese di ristorazione da 2026-01 a 2026-09.
  for (let m = 1; m <= 9; m++) {
    const mm = String(m).padStart(2, "0");
    lines.push(mk(`2026-${mm}-05`, -200, "exp.groceries"), mk(`2026-${mm}-12`, -100, "exp.dining"));
  }
  // Ottobre.
  lines.push(mk("2026-10-03", -150, "exp.groceries"), mk("2026-10-20", -150, "exp.groceries"), mk("2026-10-08", -60, "exp.dining"),
    mk("2026-10-09", -100, "exp.clothing"), mk("2026-10-15", 40, "exp.clothing", "X", "expense"), mk("2026-10-25", 3000, "inc.salary"),
    mk("2026-10-26", -500, "", "X", "transfer_out"));

  it("totali, quote, conteggi e confronti", () => {
    const b = categoryBreakdown(lines, "2026-10", cats);
    expect(b.total).toBe(420);
    expect(b.count).toBe(5);
    expect(b.categories.map((c) => c.id)).toEqual(["exp.groceries", "exp.clothing", "exp.dining"]);
    const g = b.categories[0];
    expect(g).toMatchObject({ label: "Alimentari / Supermercato", total: 300, count: 2, groupId: groupOf("exp.groceries").id });
    expect(g.share).toBeCloseTo(300 / 420);
    expect(g.previous).toEqual({ base: 200, delta: 100, pct: 0.5 });
    expect(g.avg3).toEqual({ base: 200, delta: 100, pct: 0.5 });
    expect(g.avg12!.base).toBe(200); // solo 9 mesi di storico disponibili, non diluiti da zeri
    const clothing = b.categories[1];
    expect(clothing.total).toBe(60); // il reso è netto nella categoria
    expect(clothing.previous.pct).toBeNull();
    expect(b.categories[2].avg6!.pct).toBeCloseTo(-0.4);
  });

  it("gruppi da GROUPS, ordinati per totale", () => {
    const b = categoryBreakdown(lines, "2026-10", cats);
    const food = b.groups.find((x) => x.id === groupOf("exp.groceries").id)!;
    expect(food.total).toBe(300);
    expect(food.categoryIds).toEqual(["exp.groceries"]);
    // Ristorazione è nel gruppo Svago per impostazione predefinita (uscite a mangiare fuori).
    expect(b.groups.find((x) => x.id === "svago")).toMatchObject({ total: 60, categoryIds: ["exp.dining"] });
    expect(food.slot).toBe(GROUPS.find((x) => x.id === food.id)!.slot);
    expect(b.groups[0].id).toBe(food.id);
    expect(b.groups.every((x) => GROUPS.some((g) => g.id === x.id))).toBe(true);
    expect(b.groups.reduce((s, x) => s + x.total, 0)).toBeCloseTo(b.total);
  });

  it("senza storico le medie sono null", () => {
    const b = categoryBreakdown(lines, "2026-01", cats);
    expect(b.categories[0].avg3).toBeNull();
    expect(b.categories[0].previous.base).toBe(0);
  });

  it("intervallo di date: periodo precedente di pari durata e medie riscalate", () => {
    const b = categoryBreakdown(lines, { from: "2026-10-01", to: "2026-10-10" }, cats);
    expect(b.previousPeriod).toMatchObject({ from: "2026-09-21", to: "2026-09-30" });
    const g = b.categories.find((c) => c.id === "exp.groceries")!;
    expect(g.total).toBe(150);
    expect(g.avg3!.base).toBeCloseTo(200 * (10 / (365.2425 / 12)), 1);
  });

  it("entrate e dati vuoti", () => {
    const inc = categoryBreakdown(lines, "2026-10", cats, { kind: "income" });
    expect(inc.total).toBe(3000);
    expect(inc.groups).toEqual([]);
    const e = categoryBreakdown([], "2026-10", cats);
    expect(e).toMatchObject({ total: 0, categories: [], groups: [] });
  });
});

describe("topMerchants e merchantHistory", () => {
  const lines = [
    mk("2026-05-02", -30, "exp.groceries", "CONAD"), mk("2026-05-09", -50, "exp.groceries", "CONAD"),
    mk("2026-05-10", -20, "exp.home", "CONAD"), mk("2026-05-16", 10, "exp.groceries", "CONAD", "expense"),
    mk("2026-05-03", -200, "exp.technology", "AMAZON"),
    mk("2026-05-04", -15, "exp.dining", "BAR"),
    // Movimento diviso in due quote: un solo scontrino.
    mk("2026-05-20", -40, "exp.groceries", "ESSELUNGA", "expense", { parentId: "P1", isSplit: true }),
    mk("2026-05-20", -10, "exp.home", "ESSELUNGA", "expense", { parentId: "P1", isSplit: true }),
    mk("2026-06-01", -999, "exp.technology", "AMAZON"),
  ];
  it("classifica, scontrino medio, categoria prevalente, quota", () => {
    const t = topMerchants(lines, "2026-05", 3);
    expect(t.total).toBe(355);
    expect(t.items.map((i) => i.merchant)).toEqual(["AMAZON", "CONAD", "ESSELUNGA"]);
    const conad = t.items[1];
    expect(conad).toMatchObject({ total: 90, count: 3, average: 33.33, categoryId: "exp.groceries", first: "2026-05-02", last: "2026-05-16" });
    expect(conad.share).toBeCloseTo(90 / 355);
    expect(t.items[2]).toMatchObject({ total: 50, count: 1, average: 50 });
    expect(t.others).toEqual({ total: 15, count: 1, merchants: 1 });
  });
  it("storico di un esercente", () => {
    const h = merchantHistory(lines, "amazon");
    expect(h.count).toBe(2);
    expect(h.spent).toBe(1199);
    expect(h.lines[0].date).toBe("2026-06-01");
    expect(h.byMonth).toEqual([{ month: "2026-05", total: 200, count: 1 }, { month: "2026-06", total: 999, count: 1 }]);
    expect(h.median).toBe(599.5);
    expect(merchantHistory(lines, "NESSUNO")).toMatchObject({ count: 0, byMonth: [], first: "" });
  });
});
