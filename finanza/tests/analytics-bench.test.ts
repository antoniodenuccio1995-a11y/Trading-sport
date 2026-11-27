import { describe, expect, it } from "vitest";
import type { Account, Budgets, Line, MovementType } from "../src/domain/types.ts";
import { defaultCategories } from "../src/domain/categories.ts";
import {
  accountBalances, addDays, addMonthsToDate, budgetStatus, cashflowSankey, categoryBreakdown, dailyTotals, dayNum, detectRecurring,
  findAnomalies, insights, kpis, merchantHistory, monthEndForecast, monthlySeries, netWorthSeries, openAdvances, spendingPace,
  topMerchants, weekdayPattern,
} from "../src/analytics/index.ts";

/** PRNG deterministico (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 10.000 righe sintetiche su 3 anni: spesa quotidiana, ricorrenze, giroconti, investimenti, anticipi, resi e quote. */
function synthetic(n = 10_000, today = "2026-11-26"): Line[] {
  const r = rng(42);
  const out: Line[] = [];
  let id = 0;
  const push = (date: string, amount: number, type: MovementType, categoryId: string, merchant: string, account = "Banca", extra: Partial<Line> = {}) => {
    const lid = "x" + ++id;
    out.push({ id: lid, parentId: lid, account, date, month: date.slice(0, 7), amount: Math.round(amount * 100) / 100, type, categoryId,
      counterparty: "", description: merchant, merchant, isSplit: false, unbalanced: false, deferredWallet: false, ...extra });
  };
  const start = "2023-11-27";
  for (let m = 0; m < 36; m++) {
    const base = addMonthsToDate(start, m);
    push(addDays(base, 0), 2400 + (m % 12 === 0 ? 2400 : 0), "income", "inc.salary", "STIPENDIO ACME");
    push(addMonthsToDate("2023-12-01", m), -850, "expense", "exp.housing", "AFFITTO");
    push(addMonthsToDate("2023-12-15", m), m < 24 ? -12.99 : -15.99, "expense", "exp.leisure", "NETFLIX", "Revolut");
    push(addMonthsToDate("2023-12-05", m), -9.99, "expense", "exp.leisure", "SPOTIFY", "Revolut");
    push(addMonthsToDate("2023-12-03", m), -39.9, "expense", "exp.leisure", "PALESTRA");
    push(addMonthsToDate("2023-12-08", m), -29.9, "expense", "exp.utilities", "TIM");
    if (m % 2 === 0) push(addMonthsToDate("2023-12-20", m), -(70 + r() * 80), "expense", "exp.utilities", "ENEL ENERGIA");
    const t = addMonthsToDate("2023-12-02", m);
    push(t, -300, "transfer_out", "", "GIRO REVOLUT");
    push(t, 300, "transfer_in", "", "GIRO DA BANCA", "Revolut");
    push(addMonthsToDate("2023-12-10", m), -200, "invest_buy", "", "PAC ETF");
    if (m % 3 === 0) { push(addMonthsToDate("2023-12-12", m), -60, "advance_out", "", "CENA", "Banca", { counterparty: "Marco" }); }
    if (m % 3 === 1) { push(addMonthsToDate("2023-12-12", m), 40, "refund_in", "", "RIMBORSO", "Banca", { counterparty: "Marco" }); }
  }
  const shops: [string, string, number][] = [
    ["CONAD", "exp.groceries", 45], ["ESSELUNGA", "exp.groceries", 60], ["LIDL", "exp.groceries", 30], ["BAR SPORT", "exp.dining", 4],
    ["PIZZERIA DA MARIO", "exp.dining", 28], ["SUSHI ZEN", "exp.dining", 40], ["ENI STATION", "exp.mobility", 55], ["TRENITALIA", "exp.mobility", 25],
    ["FARMACIA", "exp.health", 18], ["ZARA", "exp.clothing", 50], ["AMAZON", "exp.other", 35], ["IKEA", "exp.home", 80],
    ["CINEMA", "exp.leisure", 12], ["MEDIAWORLD", "exp.technology", 120], ["BARBIERE", "exp.personal_care", 20], ["LIBRERIA", "exp.education", 22],
  ];
  const d0 = dayNum(start), days = dayNum(today) - d0 + 1;
  while (out.length < n) {
    const date = addDays("1970-01-01", d0 + Math.floor(r() * days));
    const [merchant, cat, avg] = shops[Math.floor(r() * shops.length)];
    const amount = avg * (0.4 + r() * 1.4);
    const roll = r();
    if (roll < 0.02) push(date, amount * 0.5, "expense", cat, merchant); // reso
    else if (roll < 0.04 && out.length < n - 1) {
      const pid = "split" + out.length;
      push(date, -amount * 0.7, "expense", cat, merchant, "Banca", { parentId: pid, isSplit: true });
      push(date, -amount * 0.3, "expense", "exp.home", merchant, "Banca", { parentId: pid, isSplit: true });
    } else push(date, -amount, "expense", cat, merchant, r() < 0.3 ? "Revolut" : "Banca");
  }
  return out.slice(0, n);
}

function time(fn: () => unknown, runs = 7): number {
  for (let i = 0; i < 3; i++) fn();
  const ts: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    ts.push(performance.now() - t0);
  }
  return ts.sort((a, b) => a - b)[Math.floor(runs / 2)];
}

describe("prestazioni su 10.000 righe", () => {
  const today = "2026-11-26";
  const lines = synthetic(10_000, today);
  const cats = defaultCategories();
  const accounts: Account[] = ["Banca", "Revolut"].map((id) => ({ id, name: id, kind: "bank", initialBalance: 2000, initialDate: "", color: "", archived: false }));
  const budgets: Budgets = { default: { "exp.groceries": 500, "exp.dining": 200, "exp.leisure": 120, "exp.housing": 850 }, months: {} };
  const recurring = detectRecurring(lines, today);

  it("i dati sintetici sono realistici", () => {
    expect(lines).toHaveLength(10_000);
    const merchants = new Set(recurring.filter((x) => x.status !== "ended").map((x) => x.merchant));
    for (const m of ["NETFLIX", "SPOTIFY", "PALESTRA", "TIM", "AFFITTO", "STIPENDIO ACME", "ENEL ENERGIA"]) expect(merchants).toContain(m);
    for (const m of ["CONAD", "ESSELUNGA", "BAR SPORT", "ENI STATION"]) expect(merchants.has(m)).toBe(false);
  });

  const BUDGET_MS = 50; // obiettivo ~15 ms; margine ampio per macchine CI lente
  const cases: [string, () => unknown, number?][] = [
    ["monthlySeries", () => monthlySeries(lines)],
    ["categoryBreakdown", () => categoryBreakdown(lines, "2026-11", cats)],
    ["spendingPace", () => spendingPace(lines, "2026-11", today)],
    ["monthEndForecast", () => monthEndForecast(lines, "2026-11", today, recurring)],
    ["monthEndForecast (con detectRecurring)", () => monthEndForecast(lines, "2026-11", today)],
    ["detectRecurring", () => detectRecurring(lines, today)],
    ["findAnomalies", () => findAnomalies(lines, "2026-11", { categories: cats })],
    ["accountBalances day", () => accountBalances(lines, accounts, { granularity: "day" })],
    ["accountBalances month", () => accountBalances(lines, accounts, { granularity: "month" })],
    ["netWorthSeries", () => netWorthSeries(lines, accounts)],
    ["cashflowSankey", () => cashflowSankey(lines, { from: "2025-12-01", to: "2026-11-30" }, cats, { categoriesPerGroup: 3 })],
    ["dailyTotals (1 anno)", () => dailyTotals(lines, { from: "2025-11-27", to: "2026-11-26" })],
    ["topMerchants", () => topMerchants(lines, { from: "2023-01-01", to: "2026-12-31" }, 10)],
    ["merchantHistory", () => merchantHistory(lines, "CONAD")],
    ["budgetStatus", () => budgetStatus(lines, budgets, "2026-11", today, cats)],
    ["weekdayPattern", () => weekdayPattern(lines, { from: "2023-01-01", to: "2026-12-31" })],
    ["openAdvances", () => openAdvances(lines)],
    ["kpis", () => kpis(lines, accounts, today)],
    ["insights (composta)", () => insights(lines, accounts, budgets, cats, today, { recurring }), 120],
    ["insights (composta, senza ricorrenze)", () => insights(lines, accounts, budgets, cats, today), 150],
  ];
  const results: string[] = [];
  for (const [name, fn, limit] of cases) {
    it(`${name} entro ${limit ?? BUDGET_MS} ms`, () => {
      const ms = time(fn);
      results.push(`${name.padEnd(40)} ${ms.toFixed(2).padStart(7)} ms`);
      expect(ms).toBeLessThan(limit ?? BUDGET_MS);
    });
  }
  it("riepilogo tempi", () => {
    console.log("Tempi mediani su 10.000 righe:\n" + results.join("\n"));
  });
});
