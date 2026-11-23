import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { leagueProfiles } from "../src/stats/profile";

let id = 0;
const g = (h: number, a: number, fh: number, fa: number): Match => ({
  i: 0, id: ++id, lg: "I1", s: "2026/27", d: id, ko: null, h, a, fh, fa, hh: 0, ha: 0,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null,
});

describe("profilo a esagono", () => {
  // squadra 1 segna tanto, squadra 3 subisce tanto
  const list = [g(1, 2, 3, 0), g(2, 3, 1, 1), g(3, 1, 0, 4), g(1, 3, 2, 0), g(2, 1, 0, 1), g(3, 2, 1, 2)];
  it("percentili: la migliore a 1, la peggiore a 0; la difesa premia chi subisce meno", () => {
    const p = leagueProfiles(list);
    expect(p.get(1)!.axes[0].pct).toBe(1);      // attacco migliore
    expect(p.get(3)!.axes[1].pct).toBe(0);      // difesa peggiore
    expect(p.get(1)!.axes[1].pct).toBe(1);      // nessun gol subito
    expect(p.get(1)!.axes[2].text).toBe("3,0 punti a partita");
  });
  it("prima di una data e con un minimo di partite", () => {
    expect(leagueProfiles(list, { before: 3 }).size).toBe(0); // 2 partite: sotto il minimo
    expect(leagueProfiles(list, { before: 3 }, 1).size).toBe(3);
  });
});
