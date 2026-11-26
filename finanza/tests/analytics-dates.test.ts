import { describe, expect, it } from "vitest";
import { monthKey } from "../src/domain/movement.ts";
import {
  addDays, addMonths, addMonthsToDate, dayNum, daysBetween, fromDayNum, monthBounds, monthsBetween, weekdayOf,
  formatEUR, formatPct, formatSignedEUR, inMonth, ofMonth, displayName,
  mad, median, quantile, round2, resolvePeriod, previousPeriod,
} from "../src/analytics/index.ts";

const nb = (s: string) => s.replace(/ | /g, " ");

describe("date su numeri di giorno", () => {
  it("dayNum/fromDayNum coincidono con Date.UTC su 30 anni", () => {
    const start = Date.UTC(1999, 11, 25) / 86400000;
    for (let z = start; z < start + 11500; z++) {
      const iso = new Date(z * 86400000).toISOString().slice(0, 10);
      expect(dayNum(iso)).toBe(z);
      expect(fromDayNum(z)).toBe(iso);
    }
  });
  it("giorni della settimana con lunedì = 0", () => {
    expect(weekdayOf("2026-11-23")).toBe(0); // lunedì
    expect(weekdayOf("2026-11-26")).toBe(3); // giovedì
    expect(weekdayOf("2026-11-29")).toBe(6); // domenica
  });
  it("aritmetica di giorni e mesi", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -13)).toBe("2024-12");
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsToDate("2026-11-15", 12)).toBe("2027-11-15");
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("monthBounds è coerente con monthKey per ogni giorno e ogni monthStartDay", () => {
    for (const msd of [1, 15, 27, 29, 31]) {
      for (let z = dayNum("2023-12-01"); z <= dayNum("2025-02-28"); z++) {
        const d = fromDayNum(z);
        const b = monthBounds(monthKey(d, msd), msd);
        expect(d >= b.start && d <= b.end, `${d} msd=${msd} ${b.start}..${b.end}`).toBe(true);
      }
    }
    expect(monthBounds("2026-11", 27)).toMatchObject({ start: "2026-10-27", end: "2026-11-26", days: 31 });
    expect(monthBounds("2026-02")).toMatchObject({ start: "2026-02-01", end: "2026-02-28", days: 28 });
  });
  it("periodi: mese, intervallo e periodo precedente", () => {
    expect(resolvePeriod("2026-02")).toMatchObject({ month: "2026-02", from: "2026-02-01", to: "2026-02-28", days: 28 });
    expect(resolvePeriod({ from: "2026-03-01", to: "2026-03-10" }).days).toBe(10);
    expect(previousPeriod("2026-01")).toBe("2025-12");
    expect(previousPeriod({ from: "2026-03-11", to: "2026-03-20" })).toEqual({ from: "2026-03-01", to: "2026-03-10" });
  });
});

describe("formattazione italiana", () => {
  it("euro senza decimali da 100 € e con separatore delle migliaia", () => {
    expect(nb(formatEUR(312))).toBe("312 €");
    expect(nb(formatEUR(41.5))).toBe("41,50 €");
    expect(nb(formatEUR(1234))).toBe("1.234 €");
    expect(nb(formatEUR(12345.67))).toBe("12.346 €");
    expect(nb(formatEUR(-41.5))).toBe("-41,50 €");
    expect(nb(formatSignedEUR(850))).toBe("+850 €");
    expect(nb(formatSignedEUR(-120))).toBe("−120 €");
  });
  it("percentuali e mesi", () => {
    expect(formatPct(0.384, true)).toBe("+38%");
    expect(formatPct(-0.22, true)).toBe("−22%");
    expect(formatPct(0.2)).toBe("20%");
    expect(inMonth("2026-11", "2026")).toBe("a novembre");
    expect(inMonth("2026-04", "2026")).toBe("ad aprile");
    expect(inMonth("2026-08", "2026")).toBe("ad agosto");
    expect(inMonth("2025-12", "2026")).toBe("a dicembre 2025");
    expect(ofMonth("2026-10", "2026")).toBe("di ottobre");
    expect(displayName("NETFLIX COM")).toBe("Netflix Com");
  });
});

describe("statistiche robuste", () => {
  it("mediana, quantili, MAD", () => {
    expect(median([])).toBeNaN();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(mad([1, 1, 2, 2, 4, 6, 9])).toBe(1);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
  });
});
