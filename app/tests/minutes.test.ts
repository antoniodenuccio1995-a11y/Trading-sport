import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { goalTimes, median, minuteAgg, minuteLeagues } from "../src/stats/minutes";

const m = (fh: number, fa: number, hh: number | null, ha: number | null, gm: string | null, lg = "D1"): Match => ({
  i: 0, id: 1, lg, s: "2026/27", d: 0, ko: null, h: 1, a: 2, fh, fa, hh, ha,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null, gm,
});

describe("minuti dei gol", () => {
  it("solo partite con tutti i minuti; recupero del 1° tempo assegnato con il risultato all'intervallo", () => {
    expect(goalTimes(m(1, 1, 0, 0, "29"))).toBeNull();          // incompleto
    expect(goalTimes(m(1, 0, 0, 0, null))).toBeNull();          // non disponibile
    expect(goalTimes(m(0, 0, 0, 0, ""))).toEqual([]);           // 0-0
    const g = goalTimes(m(2, 1, 2, 0, "12,47,88"))!;            // 47' = 45+2 del primo tempo
    expect(g.map((x) => [x.half, x.band])).toEqual([[1, 0], [1, 2], [2, 5]]);
    expect(goalTimes(m(1, 0, 0, 0, "47"))![0]).toMatchObject({ half: 2, band: 3 });
  });
  it("aggregati: fasce, primo gol, gol tardivi; i campionati senza minuti non contano", () => {
    const list = [m(2, 1, 2, 0, "12,47,88"), m(0, 0, 0, 0, ""), m(1, 0, 0, 0, "93"), m(0, 0, 0, 0, "", "I2"), m(1, 0, 1, 0, null)];
    const lgs = minuteLeagues(list);
    expect([...lgs]).toEqual(["D1|2026/27"]);
    const a = minuteAgg(list, lgs);
    expect([a.n, a.goals, a.noGoal, a.firstBy30, a.after75, a.stoppage]).toEqual([3, 4, 1, 1, 2, 2]);
    expect(a.byBand).toEqual([1, 0, 1, 0, 0, 2]);
    expect(a.matchBand).toEqual([1, 0, 1, 0, 0, 2]);
    expect(median(a.first)).toBe(52.5);
  });
});
