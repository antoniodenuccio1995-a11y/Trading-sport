import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { matchInsights } from "../src/stats/insights";
import type { Forecast } from "../src/stats/poisson";

const base = (o: Partial<Match>): Match => ({
  i: 0, id: 1, lg: "D1", s: "2026/27", d: 100, ko: null, h: 1, a: 2, fh: null, fa: null, hh: null, ha: null,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null, gm: null, ...o,
});
const fc = (o: Partial<Forecast> = {}): Forecast => ({
  lh: 1.6, la: 1, home: 0.5, draw: 0.25, away: 0.25, o15: 0.75, o25: 0.55, o35: 0.3, btts: 0.5, ht05: 0.7, ht15: 0.3,
  top: [], sample: { league: 200, home: 8, away: 8 }, halves: null, ...o,
});
const names = { h: "Casa", a: "Ospite" };

describe("punti chiave", () => {
  it("senza modello avvisa che i dati non bastano", () => {
    expect(matchInsights(base({}), null, [], names)[0].tone).toBe("warn");
  });
  it("modello sopra il mercato: back con quota minima; allineati: nessun segnale", () => {
    // mercato: 1 a 2,50 (≈38% senza margine), il modello dice 50%
    const pts = matchInsights(base({ oh: 2.5, od: 3.4, oa: 2.9 }), fc(), [], names);
    const v = pts.find((p) => p.text.startsWith("1 (Casa)"))!;
    expect(v.tone).toBe("value");
    expect(v.text).toContain("da quota 2,05"); // 1 + 0,5/(0,5·0,95)
    const same = matchInsights(base({ oh: 2, od: 4, oa: 4 }), fc(), [], names);
    expect(same.some((p) => p.text.includes("allineati"))).toBe(true);
  });
  it("mercato sopra il modello sull'Over 2,5: suggerisce il lay sotto una soglia", () => {
    const pts = matchInsights(base({ oo: 1.5, ou: 2.6 }), fc({ o25: 0.5 }), [], names);
    const v = pts.find((p) => p.text.startsWith("Over 2,5"))!;
    expect(v.text).toContain("Lay da valutare solo sotto quota 1,95"); // 1 + 0,5·0,95/0,5
  });
  it("senza quote invita a inserirle; campione piccolo segnalato", () => {
    const pts = matchInsights(base({}), fc({ sample: { league: 100, home: 3, away: 9 } }), [], names);
    expect(pts.some((p) => p.text.startsWith("Quote non ancora disponibili"))).toBe(true);
    expect(pts.some((p) => p.tone === "warn" && p.text.includes("Campione piccolo"))).toBe(true);
  });
  it("scontri diretti: solo con abbastanza precedenti e uno schema netto", () => {
    const g = (fh: number, fa: number, home = 1) => base({ fh, fa, h: home, a: home === 1 ? 2 : 1, d: 10 });
    const five = [g(2, 1), g(3, 1, 2), g(1, 1), g(2, 2), g(4, 0, 2)]; // 4 Over su 5; la squadra di casa ne perde 2
    const t = (list: Match[]) => matchInsights(base({}), fc(), [], names, undefined, list).map((p) => p.text);
    expect(t(five).some((x) => x.startsWith("Precedenti ricchi di gol"))).toBe(true);
    expect(t(five).some((x) => x.includes("non ha mai perso"))).toBe(false);
    const unbeaten = [g(2, 0), g(1, 1, 2), g(0, 1, 2), g(1, 0)];
    expect(t(unbeaten).some((x) => x.startsWith("Casa non ha mai perso negli ultimi 4"))).toBe(true);
    expect(t(unbeaten.slice(0, 3)).some((x) => x.includes("scontri diretti"))).toBe(false);
  });
});
