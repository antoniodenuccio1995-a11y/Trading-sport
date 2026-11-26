import { describe, expect, it } from "vitest";
import type { Line, MovementType } from "../src/domain/types.ts";
import { makeMovement, toLines } from "../src/domain/movement.ts";
import { dailyTotals, heatLevel, monthlySeries, weekdayPattern } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, categoryId = "exp.other", type?: MovementType, extra: Partial<Line> = {}): Line {
  const id = "s" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: "X", merchant: "X", isSplit: false, unbalanced: false, deferredWallet: false, ...extra,
  };
}

describe("monthlySeries", () => {
  it("dati vuoti", () => {
    const s = monthlySeries([]);
    expect(s.months).toEqual([]);
    expect(s.points).toEqual([]);
    expect(s.totals.savingsRate).toBeNull();
  });

  it("riempie i mesi mancanti con zeri e calcola netto e tasso di risparmio", () => {
    const s = monthlySeries([
      mk("2026-01-05", 2000, "inc.salary"), mk("2026-01-10", -500, "exp.groceries"),
      mk("2026-04-02", -100, "exp.dining"),
    ]);
    expect(s.months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(s.points[0]).toEqual({ month: "2026-01", income: 2000, expense: 500, net: 1500, savingsRate: 0.75, count: 2 });
    expect(s.points[1]).toEqual({ month: "2026-02", income: 0, expense: 0, net: 0, savingsRate: null, count: 0 });
    expect(s.points[3].net).toBe(-100);
    expect(s.expenseByCategory["exp.groceries"]).toEqual([500, 0, 0, 0]);
    expect(s.incomeByCategory["inc.salary"]).toEqual([2000, 0, 0, 0]);
    expect(s.expenseCategoryIds).toEqual(["exp.groceries", "exp.dining"]);
  });

  it("un solo mese", () => {
    const s = monthlySeries([mk("2026-05-01", -10), mk("2026-05-31", -5)]);
    expect(s.months).toEqual(["2026-05"]);
    expect(s.points[0].expense).toBe(15);
  });

  it("i resi riducono la spesa della loro categoria", () => {
    const s = monthlySeries([mk("2026-03-01", -100, "exp.clothing"), mk("2026-03-08", 30, "exp.clothing", "expense")]);
    expect(s.points[0].expense).toBe(70);
    expect(s.expenseByCategory["exp.clothing"]).toEqual([70]);
    expect(s.points[0].income).toBe(0);
  });

  it("esclude giroconti, investimenti, anticipi, wallet e quote non quadrate", () => {
    const s = monthlySeries([
      mk("2026-03-01", -100, "exp.groceries"),
      mk("2026-03-02", -500, "", "transfer_out"), mk("2026-03-02", 500, "", "transfer_in"),
      mk("2026-03-03", -1000, "", "invest_buy"), mk("2026-03-04", -50, "", "advance_out"), mk("2026-03-05", 50, "", "refund_in"),
      mk("2026-03-06", -70, "exp.betting", "expense", { deferredWallet: true }),
      mk("2026-03-07", -90, "exp.home", "expense", { unbalanced: true }),
    ]);
    expect(s.points[0]).toMatchObject({ income: 0, expense: 100, count: 1 });
  });

  it("le quote (split) contano per categoria, le quote non quadrate sono escluse", () => {
    const lines = toLines({
      settings: { ownerNames: [], theme: "auto", accent: "", reduceMotion: "auto", monthStartDay: 1, hideAmounts: false },
      movements: [
        makeMovement({ account: "Banca", date: "2026-06-10", description: "IPERCOOP", amount: -100, type: "expense", categoryId: "exp.groceries",
          splits: [
            { id: "a", amount: -60, type: "expense", categoryId: "exp.groceries", counterparty: "", description: "" },
            { id: "b", amount: -40, type: "expense", categoryId: "exp.home", counterparty: "", description: "" },
          ] }),
        makeMovement({ account: "Banca", date: "2026-06-11", description: "BRICO", amount: -80, type: "expense", categoryId: "exp.home",
          splits: [{ id: "c", amount: -50, type: "expense", categoryId: "exp.home", counterparty: "", description: "" }] }),
      ],
    });
    const s = monthlySeries(lines);
    expect(s.points[0].expense).toBe(100);
    expect(s.expenseByCategory["exp.groceries"]).toEqual([60]);
    expect(s.expenseByCategory["exp.home"]).toEqual([40]);
  });

  it("rispetta from/to", () => {
    const s = monthlySeries([mk("2026-01-05", -10), mk("2026-06-05", -10)], { from: "2025-12", to: "2026-02" });
    expect(s.months).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(s.totals.expense).toBe(10);
  });
});

describe("dailyTotals", () => {
  it("giorni continui, soglie a quantili e livelli 0–4", () => {
    const lines = [
      mk("2026-02-02", -10), mk("2026-02-03", -20), mk("2026-02-04", -30), mk("2026-02-05", -40), mk("2026-02-05", -60),
      mk("2026-02-06", 1500, "inc.salary"), mk("2026-02-07", 25, "exp.clothing", "expense"), mk("2026-02-08", -40),
    ];
    const d = dailyTotals(lines, "2026-02");
    expect(d.days).toHaveLength(28);
    expect(d.days[0]).toMatchObject({ date: "2026-02-01", expense: 0, count: 0, level: 0 });
    expect(d.byDate["2026-02-05"]).toMatchObject({ expense: 100, count: 2 });
    expect(d.byDate["2026-02-06"]).toMatchObject({ income: 1500, expense: 0, level: 0 });
    expect(d.byDate["2026-02-07"]).toMatchObject({ expense: -25, level: 0 });
    expect(d.thresholds).toEqual([20, 30, 40]);
    expect(d.byDate["2026-02-02"].level).toBe(1);
    expect(d.byDate["2026-02-05"].level).toBe(4);
    expect(d.maxExpense).toBe(100);
    expect(heatLevel(35, d.thresholds)).toBe(3);
    expect(Object.keys(d.byDate)).toHaveLength(7);
  });
  it("periodo senza dati", () => {
    const d = dailyTotals([], { from: "2026-01-01", to: "2026-01-07" });
    expect(d.days).toHaveLength(7);
    expect(d.thresholds).toEqual([]);
  });
});

describe("weekdayPattern", () => {
  it("media per giorno della settimana sul periodo coperto dai dati", () => {
    // 2026-11-02 è lunedì; due settimane di dati.
    const lines = [mk("2026-11-02", -10), mk("2026-11-09", -30), mk("2026-11-07", -50), mk("2026-11-15", -5)];
    const w = weekdayPattern(lines, { from: "2026-01-01", to: "2026-12-31" });
    expect(w.from).toBe("2026-11-02");
    expect(w.to).toBe("2026-11-15");
    expect(w.days).toHaveLength(7);
    expect(w.days[0]).toMatchObject({ label: "lunedì", total: 40, occurrences: 2, average: 20, count: 2 });
    expect(w.days[5]).toMatchObject({ short: "sab", total: 50, occurrences: 2, average: 25 });
    expect(w.days[6]).toMatchObject({ total: 5, occurrences: 2 });
    expect(w.busiest).toBe(5);
    expect(w.total).toBe(95);
  });
  it("dati vuoti", () => {
    const w = weekdayPattern([], "2026-11");
    expect(w.total).toBe(0);
    expect(w.busiest).toBeNull();
  });
});
