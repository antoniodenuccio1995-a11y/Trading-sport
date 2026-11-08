import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { halfLeague, halfTeam } from "../src/stats/halves";
import { agreement, evBack, evLay, marketProbs, maxLay, minBack, verdict } from "../src/stats/market";
import { forecast, forecastHalves } from "../src/stats/poisson";
import { leagueTeamAgg, pct } from "../src/stats/team";
import { finalRank, rankTimeline, zones } from "../src/stats/timeline";

let id = 0;
const mk = (d: number, h: number, a: number, fh: number | null, fa: number | null, hh: number | null = null, ha: number | null = null): Match => ({
  i: 0, id: ++id, lg: "I1", s: "2026/27", d, ko: null, h, a, fh, fa, hh, ha,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null,
});

describe("classifica nel tempo", () => {
  // settimane: 20000 (lun?) — usiamo giorni distanti 7 per avere settimane diverse
  const list = [mk(20002, 1, 2, 0, 1), mk(20002, 3, 4, 2, 0), mk(20009, 2, 3, 0, 3), mk(20009, 4, 1, 1, 1), mk(20016, 1, 3, null, null)];
  it("una posizione per settimana con partite", () => {
    const t = rankTimeline(list);
    expect(t.dates).toEqual([20002, 20009]);
    expect(t.ranks.get(3)).toEqual([1, 1]);
    expect(t.ranks.get(1)!.length).toBe(2);
    expect(t.pts.get(3)).toEqual([3, 6]);
    expect(t.games.get(1)).toEqual([1, 2]);
  });
  it("classifica solo casa e prima di una data", () => {
    expect(rankTimeline(list, "home").ranks.get(3)).toEqual([1, 1]);
    expect(rankTimeline(list, "all", undefined, 20005).dates).toEqual([20002]);
  });
  it("posizione finale e zone", () => {
    expect(finalRank(list, 3)).toMatchObject({ rank: 1, pts: 6, p: 2 });
    expect(zones("I1", 20).map((z) => [z.from, z.to, z.tone])).toEqual([[1, 4, "top"], [5, 6, "mid"], [18, 20, "low"]]);
    expect(zones("CL", 36)).toEqual([]);
  });
});

describe("gol per tempo", () => {
  const list = [mk(1, 1, 2, 2, 1, 0, 1), mk(2, 3, 1, 1, 1, 1, 0), mk(3, 1, 4, 3, 0, 1, 0), mk(4, 2, 1, 0, 0, null, null)];
  it("profilo squadra 1T/2T", () => {
    const g = halfTeam(list, 1);
    expect(g.n).toBe(3);
    expect([g.f1, g.a1, g.f2, g.a2]).toEqual([1, 2, 5, 0]);
    expect(g.g1).toBe(3); expect(g.g2).toBe(3);
    expect(g.more2).toBe(2); expect(g.zero1).toBe(0);
    expect(g.htft["P>V"]).toBe(1); expect(g.htft["P>N"]).toBe(1); expect(g.htft["V>V"]).toBe(1);
  });
  it("media lega in casa conta ogni partita una volta", () => {
    const L = halfLeague(list, "home");
    expect(L.n).toBe(3);
    expect(L.f1 + L.a1).toBe(3);
    expect(halfLeague(list, "all").n).toBe(6);
  });
  it("squadra media del campionato", () => {
    const g = leagueTeamAgg(list, "all");
    expect(g.n).toBe(8);
    expect(pct(g.w, g.n)).toBeCloseTo(25);
  });
});

describe("Poisson per tempo", () => {
  const list: Match[] = [];
  for (let d = 0; d < 80; d++) {
    const h = 1 + (d % 8), a = 1 + ((d + 3) % 8);
    if (h === a) continue;
    const fh = d % 3, fa = d % 2, hh = Math.min(fh, d % 2), ha = d % 2 === 1 && d % 3 === 0 ? 1 : 0;
    list.push(mk(d, h, a, fh, fa, hh, ha));
  }
  it("probabilità coerenti e solo dati precedenti", () => {
    const f = forecast(list, "I1", 90, 1, 4)!;
    expect(f.halves).not.toBeNull();
    const h = f.halves!;
    expect(h.more1 + h.more2 + h.same).toBeCloseTo(1, 3);
    expect(f.ht05).toBeCloseTo(h.h1.goal, 10);
    expect(h.h2.goal).toBeGreaterThan(h.h1.goal); // in questi dati il 2° tempo ha più gol
  });
  it("senza risultati all'intervallo non stima i tempi", () => {
    expect(forecastHalves(list.map((m) => ({ ...m, hh: null, ha: null })), list, list)).toBeNull();
  });
});

describe("mercato", () => {
  it("toglie il margine quando il gruppo è completo", () => {
    const r = marketProbs([{ b: 2 }, { b: 3.5 }, { b: 4 }]);
    expect(r.complete).toBe(true);
    expect(r.probs.reduce((s, p) => s! + p!, 0)).toBeCloseTo(1, 8);
    expect(r.margin).toBeGreaterThan(0);
  });
  it("usa il prezzo medio back/lay e 1/quota se il gruppo è incompleto", () => {
    const r = marketProbs([{ b: 2, l: 2.04 }, {}]);
    expect(r.complete).toBe(false);
    expect(r.probs[0]).toBeCloseTo((0.5 + 1 / 2.04) / 2, 8);
    expect(r.probs[1]).toBeNull();
  });
  it("soglie back/lay coerenti con il valore atteso", () => {
    const p = 0.55, c = 0.05;
    expect(evBack(p, minBack(p, c), c)).toBeCloseTo(0, 10);
    expect(evLay(p, maxLay(p, c), c)).toBeCloseTo(0, 10);
    expect(evBack(p, 2.2, c)).toBeGreaterThan(0);
    expect(evLay(p, 1.5, c)).toBeGreaterThan(0);
  });
  it("lettura e accordo", () => {
    expect(verdict(0.6, 0.5).v).toBe("back");
    expect(verdict(0.4, 0.5).v).toBe("lay");
    expect(verdict(0.51, 0.5).v).toBe("linea");
    expect(agreement([0.01, -0.02])!.level).toBe("alta");
    expect(agreement([0.1, -0.08])!.level).toBe("bassa");
    expect(agreement([])).toBeNull();
  });
});
