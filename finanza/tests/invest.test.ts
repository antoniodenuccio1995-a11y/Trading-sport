import { describe, expect, it } from "vitest";
import type { Line } from "../src/domain/types.ts";
import { makeMovement } from "../src/domain/movement.ts";
import type { Instrument, InvestData, Trade } from "../src/invest/types.ts";
import {
  allocationByInstrument, allocationByKind, bookOf, dividends, findIsin, historyPrice, isValidIsin, machineNum, mergeHistory,
  monthlyPoints, positions, proposeTrades, totals, tradeCash, tradeFromProposal, unlinkedInvestMovements, valueOverTime,
} from "../src/invest/portfolio.ts";
import { parseChart, pickSymbol, toEur } from "../../supabase/functions/fp-prices/yahoo.ts";

// Dati sintetici: ISIN inventati ma con cifra di controllo valida.
const ISIN_ETF = "IE00TEST0000";
const ISIN_STOCK = "LU00TEST0005";
const ISIN_OTHER = "XX00PROVA006";

const etf: Instrument = { id: "etf", name: "ETF MONDO TEST", kind: "etf", isin: ISIN_ETF, symbol: "EMT", currency: "EUR" };
const btc: Instrument = { id: "btc", name: "Moneta Test", kind: "crypto", symbol: "MTS", coingeckoId: "moneta-test", currency: "EUR" };
const stock: Instrument = { id: "stk", name: "AZIONE PROVA", kind: "stock", isin: ISIN_STOCK, currency: "EUR" };

let n = 0;
const T = (p: Partial<Trade> & Pick<Trade, "instrumentId" | "date" | "side" | "quantity" | "price">): Trade =>
  ({ id: "t" + ++n, account: "Trade Republic", fees: 0, amount: 0, ...p });

function data(over: Partial<InvestData> = {}): InvestData {
  return {
    instruments: [etf, btc],
    trades: [
      T({ instrumentId: "etf", date: "2026-01-10", side: "buy", quantity: 10, price: 100, fees: 1, amount: -1001 }),
      T({ instrumentId: "etf", date: "2026-03-05", side: "buy", quantity: 10, price: 120, fees: 1, amount: -1201 }),
      T({ instrumentId: "etf", date: "2026-04-02", side: "sell", quantity: 5, price: 130, fees: 1, amount: 649 }),
      T({ instrumentId: "btc", date: "2026-02-15", side: "buy", quantity: 0.5, price: 30000, fees: 0, amount: -15000, account: "Binance" }),
    ],
    prices: {
      etf: { price: 125, currency: "EUR", at: "2026-04-10T10:00:00.000Z", source: "yahoo" },
      btc: { price: 40000, currency: "EUR", at: "2026-04-10T10:05:00.000Z", source: "coingecko" },
    },
    priceHistory: {},
    ...over,
  };
}

describe("costo medio ponderato", () => {
  it("prezzo medio, investito e realizzato", () => {
    const p = positions(data()).find((x) => x.instrument.id === "etf")!;
    // 2 acquisti: 20 quote per 2.202 € → medio 110,10; vendita di 5 quote a 649 € netti
    expect(p.quantity).toBe(15);
    expect(p.avgCost).toBeCloseTo(110.1, 6);
    expect(p.invested).toBeCloseTo(1651.5, 2);
    expect(p.realized).toBeCloseTo(649 - 5 * 110.1, 2); // 98,50
    expect(p.marketValue).toBe(1875);
    expect(p.unrealized).toBeCloseTo(223.5, 2);
    expect(p.unrealizedPct).toBeCloseTo(223.5 / 1651.5, 6);
    expect(p.fees).toBe(3);
    expect(p.closed).toBe(false);
    expect(p.issues).toEqual([]);
  });

  it("l'importo mancante si ricava da quantità × prezzo ± commissioni", () => {
    expect(tradeCash({ side: "buy", quantity: 2, price: 50, fees: 1, amount: 0 })).toBe(-101);
    expect(tradeCash({ side: "sell", quantity: 2, price: 50, fees: 1, amount: 0 })).toBe(99);
    expect(tradeCash({ side: "buy", quantity: 2, price: 50, fees: 1, amount: -100.5 })).toBe(-100.5);
    const b = bookOf([T({ instrumentId: "x", date: "2026-01-01", side: "buy", quantity: 2, price: 50, fees: 1 })]);
    expect(b.cost).toBe(101);
  });

  it("vendere tutto chiude la posizione; vendere troppo è segnalato", () => {
    const closed = positions(data({ instruments: [stock], trades: [
      T({ instrumentId: "stk", date: "2026-01-01", side: "buy", quantity: 4, price: 10, amount: -40 }),
      T({ instrumentId: "stk", date: "2026-02-01", side: "sell", quantity: 4, price: 12, amount: 48 }),
    ], prices: {} }))[0];
    expect(closed).toMatchObject({ quantity: 0, invested: 0, marketValue: 0, realized: 8, closed: true, valuedAtCost: false });
    const over = positions(data({ instruments: [stock], trades: [
      T({ instrumentId: "stk", date: "2026-01-01", side: "buy", quantity: 1, price: 10, amount: -10 }),
      T({ instrumentId: "stk", date: "2026-02-01", side: "sell", quantity: 3, price: 10, amount: 30 }),
    ], prices: {} }))[0];
    expect(over.issues).toContain("oversell");
    expect(over.quantity).toBe(0);
  });

  it("le operazioni si applicano in ordine di data, non di inserimento", () => {
    const b = bookOf([
      T({ instrumentId: "x", date: "2026-03-01", side: "sell", quantity: 1, price: 20, amount: 20 }),
      T({ instrumentId: "x", date: "2026-01-01", side: "buy", quantity: 2, price: 10, amount: -20 }),
    ]);
    expect(b).toMatchObject({ qty: 1, cost: 10, realized: 10, issues: [] });
  });

  it("senza prezzo (o con prezzo non in euro) la posizione vale il costo", () => {
    const d = data({ prices: { btc: { price: 45000, currency: "USD", at: "2026-04-10T10:00:00.000Z", source: "yahoo" } } });
    const pos = positions(d);
    const e = pos.find((p) => p.instrument.id === "etf")!, b = pos.find((p) => p.instrument.id === "btc")!;
    expect(e).toMatchObject({ price: null, valuedAtCost: true, marketValue: 1651.5, unrealized: 0, unrealizedPct: null });
    expect(b.valuedAtCost).toBe(true);
    const t = totals(pos);
    expect(t.unpriced).toBe(2);
    expect(t.unrealizedPct).toBeNull();
  });
});

describe("totali e ripartizione", () => {
  it("somma valore, costo, realizzato; pesi e ripartizione per tipo", () => {
    const pos = positions(data());
    const t = totals(pos);
    expect(t.marketValue).toBe(21875);
    expect(t.invested).toBeCloseTo(16651.5, 2);
    expect(t.unrealized).toBeCloseTo(223.5 + 5000, 2);
    expect(t.realized).toBeCloseTo(98.5, 2);
    expect(t.open).toBe(2);
    expect(t.lastQuoteAt).toBe("2026-04-10T10:05:00.000Z");
    expect(t.oldestQuoteAt).toBe("2026-04-10T10:00:00.000Z");
    expect(pos[0].instrument.id).toBe("btc"); // ordinate per valore
    expect(pos.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(1, 9);
    const k = allocationByKind(pos);
    expect(k.map((x) => [x.kind, x.label])).toEqual([["crypto", "Cripto"], ["etf", "ETF"]]);
    expect(k[0].pct).toBeCloseTo(20000 / 21875, 9);
    expect(k.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(1, 9);
    const i = allocationByInstrument(pos);
    expect(i.map((x) => x.id)).toEqual(["btc", "etf"]);
  });

  it("portafoglio vuoto", () => {
    expect(positions(undefined)).toEqual([]);
    expect(totals([])).toMatchObject({ marketValue: 0, invested: 0, unrealizedPct: null, open: 0 });
    expect(allocationByKind([])).toEqual([]);
  });
});

describe("valore nel tempo", () => {
  it("usa lo storico mensile, l'ultimo prezzo nel mese corrente, il costo dove manca", () => {
    const d = data({ priceHistory: {
      etf: [["2026-01-30", 102], ["2026-02-27", 108]], // marzo manca: vale il punto di febbraio (tolleranza 1 mese)
      // btc senza storico: febbraio e marzo al costo
    } });
    const s = valueOverTime(d, { asOf: "2026-04-10" });
    expect(s.keys).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(s.value[0]).toBe(1020); // 10 × 102
    expect(s.value[1]).toBe(10 * 108 + 15000); // btc al costo
    expect(s.value[2]).toBe(20 * 108 + 15000);
    expect(s.value[3]).toBe(15 * 125 + 0.5 * 40000); // ultimo prezzo noto
    expect(s.invested).toEqual([1001, 16001, 17202, 16651.5]);
    expect(s.estimated).toEqual([false, true, true, false]);
  });

  it("senza storico vale il costo; maxMonths taglia i mesi più vecchi ma conta le operazioni", () => {
    const d = data({ prices: {}, priceHistory: {} });
    const s = valueOverTime(d, { asOf: "2026-04-10", maxMonths: 2 });
    expect(s.keys).toEqual(["2026-03", "2026-04"]);
    expect(s.value).toEqual(s.invested);
    expect(s.invested[0]).toBe(17202);
    expect(valueOverTime(data({ trades: [] }), { asOf: "2026-04-10" }).keys).toEqual([]);
  });

  it("storico: un punto per mese e unione col nuovo che vince", () => {
    expect(monthlyPoints([["2026-01-05", 1], ["2026-01-31", 2], ["2026-02-01", 3], ["bad", 9]])).toEqual([["2026-01-31", 2], ["2026-02-01", 3]]);
    expect(mergeHistory([["2026-01-31", 2], ["2026-02-28", 3]], [["2026-02-10", 4], ["2026-03-31", 5]])).toEqual([["2026-01-31", 2], ["2026-02-10", 4], ["2026-03-31", 5]]);
    expect(mergeHistory([["2026-01-31", 1], ["2026-02-28", 2], ["2026-03-31", 3]], [], 2)).toEqual([["2026-02-28", 2], ["2026-03-31", 3]]);
    expect(historyPrice([["2026-01-31", 1]], "2026-03")).toBeNull(); // troppo vecchio
    expect(historyPrice([["2026-01-31", 1]], "2026-02")).toBe(1);
  });
});

describe("dividendi", () => {
  const L = (id: string, date: string, amount: number, description: string, counterparty = "", categoryId = "inc.financial_income"): Line =>
    ({ id, parentId: id, account: "Trade Republic", date, month: date.slice(0, 7), amount, type: "income", categoryId, counterparty, description, merchant: "", isSplit: false, unbalanced: false, deferredWallet: false });

  it("per ISIN, nome, ticker e prime parole del nome; il resto è 'altro'", () => {
    const named: Instrument = { id: "n", name: "Fondo Globale Prova Distribuzione", kind: "etf", currency: "EUR" };
    const rep = dividends([
      L("a", "2025-06-01", 3, `Dividendo ${ISIN_ETF}`),
      L("b", "2026-06-01", 4, "Cedola", "ETF MONDO TEST"),
      L("c", "2026-07-01", 1, "DIV EMT 0,25 PER QUOTA"),
      L("d", "2026-08-01", 2, "Dividendo FONDO GLOBALE PROVA"),
      L("e", "2026-08-01", 1.5, "Interessi"),
      L("f", "2026-08-01", 9, `Dividendo ${ISIN_ETF}`, "", "inc.other"), // altra categoria: ignorata
      L("g", "2026-09-01", 1, "AEMTX bonus"), // "EMT" non è una parola intera
    ], [etf, named]);
    expect(rep.byInstrument.etf).toMatchObject({ total: 8, byYear: { "2025": 3, "2026": 5 }, lineIds: ["a", "b", "c"] });
    expect(rep.byInstrument.n).toMatchObject({ total: 2, lineIds: ["d"] });
    expect(rep.other).toMatchObject({ total: 2.5, lineIds: ["e", "g"] });
    expect(rep.years).toEqual(["2025", "2026"]);
    expect(rep.byYear).toEqual({ "2025": 3, "2026": 7 });
  });
});

describe("numeri e ISIN", () => {
  it("ISIN con cifra di controllo", () => {
    expect(isValidIsin("US0378331005")).toBe(true);
    expect(isValidIsin(ISIN_ETF)).toBe(true);
    expect(isValidIsin("US0378331006")).toBe(false);
    expect(isValidIsin("ABC")).toBe(false);
    expect(findIsin(`Buy trade ${ISIN_STOCK} AZIONE, quantity: 2`)).toBe(ISIN_STOCK);
    expect(findIsin("CODICE AB1234567890 NON VALIDO")).toBe("");
  });
  it("numeri del CSV: punto decimale, niente migliaia", () => {
    expect(machineNum("1.234")).toBe(1.234);
    expect(machineNum("0.512345")).toBe(0.512345);
    expect(machineNum("1,5")).toBe(1.5);
    expect(machineNum("1.234,56")).toBe(1234.56);
    expect(machineNum("1,234.56")).toBe(1234.56);
    expect(machineNum("-3")).toBe(-3);
    expect(machineNum("")).toBeNaN();
    expect(machineNum("abc")).toBeNaN();
  });
});

describe("proposte da Trade Republic", () => {
  const TR = "Trade Republic";
  const mv = (p: Parameters<typeof makeMovement>[0]) => makeMovement({ account: TR, currency: "EUR", ...p });

  const buyCols = mv({ id: "m1", date: "2026-03-02", description: "Acquisto ETF TEST", amount: -151, type: "invest_buy", sourceType: "BUY", counterparty: "ETF TEST",
    raw: { type: "BUY", asset_class: "FUND", name: "ETF TEST", symbol: ISIN_OTHER, shares: "1.5", price: "100.0", fee: "-1.00", __TR_FEE: -1, __TR_GROSS_AMOUNT: -150 } });
  const buyDesc = mv({ id: "m2", date: "2026-03-03", description: `Buy trade ${ISIN_STOCK} AZIONE PROVA, quantity: 2.5`, amount: -250.5, type: "invest_buy", raw: {} });
  const noData = mv({ id: "m3", date: "2026-03-04", description: "PIANO DI ACCUMULO ETF MSCI WORLD", amount: -200, type: "invest_buy" });
  const sellNoQty = mv({ id: "m4", date: "2026-03-05", description: "Vendita ETF MONDO TEST", amount: 300, type: "invest_sell", raw: { symbol: ISIN_ETF, name: "ETF MONDO TEST", asset_class: "FUND" } });
  const linked = mv({ id: "m5", date: "2026-03-06", description: `Acquisto ${ISIN_ETF}`, amount: -100, type: "invest_buy", raw: { symbol: ISIN_ETF, shares: "1" } });
  const ignored = mv({ id: "m6", date: "2026-03-07", description: `Acquisto ${ISIN_ETF}`, amount: -100, type: "invest_buy", raw: { symbol: ISIN_ETF, shares: "1" } });
  const deleted = { ...mv({ id: "m7", date: "2026-03-08", description: `Acquisto ${ISIN_ETF}`, amount: -100, type: "invest_buy", raw: { symbol: ISIN_ETF, shares: "1" } }), deletedAt: "2026-03-09" };
  const notInvest = mv({ id: "m8", date: "2026-03-08", description: `Dividendo ${ISIN_ETF}`, amount: 3, type: "income", categoryId: "inc.financial_income" });
  const unclassified = mv({ id: "m9", date: "2026-03-09", description: "Esecuzione piano", amount: -50, type: "", sourceType: "SAVINGS_PLAN", raw: { SYMBOL: ISIN_ETF, SHARES: "0.4", PRICE: "125" } });
  const all = [buyCols, buyDesc, noData, sellNoQty, linked, ignored, deleted, notInvest, unclassified];
  const d: InvestData = { instruments: [etf], prices: {}, trades: [T({ instrumentId: "etf", date: "2026-03-06", side: "buy", quantity: 1, price: 100, amount: -100, movementId: "m5" })], ignoredMovements: ["m6"] };

  it("legge ISIN, quantità, prezzo e commissioni dalle colonne o dalla descrizione", () => {
    const ps = proposeTrades(all, d);
    expect(ps.map((p) => p.movementId).sort()).toEqual(["m1", "m2", "m4", "m9"]);
    const p1 = ps.find((p) => p.movementId === "m1")!;
    expect(p1).toMatchObject({ side: "buy", quantity: 1.5, price: 100, fees: 1, amount: -151, from: "colonne", missing: [], instrumentId: undefined,
      instrument: { name: "ETF TEST", kind: "etf", isin: ISIN_OTHER, currency: "EUR" } });
    const p2 = ps.find((p) => p.movementId === "m2")!;
    expect(p2).toMatchObject({ side: "buy", quantity: 2.5, from: "descrizione", instrument: { isin: ISIN_STOCK, name: "AZIONE PROVA", kind: "etf" } }); // LU → probabile fondo/ETF
    expect(p2.price).toBeCloseTo(100.2, 6); // importo ÷ quantità
    const p9 = ps.find((p) => p.movementId === "m9")!;
    expect(p9).toMatchObject({ side: "buy", quantity: 0.4, price: 125, instrumentId: "etf" }); // intestazioni maiuscole (v3.10)
  });

  it("la quantità non si inventa: resta da chiedere", () => {
    const p4 = proposeTrades(all, d).find((p) => p.movementId === "m4")!;
    expect(p4).toMatchObject({ side: "sell", quantity: null, price: null, missing: ["quantità"], instrumentId: "etf" });
    expect(tradeFromProposal(p4, "etf")).toBeNull();
    expect(tradeFromProposal(p4, "etf", 2)).toMatchObject({ side: "sell", quantity: 2, price: 150, amount: 300, movementId: "m4", instrumentId: "etf" });
  });

  it("esclude collegati, ignorati, cestinati e movimenti non di investimento", () => {
    const ids = unlinkedInvestMovements(all, d).map((m) => m.id).sort();
    expect(ids).toEqual(["m1", "m2", "m3", "m4", "m9"]);
  });

  it("riconosce un'operazione manuale già inserita (stesso conto, importo, ±3 giorni)", () => {
    const manual = T({ instrumentId: "etf", date: "2026-03-04", side: "sell", quantity: 2, price: 150, amount: 300 });
    const p4 = proposeTrades([sellNoQty], { ...d, trades: [manual] })[0];
    expect(p4.duplicateOf).toBe(manual.id);
  });
});

describe("fp-prices (Yahoo, risposte sintetiche)", () => {
  it("preferisce una quotazione in euro", () => {
    expect(pickSymbol([{ symbol: "TEST.L", quoteType: "ETF" }, { symbol: "TEST.MI", quoteType: "ETF" }, { symbol: "TEST.DE", quoteType: "ETF" }])!.symbol).toBe("TEST.DE");
    expect(pickSymbol([{ symbol: "TST", quoteType: "EQUITY" }, { symbol: "TST.X", quoteType: "OPTION" }])!.symbol).toBe("TST");
    expect(pickSymbol([])).toBeNull();
  });

  const ts = (iso: string) => Date.parse(iso) / 1000;
  it("legge prezzo e storico mensile, con fine mese e centesimi di sterlina", () => {
    const j = { chart: { result: [{
      meta: { symbol: "TEST.L", currency: "GBp", regularMarketPrice: 1250, regularMarketTime: ts("2026-03-10T15:00:00Z"), gmtoffset: 0, longName: "Test Fund", exchangeName: "LSE" },
      timestamp: [ts("2026-01-01T08:00:00Z"), ts("2026-02-01T08:00:00Z"), ts("2026-03-01T08:00:00Z")],
      indicators: { quote: [{ close: [1000, null, 1200] }] },
    }] } };
    const c = parseChart(j)!;
    expect(c).toMatchObject({ symbol: "TEST.L", currency: "GBP", price: 12.5, name: "Test Fund", at: "2026-03-10T15:00:00.000Z" });
    expect(c.history).toEqual([["2026-01-31", 10], ["2026-03-10", 12.5]]);
    const fx = parseChart({ chart: { result: [{ meta: { symbol: "GBPEUR=X", currency: "EUR", regularMarketPrice: 1.2, regularMarketTime: ts("2026-03-10T15:00:00Z"), gmtoffset: 0 },
      timestamp: [ts("2026-01-01T00:00:00Z")], indicators: { quote: [{ close: [1.1] }] } }] } });
    const e = toEur(c, fx)!;
    expect(e.price).toBeCloseTo(15, 6);
    expect(e.history[0][1]).toBeCloseTo(11, 6); // cambio di gennaio
    expect(e.history[1][1]).toBeCloseTo(15, 6); // mese corrente: cambio attuale
    expect(toEur(c, null)).toBeNull();
    expect(parseChart({ chart: { result: [] } })).toBeNull();
  });
});
