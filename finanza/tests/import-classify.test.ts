import { describe, expect, it } from "vitest";
import { baseClassify, categoryIdFromLegacy, dedupeKeys } from "../src/import/index.ts";
import { applySavePlan, importCategoryId } from "../src/import/legacy-category.ts";
import { mentionsOwner, ownerAfter, ownerVariants } from "../src/import/owner.ts";
import { makeMovement, signature } from "../src/domain/movement.ts";
import type { ImportedRow } from "../src/domain/types.ts";

const m = (account: string, amount: number, description: string, sourceType = "") =>
  ({ account, amount, description, sourceType, type: "" as const, counterparty: "", ruleStatus: "" as const });

describe("nomi del titolare", () => {
  it("varianti nome/cognome, maiuscole e accenti", () => {
    expect(ownerVariants(["Mário Rossi"])).toEqual(["MARIO ROSSI", "ROSSI MARIO"]);
    expect(ownerVariants(["Anna De Santis"])).toContain("DE SANTIS ANNA");
    expect(ownerVariants(["", "  "])).toEqual([]);
    expect(mentionsOwner("bonifico da rossi  mario", ["Mario Rossi"])).toBe(true);
    expect(ownerAfter("Ricarica a Rossi Mario srl", "RICARICA A", ["mario rossi"])).toBe(true);
    expect(ownerAfter("Ricarica a Bianchi Luigi", "RICARICA A", ["mario rossi"])).toBe(false);
    expect(mentionsOwner("MARIO ROSSI", [])).toBe(false);
  });
});

describe("baseClassify", () => {
  const owners = ["Mario Rossi"];
  it("Revolut", () => {
    expect(baseClassify(m("Revolut", -5, "NEGOZIO TEST", "Pagamento con carta"), owners)).toEqual({ type: "expense" });
    expect(baseClassify(m("Revolut", -5, "NEGOZIO TEST", "PAGAMENTO REVOLUT"), owners)).toEqual({ type: "expense" });
    expect(baseClassify(m("Revolut", 5, "NEGOZIO TEST", "Pagamento con carta"), owners)).toEqual({});
    expect(baseClassify(m("Revolut", 5, "NEGOZIO TEST", "Rimborso su carta"), owners)).toEqual({ type: "income" });
    expect(baseClassify(m("Revolut", 50, "Pagamento da Mario Rossi", "Ricarica"), owners)).toEqual({ type: "transfer_in", ruleStatus: "candidate" });
    expect(baseClassify(m("Revolut", 50, "Pagamento da Mario Rossi", "Ricarica"), [])).toEqual({});
    expect(baseClassify(m("Revolut", 50, "Pagamento da Luigi Bianchi", "Ricarica"), owners)).toEqual({});
  });
  it("Banca Sella", () => {
    expect(baseClassify(m("Banca Sella", -100, "RICARICA REVOLUT"), owners)).toEqual({ type: "transfer_out", counterparty: "Revolut" });
    expect(baseClassify(m("Banca Sella", 100, "RICARICA REVOLUT"), owners)).toEqual({});
    expect(baseClassify(m("Banca Sella", -100, "GIROCONTO TR PUB TEST"), owners)).toEqual({ type: "transfer_out", counterparty: "Trade Republic" });
    expect(baseClassify(m("Banca Sella", -30, "RICARICA A ROSSI MARIO"), owners)).toEqual({ type: "transfer_out", ruleStatus: "candidate", counterparty: "" });
    expect(baseClassify(m("Banca Sella", -30, "RICARICA A ROSSI MARIO"), [])).toEqual({});
  });
  it("altri conti: nessuna regola base", () => {
    expect(baseClassify(m("Hype", -5, "REVOLUT"), owners)).toEqual({});
  });
});

describe("categorie v3.8.2", () => {
  it("mappa delle etichette legacy", () => {
    expect(categoryIdFromLegacy("Tasse / F24")).toBe("exp.taxes");
    expect(categoryIdFromLegacy("Altro Uscite")).toBe("exp.other");
    expect(categoryIdFromLegacy("Investimenti / Dividendi", { type: "income" })).toBe("inc.financial_income");
    expect(categoryIdFromLegacy("Investimenti / Dividendi", { type: "invest_buy" })).toBe("");
    expect(categoryIdFromLegacy("Regali", { amount: 10 })).toBe("inc.gifts");
    expect(categoryIdFromLegacy("Regali", { type: "expense" })).toBe("exp.gifts");
    expect(categoryIdFromLegacy("Abbonamenti", { description: "NETFLIX" })).toBe("exp.leisure");
    expect(categoryIdFromLegacy("Scommesse")).toBe("");
    expect(categoryIdFromLegacy("")).toBe("");
  });
  it("pattern di descrizione della baseline importatore", () => {
    expect(importCategoryId("", "expense", "PAGAMENTO EASYPARK", -2)).toBe("exp.mobility");
    expect(importCategoryId("", "expense", "BARBER SHOP TEST", -15)).toBe("exp.personal_care");
    expect(importCategoryId("", "expense", "COMMISSIONE BONIFICO", -1)).toBe("exp.financial_services");
    expect(importCategoryId("", "income", "COMMISSIONE STORNATA", 1)).toBe("");
    expect(importCategoryId("Investimenti / Dividendi", "invest_buy", "NETFLIX", -1)).toBe("");
  });
  it("piano al salvataggio: tipo Uscita per alcuni esercenti, wallet scommesse", () => {
    expect(applySavePlan({ account: "Revolut", description: "SISAL TEST", amount: -5, type: "expense", categoryId: "" })).toEqual({ type: "expense", categoryId: "", deferredWallet: true });
    expect(applySavePlan({ account: "Banca Sella", description: "WIND TRE", amount: -10, type: "", categoryId: "exp.utilities" })).toEqual({ type: "expense", categoryId: "exp.utilities", deferredWallet: false });
    expect(applySavePlan({ account: "Banca Sella", description: "WIND TRE RIMBORSO", amount: 10, type: "", categoryId: "exp.utilities" })).toEqual({ type: "", categoryId: "exp.utilities", deferredWallet: false });
    expect(applySavePlan({ account: "Trade Republic", description: "Dividend TEST", amount: 1, type: "income", categoryId: "" })).toEqual({ type: "income", categoryId: "inc.financial_income", deferredWallet: false });
    expect(applySavePlan({ account: "Hype", description: "Imposta di bollo", amount: -2, type: "expense", categoryId: "exp.taxes" })).toEqual({ type: "expense", categoryId: "exp.taxes", deferredWallet: false });
  });
});

describe("dedupeKeys", () => {
  const row = (o: Partial<ImportedRow>): ImportedRow => ({
    account: "Banca Sella", date: "2026-01-05", dateTime: "", valueDate: "", description: "NEGOZIO TEST", amount: -1, currency: "EUR",
    externalId: "", sourceType: "", sourceCategory: "", raw: {}, inputIssue: "", type: "", categoryId: "", counterparty: "", ruleStatus: "", ...o,
  });
  it("codice della banca (per conto) e firma", () => {
    const r = row({ externalId: "ID001" });
    expect(dedupeKeys(r)).toEqual(["ext:Banca Sella:ID001", "sig:" + signature(r)]);
    const rev = row({ account: "Revolut", dateTime: "2026-01-05 10:00:00" });
    expect(dedupeKeys(rev)).toEqual(["sig:" + signature(rev)]);
  });
  it("stesse chiavi per la riga importata e per il movimento salvato; usa la firma memorizzata", () => {
    const r = row({ externalId: "ID002" });
    expect(dedupeKeys(makeMovement(r))).toEqual(dedupeKeys(r));
    expect(dedupeKeys(makeMovement({ ...r, signature: "abc" }))).toEqual(["ext:Banca Sella:ID002", "sig:abc"]);
  });
  it("la classificazione non cambia le chiavi", () => {
    expect(dedupeKeys(row({ type: "expense", categoryId: "exp.other" }))).toEqual(dedupeKeys(row({})));
  });
});
