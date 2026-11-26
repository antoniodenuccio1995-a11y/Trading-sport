import { describe, expect, it } from "vitest";
import type { Budgets, Line, MovementType } from "../src/domain/types.ts";
import { defaultCategories } from "../src/domain/categories.ts";
import { budgetFor, budgetStatus } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, categoryId: string, type?: MovementType): Line {
  const id = "g" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: "X", merchant: "X", isSplit: false, unbalanced: false, deferredWallet: false,
  };
}
const cats = defaultCategories();
const budgets: Budgets = {
  default: { "exp.groceries": 400, "exp.dining": 150, "exp.housing": 800, "exp.betting": 100 },
  months: { "2026-11": { "exp.dining": 200 } },
};
const history: Line[] = [];
for (const m of ["06", "07", "08", "09", "10"]) {
  history.push(mk(`2026-${m}-01`, -800, "exp.housing"));
  for (const d of ["05", "12", "19", "26"]) history.push(mk(`2026-${m}-${d}`, -100, "exp.groceries"));
  history.push(mk(`2026-${m}-10`, -50, "exp.dining"), mk(`2026-${m}-20`, -50, "exp.dining"));
}
const november = [
  mk("2026-11-01", -800, "exp.housing"),
  mk("2026-11-05", -100, "exp.groceries"), mk("2026-11-12", -100, "exp.groceries"), mk("2026-11-14", -120, "exp.groceries"),
  mk("2026-11-03", -150, "exp.dining"), mk("2026-11-09", -100, "exp.dining"), mk("2026-11-13", 0.01, "exp.dining", "expense"),
  mk("2026-11-07", -60, "exp.clothing"), mk("2026-11-08", -40, "exp.betting"),
];

describe("budgetStatus", () => {
  it("budget del mese o di default", () => {
    expect(budgetFor(budgets, "2026-11", "exp.dining")).toBe(200);
    expect(budgetFor(budgets, "2026-10", "exp.dining")).toBe(150);
    expect(budgetFor(budgets, "2026-11", "exp.travel")).toBe(0);
  });

  it("speso, residuo, ritmo, proiezione storica e stato", () => {
    const s = budgetStatus([...history, ...november], budgets, "2026-11", "2026-11-15", cats);
    expect(s).toMatchObject({ daysTotal: 30, daysElapsed: 15 });
    expect(s.items.map((i) => i.categoryId)).toEqual(["exp.dining", "exp.groceries", "exp.housing"]); // betting non è budgetabile
    const [dining, groceries, housing] = s.items;
    expect(dining).toMatchObject({ budget: 200, spent: 249.99, status: "sforato" });
    expect(groceries).toMatchObject({ budget: 400, spent: 320, remaining: 80, expectedAtToday: 200, projection: "storico", status: "attenzione" });
    expect(groceries.pct).toBeCloseTo(0.8);
    // Di solito dopo metà mese restano 200 €; il ritmo attuale è 1,6× -> 320 + 320.
    expect(groceries.projected).toBe(640);
    // L'affitto è pagato il primo del mese: la proiezione non lo moltiplica.
    expect(housing).toMatchObject({ spent: 800, projected: 800, status: "ok" });
    expect(s.totals).toMatchObject({ budget: 1400, spent: 1369.99, remaining: 30.01, expectedAtToday: 700, status: "attenzione" });
    expect(s.unbudgetedSpent).toBe(100);
  });

  it("senza storico la proiezione è lineare", () => {
    const s = budgetStatus(november, budgets, "2026-11", "2026-11-15", cats);
    const groceries = s.items.find((i) => i.categoryId === "exp.groceries")!;
    expect(groceries).toMatchObject({ projection: "lineare", projected: 640 });
    expect(s.items.find((i) => i.categoryId === "exp.housing")!.projected).toBe(1600);
  });

  it("mese chiuso: proiezione = speso", () => {
    const s = budgetStatus(history, budgets, "2026-10", "2026-11-15", cats);
    expect(s.items.every((i) => i.projection === "finale" && i.projected === i.spent)).toBe(true);
    expect(s.items.every((i) => i.status === "ok")).toBe(true);
    expect(s.totals.expectedAtToday).toBe(s.totals.budget);
  });

  it("nessun budget", () => {
    const s = budgetStatus(november, { default: {}, months: {} }, "2026-11", "2026-11-15", cats);
    expect(s.items).toEqual([]);
    expect(s.totals).toMatchObject({ budget: 0, pct: null, status: "ok" });
  });
});
