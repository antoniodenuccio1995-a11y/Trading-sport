import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { moveStudy, movesBetween, openCloseMoves } from "../src/stats/moves";

const m = (o: Partial<Match>): Match => ({
  i: 0, id: 1, lg: "I1", s: "2026/27", d: 0, ko: null, h: 1, a: 2, fh: null, fa: null, hh: null, ha: null,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null, ...o,
});

describe("movimenti di quota", () => {
  it("apertura → chiusura: la quota che scende aumenta la probabilità", () => {
    const mv = openCloseMoves(m({ oh: 2.5, od: 3.3, oa: 3, ch: 2.1, cd: 3.4, ca: 3.8 }));
    const h = mv.find((x) => x.sel === "1")!;
    expect(h.dP).toBeGreaterThan(0.04);
    expect(h.strong).toBe(true);
    expect(h.dOdd).toBeCloseTo(2.1 / 2.5 - 1);
    expect(mv.find((x) => x.sel === "2")!.dP).toBeLessThan(0);
    expect(openCloseMoves(m({ oh: 2, od: 3, oa: 4 }))).toEqual([]); // manca la chiusura
  });
  it("Over/Under dalla coppia di quote", () => {
    const mv = movesBetween({ h: null, d: null, a: null, o: 2, u: 1.8 }, { h: null, d: null, a: null, o: 1.8, u: 2 });
    expect(mv.map((x) => x.sel)).toEqual(["o25", "u25"]);
    expect(mv[0].dP).toBeCloseTo(-mv[1].dP);
  });
  it("studio per fasce: esiti e rendimento all'apertura e alla chiusura", () => {
    const list = [
      m({ fh: 2, fa: 0, oh: 2.5, od: 3.3, oa: 3, ch: 2.0, cd: 3.5, ca: 4 }), // scesa molto, vinta
      m({ fh: 0, fa: 1, oh: 2.5, od: 3.3, oa: 3, ch: 2.0, cd: 3.5, ca: 4 }), // scesa molto, persa
      m({ fh: 1, fa: 1, oh: 2, od: 3.4, oa: 4, ch: 2, cd: 3.4, ca: 4 }),     // stabile, persa
    ];
    const b = moveStudy(list, "1");
    expect(b[0]).toMatchObject({ n: 2, wins: 1 });
    expect(b[0].roiEarly).toBeCloseTo((1.5 - 1) / 2);
    expect(b[0].roiClose).toBeCloseTo((1 - 1) / 2);
    expect(b[2]).toMatchObject({ n: 1, wins: 0, roiEarly: -1 });
  });
});
