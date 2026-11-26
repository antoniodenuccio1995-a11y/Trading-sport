// Importatori Excel con workbook sintetici creati con SheetJS.
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBankFile, type ParsedRow, type XLSXLike } from "../src/import/index.ts";
import { signature } from "../src/domain/movement.ts";

const OWNER = ["Mario Rossi"];
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

function workbookFile(name: string, aoa: unknown[][], bookType: XLSX.BookType) {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimenti");
  const buf = XLSX.write(wb, { bookType, type: "array" }) as ArrayBuffer;
  return { name, text: async () => "", arrayBuffer: async () => buf };
}
const byDesc = (rows: ParsedRow[], desc: string) => {
  const r = rows.find((x) => x.description === desc);
  if (!r) throw new Error("riga non trovata: " + desc);
  return r;
};

describe("Banca Sella (.xls)", () => {
  const head = ["Codice identificativo", "Data operazione", "Data valuta", "Descrizione", "Importo", "Divisa", "Categoria", "Sottocategoria"];
  const aoa: unknown[][] = [
    ["Lista movimenti"],
    ["Conto TEST"],
    head,
    ["ID001", d(2026, 1, 5), d(2026, 1, 6), "PAGAMENTO POS NEGOZIO TEST", -25.5, "EUR", "Spese", "Negozi"],
    ["ID002", d(2026, 1, 7), d(2026, 1, 7), "RICARICA REVOLUT", -100, "EUR", "Trasferimenti", "Ricarica"],
    ["ID003", d(2026, 1, 8), d(2026, 1, 8), "GIROCONTO TR PUB TEST", -200, "EUR", "Trasferimenti", "Giroconto"],
    ["ID004", d(2026, 1, 9), d(2026, 1, 9), "RICARICA A ROSSI MARIO", -30, "EUR", "Trasferimenti", "Ricarica"],
    ["", d(2026, 1, 10), d(2026, 1, 10), "SALDO AL 09/01/2026", 0, "EUR", "", ""],
    [],
    ["ID005", d(2026, 1, 11), d(2026, 1, 11), "ADDEBITO WIND TRE TEST", -15, "EUR", "Utenze", "Telefono"],
    ["", d(2026, 1, 12), d(2026, 1, 12), "PRELIEVO BANCOMAT TEST", -20, "EUR", "", ""],
    ["", d(2026, 1, 12), d(2026, 1, 12), "PRELIEVO BANCOMAT TEST", -20, "EUR", "", ""],
  ];

  it("righe, date, id, tipi e righe SALDO escluse", async () => {
    const res = await parseBankFile(workbookFile("lista_movimenti.xls", aoa, "biff8"), { xlsx: XLSX, ownerNames: OWNER });
    expect(res.account).toBe("Banca Sella");
    expect(res.skipped).toBe(1);
    expect(res.rows).toHaveLength(7);
    const pos = byDesc(res.rows, "PAGAMENTO POS NEGOZIO TEST");
    expect(pos).toMatchObject({ externalId: "ID001", date: "2026-01-05", valueDate: "2026-01-06", dateTime: "", amount: -25.5, currency: "EUR", sourceCategory: "Spese", sourceType: "Negozi", type: "", ruleStatus: "", inputIssue: "" });
    expect(pos.raw).toMatchObject({ __IMPORTO_CELL_V: -25.5, Descrizione: "PAGAMENTO POS NEGOZIO TEST" });
    expect(byDesc(res.rows, "RICARICA REVOLUT")).toMatchObject({ type: "transfer_out", counterparty: "Revolut", ruleStatus: "import" });
    expect(byDesc(res.rows, "GIROCONTO TR PUB TEST")).toMatchObject({ type: "transfer_out", counterparty: "Trade Republic" });
    expect(byDesc(res.rows, "RICARICA A ROSSI MARIO")).toMatchObject({ type: "transfer_out", counterparty: "", ruleStatus: "candidate" });
    expect(byDesc(res.rows, "ADDEBITO WIND TRE TEST")).toMatchObject({ type: "expense", categoryId: "exp.utilities" });
    expect(res.notes.join(" ")).toContain('1 righe "SALDO AL" ignorate');
  });

  it("righe identiche senza codice restano entrambe con la stessa firma", async () => {
    const res = await parseBankFile(workbookFile("lista_movimenti.xls", aoa, "biff8"), { xlsx: XLSX, ownerNames: OWNER });
    const atm = res.rows.filter((r) => r.description === "PRELIEVO BANCOMAT TEST");
    expect(atm).toHaveLength(2);
    expect(signature(atm[0])).toBe(signature(atm[1]));
  });

  it("anche come .xlsx; senza nomi del titolare la ricarica non è giroconto", async () => {
    const res = await parseBankFile(workbookFile("lista.xlsx", aoa, "xlsx"), { xlsx: XLSX, ownerNames: [] });
    expect(byDesc(res.rows, "RICARICA A ROSSI MARIO")).toMatchObject({ type: "", ruleStatus: "" });
    expect(byDesc(res.rows, "RICARICA REVOLUT")).toMatchObject({ type: "transfer_out" });
  });

  it("vecchio .xls: valore della cella e testo visualizzato in disaccordo (separatore migliaia)", async () => {
    // Workbook in memoria con celle .v/.w incoerenti, come le legge SheetJS dal vecchio export.
    const ws = XLSX.utils.aoa_to_sheet([
      head,
      ["A1", "05/01/2026", "05/01/2026", "STIPENDIO TEST", 1, "EUR", "", ""],
      ["A2", "06/01/2026", "06/01/2026", "AFFITTO TEST", -1.4, "EUR", "", ""],
      ["A3", "07/01/2026", "07/01/2026", "NEGOZIO TEST", 12.5, "EUR", "", ""],
      ["A4", "08/01/2026", "08/01/2026", "VALORE DIVERSO", 7, "EUR", "", ""],
      ["A5", "09/01/2026", "09/01/2026", "ILLEGGIBILE", "n.d.", "EUR", "", ""],
    ]);
    ws["E2"] = { t: "n", v: 1, w: "1.000,00", z: "#,##0.00" };
    ws["E3"] = { t: "n", v: -1.4, w: "-1.400,00", z: "#,##0.00" };
    ws["E4"] = { t: "n", v: 12.5, w: "12,50", z: "#,##0.00" };
    ws["E5"] = { t: "n", v: 7, w: "8,00", z: "#,##0.00" };
    ws["E6"] = { t: "s", v: "n.d.", w: "n.d." };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    const stub = { ...XLSX, read: () => wb } as XLSXLike;
    const file = { name: "vecchio.xls", text: async () => "", arrayBuffer: async () => new ArrayBuffer(8) };

    const res = await parseBankFile(file, { xlsx: stub, ownerNames: [] });
    expect(res.rows.map((r) => r.amount)).toEqual([1000, -1400, 12.5, 8, 0]);
    expect(byDesc(res.rows, "STIPENDIO TEST")).toMatchObject({ date: "2026-01-05", inputIssue: "" });
    expect(byDesc(res.rows, "STIPENDIO TEST").raw).toMatchObject({ __IMPORTO_CELL_V: 1, __IMPORTO_CELL_W: "1.000,00", __IMPORTO_CELL_Z: "#,##0.00" });
    expect(byDesc(res.rows, "ILLEGGIBILE").inputIssue).toBe("Importo Sella non leggibile");
    const notes = res.notes.join(" ");
    expect(notes).toContain("correzioni XLS automatiche 2");
    expect(notes).toContain("importi non leggibili 1");
    expect(notes).toContain("1 importi presi dal testo visualizzato");
    expect(notes).toContain("ATTENZIONE: 1 importi Sella non leggibili");
  });
});

describe("Poste Italiane (.xlsx)", () => {
  const aoa: unknown[][] = [
    ["Lista Movimenti"],
    [],
    ["Data Contabile", "Data Valuta", "Importo (euro)", "Descrizione operazioni"],
    [d(2026, 1, 3), d(2026, 1, 2), -50, "PRELIEVO CONTANTI ATM UFFICIO TEST"],
    [d(2026, 1, 4), d(2026, 1, 4), -10, "PAGAMENTO POS NEGOZIO TEST"],
    ["", "", 5, "RIGA SENZA DATA"],
    [d(2026, 1, 5), "", "1.234,56", "ACCREDITO TEST"],
  ];

  it("date (valuta → data, contabile → valueDate), prelievi ATM verso Cassa, righe senza data", async () => {
    const res = await parseBankFile(workbookFile("poste.xlsx", aoa, "xlsx"), { xlsx: XLSX, ownerNames: OWNER });
    expect(res.account).toBe("Poste Italiane");
    expect(res.rows).toHaveLength(3);
    expect(res.skipped).toBe(1);
    const atm = byDesc(res.rows, "PRELIEVO CONTANTI ATM UFFICIO TEST");
    expect(atm).toMatchObject({ date: "2026-01-02", valueDate: "2026-01-03", amount: -50, type: "transfer_out", counterparty: "Cassa", ruleStatus: "import", externalId: "" });
    expect(atm.raw).toMatchObject({ __POSTE_DATA_VALUTA: "2026-01-02", __POSTE_DATA_CONTABILE: "2026-01-03" });
    expect(byDesc(res.rows, "PAGAMENTO POS NEGOZIO TEST")).toMatchObject({ type: "", ruleStatus: "" });
    expect(byDesc(res.rows, "ACCREDITO TEST")).toMatchObject({ date: "2026-01-05", valueDate: "2026-01-05", amount: 1234.56 });
    expect(res.notes[0]).toContain("prelievi ATM riconosciuti 1");
  });
});

describe("Easy Bank (.xlsx)", () => {
  const head = ["Data", "Contabilizzazione", "Operazione", "Dettagli", "Conto o carta", "Categoria", "Valuta", "Importo"];
  const aoa: unknown[][] = [
    ["Movimenti conto"],
    head,
    [d(2026, 1, 5), d(2026, 1, 5), "Bonifico in entrata", "Bonifico da MARIO ROSSI GIROCONTO BIC HYEEIT22 COD. DISP. ABC123", "Conto TEST", "Entrate", "EUR", 200],
    [d(2026, 1, 6), d(2026, 1, 6), "Costo carta", "Canone mensile", "Carta TEST", "Spese bancarie", "EUR", -2],
    [d(2026, 1, 7), d(2026, 1, 7), "Pagamento BETFAIR", "Carta", "Carta TEST", "Svago", "EUR", -10],
    [d(2026, 1, 8), d(2026, 1, 8), "Pagamento NEGOZIO TEST", "Carta", "Carta TEST", "Shopping", "EUR", -20],
    [d(2026, 1, 8), d(2026, 1, 8), "Pagamento NEGOZIO TEST", "Carta", "Carta TEST", "Shopping", "EUR", -20],
    [d(2025, 12, 30), d(2025, 12, 30), "Accredito TEST", "Rimborso", "Conto TEST", "Entrate", "EUR", 15],
  ];

  it("giroconto da Hype, costi carta, scommesse (wallet), classificazione base, ID con occorrenza", async () => {
    const res = await parseBankFile(workbookFile("easy.xlsx", aoa, "xlsx"), { xlsx: XLSX, ownerNames: OWNER });
    expect(res.account).toBe("Easy Bank");
    expect(res.rows).toHaveLength(6);
    expect(res.skipped).toBe(0);
    expect(byDesc(res.rows, "Bonifico in entrata")).toMatchObject({ externalId: "EASY-ABC123", type: "transfer_in", counterparty: "Hype", date: "2026-01-05", sourceType: "Entrate" });
    expect(byDesc(res.rows, "Costo carta")).toMatchObject({ type: "expense", categoryId: "exp.financial_services", counterparty: "Easy Bank" });
    expect(byDesc(res.rows, "Pagamento BETFAIR")).toMatchObject({ type: "expense", categoryId: "", counterparty: "Betfair", deferredWallet: true });
    const shop = res.rows.filter((r) => r.description === "Pagamento NEGOZIO TEST");
    expect(shop).toHaveLength(2);
    expect(shop[0]).toMatchObject({ type: "expense", categoryId: "", ruleStatus: "import" });
    expect(shop[0].externalId).not.toBe(shop[1].externalId);
    expect(shop.map((r) => r.raw.__EASY_OCCURRENCE)).toEqual([1, 2]);
    expect(byDesc(res.rows, "Accredito TEST")).toMatchObject({ date: "2025-12-30", type: "income" });
    expect(res.notes[0]).toContain("giroconti 1 · scommesse 1 · costi carta 1");
  });

  it("senza nomi del titolare il bonifico resta un'entrata", async () => {
    const res = await parseBankFile(workbookFile("easy.xlsx", aoa, "xlsx"), { xlsx: XLSX, ownerNames: [] });
    expect(byDesc(res.rows, "Bonifico in entrata")).toMatchObject({ type: "income", counterparty: "" });
  });
});

describe("riconoscimento del file", () => {
  const csvFile = (name: string, content: string) => {
    const b = new TextEncoder().encode(content);
    return { name, text: async () => content, arrayBuffer: async () => b.slice().buffer as ArrayBuffer };
  };

  it("CSV sconosciuto, vuoto, estensione non supportata", async () => {
    await expect(parseBankFile(csvFile("x.csv", "colonna1,colonna2\n1,2"), { ownerNames: [] })).rejects.toThrow(/CSV non riconosciuto/);
    await expect(parseBankFile(csvFile("x.csv", ""), { ownerNames: [] })).rejects.toThrow("CSV vuoto");
    await expect(parseBankFile(csvFile("x.pdf", "x"), { ownerNames: [] })).rejects.toThrow(/Formato non supportato/);
  });

  it("Excel senza libreria XLSX o con intestazioni sconosciute", async () => {
    const f = workbookFile("x.xlsx", [["A", "B"], [1, 2]], "xlsx");
    await expect(parseBankFile(f, { ownerNames: [] })).rejects.toThrow(/libreria XLSX/);
    await expect(parseBankFile(f, { xlsx: XLSX, ownerNames: [] })).rejects.toThrow(/File Excel non riconosciuto/);
  });

  it("estensione in maiuscolo e intestazioni con accenti/maiuscole diverse", async () => {
    const csv = "TIPO,Data di inizio,Data di completamento,Descrizione,Importo,Valuta,State\nPagamento,2026-02-01 10:00:00,,NEGOZIO TEST,-1.00,EUR,COMPLETATO";
    const res = await parseBankFile(csvFile("ESTRATTO.CSV", csv), { ownerNames: [] });
    expect(res.account).toBe("Revolut");
    expect(res.rows[0]).toMatchObject({ date: "2026-02-01", type: "expense" });
  });

  it("Excel: Easy Bank e Poste prima di Sella", async () => {
    const easy = workbookFile("x.xlsx", [["Data", "Contabilizzazione", "Operazione", "Dettagli", "Conto o carta", "Categoria", "Valuta", "Importo"]], "xlsx");
    expect((await parseBankFile(easy, { xlsx: XLSX, ownerNames: [] })).account).toBe("Easy Bank");
    const poste = workbookFile("x.xlsx", [["Data Contabile", "Data Valuta", "Importo (euro)", "Descrizione"]], "xlsx");
    expect((await parseBankFile(poste, { xlsx: XLSX, ownerNames: [] })).account).toBe("Poste Italiane");
  });
});
