import { describe, expect, it } from "vitest";
import type { Line, MovementType } from "../src/domain/types.ts";
import { monthKey } from "../src/domain/movement.ts";
import { addDays, dayNum, monthEndForecast, resampleCumulative, spendingPace } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, categoryId = "exp.groceries", merchant = "SUPER", type?: MovementType, msd = 1): Line {
  const id = "p" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: monthKey(date, msd), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: merchant, merchant, isSplit: false, unbalanced: false, deferredWallet: false,
  };
}
function daily(from: string, to: string, amount: number, msd = 1): Line[] {
  const out: Line[] = [];
  for (let z = dayNum(from); z <= dayNum(to); z++) out.push(mk(addDays("1970-01-01", z), -amount, "exp.groceries", "SUPER", undefined, msd));
  return out;
}

describe("spendingPace", () => {
  it("normalizza per la durata del mese e calcola l'anticipo al giorno di oggi", () => {
    const lines = [...daily("2026-01-01", "2026-01-31", 1), ...daily("2026-02-01", "2026-02-14", 2)];
    const p = spendingPace(lines, "2026-02", "2026-02-14");
    expect(p.days).toBe(28);
    expect(p.day).toBe(14);
    expect(p.current[13]).toBe(28);
    expect(p.current[14]).toBeNull();
    expect(p.previous![27]).toBe(31); // il mese precedente intero finisce all'ultimo giorno
    expect(p.previous![13]).toBe(15.5); // giorno 14 di 28 = giorno 15,5 di 31
    expect(p.vsPrevious).toMatchObject({ day: 14, current: 28, reference: 15.5, diff: 12.5, status: "ahead" });
    expect(p.averageMonths).toBe(1); // lo storico inizia a gennaio
    expect(p.average![27]).toBe(31);
  });

  it("in ritardo e in linea", () => {
    const lines = [...daily("2026-03-01", "2026-03-31", 10), ...daily("2026-04-01", "2026-04-10", 5)];
    expect(spendingPace(lines, "2026-04", "2026-04-10").vsPrevious!.status).toBe("behind");
    const same = [...daily("2026-03-01", "2026-03-31", 10), ...daily("2026-04-01", "2026-04-10", 10)];
    expect(spendingPace(same, "2026-04", "2026-04-10").vsPrevious!.status).toBe("inline");
  });

  it("mese passato, mese futuro e dati vuoti", () => {
    const lines = daily("2026-01-01", "2026-01-31", 1);
    const past = spendingPace(lines, "2026-01", "2026-03-01");
    expect(past.day).toBe(31);
    expect(past.current.every((v) => v !== null)).toBe(true);
    expect(past.previous).toBeNull();
    const fut = spendingPace(lines, "2026-02", "2026-01-15");
    expect(fut.day).toBe(0);
    expect(fut.vsPrevious).toBeNull();
    const empty = spendingPace([], "2026-02", "2026-02-10");
    expect(empty.current.slice(0, 10)).toEqual(new Array(10).fill(0));
    expect(empty.average).toBeNull();
  });

  it("mese contabile con monthStartDay = 27", () => {
    const lines = [...daily("2026-09-27", "2026-10-26", 1, 27), ...daily("2026-10-27", "2026-11-05", 3, 27)];
    const p = spendingPace(lines, "2026-11", "2026-11-05", { monthStartDay: 27 });
    expect(p.start).toBe("2026-10-27");
    expect(p.days).toBe(31);
    expect(p.day).toBe(10);
    expect(p.current[9]).toBe(30);
    expect(p.vsPrevious!.reference).toBeCloseTo(10 * 30 / 31, 2);
  });

  it("resampleCumulative conserva il totale", () => {
    expect(resampleCumulative([1, 2, 3], 6)).toEqual([0.5, 1, 1.5, 2, 2.5, 3]);
    expect(resampleCumulative([], 3)).toEqual([0, 0, 0]);
  });
});

describe("monthEndForecast", () => {
  const lines: Line[] = [];
  for (const m of ["06", "07", "08", "09", "10"]) {
    lines.push(mk(`2026-${m}-01`, -800, "exp.housing", "AFFITTO"), mk(`2026-${m}-20`, -15.99, "exp.leisure", "NETFLIX"),
      mk(`2026-${m}-27`, 2000, "inc.salary", "STIPENDIO"), mk(`2026-${m}-02`, -40, "exp.leisure", "PALESTRA"));
  }
  lines.push(...daily("2026-06-01", "2026-10-31", 10));
  lines.push(mk("2026-11-01", -800, "exp.housing", "AFFITTO"), ...daily("2026-11-01", "2026-11-10", 10));
  const today = "2026-11-10";

  it("ricorrenze in arrivo + ritmo della spesa variabile", () => {
    const f = monthEndForecast(lines, "2026-11", today);
    expect(f).toMatchObject({ daysTotal: 30, daysElapsed: 10, daysRemaining: 20 });
    expect(f.actual).toEqual({ income: 0, expense: 900, net: -900 });
    const active = f.pending.filter((p) => p.status === "active").map((p) => [p.label, p.date, p.amount]);
    expect(active).toEqual([["Netflix", "2026-11-20", -15.99], ["Stipendio", "2026-11-27", 2000]]);
    expect(f.pending.find((p) => p.label === "Palestra")).toMatchObject({ status: "late", amount: -40 });
    expect(f.variable).toMatchObject({ spent: 100, currentDailyRate: 10, historicalDailyRate: 10, dailyRate: 10, projectedRemaining: 200, historyMonths: 5 });
    expect(f.projected).toEqual({ income: 2000, expense: 1115.99, net: 884.01 });
    // La palestra in ritardo entra solo nella banda pessimistica delle uscite.
    expect(f.high.expense).toBe(1155.99);
    expect(f.low.expense).toBe(1115.99);
    expect(f.low.net).toBe(844.01);
    expect(f.high.net).toBe(884.01);
  });

  it("la banda si allarga con ritmi storici diversi", () => {
    const extra = [...lines, ...daily("2026-08-01", "2026-08-31", 10), ...daily("2026-09-01", "2026-09-30", 20)];
    const f = monthEndForecast(extra, "2026-11", today);
    expect(f.low.expense).toBeLessThanOrEqual(f.projected.expense);
    expect(f.high.expense).toBeGreaterThan(f.projected.expense);
    expect(f.low.net).toBeLessThan(f.projected.net);
  });

  it("mese chiuso: la previsione coincide con l'effettivo", () => {
    const f = monthEndForecast(lines, "2026-10", today);
    expect(f.daysRemaining).toBe(0);
    expect(f.pending).toEqual([]);
    expect(f.projected).toEqual(f.actual);
  });

  it("mese futuro: tutte le ricorrenze e il ritmo storico", () => {
    const f = monthEndForecast(lines, "2026-12", today);
    expect(f.daysElapsed).toBe(0);
    expect(f.pending.map((p) => p.label).sort()).toEqual(["Affitto", "Netflix", "Palestra", "Stipendio"]);
    expect(f.variable.projectedRemaining).toBe(310);
  });

  it("senza storico usa il ritmo del mese con una banda del ±20%", () => {
    const f = monthEndForecast(daily("2026-11-01", "2026-11-10", 10), "2026-11", today, []);
    expect(f.variable.historicalDailyRate).toBeNull();
    expect(f.projected.expense).toBe(300);
    expect(f.low.expense).toBe(260);
    expect(f.high.expense).toBe(340);
  });

  it("le spese eccezionali non gonfiano il ritmo", () => {
    const f = monthEndForecast([...lines, mk("2026-11-05", -1500, "exp.technology", "MEDIAWORLD")], "2026-11", today);
    expect(f.actual.expense).toBe(2400);
    expect(f.variable.dailyRate).toBe(10);
  });
});
