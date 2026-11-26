// Importatori CSV con dati sintetici (titolare fittizio "MARIO ROSSI").
import { describe, expect, it } from "vitest";
import { parseBankFile, type ParsedRow } from "../src/import/index.ts";
import { signature } from "../src/domain/movement.ts";

const OWNER = ["Mario Rossi"];

function fileOf(name: string, content: string) {
  const bytes = new TextEncoder().encode(content);
  return { name, text: async () => content, arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer };
}

// Firma calcolata come la sig() della v3.10, indipendente da movement.ts.
const v310norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
function v310fnv(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
const v310sig = (m: { source: string; externalId?: string; dateTime?: string; date: string; descriptionRaw: string; amount: number; currency?: string }) =>
  v310fnv([m.source, m.externalId || "", m.dateTime || m.date, m.descriptionRaw, Number(m.amount).toFixed(2), m.currency || "EUR"].map(v310norm).join("|"));

const byDesc = (rows: ParsedRow[], d: string) => {
  const r = rows.find((x) => x.description === d);
  if (!r) throw new Error("riga non trovata: " + d);
  return r;
};

describe("Revolut", () => {
  const csv = [
    "Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo",
    "Pagamento con carta,Attuale,2026-01-15 10:30:00,2026-01-16 08:00:00,NEGOZIO TEST,-12.50,0.00,EUR,COMPLETATO,87.50",
    "Ricarica,Attuale,2026-01-14 09:00:00,2026-01-14 09:00:01,Pagamento da MARIO ROSSI,50.00,0.00,EUR,COMPLETATO,100.00",
    "Ricarica,Attuale,2026-01-14 11:00:00,2026-01-14 11:00:01,Pagamento da LUIGI BIANCHI,20.00,0.00,EUR,COMPLETATO,120.00",
    "Rimborso su carta,Attuale,2026-01-17 12:00:00,2026-01-17 12:00:00,NEGOZIO TEST,5.00,0.00,EUR,COMPLETATO,92.50",
    "Pagamento con carta,Attuale,2026-01-18 12:00:00,,NEGOZIO ANNULLATO,-3.00,0.00,EUR,OPERAZIONE ANNULLATA,92.50",
    "Pagamento con carta,Attuale,2026-01-19 12:00:00,2026-01-19 12:00:00,NETFLIX.COM,-9.99,0.00,EUR,COMPLETATO,82.51",
    "Pagamento con carta,Attuale,2026-01-20 12:00:00,2026-01-20 12:00:00,BETFAIR,-10.00,0.00,EUR,COMPLETATO,72.51",
    "Pagamento con carta,Attuale,2026-01-21 08:00:00,2026-01-21 08:00:00,BAR TEST,-1.20,0.00,EUR,COMPLETATO,71.31",
    "Pagamento con carta,Attuale,2026-01-21 08:00:00,2026-01-21 08:00:00,BAR TEST,-1.20,0.00,EUR,COMPLETATO,70.11",
    "",
  ].join("\n");

  it("righe, segni, date, tipi e annullate", async () => {
    const res = await parseBankFile(fileOf("revolut.csv", "﻿" + csv), { ownerNames: OWNER });
    expect(res.account).toBe("Revolut");
    expect(res.file).toBe("revolut.csv");
    expect(res.skipped).toBe(1);
    expect(res.rows).toHaveLength(8);
    expect(res.notes.join(" ")).toContain("operazioni annullate ignorate 1");

    const card = byDesc(res.rows, "NEGOZIO TEST");
    expect(card).toMatchObject({ account: "Revolut", date: "2026-01-16", dateTime: "2026-01-15 10:30:00", amount: -12.5, currency: "EUR", sourceType: "Pagamento con carta", externalId: "", type: "expense", ruleStatus: "import", inputIssue: "" });
    expect(card.raw).toMatchObject({ "TIPO": "Pagamento con carta", "IMPORTO": "-12.50", "STATE": "COMPLETATO" });

    expect(byDesc(res.rows, "Pagamento da MARIO ROSSI")).toMatchObject({ amount: 50, type: "transfer_in", ruleStatus: "candidate", counterparty: "" });
    expect(byDesc(res.rows, "Pagamento da LUIGI BIANCHI")).toMatchObject({ amount: 20, type: "", ruleStatus: "" });
    expect(res.rows.find((r) => r.sourceType === "Rimborso su carta")).toMatchObject({ amount: 5, type: "income" });
    expect(byDesc(res.rows, "NETFLIX.COM")).toMatchObject({ type: "expense", categoryId: "exp.leisure" });
    const bet = byDesc(res.rows, "BETFAIR");
    expect(bet).toMatchObject({ type: "expense", categoryId: "", deferredWallet: true });
  });

  it("due righe identiche nello stesso file restano entrambe, con la stessa firma", async () => {
    const res = await parseBankFile(fileOf("revolut.csv", csv), { ownerNames: OWNER });
    const bars = res.rows.filter((r) => r.description === "BAR TEST");
    expect(bars).toHaveLength(2);
    expect(signature(bars[0])).toBe(signature(bars[1]));
  });

  it("firma identica alla sig() della v3.10 e stabile tra due letture", async () => {
    const a = await parseBankFile(fileOf("revolut.csv", csv), { ownerNames: OWNER });
    const b = await parseBankFile(fileOf("revolut.csv", csv), { ownerNames: [] });
    expect(a.rows.map(signature)).toEqual(b.rows.map(signature));
    expect(signature(byDesc(a.rows, "NEGOZIO TEST"))).toBe(v310sig({ source: "Revolut", dateTime: "2026-01-15 10:30:00", date: "2026-01-16", descriptionRaw: "NEGOZIO TEST", amount: -12.5, currency: "EUR" }));
  });

  it("senza nomi del titolare la ricarica non diventa giroconto; basta anche il solo nome", async () => {
    const a = await parseBankFile(fileOf("revolut.csv", csv), { ownerNames: [] });
    expect(byDesc(a.rows, "Pagamento da MARIO ROSSI")).toMatchObject({ type: "", ruleStatus: "" });
    const first = csv.replace("Pagamento da MARIO ROSSI", "Pagamento da Mario").replace("Pagamento da LUIGI BIANCHI", "Pagamento da Mariolina Verdi");
    const b = await parseBankFile(fileOf("revolut.csv", first), { ownerNames: ["MARIO ROSSI"] });
    expect(byDesc(b.rows, "Pagamento da Mario")).toMatchObject({ type: "transfer_in", ruleStatus: "candidate" });
    expect(byDesc(b.rows, "Pagamento da Mariolina Verdi")).toMatchObject({ type: "" });
  });
});

describe("Trade Republic", () => {
  const head = "datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code";
  const row = (o: Record<string, string>) => {
    const cols = head.split(",");
    return cols.map((c) => o[c] ?? "").join(",");
  };
  const csv = [
    head,
    row({ datetime: "2026-01-02T09:00:00.000Z", date: "2026-01-02", account_type: "DEFAULT", category: "CASH", type: "TRANSFER_INBOUND", amount: "500.00", currency: "EUR", description: "Bonifico in entrata", transaction_id: "tx-0001" }),
    row({ datetime: "2026-01-03T10:00:00.000Z", date: "2026-01-03", account_type: "DEFAULT", category: "TRADING", type: "BUY", asset_class: "FUND", name: "ETF TEST", amount: "-100.00", fee: "-1.00", currency: "EUR", description: "Acquisto ETF TEST", transaction_id: "tx-0002" }),
    row({ datetime: "2026-01-04T10:00:00.000Z", date: "2026-01-04", account_type: "DEFAULT", category: "TRADING", type: "SELL", asset_class: "STOCK", name: "AZIONE TEST", amount: "50.00", fee: "-1.00", tax: "-2.50", currency: "EUR", description: "Vendita AZIONE TEST", transaction_id: "tx-0003" }),
    row({ datetime: "2026-01-05T10:00:00.000Z", date: "2026-01-05", account_type: "DEFAULT", category: "CASH", type: "DIVIDEND", asset_class: "STOCK", name: "AZIONE TEST", amount: "3.20", tax: "-0.80", currency: "EUR", description: "Cedola AZIONE TEST", transaction_id: "tx-0004" }),
    row({ datetime: "2026-01-06T10:00:00.000Z", date: "2026-01-06", account_type: "DEFAULT", category: "CASH", type: "INTEREST_PAYMENT", amount: "1.50", currency: "EUR", description: "Interessi", transaction_id: "tx-0005" }),
    row({ datetime: "2026-01-07T10:00:00.000Z", date: "2026-01-07", account_type: "DEFAULT", category: "CASH", type: "TAX_OPTIMIZATION", amount: "0.30", currency: "EUR", description: "Ottimizzazione fiscale", transaction_id: "tx-0006" }),
    row({ datetime: "2026-01-08T10:00:00.000Z", date: "2026-01-08", account_type: "DEFAULT", category: "CASH", type: "CARD_TRANSACTION", amount: "-5.00", currency: "EUR", description: "NEGOZIO TEST", transaction_id: "" }),
    row({ datetime: "2025-12-30T10:00:00.000Z", date: "2025-12-30", account_type: "DEFAULT", category: "CASH", type: "INTEREST_PAYMENT", amount: "1.10", currency: "EUR", description: "Interessi", transaction_id: "tx-0000" }),
    row({ datetime: "", date: "", account_type: "DEFAULT", category: "CASH", type: "BUY", amount: "-1.00", currency: "EUR", description: "Senza data", transaction_id: "tx-0009" }),
  ].join("\n");

  it("tipi, importi netti e controparti", async () => {
    const res = await parseBankFile(fileOf("tr.csv", csv), { ownerNames: OWNER });
    expect(res.account).toBe("Trade Republic");
    expect(res.rows).toHaveLength(8);
    expect(res.skipped).toBe(1);
    const by = (id: string) => res.rows.find((r) => r.externalId === id)!;

    expect(by("tx-0001")).toMatchObject({ type: "transfer_in", counterparty: "", amount: 500, ruleStatus: "import", dateTime: "2026-01-02T09:00:00.000Z" });
    expect(by("tx-0002")).toMatchObject({ type: "invest_buy", categoryId: "", counterparty: "ETF TEST", amount: -101, sourceCategory: "TRADING · FUND" });
    expect(by("tx-0002").raw).toMatchObject({ __TR_GROSS_AMOUNT: -100, __TR_FEE: -1, __TR_TAX: 0, __TR_NET_CASH: -101, name: "ETF TEST" });
    expect(by("tx-0003")).toMatchObject({ type: "invest_sell", categoryId: "", counterparty: "AZIONE TEST", amount: 46.5 });
    expect(by("tx-0004")).toMatchObject({ type: "income", categoryId: "inc.financial_income", counterparty: "AZIONE TEST", amount: 2.4 });
    expect(by("tx-0005")).toMatchObject({ type: "income", categoryId: "inc.financial_income", counterparty: "Trade Republic", amount: 1.5 });
    expect(by("tx-0006")).toMatchObject({ type: "expense", categoryId: "exp.taxes", counterparty: "Trade Republic", amount: 0.3 });
    expect(res.rows.find((r) => r.description === "NEGOZIO TEST")).toMatchObject({ type: "", externalId: "", ruleStatus: "" });
    expect(res.notes[0]).toContain("acquisti 1 · vendite 1 · dividendi 1 · interessi 2 · fiscali 1");
  });

  it("nessun anno cablato: anche le righe del 2025 sono importate", async () => {
    const res = await parseBankFile(fileOf("tr.csv", csv), { ownerNames: [] });
    expect(res.rows.find((r) => r.externalId === "tx-0000")).toMatchObject({ date: "2025-12-30", type: "income" });
  });

  it("firma come la v3.10", async () => {
    const res = await parseBankFile(fileOf("tr.csv", csv), { ownerNames: [] });
    const buy = res.rows.find((r) => r.externalId === "tx-0002")!;
    expect(signature(buy)).toBe(v310sig({ source: "Trade Republic", externalId: "tx-0002", dateTime: "2026-01-03T10:00:00.000Z", date: "2026-01-03", descriptionRaw: "Acquisto ETF TEST", amount: -101, currency: "EUR" }));
  });
});

describe("Hype", () => {
  const head = "Data operazione,Data contabile,Tipologia,Nome,Descrizione,Importo ( € ),Iban";
  const csv = [
    head,
    "03/01/2026,04/01/2026,Pagamento,NEGOZIO TEST,Pagamento POS NEGOZIO TEST,-15.00,",
    "05/01/2026,05/01/2026,Bonifico in entrata,Mario Rossi,Bonifico da conto personale,100.00,IT00X0000000000000000000000",
    "06/01/2026,06/01/2026,Giroconto,ROSSI MARIO,Giroconto verso altro conto,-50.00,IT00X0000000000000000000000",
    "07/01/2026,07/01/2026,Ricarica carta,,Ricarica Hype,20.00,",
    "08/01/2026,08/01/2026,Prelievo,ATM TEST,Prelievo contanti,-50.00,",
    "09/01/2026,09/01/2026,Commissione,,Commissione servizio,-1.00,",
    "10/01/2026,10/01/2026,Bollo,,Imposta di bollo,-2.00,",
    "11/01/2026,11/01/2026,Bonifico in entrata,LUIGI BIANCHI,Cena,30.00,IT00X0000000000000000000001",
    '12/01/2026,12/01/2026,Pagamento,BAR TEST,Caffe,"-1,20",',
    '12/01/2026,12/01/2026,Pagamento,BAR TEST,Caffe,"-1,20",',
    "20/12/2025,20/12/2025,Pagamento,NEGOZIO TEST,Spesa 2025,-7.00,",
  ].join("\r\n");

  it("riconosciuto anche con estensione .xls, senza libreria XLSX", async () => {
    const res = await parseBankFile(fileOf("hype.xls", csv), { ownerNames: OWNER });
    expect(res.account).toBe("Hype");
    expect(res.rows).toHaveLength(11);
    expect(res.skipped).toBe(0);
  });

  it("tipi, giroconti verso se stessi (nome in entrambi gli ordini), prelievi, commissioni, bollo", async () => {
    const res = await parseBankFile(fileOf("hype.csv", csv), { ownerNames: OWNER });
    const r = res.rows;
    expect(byDesc(r, "Pagamento POS NEGOZIO TEST")).toMatchObject({ date: "2026-01-03", valueDate: "2026-01-04", amount: -15, type: "expense", sourceType: "Pagamento", sourceCategory: "NEGOZIO TEST" });
    expect(byDesc(r, "Bonifico da conto personale")).toMatchObject({ type: "transfer_in", counterparty: "", ruleStatus: "import" });
    expect(byDesc(r, "Giroconto verso altro conto")).toMatchObject({ type: "transfer_out" });
    expect(byDesc(r, "Ricarica Hype")).toMatchObject({ type: "transfer_in" });
    expect(byDesc(r, "Prelievo contanti")).toMatchObject({ type: "transfer_out", counterparty: "Cassa" });
    expect(byDesc(r, "Commissione servizio")).toMatchObject({ type: "expense", categoryId: "exp.financial_services" });
    expect(byDesc(r, "Imposta di bollo")).toMatchObject({ type: "expense", categoryId: "exp.taxes" });
    expect(byDesc(r, "Cena")).toMatchObject({ type: "income", categoryId: "" });
    expect(byDesc(r, "Spesa 2025")).toMatchObject({ date: "2025-12-20" });
    expect(res.notes[0]).toContain("candidati giroconto 3 · prelievi 1");
  });

  it("righe identiche: ID con numero di occorrenza, entrambe restituite", async () => {
    const res = await parseBankFile(fileOf("hype.csv", csv), { ownerNames: OWNER });
    const caffe = res.rows.filter((x) => x.description === "Caffe");
    expect(caffe).toHaveLength(2);
    expect(caffe[0].amount).toBe(-1.2);
    expect(caffe[0].externalId).toMatch(/^HYPE-[0-9a-f]+$/);
    expect(caffe[0].externalId).not.toBe(caffe[1].externalId);
    expect(caffe.map((x) => x.raw.__HYPE_OCCURRENCE)).toEqual([1, 2]);
    const key = ["2026-01-12", "2026-01-12", "", "Pagamento", "BAR TEST", "Caffe", "-1.20"].map(v310norm).join("|");
    expect(caffe[1].externalId).toBe("HYPE-" + v310fnv(key + "|2"));
  });

  it("senza nomi del titolare i bonifici non diventano giroconti", async () => {
    const res = await parseBankFile(fileOf("hype.csv", csv), { ownerNames: [] });
    expect(byDesc(res.rows, "Bonifico da conto personale")).toMatchObject({ type: "income" });
    expect(byDesc(res.rows, "Giroconto verso altro conto")).toMatchObject({ type: "" });
  });
});

describe("Tinaba", () => {
  const head = "Data;Descrizione;Importo;Categoria;Causale/Messaggio;Controparte;CRO/NOP;Community";
  const csv = [
    head,
    "15/06/2025;Nuova sottoscrizione conto deposito;1.000,00;Conti deposito;;;CRO-010;",
    "10/01/2026;Bonifico effettuato a favore di MARIO ROSSI;100,00;Trasferimenti;Giroconto;MARIO ROSSI;CRO-001;",
    "11/01/2026;Bonifico effettuato a favore di NEGOZIO TEST SRL;45,50;Trasferimenti;Fattura 12;NEGOZIO TEST SRL;CRO-002;",
    "12/01/2026;Bonifico ricevuto da LUIGI BIANCHI;30,00;Trasferimenti;Cena;LUIGI BIANCHI;CRO-003;",
    "13/01/2026;Movimento misterioso;5,00;Altro;;;;",
    "14/01/2026;Pagamento negozio;-8,00;Shopping;;;;",
    "15/01/2026;Accredito capitale investito e interessi;1.025,00;Conti deposito;;;CRO-011;",
  ].join("\n");

  it("segno ricostruito dalla descrizione, giroconto verso se stessi, bonifico a terzi", async () => {
    const res = await parseBankFile(fileOf("tinaba.csv", csv), { ownerNames: OWNER });
    expect(res.account).toBe("Tinaba");
    expect(res.rows).toHaveLength(7);
    const r = res.rows;
    expect(byDesc(r, "Bonifico effettuato a favore di MARIO ROSSI")).toMatchObject({ amount: -100, type: "transfer_out", counterparty: "", externalId: "CRO-001", sourceType: "Trasferimenti", sourceCategory: "Giroconto", dateTime: "10/01/2026", date: "2026-01-10", ruleStatus: "import" });
    expect(byDesc(r, "Bonifico effettuato a favore di NEGOZIO TEST SRL")).toMatchObject({ amount: -45.5, type: "", counterparty: "NEGOZIO TEST SRL", ruleStatus: "import" });
    expect(byDesc(r, "Bonifico ricevuto da LUIGI BIANCHI")).toMatchObject({ amount: 30, type: "", counterparty: "", ruleStatus: "" });
    expect(byDesc(r, "Movimento misterioso")).toMatchObject({ amount: 5, inputIssue: "Direzione movimento Tinaba non riconosciuta" });
    expect(byDesc(r, "Pagamento negozio")).toMatchObject({ amount: -8, inputIssue: "" });
    expect(byDesc(r, "Nuova sottoscrizione conto deposito")).toMatchObject({ amount: -1000, date: "2025-06-15" });
  });

  it("rientro conto deposito diviso in capitale e interessi", async () => {
    const res = await parseBankFile(fileOf("tinaba.csv", csv), { ownerNames: OWNER });
    const ret = byDesc(res.rows, "Accredito capitale investito e interessi");
    expect(ret.amount).toBe(1025);
    expect(ret.inputIssue).toBe("");
    expect(ret.ruleStatus).toBe("import");
    expect(ret.splits).toHaveLength(2);
    expect(ret.splits![0]).toMatchObject({ amount: 1000, type: "transfer_in", counterparty: "Tinaba Conto deposito", categoryId: "" });
    expect(ret.splits![1]).toMatchObject({ amount: 25, type: "income", categoryId: "inc.financial_income" });
    expect(ret.splits!.reduce((t, s) => t + s.amount, 0)).toBeCloseTo(ret.amount, 9);
    expect(ret.raw).toMatchObject({ __TINABA_CAPITALE_RICOSTRUITO: 1000, __TINABA_INTERESSI_NETTI: 25 });
    expect(res.notes[0]).toContain("capitale e interessi 1");
  });

  it("rientro senza sottoscrizioni nel file: da verificare", async () => {
    const lines = csv.split("\n").filter((l) => !l.includes("Nuova sottoscrizione"));
    const res = await parseBankFile(fileOf("tinaba.csv", lines.join("\n")), { ownerNames: OWNER });
    const ret = byDesc(res.rows, "Accredito capitale investito e interessi");
    expect(ret.splits).toBeUndefined();
    expect(ret.inputIssue).toBe("Rientro conto deposito: capitale/interessi da verificare");
  });

  it("più cicli di deposito: il capitale già rientrato non si conta due volte", async () => {
    const multi = [
      head,
      "10/01/2025;Nuova sottoscrizione conto deposito;1.000,00;Conti deposito;;;C1;",
      "10/06/2025;Accredito capitale investito e interessi;1.010,00;Conti deposito;;;C2;",
      "10/07/2025;Nuova sottoscrizione conto deposito;500,00;Conti deposito;;;C3;",
      "10/12/2025;Accredito capitale investito e interessi;505,00;Conti deposito;;;C4;",
    ].join("\n");
    const res = await parseBankFile(fileOf("tinaba.csv", multi), { ownerNames: [] });
    const c4 = res.rows.find((r) => r.externalId === "C4")!;
    expect(c4.splits!.map((s) => s.amount)).toEqual([500, 5]);
    const c2 = res.rows.find((r) => r.externalId === "C2")!;
    expect(c2.splits!.map((s) => s.amount)).toEqual([1000, 10]);
  });

  it("senza nomi del titolare: nessun giroconto e nessuna controparte di terzi", async () => {
    const res = await parseBankFile(fileOf("tinaba.csv", csv), { ownerNames: [] });
    expect(byDesc(res.rows, "Bonifico effettuato a favore di MARIO ROSSI")).toMatchObject({ type: "", counterparty: "" });
    expect(byDesc(res.rows, "Bonifico effettuato a favore di NEGOZIO TEST SRL")).toMatchObject({ counterparty: "" });
  });

  it("firma: dateTime = testo originale della data", async () => {
    const res = await parseBankFile(fileOf("tinaba.csv", csv), { ownerNames: OWNER });
    const r = byDesc(res.rows, "Bonifico effettuato a favore di NEGOZIO TEST SRL");
    expect(signature(r)).toBe(v310sig({ source: "Tinaba", externalId: "CRO-002", dateTime: "11/01/2026", date: "2026-01-11", descriptionRaw: "Bonifico effettuato a favore di NEGOZIO TEST SRL", amount: -45.5 }));
  });
});
