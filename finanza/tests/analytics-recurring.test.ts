import { describe, expect, it } from "vitest";
import type { Line, MovementType } from "../src/domain/types.ts";
import { addDays, addMonthsToDate, detectRecurring, type RecurringItem } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, merchant: string, categoryId = "exp.leisure", type?: MovementType, extra: Partial<Line> = {}): Line {
  const id = "r" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: merchant, merchant, isSplit: false, unbalanced: false, deferredWallet: false, ...extra,
  };
}
/** Addebiti mensili dallo stesso giorno di `first`, uno per importo. */
const monthly = (first: string, amounts: number[], merchant: string, cat?: string) =>
  amounts.map((a, i) => mk(addMonthsToDate(first, i), a, merchant, cat));
const find = (items: RecurringItem[], merchant: string) => items.find((i) => i.merchant === merchant);

describe("detectRecurring", () => {
  it("dati vuoti", () => {
    expect(detectRecurring([], "2026-11-10")).toEqual([]);
  });

  it("abbonamento mensile attivo", () => {
    const items = detectRecurring(monthly("2026-01-15", new Array(10).fill(-12.99), "NETFLIX"), "2026-11-10");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      label: "Netflix", direction: "out", kind: "subscription", cadence: "monthly", status: "active", count: 10,
      nextExpected: "2026-11-15", expectedAmount: 12.99, annualized: 155.88, monthly: 12.99, priceChange: null, variable: false,
      amount: { median: 12.99, min: 12.99, max: 12.99, last: 12.99 },
    });
    expect(items[0].confidence).toBeGreaterThan(0.9);
  });

  it("rileva un aumento di prezzo oltre il 5%", () => {
    const lines = monthly("2026-01-05", [-9.99, -9.99, -9.99, -9.99, -9.99, -9.99, -9.99, -11.99, -11.99, -11.99], "SPOTIFY");
    const s = detectRecurring(lines, "2026-11-01")[0];
    expect(s.priceChange).toMatchObject({ from: 9.99, to: 11.99, since: "2026-08-05" });
    expect(s.priceChange!.pct).toBeCloseTo(0.2, 2);
    expect(s.expectedAmount).toBe(11.99);
    // Variazioni minime (cambio valuta) non sono un aumento.
    const fx = monthly("2026-01-05", [-10.37, -10.52, -10.21, -10.4, -10.45], "OPENAI");
    expect(detectRecurring(fx, "2026-06-01")[0].priceChange).toBeNull();
  });

  it("in ritardo e terminato", () => {
    const lines = [
      ...monthly("2026-03-02", new Array(7).fill(-40), "PALESTRA"), // ultimo 2026-09-02 -> atteso 2026-10-02
      ...monthly("2026-01-03", new Array(5).fill(-8.99), "DISNEY"), // ultimo 2026-05-03
    ];
    const items = detectRecurring(lines, "2026-10-12");
    expect(find(items, "PALESTRA")).toMatchObject({ status: "late", nextExpected: "2026-10-02", daysOverdue: 10 });
    expect(find(items, "DISNEY")).toMatchObject({ status: "ended" });
    expect(items[items.length - 1].merchant).toBe("DISNEY"); // i terminati in fondo
  });

  it("annuale con due sole occorrenze solo se la data coincide quasi", () => {
    const lines = [
      mk("2025-03-14", -49.9, "AMAZON PRIME"), mk("2026-03-16", -49.9, "AMAZON PRIME"),
      mk("2025-01-10", -300, "ASSICURA", "exp.vehicle"), mk("2025-12-01", -300, "ASSICURA", "exp.vehicle"),
    ];
    const items = detectRecurring(lines, "2026-11-10");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ merchant: "AMAZON PRIME", cadence: "yearly", count: 2, nextExpected: "2027-03-16", annualized: 49.9, monthly: 4.16, status: "active" });
  });

  it("non scambia la spesa al supermercato per un abbonamento", () => {
    const amounts = [23.4, 67.1, 41.8, 88.2, 35.5, 52.9, 19.7, 74.3, 46.1, 61.2, 28.8, 95.4];
    const weekly = amounts.map((a, i) => mk(addDays("2026-08-01", 7 * i), -a, "CONAD", "exp.groceries")); // ogni sabato
    const gaps = [2, 5, 3, 9, 1, 4, 6, 2, 8, 3];
    let d = "2026-08-01";
    const irregular = gaps.map((g) => { d = addDays(d, g); return mk(d, -(30 + (g % 3)), "ESSELUNGA", "exp.groceries"); });
    // Anche importi identici una volta al mese non bastano con poche occorrenze nella spesa quotidiana.
    const few = monthly("2026-07-10", [-30, -30, -30], "LIDL", "exp.groceries");
    expect(detectRecurring([...weekly, ...irregular, ...few], "2026-11-01")).toEqual([]);
  });

  it("settimanale, trimestrale e fine mese", () => {
    const lines = [
      ...[0, 1, 2, 3, 4, 5].map((i) => mk(addDays("2026-09-01", 7 * i), -25, "LEZIONE INGLESE", "exp.education")),
      ...monthly("2025-11-20", [-60, 0, 0, -60, 0, 0, -60, 0, 0, -60].map((x) => x || NaN), "CANONE").filter((l) => !Number.isNaN(l.amount)),
      ...monthly("2026-05-31", new Array(6).fill(-5), "ICLOUD"),
    ];
    const items = detectRecurring(lines, "2026-10-08");
    expect(find(items, "LEZIONE INGLESE")).toMatchObject({ cadence: "weekly", nextExpected: "2026-10-13", status: "active" });
    expect(find(items, "LEZIONE INGLESE")!.annualized).toBeCloseTo(25 * 52.18, 0);
    expect(find(items, "CANONE")).toMatchObject({ cadence: "quarterly", count: 4, nextExpected: "2026-11-20", annualized: 240 });
    // 31/05, 30/06, 31/07, 31/08, 30/09: il giorno di riferimento resta il 31 (troncato a fine mese).
    expect(find(items, "ICLOUD")).toMatchObject({ cadence: "monthly", last: "2026-09-30", nextExpected: "2026-10-31" });
    expect(find(detectRecurring(lines, "2026-11-05"), "ICLOUD")).toMatchObject({ last: "2026-10-31", nextExpected: "2026-11-30" });
  });

  it("bolletta bimestrale a importo variabile", () => {
    const amounts = [-85, -120, -95, -140, -70, -110];
    const lines = amounts.map((a, i) => mk(addMonthsToDate("2025-12-12", 2 * i), a, "ENEL ENERGIA", "exp.utilities"));
    const b = detectRecurring(lines, "2026-11-01")[0];
    expect(b).toMatchObject({ kind: "bill", cadence: "bimonthly", variable: true, priceChange: null, nextExpected: "2026-12-12" });
    expect(b.expectedAmount).toBe(102.5);
    // Gli stessi importi in una categoria non da bolletta non sono un abbonamento.
    const leisure = amounts.map((a, i) => mk(addMonthsToDate("2025-12-12", 2 * i), a, "CINEMA", "exp.leisure"));
    expect(detectRecurring(leisure, "2026-11-01")).toEqual([]);
  });

  it("stipendio con tredicesima", () => {
    const amounts = [1850, 1870, 1850, 1850, 1865, 1850, 3700, 1850, 1850, 1880];
    const lines = amounts.map((a, i) => mk(addMonthsToDate("2026-01-27", i).replace(/-27$/, i === 6 ? "-24" : "-27"), a, "STIPENDIO ACME", "inc.salary"));
    const s = detectRecurring(lines, "2026-11-05")[0];
    expect(s).toMatchObject({ kind: "income", direction: "in", cadence: "monthly", priceChange: null, status: "active" });
    expect(s.expectedAmount).toBeCloseTo(1857.5, 1);
  });

  it("separa un abbonamento dagli acquisti sporadici dello stesso esercente", () => {
    const sub = monthly("2026-02-08", new Array(8).fill(-4.99), "AMAZON");
    const random = [["2026-02-19", 23.5], ["2026-03-02", 120], ["2026-04-27", 56.7], ["2026-05-03", 15], ["2026-07-14", 89], ["2026-08-30", 34]]
      .map(([d, a]) => mk(d as string, -(a as number), "AMAZON", "exp.other"));
    const items = detectRecurring([...sub, ...random], "2026-10-01");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ merchant: "AMAZON", count: 8, expectedAmount: 4.99, cadence: "monthly" });
    expect(items[0].id).toBe("AMAZON|-|5");
  });

  it("le quote dello stesso movimento sono un solo addebito", () => {
    const lines: Line[] = [];
    for (let i = 0; i < 5; i++) {
      const date = addMonthsToDate("2026-04-07", i);
      lines.push(mk(date, -20, "TIM", "exp.utilities", "expense", { parentId: "TIM" + i, isSplit: true }),
        mk(date, -9.9, "TIM", "exp.leisure", "expense", { parentId: "TIM" + i, isSplit: true }));
    }
    const t = detectRecurring(lines, "2026-09-01")[0];
    expect(t).toMatchObject({ count: 5, expectedAmount: 29.9, categoryId: "exp.utilities", kind: "bill" });
    expect(t.lineIds).toHaveLength(10);
  });

  it("ignora le righe future, i giroconti e le righe non economiche", () => {
    const lines = [
      ...monthly("2026-01-10", new Array(6).fill(-500), "GIRO RISPARMI").map((l) => ({ ...l, type: "transfer_out" as const })),
      ...monthly("2026-09-10", new Array(6).fill(-7), "FUTURO"),
    ];
    expect(detectRecurring(lines, "2026-10-15")).toEqual([]);
  });
});
