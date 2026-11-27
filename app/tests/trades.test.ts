import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { NO_FILTER, activeFilters, fullOutcomes, clv, filterTrades, guessMarket, maxDrawdown, periodRange, selectionWon, strategyOf, summarize, tradesCsv } from "../src/data/trades";
import { tradePL, type Trade } from "../src/data/personal";

const m = (fh: number, fa: number, hh: number | null, ha: number | null): Match => ({
  i: 0, id: 1, lg: "I1", s: "2026/27", d: 0, ko: null, h: 1, a: 2, fh, fa, hh, ha,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null,
});
const t = (p: Partial<Trade>): Trade => ({ id: 1, d: "2026-11-08", lg: "Serie A", m: "A – B", mk: "", side: "back", q: 2, s: 10, comm: 5, res: "open", exitpl: null, ...p });

describe("esito dei mercati dal risultato", () => {
  it("1X2, over/under, goal", () => {
    const r = m(2, 1, 0, 1);
    expect(selectionWon("1", r)).toBe(true); expect(selectionWon("X", r)).toBe(false); expect(selectionWon("2", r)).toBe(false);
    expect(selectionWon("o25", r)).toBe(true); expect(selectionWon("u25", r)).toBe(false); expect(selectionWon("o35", r)).toBe(false);
    expect(selectionWon("gg", r)).toBe(true); expect(selectionWon("ng", r)).toBe(false);
  });
  it("primo e secondo tempo", () => {
    const r = m(2, 1, 0, 1);
    expect(selectionWon("o05h1", r)).toBe(true); expect(selectionWon("u15h1", r)).toBe(true);
    expect(selectionWon("o05h2", r)).toBe(true); expect(selectionWon("u05h2", r)).toBe(false);
    expect(selectionWon("o05h1", m(1, 0, null, null))).toBeNull();
  });
  it("partita non giocata", () => {
    expect(selectionWon("1", { ...m(0, 0, null, null), fh: null, fa: null })).toBeNull();
  });
});

describe("trade", () => {
  it("riconosce i mercati scritti nella v0.3", () => {
    expect(guessMarket("Vittoria casa")).toBe("1");
    expect(guessMarket("Under 1.5 primo tempo")).toBe("u15h1");
    expect(guessMarket("Over 2,5")).toBe("o25");
    expect(guessMarket("Entrambe segnano")).toBe("gg");
    expect(guessMarket("No goal")).toBe("ng");
    expect(guessMarket("Pareggio")).toBe("X");
  });
  it("CLV: back migliore della chiusura è positivo, lay il contrario", () => {
    expect(clv(t({ q: 2.2, cl: 2 }))).toBeCloseTo(0.1);
    expect(clv(t({ side: "lay", q: 2, cl: 2.2 }))).toBeCloseTo(0.1);
    expect(clv(t({ cl: null }))).toBeNull();
  });
  it("riepilogo e CSV", () => {
    const list = [t({ id: 1, res: "won" }), t({ id: 2, res: "lost" }), t({ id: 3, res: "open" })];
    const s = summarize(list);
    expect([s.n, s.open, s.closed, s.won]).toEqual([3, 1, 2, 1]);
    expect(s.pl).toBeCloseTo(9.5 - 10);
    expect(tradesCsv(list).split("\r\n").length).toBe(4);
  });
});

describe("filtri del registro", () => {
  const list = [
    t({ id: 1, d: "2026-11-08", res: "won", lg: "Serie A", st: "Over HT", mk: "Over 0,5 1° tempo", mkey: "o05h1" }),
    t({ id: 2, d: "2026-11-02", res: "lost", lg: "Serie B", side: "lay", sim: 1 }),
    t({ id: 3, d: "2026-10-01", res: "open", lg: "Serie A", m: "Inter – Milan", n: "derby" }),
    t({ id: 4, d: "2025-12-31", res: "void", lg: "Premier League", st: "Over HT" }),
  ];
  const ids = (f: Partial<typeof NO_FILTER>, withState = true) => filterTrades(list, { ...NO_FILTER, ...f }, "2026-11-08", withState).map((x) => x.id);
  it("stato, esito, tipo, lato", () => {
    expect(ids({})).toEqual([1, 2, 3, 4]);
    expect(ids({ stato: "open" })).toEqual([3]);
    expect(ids({ stato: "closed" })).toEqual([1, 2, 4]);
    expect(ids({ stato: "open" }, false)).toEqual([1, 2, 3, 4]);
    expect(ids({ res: "won" })).toEqual([1]);
    expect(ids({ tipo: "sim" })).toEqual([2]);
    expect(ids({ tipo: "real" })).toEqual([1, 3, 4]);
    expect(ids({ side: "lay" })).toEqual([2]);
  });
  it("campionato, strategia, mercato, ricerca", () => {
    expect(ids({ lg: "Serie A" })).toEqual([1, 3]);
    expect(ids({ st: "Over HT" })).toEqual([1, 4]);
    expect(ids({ st: strategyOf(list[1]) })).toEqual([2, 3]);
    expect(ids({ mk: "Over 0,5 1° tempo" })).toEqual([1]);
    expect(ids({ q: "derby" })).toEqual([3]);
    expect(ids({ q: "inter" })).toEqual([3]);
  });
  it("periodi", () => {
    expect(periodRange({ per: "7", from: "", to: "" }, "2026-11-08")).toEqual(["2026-11-02", ""]);
    expect(ids({ per: "7" })).toEqual([1, 2]);
    expect(ids({ per: "month" })).toEqual([1, 2]);
    expect(ids({ per: "year" })).toEqual([1, 2, 3]);
    expect(ids({ per: "custom", from: "2025-01-01", to: "2026-10-31" })).toEqual([3, 4]);
    expect(activeFilters({ ...NO_FILTER, stato: "open" })).toBe(0);
    expect(activeFilters({ ...NO_FILTER, lg: "Serie A", per: "30" })).toBe(2);
  });
  it("calo massimo", () => {
    const l = [t({ id: 1, d: "2026-11-01", res: "won" }), t({ id: 2, d: "2026-11-02", res: "lost" }), t({ id: 3, d: "2026-11-03", res: "lost" }), t({ id: 4, d: "2026-11-04", res: "won" })];
    expect(maxDrawdown(l)).toBeCloseTo(20);
    expect(maxDrawdown([])).toBe(0);
  });
});

describe("chiusura parziale", () => {
  it("conta solo con l'importo scritto, vincita o perdita", () => {
    expect(tradePL(t({ res: "exit", exitpl: null }))).toBeNull();
    expect(tradePL(t({ res: "exit", exitpl: 3.2 }))).toBeCloseTo(3.2);
    expect(tradePL(t({ res: "exit", exitpl: -2 }))).toBeCloseTo(-2);
    const s = summarize([t({ id: 1, res: "exit", exitpl: 3.2 }), t({ id: 2, res: "exit", exitpl: -2 }), t({ id: 3, res: "exit", exitpl: null })]);
    expect([s.closed, s.won, s.open]).toEqual([2, 1, 1]);
    expect(s.pl).toBeCloseTo(1.2);
  });
  it("vincita e perdita piene come riferimento", () => {
    expect(fullOutcomes(t({ q: 2, s: 10 }))).toEqual({ win: 9.5, loss: -10 });
    const lay = fullOutcomes(t({ side: "lay", q: 3, s: 10 }));
    expect(lay.win).toBeCloseTo(9.5); expect(lay.loss).toBeCloseTo(-20);
  });
});

describe("numeri con la virgola nei moduli", () => {
  it("virgola o punto, testo a metà e vuoto", async () => {
    const { parseDecimal } = await import("../src/ui/components/common");
    expect(parseDecimal("2,50")).toBe(2.5);
    expect(parseDecimal("2.5")).toBe(2.5);
    expect(parseDecimal("1,")).toBe(1);
    expect(parseDecimal(" 10,5 ")).toBe(10.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal(",")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });
});
