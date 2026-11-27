import { describe, expect, it } from "vitest";
import { num, parseBankAmount, parseItalianFormattedAmount, parseSellaAmountCell } from "../src/import/amounts.ts";
import { dateOnly } from "../src/import/dates.ts";
import { parseCsv, parseDelimited } from "../src/import/csv.ts";

describe("num", () => {
  it("legge formati italiani e inglesi", () => {
    expect(num("1.234,56")).toBe(1234.56);
    expect(num("12,5")).toBe(12.5);
    expect(num("-12.50")).toBe(-12.5);
    expect(num("1.000")).toBe(1000);
    expect(num("€ 7,00")).toBe(7);
    expect(num("(3,50)")).toBe(-3.5);
    expect(num(42)).toBe(42);
  });
  it("restituisce 0 per testo non numerico (come la v3.10)", () => {
    expect(num("abc")).toBe(0);
    expect(num("")).toBe(0);
    expect(num(null)).toBe(0);
  });
});

describe("parseBankAmount", () => {
  it("numeri finiti passano senza anomalie", () => {
    expect(parseBankAmount(-12.5)).toEqual({ value: -12.5, issue: "" });
  });
  it("vuoto e non numerico producono un'anomalia e valore 0", () => {
    expect(parseBankAmount("")).toEqual({ value: 0, issue: "Importo mancante" });
    expect(parseBankAmount(undefined)).toEqual({ value: 0, issue: "Importo mancante" });
    expect(parseBankAmount("dieci")).toEqual({ value: 0, issue: "Importo non numerico: dieci" });
    expect(parseBankAmount(NaN)).toEqual({ value: 0, issue: "Importo non numerico: NaN" });
  });
  it("separatori delle migliaia italiani", () => {
    expect(parseBankAmount("1.234,56")).toEqual({ value: 1234.56, issue: "" });
    expect(parseBankAmount("-1.234,56")).toEqual({ value: -1234.56, issue: "" });
    expect(parseBankAmount("1.000")).toEqual({ value: 1000, issue: "" });
    expect(parseBankAmount("-12.50")).toEqual({ value: -12.5, issue: "" });
  });
  it("parentesi con migliaia: correzione della v3.10 (valore positivo) mantenuta per la firma", () => {
    expect(parseBankAmount("(1.234,56)")).toEqual({ value: 1234.56, issue: "Correzione separatore migliaia: (1.234,56)" });
    expect(parseBankAmount("(12,50)")).toEqual({ value: -12.5, issue: "" });
  });
});

describe("parseItalianFormattedAmount", () => {
  it("punto migliaia, virgola decimali, NaN se illeggibile", () => {
    expect(parseItalianFormattedAmount("1.234,56")).toBe(1234.56);
    expect(parseItalianFormattedAmount("-1.000")).toBe(-1000);
    expect(parseItalianFormattedAmount("1.5")).toBe(1.5);
    expect(parseItalianFormattedAmount("(2,00)")).toBe(-2);
    expect(parseItalianFormattedAmount("")).toBeNaN();
    expect(parseItalianFormattedAmount("x")).toBeNaN();
  });
});

describe("parseSellaAmountCell", () => {
  it("valore e testo uguali", () => {
    expect(parseSellaAmountCell({ v: -12.5, w: "-12,50" })).toMatchObject({ value: -12.5, issue: "" });
  });
  it("fattore 1000 tra .v e .w: sceglie il valore maggiore", () => {
    expect(parseSellaAmountCell({ v: 1, w: "1.000,00" })).toMatchObject({ value: 1000, issue: "Disallineamento XLS corretto automaticamente" });
    expect(parseSellaAmountCell({ v: -1.4, w: "-1.400,00" })).toMatchObject({ value: -1400, issue: "Disallineamento XLS corretto automaticamente" });
    expect(parseSellaAmountCell({ v: 2000, w: "2,00" })).toMatchObject({ value: 2000, issue: "Disallineamento XLS corretto automaticamente" });
  });
  it("altre differenze: vince il testo visualizzato", () => {
    expect(parseSellaAmountCell({ v: 7, w: "8,00" })).toMatchObject({ value: 8, issue: "Valore XLS verificato sul formato visualizzato" });
  });
  it("solo testo, solo numero, illeggibile, cella mancante", () => {
    expect(parseSellaAmountCell({ v: "3,40" })).toMatchObject({ value: 3.4, issue: "" });
    expect(parseSellaAmountCell({ v: 5, w: "" })).toMatchObject({ value: 5, issue: "" });
    expect(parseSellaAmountCell({ v: "abc", w: "abc" })).toMatchObject({ value: 0, issue: "Importo Sella non leggibile" });
    expect(parseSellaAmountCell(undefined)).toMatchObject({ value: 0, issue: "Cella importo mancante" });
  });
});

describe("dateOnly", () => {
  it("ISO, GG/MM/AAAA e data con ora", () => {
    expect(dateOnly("2026-03-04 10:11:12")).toBe("2026-03-04");
    expect(dateOnly("2026-03-04T10:11:12Z")).toBe("2026-03-04");
    expect(dateOnly("4/3/2026")).toBe("2026-03-04");
    expect(dateOnly("04/03/2026 10:30")).toBe("2026-03-04");
  });
  it("seriali Excel (1899-12-30 = 0) anche con la parte oraria", () => {
    expect(dateOnly(46026)).toBe("2026-01-04");
    expect(dateOnly(46026.75)).toBe("2026-01-04");
    expect(dateOnly(45658)).toBe("2025-01-01");
  });
  it("oggetti Date: giorno locale", () => {
    expect(dateOnly(new Date(2026, 0, 31, 23, 30))).toBe("2026-01-31");
  });
  it("vuoti e formati sconosciuti come la v3.10", () => {
    expect(dateOnly("")).toBe("");
    expect(dateOnly(null)).toBe("");
    expect(dateOnly(undefined)).toBe("");
    expect(dateOnly(5)).toBe("5");
    expect(dateOnly("31.01.2026")).toBe("31.01.2026");
  });
});

describe("parseDelimited / parseCsv", () => {
  it("virgolette, virgolette doppie, CRLF e ultima riga senza a capo", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n1,2')).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["1", "2"]]);
  });
  it("punto e virgola per Tinaba; la virgola resta nel campo", () => {
    expect(parseDelimited("Data;Importo\n01/01/2026;1.234,56\n", ";")).toEqual([["Data", "Importo"], ["01/01/2026", "1.234,56"]]);
  });
  it("righe vuote restano righe con una cella vuota", () => {
    expect(parseCsv("a\n\nb")).toEqual([["a"], [""], ["b"]]);
    expect(parseCsv("")).toEqual([]);
  });
});
