import { describe, expect, it } from "vitest";
import type { Account, Line, MovementType } from "../src/domain/types.ts";
import { accountBalances, currentBalances, netInvested, netWorthSeries, openAdvances } from "../src/analytics/index.ts";

let seq = 0;
function mk(account: string, date: string, amount: number, type: MovementType, extra: Partial<Line> = {}): Line {
  const id = "b" + ++seq;
  return {
    id, parentId: id, account, date, month: date.slice(0, 7), amount, type, categoryId: "", counterparty: "", description: "X",
    merchant: "X", isSplit: false, unbalanced: false, deferredWallet: false, ...extra,
  };
}
const acc = (id: string, initialBalance: number, initialDate = "", kind: Account["kind"] = "bank"): Account =>
  ({ id, name: id, kind, initialBalance, initialDate, color: "", archived: false });

const accounts = [acc("Banca", 1000), acc("Revolut", 650, "2026-03-01", "card")];
const lines = [
  mk("Banca", "2026-01-10", 2000, "income"),
  mk("Banca", "2026-01-15", -300, "expense"),
  mk("Banca", "2026-02-01", -500, "transfer_out"),
  mk("Revolut", "2026-02-01", 500, "transfer_in"),
  mk("Revolut", "2026-02-20", -50, "expense"), // prima di initialDate: già compreso nei 650
  mk("Revolut", "2026-03-05", -20, "expense"),
  mk("Banca", "2026-03-10", -1000, "invest_buy"),
  mk("Banca", "2026-04-10", 300, "invest_sell"),
  mk("Cassa", "2026-04-01", -10, "expense", { deferredWallet: true }),
  mk("Banca", "2026-04-12", -80, "expense", { unbalanced: true }),
];

describe("accountBalances", () => {
  it("serie mensile per conto, liquidità, investito e patrimonio", () => {
    const b = accountBalances(lines, accounts, { granularity: "month" });
    expect(b.keys).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    const [banca, revolut, cassa] = b.accounts;
    expect(banca.series).toEqual([2700, 2200, 1200, 1420]);
    expect(revolut.series).toEqual([200, 650, 630, 630]); // storico ricostruito prima di initialDate
    expect(cassa).toMatchObject({ id: "Cassa", known: false, kind: "other", series: [0, 0, 0, -10] });
    expect(b.liquidity).toEqual([2900, 2850, 1830, 2040]);
    expect(b.invested).toEqual([0, 0, 1000, 700]);
    expect(b.netWorth).toEqual([2900, 2850, 2830, 2740]);
    expect(b.current).toMatchObject({ asOf: "2026-04", liquidity: 2040, invested: 700, netWorth: 2740, byAccount: { Banca: 1420, Revolut: 630, Cassa: -10 } });
  });

  it("i giroconti non cambiano la liquidità totale", () => {
    const only = [mk("Banca", "2026-05-01", -400, "transfer_out"), mk("Revolut", "2026-05-01", 400, "transfer_in")];
    const b = accountBalances(only, [acc("Banca", 1000), acc("Revolut", 0)], { granularity: "day" });
    expect(b.liquidity).toEqual([1000]);
    expect(b.current.byAccount).toEqual({ Banca: 600, Revolut: 400 });
  });

  it("serie giornaliera continua", () => {
    const b = accountBalances(lines, accounts, { granularity: "day" });
    expect(b.keys[0]).toBe("2026-01-10");
    expect(b.keys[b.keys.length - 1]).toBe("2026-04-12");
    const i = b.keys.indexOf("2026-02-25");
    expect(b.accounts[1].series[i]).toBe(650);
    expect(b.accounts[0].series[b.keys.indexOf("2026-01-14")]).toBe(3000);
    const r = accountBalances(lines, accounts, { granularity: "day", from: "2026-03-01", to: "2026-03-31" });
    expect(r.keys).toHaveLength(31);
    expect(r.accounts[0].series[0]).toBe(2200); // apertura che include le righe precedenti
    expect(r.current.byAccount.Banca).toBe(1200);
  });

  it("senza righe: saldi iniziali", () => {
    const b = accountBalances([], [acc("Banca", 500)]);
    expect(b.keys).toEqual([]);
    expect(b.current).toMatchObject({ liquidity: 500, netWorth: 500 });
  });
});

describe("currentBalances e capitale investito", () => {
  it("saldi a una data", () => {
    const c = currentBalances(lines, accounts, "2026-03-31");
    expect(c).toMatchObject({ liquidity: 1830, invested: 1000, investedAtCost: 1000, netWorth: 2830 });
    expect(netInvested(lines)).toBe(700);
    expect(netInvested(lines, "2026-03-31")).toBe(1000);
  });
  it("vendite oltre il versato: capitale al costo mai negativo", () => {
    const l = [mk("Banca", "2026-01-01", -1000, "invest_buy"), mk("Banca", "2026-06-01", 1500, "invest_sell")];
    const c = currentBalances(l, [acc("Banca", 2000)]);
    expect(c).toMatchObject({ liquidity: 2500, invested: -500, investedAtCost: 0, netWorth: 2500 });
    const nw = netWorthSeries(l, [acc("Banca", 2000)]);
    expect(nw.netWorth).toEqual([1000 + 1000, 2000, 2000, 2000, 2000, 2500]);
  });
});

describe("openAdvances", () => {
  it("anticipi, rimborsi e residuo per controparte", () => {
    const l = [
      mk("Banca", "2026-01-10", -100, "advance_out", { counterparty: "Marco" }),
      mk("Banca", "2026-02-05", 40, "refund_in", { counterparty: "marco " }),
      mk("Banca", "2026-03-01", -50, "advance_out", { counterparty: "Giulia" }),
      mk("Banca", "2026-03-09", 50, "refund_in", { counterparty: "Giulia" }),
      mk("Banca", "2026-04-01", 30, "refund_in", { counterparty: "Luca" }),
      mk("Banca", "2026-04-02", -200, "advance_out", { counterparty: "Anna" }),
      mk("Banca", "2026-04-03", -999, "expense"),
    ];
    const a = openAdvances(l);
    expect(a.items.map((i) => [i.counterparty, i.status, i.outstanding])).toEqual([
      ["Anna", "aperto", 200], ["marco", "aperto", 60], ["Luca", "eccedenza", -30], ["Giulia", "chiuso", 0],
    ]);
    expect(a.items[1]).toMatchObject({ advanced: 100, refunded: 40, firstDate: "2026-01-10", lastDate: "2026-02-05", count: 2 });
    expect(a.totals).toEqual({ advanced: 350, refunded: 120, outstanding: 260 });
    expect(a.openCount).toBe(2);
    expect(openAdvances([])).toEqual({ items: [], totals: { advanced: 0, refunded: 0, outstanding: 0 }, openCount: 0 });
  });
});
