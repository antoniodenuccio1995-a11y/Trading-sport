import { describe, expect, it } from "vitest";
import type { Match } from "../src/data/types";
import { goalTimes, median, minuteAgg, minuteLeagues } from "../src/stats/minutes";

const m = (fh: number, fa: number, hh: number | null, ha: number | null, gm: string | null, lg = "D1"): Match => ({
  i: 0, id: 1, lg, s: "2026/27", d: 0, ko: null, h: 1, a: 2, fh, fa, hh, ha,
  shh: null, sha: null, soh: null, soa: null, coh: null, coa: null, yeh: null, yea: null, reh: null, rea: null,
  oh: null, od: null, oa: null, oo: null, ou: null, ch: null, cd: null, ca: null, co: null, cu: null, bh: null, bd: null, ba: null, gm,
});

describe("chi ha segnato", () => {
  const side = (x: Match) => goalTimes(x)!.map((g) => [g.side, g.score && g.score.join("-")]);
  it("squadra e marcatori dalla fonte; punteggio dopo ogni gol", () => {
    // Darmstadt–Heidenheim 3-1 (1° tempo 2-1), come arriva dalla fonte: 5' ospite, poi tre gol della casa
    const x = { ...m(3, 1, 2, 1, "5a,22h,27h,62h"), gb: "A|B|C|D" };
    const g = goalTimes(x)!;
    expect(g.map((y) => [y.min, y.side, y.score?.join("-"), y.by])).toEqual([[5, "a", "0-1", "A"], [22, "h", "1-1", "B"], [27, "h", "2-1", "C"], [62, "h", "3-1", "D"]]);
    expect(g.map((y) => y.half)).toEqual([1, 1, 1, 2]);
  });
  it("squadre della fonte che non tornano col risultato: non si usano", () => {
    expect(side(m(3, 1, 2, 1, "5h,22a,27a,62h"))).toEqual([[null, null], [null, null], [null, null], ["h", "3-1"]]);
  });
  it("senza squadra: ricavata solo dove ha segnato una sola squadra in quel tempo", () => {
    // 1° tempo 2-0 (entrambi casa), 2° tempo 1-1 (non si sa l'ordine)
    expect(side(m(3, 1, 2, 0, "10,30,50,70"))).toEqual([["h", "1-0"], ["h", "2-0"], [null, null], [null, null]]);
    // 1° tempo 1-1 (non si sa), 2° tempo solo ospite: il punteggio riparte dall'intervallo
    expect(side(m(1, 3, 1, 1, "10,30,50,70"))).toEqual([[null, null], [null, null], ["a", "1-2"], ["a", "1-3"]]);
    // senza risultato all'intervallo: certo solo se ha segnato una squadra sola
    expect(side(m(0, 2, null, null, "10,80"))).toEqual([["a", "0-1"], ["a", "0-2"]]);
    expect(side(m(1, 1, null, null, "10,80"))).toEqual([[null, null], [null, null]]);
  });
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
