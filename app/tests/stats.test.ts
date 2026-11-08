import { describe, expect, it } from "vitest";
import { extractPersonal, tradePL, type Trade } from "../src/data/personal";
import { buildStore } from "../src/data/store";
import type { Match } from "../src/data/types";
import { forecast, implied, probabilities } from "../src/stats/poisson";
import { formTable, standings } from "../src/stats/standings";
import { h2h, pct, teamAgg, teamMatches } from "../src/stats/team";

let id = 0;
const mk = (d: number, h: number, a: number, fh: number | null, fa: number | null, hh: number | null = null, ha: number | null = null): Match => ({
  i: 0, id: ++id, lg: "I1", s: "2026/27", d, ko: null, h, a, fh, fa, hh, ha,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null,
});

describe("classifica", () => {
  const list = [mk(1, 1, 2, 2, 0), mk(2, 2, 3, 1, 1), mk(3, 3, 1, 0, 3), mk(4, 1, 3, null, null)];
  it("punti, differenza reti e forma", () => {
    const t = standings(list);
    expect(t.map((r) => [r.team, r.pts, r.gf - r.ga])).toEqual([[1, 6, 5], [2, 1, -2], [3, 1, -3]]);
    expect(t[0].form).toEqual(["V", "V"]);
  });
  it("solo casa e prima di una data", () => {
    expect(standings(list, "home").find((r) => r.team === 1)!.p).toBe(1);
    expect(standings(list, "all", 2).find((r) => r.team === 2)!.p).toBe(1);
  });
  it("tabella forma", () => {
    expect(formTable(list, 1)[0].team).toBe(1);
  });
});

describe("statistiche squadra", () => {
  const list = [mk(1, 1, 2, 2, 1, 1, 0), mk(2, 3, 1, 0, 0, 0, 0), mk(3, 1, 4, 3, 2), mk(4, 1, 2, null, null)];
  it("percentuali over / GG / porta inviolata", () => {
    const g = teamAgg(teamMatches(list, 1), 1);
    expect(g.n).toBe(3);
    expect(pct(g.o25, g.n)).toBeCloseTo(66.67, 1);
    expect(pct(g.btts, g.n)).toBeCloseTo(66.67, 1);
    expect(g.cs).toBe(1);
    expect(g.htN).toBe(2);
    expect(g.form).toEqual(["V", "N", "V"]);
  });
  it("precedenti in ordine dal più recente", () => {
    expect(h2h(list, 2, 1).map((m) => m.d)).toEqual([1]);
  });
});

describe("Poisson", () => {
  it("le probabilità 1X2 sommano a 1", () => {
    const p = probabilities(1.6, 1.1);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 4);
    expect(p.home).toBeGreaterThan(p.away);
    expect(p.o25).toBeGreaterThan(0.4);
  });
  it("niente previsione con pochi dati", () => {
    expect(forecast([mk(1, 1, 2, 1, 0)], "I1", 10, 1, 2)).toBeNull();
  });
  it("previsione con lega sufficiente usa solo partite precedenti", () => {
    const list: Match[] = [];
    for (let d = 0; d < 60; d++) list.push(mk(d, 1 + (d % 6), 1 + ((d + 3) % 6), d % 3, d % 2));
    list.push(mk(100, 1, 4, 9, 9)); // futura: non deve contare
    const f = forecast(list, "I1", 70, 1, 4)!;
    expect(f).not.toBeNull();
    expect(f.lh).toBeGreaterThan(0);
    expect(f.sample.league).toBe(60);
  });
  it("probabilità implicite senza margine", () => {
    const i = implied(2, 3.4, 4)!;
    expect(i.home + i.draw + i.away).toBeCloseTo(1, 6);
    expect(i.margin).toBeGreaterThan(0);
  });
});

describe("trade (formula v0.3)", () => {
  const t = (p: Partial<Trade>): Trade => ({ id: 1, d: "2026-10-27", lg: "Serie A", m: "A – B", mk: "1", side: "back", q: 2, s: 10, comm: 5, res: "open", exitpl: null, ...p });
  it("back e lay", () => {
    expect(tradePL(t({ res: "won" }))).toBeCloseTo(9.5);
    expect(tradePL(t({ res: "lost" }))).toBe(-10);
    expect(tradePL(t({ side: "lay", res: "won" }))).toBeCloseTo(9.5);
    expect(tradePL(t({ side: "lay", res: "lost", q: 3 }))).toBe(-20);
    expect(tradePL(t({ res: "open" }))).toBeNull();
    expect(tradePL(t({ res: "exit", exitpl: 3.2 }))).toBe(3.2);
  });
});

describe("import dati personali", () => {
  it("estrae trade, quote, impostazioni e partite manuali dal backup v0.3", () => {
    const rows = extractPersonal({
      format: "TradingAnalyticsBackup", version: 2, records: [[1, "Serie A"]],
      manual: [{ d: 1, lg: "Serie A", H: "Monza", A: "Cagliari", up: true }],
      strategies: [], clubRules: [{ alias: "Nancy", country: "FRA", scope: "alias" }],
      v3: { trades: [{ id: 5, q: 1.3 }, { id: 5, q: 1.4 }], quotes: { "Serie A|A|B": { h: 2 } }, tradeset: { cap: 100 }, delnid: ["x"] },
    });
    const kinds = rows.map((r) => r.kind).sort();
    expect(kinds).toEqual(["clubRule", "manual", "quote", "settings", "settings", "trade"]);
    expect(rows.find((r) => r.kind === "trade")!.value).toEqual({ id: 5, q: 1.4 });
  });
  it("rifiuta file non validi", () => {
    expect(() => extractPersonal({ hello: 1 })).toThrow();
  });
});

describe("archivio in memoria", () => {
  it("ricostruisce partite e indici dall'istantanea colonnare", () => {
    const st = buildStore(
      { v: 1, leagues: [{ code: "I1", name: "Serie A", country: "ITA", countryName: "Italia", tier: 1, sort: 1 }], teams: [[1, "ITA", "Inter", "ok"], [2, "ITA", "Monza", "ok"]] },
      [{ v: 1, season: "2026/27", n: 2, updatedAt: "", id: [11, 10], lg: ["I1", "I1"], d: [20000, 19999], ko: [null, 5], h: [1, 2], a: [2, 1], fh: [null, 4], fa: [null, 1], hh: [null, 1], ha: [null, 1] }],
    );
    expect(st.matches.map((m) => m.id)).toEqual([10, 11]);
    expect(st.byTeam.get(1)!.length).toBe(2);
    expect(st.byId.get(10)!.fh).toBe(4);
    expect(st.byId.get(11)!.oh).toBeNull();
  });
});
