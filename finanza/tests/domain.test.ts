import { describe, expect, it } from "vitest";
import { makeMovement, signature, toLines, monthKey, merchantOf } from "../src/domain/movement.ts";
import { applyRules, rematchTransfers, reprocess, statusOf } from "../src/domain/classify.ts";
import type { Rule } from "../src/domain/types.ts";
import { fromLegacy, isLegacyBackup } from "../src/storage/legacy.ts";
import { defaultSettings } from "../src/state/defaults.ts";

const rule = (p: Partial<Rule>): Rule => ({ id: Math.random().toString(36), account: "", contains: "", sign: "", type: "expense", categoryId: "", counterparty: "", priority: 50, active: true, ...p });

describe("regole", () => {
  it("applica la regola con priorità più alta", () => {
    const m = makeMovement({ account: "Revolut", date: "2026-03-02", description: "CONAD SUPERSTORE 12", amount: -20 });
    applyRules(m, [rule({ contains: "CONAD", categoryId: "exp.groceries", priority: 50 }), rule({ contains: "SUPERSTORE", categoryId: "exp.home", priority: 70 })]);
    expect(m.categoryId).toBe("exp.home");
    expect(m.ruleStatus).toBe("rule");
  });
  it("due regole diverse alla stessa priorità: ambigua", () => {
    const m = makeMovement({ account: "Revolut", date: "2026-03-02", description: "CONAD SUPERSTORE", amount: -20 });
    applyRules(m, [rule({ contains: "CONAD", categoryId: "exp.groceries" }), rule({ contains: "SUPERSTORE", categoryId: "exp.home" })]);
    expect(m.ruleStatus).toBe("ambiguous");
    expect(statusOf(m).kind).toBe("warn");
  });
  it("rispetta segno, conto e blocco manuale", () => {
    const r = [rule({ contains: "BONIFICO", sign: "+", type: "income", categoryId: "inc.other", account: "Banca Sella" })];
    const out = makeMovement({ account: "Banca Sella", date: "2026-03-02", description: "BONIFICO", amount: -5 });
    const other = makeMovement({ account: "Hype", date: "2026-03-02", description: "BONIFICO", amount: 5 });
    const locked = makeMovement({ account: "Banca Sella", date: "2026-03-02", description: "BONIFICO", amount: 5, lock: true, type: "expense", categoryId: "exp.other" });
    for (const m of [out, other, locked]) applyRules(m, r);
    expect(out.type).toBe("");
    expect(other.type).toBe("");
    expect(locked.categoryId).toBe("exp.other");
  });
  it("il ricalcolo conserva la classificazione dell'importatore", () => {
    const m = makeMovement({ account: "Trade Republic", date: "2026-03-02", description: "BUY ETF", amount: -100, type: "invest_buy", ruleStatus: "import" });
    reprocess([m], []);
    expect(m.type).toBe("invest_buy");
  });
});

describe("giroconti", () => {
  const out = () => makeMovement({ account: "Banca Sella", date: "2026-04-03", description: "RICARICA", amount: -200, type: "transfer_out" });
  const inn = (d = "2026-04-04", acc = "Revolut") => makeMovement({ account: acc, date: d, description: "TOP UP", amount: 200, type: "transfer_in" });
  it("abbina se il candidato è unico entro 5 giorni", () => {
    const a = out(), b = inn();
    rematchTransfers([a, b]);
    expect(a.matchedTo).toBe(b.id);
    expect(a.counterparty).toBe("Revolut");
    expect(statusOf(a, new Map([[a.id, a], [b.id, b]])).kind).toBe("ok");
  });
  it("non abbina se i candidati sono due o troppo lontani", () => {
    const a = out(), b = inn(), c = inn("2026-04-05", "Hype");
    rematchTransfers([a, b, c]);
    expect(a.matchedTo).toBeNull();
    const d = out(), e = inn("2026-04-20");
    rematchTransfers([d, e]);
    expect(d.matchedTo).toBeNull();
  });
});

describe("righe effettive", () => {
  it("espande le quote quadrate ed esclude quelle non quadrate dai KPI", () => {
    const ok = makeMovement({ account: "Revolut", date: "2026-05-10", description: "CENA", amount: -60, type: "expense", splits: [
      { id: "a", amount: -30, type: "expense", categoryId: "exp.dining", counterparty: "", description: "" },
      { id: "b", amount: -30, type: "advance_out", categoryId: "", counterparty: "Luca", description: "" }] });
    const bad = makeMovement({ account: "Revolut", date: "2026-05-10", description: "X", amount: -60, type: "expense", splits: [{ id: "a", amount: -10, type: "expense", categoryId: "exp.dining", counterparty: "", description: "" }] });
    const ls = toLines({ movements: [ok, bad], settings: defaultSettings() });
    expect(ls.filter((l) => l.parentId === ok.id)).toHaveLength(2);
    expect(ls.find((l) => l.parentId === bad.id)?.unbalanced).toBe(true);
  });
  it("mese contabile con inizio al 27", () => {
    expect(monthKey("2026-12-27", 27)).toBe("2027-01");
    expect(monthKey("2026-12-26", 27)).toBe("2026-12");
  });
  it("esercente ripulito da prefissi e codici", () => {
    expect(merchantOf("PAGAMENTO POS 12/03 ORE 18.22 CONAD SUPERSTORE CARTA N. 1234")).toBe("CONAD SUPERSTORE");
  });
});

describe("migrazione dal backup v3.10", () => {
  const v3 = {
    version: 2.1, appVersion: "3.10.1", initialBalances: { "Banca Sella": 1000 },
    budgets: { "exp.groceries": 300 }, budgetPlanV3103A: { version: 1, values: { "2026-05": { "exp.groceries": 250, "exp.dining": 0 } } },
    rules: [{ id: "r1", source: "", contains: "CONAD", sign: "-", type: "❌ Uscita reale", category: "Alimentari / Supermercato", categoryId: "exp.groceries", counterparty: "", priority: 70, active: true }],
    movements: [
      { id: "x1", source: "Banca Sella", date: "2026-05-02", dateTime: "", descriptionRaw: "CONAD", amount: -12.5, currency: "EUR", externalId: "", type: "❌ Uscita reale", category: "Spesa Alimentare", categoryId: "exp.groceries", manualLock: true, splits: [], merchant: "Conad", recurrence: "none" },
      { id: "x2", source: "Banca Sella", date: "2026-05-03", descriptionRaw: "RICARICA", amount: -50, type: "🔄 Giroconto uscita", category: "", counterparty: "Revolut", matchedTo: "x3", manualTransferMatch: true, ruleStatus: "Match automatico", splits: [] },
      { id: "x3", source: "Revolut", date: "2026-05-03", descriptionRaw: "TOP UP", amount: 50, type: "🔄 Giroconto entrata", category: "", counterparty: "Banca Sella", matchedTo: "x2", manualTransferMatch: true, splits: [] },
      { id: "x4", source: "Revolut", date: "2026-05-04", descriptionRaw: "REGALO", amount: -20, type: "❌ Uscita reale", category: "Regali", splits: [], deletedAt: "2026-05-05" },
    ],
  };
  it("riconosce e converte senza perdere campi", () => {
    expect(isLegacyBackup(v3)).toBe(true);
    const { snapshot: s } = fromLegacy(v3);
    const [a, b, , d] = s.movements;
    expect(a).toMatchObject({ id: "x1", account: "Banca Sella", description: "CONAD", type: "expense", categoryId: "exp.groceries", lock: true });
    expect(a.legacy).toMatchObject({ merchant: "Conad", recurrence: "none" });
    expect(a.signature).toBe(signature(a));
    expect(b).toMatchObject({ type: "transfer_out", matchedTo: "x3", manualMatch: true, ruleStatus: "auto-match" });
    expect(d).toMatchObject({ categoryId: "exp.gifts" });
    expect(d.deletedAt).toBeTruthy();
    expect(s.rules[0]).toMatchObject({ contains: "CONAD", type: "expense", categoryId: "exp.groceries", priority: 70 });
    expect(s.accounts.find((x) => x.id === "Banca Sella")?.initialBalance).toBe(1000);
    expect(s.budgets.months["2026-05"]).toEqual({ "exp.groceries": 250, "exp.dining": 0 });
  });
});
