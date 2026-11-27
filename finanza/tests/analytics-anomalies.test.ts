import { describe, expect, it } from "vitest";
import type { Line, MovementType } from "../src/domain/types.ts";
import { defaultCategories } from "../src/domain/categories.ts";
import { addDays, findAnomalies } from "../src/analytics/index.ts";

let seq = 0;
function mk(date: string, amount: number, merchant: string, categoryId = "exp.groceries", type?: MovementType): Line {
  const id = "a" + ++seq;
  return {
    id, parentId: id, account: "Banca", date, month: date.slice(0, 7), amount, type: type ?? (amount < 0 ? "expense" : "income"),
    categoryId, counterparty: "", description: merchant, merchant, isSplit: false, unbalanced: false, deferredWallet: false,
  };
}
const nb = (s: string) => s.replace(/ | /g, " ");
const categories = defaultCategories();

// Storico da novembre 2025 a ottobre 2026: spesa settimanale da CONAD tra 35 e 45 €, due cene da 50 € al mese.
const history: Line[] = [];
for (let i = 0; i < 52; i++) history.push(mk(addDays("2025-11-01", 7 * i), -(35 + (i % 5) * 2.5), "CONAD"));
for (let m = 0; m < 12; m++) {
  const month = m < 2 ? `2025-${11 + m}` : `2026-${String(m - 1).padStart(2, "0")}`;
  history.push(mk(`${month}-10`, -50, "TRATTORIA", "exp.dining"), mk(`${month}-20`, -50, "TRATTORIA", "exp.dining"));
}

describe("findAnomalies", () => {
  it("dati vuoti o mese senza movimenti", () => {
    expect(findAnomalies([], "2026-11")).toEqual([]);
    expect(findAnomalies(history, "2026-11")).toEqual([]);
  });

  it("importo insolito rispetto allo storico dell'esercente", () => {
    const lines = [...history, mk("2026-11-07", -180, "CONAD"), mk("2026-11-14", -42, "CONAD")];
    const a = findAnomalies(lines, "2026-11", { categories });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "transaction", merchant: "CONAD", amount: 180, expected: 40, date: "2026-11-07" });
    expect(["medium", "high"]).toContain(a[0].severity);
    expect(nb(a[0].reason)).toBe("Conad: 180 € il 7/11, di solito 40,00 €");
  });

  it("nuovo esercente con importo alto (solo se esiste uno storico)", () => {
    const lines = [...history, mk("2026-11-03", -450, "DYSON STORE", "exp.home"), mk("2026-11-04", -25, "EDICOLA", "exp.other")];
    const a = findAnomalies(lines, "2026-11", { categories });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "new_merchant", merchant: "DYSON STORE", severity: "medium", expected: null });
    expect(nb(a[0].reason)).toBe("Nuovo esercente: Dyson Store, 450 € il 3/11");
    // Primo mese dell'archivio: tutti gli esercenti sono "nuovi", nessuna segnalazione.
    expect(findAnomalies([mk("2026-11-03", -450, "DYSON STORE", "exp.home")], "2026-11")).toEqual([]);
  });

  it("categoria con totale mensile molto sopra la mediana", () => {
    const lines = [...history];
    for (let d = 1; d <= 8; d++) lines.push(mk(`2026-11-0${d}`, -50, "TRATTORIA", "exp.dining"));
    const a = findAnomalies(lines, "2026-11", { categories });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "category", categoryId: "exp.dining", amount: 400, expected: 100, severity: "high" });
    expect(nb(a[0].reason)).toBe("Ristorazione: 400 € a novembre, mediana 100 € (+300%)");
  });

  it("spesa alta in categoria per un esercente con poco storico; ordinamento per gravità", () => {
    const lines = [...history, mk("2026-11-12", -400, "RISTORANTE STELLATO", "exp.dining"), mk("2026-11-07", -180, "CONAD")];
    lines.push(mk("2026-06-01", -30, "RISTORANTE STELLATO", "exp.dining"));
    const a = findAnomalies(lines, "2026-11", { categories });
    const tx = a.find((x) => x.merchant === "RISTORANTE STELLATO")!;
    expect(tx.kind).toBe("transaction");
    expect(nb(tx.reason)).toContain("in Ristorazione, la spesa più alta degli ultimi 12 mesi");
    const rank = { high: 3, medium: 2, low: 1 };
    for (let i = 1; i < a.length; i++) expect(rank[a[i - 1].severity]).toBeGreaterThanOrEqual(rank[a[i].severity]);
  });

  it("i resi non sono anomalie", () => {
    const lines = [...history, mk("2026-11-07", 300, "CONAD", "exp.groceries", "expense")];
    expect(findAnomalies(lines, "2026-11")).toEqual([]);
  });
});
