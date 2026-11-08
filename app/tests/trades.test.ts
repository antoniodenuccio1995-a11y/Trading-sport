import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { clv, guessMarket, selectionWon, summarize, tradesCsv } from "../src/data/trades";
import type { Trade } from "../src/data/personal";

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
