import { describe, expect, it } from "vitest";
import type { Account, Budgets, Line, MovementType } from "../src/domain/types.ts";
import { defaultCategories } from "../src/domain/categories.ts";
import { addDays, dayNum, insights, kpis } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, categoryId: string, merchant = "X", type?: MovementType): Line {
  const id = "q" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: merchant, merchant, isSplit: false, unbalanced: false, deferredWallet: false,
  };
}
const nb = (s: string) => s.replace(/ | /g, " ");
const accounts: Account[] = [{ id: "Banca", name: "Banca", kind: "bank", initialBalance: 1000, initialDate: "", color: "", archived: false }];
const cats = defaultCategories();

describe("kpis", () => {
  const lines: Line[] = [];
  for (let m = 1; m <= 10; m++) {
    const mm = String(m).padStart(2, "0");
    lines.push(mk(`2026-${mm}-27`, 2000, "inc.salary"), mk(`2026-${mm}-01`, -800, "exp.housing"), mk(`2026-${mm}-10`, -700, "exp.groceries"));
  }
  lines.push(mk("2026-11-05", -500, "exp.groceries"), mk("2026-03-15", -1000, "", "X", "invest_buy"));
  lines.push(mk("2026-11-06", -120, "", "X", "advance_out"));

  it("mese, mese scorso, 12 mesi, media 6 mesi, fondo di emergenza", () => {
    const k = kpis(lines, accounts, "2026-11-20");
    expect(k.month).toBe("2026-11");
    expect(k.thisMonth).toMatchObject({ income: 0, expense: 500, net: -500, savingsRate: null, months: 1 });
    expect(k.lastMonth).toMatchObject({ from: "2026-10", to: "2026-10", income: 2000, expense: 1500, net: 500, savingsRate: 0.25 });
    expect(k.last12).toMatchObject({ from: "2025-11", to: "2026-10", income: 20000, expense: 15000, savingsRate: 0.25, months: 10 });
    expect(k.yearToDate).toMatchObject({ from: "2026-01", income: 20000, expense: 15500, months: 11 });
    expect(k.avgMonthlyExpense6).toBe(1500);
    expect(k.avgMonthlyIncome6).toBe(2000);
    // 1000 + 10×500 − 500 − 1000 investiti − 120 anticipati
    expect(k.liquidity).toBe(4380);
    expect(k.investedNet).toBe(1000);
    expect(k.netWorth).toBe(5380);
    expect(k.emergencyFundMonths).toBeCloseTo(4380 / 1500);
    expect(k.advancesOutstanding).toBe(120);
  });

  it("dati vuoti", () => {
    const k = kpis([], accounts, "2026-11-20");
    expect(k.thisMonth.months).toBe(0);
    expect(k.avgMonthlyExpense6).toBeNull();
    expect(k.emergencyFundMonths).toBeNull();
    expect(k.liquidity).toBe(1000);
  });
});

describe("insights", () => {
  const today = "2026-11-20";
  const lines: Line[] = [];
  for (const m of ["05", "06", "07", "08", "09", "10"]) {
    lines.push(mk(`2026-${m}-08`, -113, "exp.dining", "TRATTORIA"), mk(`2026-${m}-18`, -113, "exp.dining", "TRATTORIA"));
    lines.push(mk(`2026-${m}-27`, 2500, "inc.salary", "STIPENDIO"), mk(`2026-${m}-05`, -9.99, "exp.leisure", "SPOTIFY"));
    lines.push(mk(`2026-${m}-12`, m <= "08" ? -12.99 : -15.59, "exp.leisure", "NETFLIX"));
  }
  for (let z = dayNum("2026-05-01"); z <= dayNum("2026-10-31"); z++) lines.push(mk(addDays("1970-01-01", z), -10, "exp.groceries", "SUPER"));
  for (let z = dayNum("2026-11-01"); z <= dayNum(today); z++) lines.push(mk(addDays("1970-01-01", z), -15, "exp.groceries", "SUPER"));
  lines.push(mk("2026-11-03", -104, "exp.dining", "TRATTORIA"), mk("2026-11-09", -104, "exp.dining", "TRATTORIA"), mk("2026-11-15", -104, "exp.dining", "TRATTORIA"));
  lines.push(mk("2026-11-05", -9.99, "exp.leisure", "SPOTIFY"), mk("2026-11-12", -15.59, "exp.leisure", "NETFLIX"));
  const budgets: Budgets = { default: { "exp.dining": 250 }, months: {} };

  it("frasi ordinate, al massimo 8, con i fatti principali", () => {
    const out = insights(lines, accounts, budgets, cats, today);
    expect(out.length).toBeGreaterThan(3);
    expect(out.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < out.length; i++) expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    expect(out.every((i) => ["good", "warn", "info"].includes(i.kind))).toBe(true);
    const texts = out.map((i) => nb(i.text));
    expect(texts).toContain("Ristorazione: 312 € a novembre, +38% rispetto alla media di 6 mesi");
    expect(texts).toContain("Abbonamenti: 2 attivi per 25,58 €/mese; Netflix è aumentato del 20%");
    expect(texts).toContain("Budget Ristorazione superato: 312 € su 250 € (125%)");
    expect(texts.some((t) => /^Sei in anticipo di \d+ € sul ritmo di spesa di ottobre$/.test(t))).toBe(true);
    expect(texts.some((t) => t.startsWith("Previsione di fine mese: saldo +"))).toBe(true);
    expect(new Set(out.map((i) => i.id)).size).toBe(out.length);
  });

  it("limite e dati vuoti", () => {
    expect(insights(lines, accounts, budgets, cats, today, { max: 3 })).toHaveLength(3);
    expect(insights([], accounts, budgets, cats, today)).toEqual([]);
  });
});
