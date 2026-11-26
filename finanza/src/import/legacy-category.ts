// Categorie: gli importatori della v3.10 assegnano etichette legacy ("Tasse / F24",
// "Investimenti / Dividendi"…). Dalla v3.8.2 queste diventano categoryId con
// categoryIdFromLegacyV382 e con i pattern di descrizione del registro categorie.
// Qui c'è il porting di:
//  - categoryIdFromLegacyV382 (mappa etichetta legacy → id);
//  - il wrapper v3.8.2 della baseline importatore (deriveImportClassificationV381);
//  - genericPlanV382, che nella v3.10 viene applicato ai movimenti nuovi al primo
//    salvataggio dopo l'import (tipo Uscita per alcuni esercenti, wallet scommesse).
import type { MovementType } from "../domain/types.ts";
import { norm } from "../domain/movement.ts";

const DIRECT: Record<string, string> = {
  "Stipendio": "inc.salary",
  "Freelance / Fattura": "inc.self_employment",
  "Rimborso fiscale": "inc.tax_refund",
  "Altro Entrate": "inc.other",
  "Affitto / Mutuo": "exp.housing",
  "Spesa Alimentare": "exp.groceries",
  "Trasporti / Carburante": "exp.mobility",
  "Utenze": "exp.utilities",
  "Ristorazione": "exp.dining",
  "Salute / Farmacia": "exp.health",
  "Abbigliamento": "exp.clothing",
  "Svago / Hobby": "exp.leisure",
  "Istruzione / Formazione": "exp.education",
  "Tasse / F24": "exp.taxes",
  "Altro Uscite": "exp.other",
  "Spesa per la Casa": "exp.home",
  "Automezzi / Manutenzione": "exp.vehicle",
};

/** categoryIdFromLegacyV382: etichetta categoria v3.10 → id v4 ("" se 1:N o sconosciuta). */
export function categoryIdFromLegacy(label: string, ctx: { type?: MovementType; description?: string; amount?: number } = {}): string {
  label = String(label || "").trim();
  if (!label) return "";
  const t = ctx.type ?? "", d = norm(ctx.description ?? ""), amount = Number(ctx.amount || 0);
  if (DIRECT[label]) return DIRECT[label];
  if (label === "Investimenti / Dividendi") return t === "income" ? "inc.financial_income" : "";
  if (label === "Regali") return t === "income" || amount > 0 ? "inc.gifts" : t === "expense" || amount < 0 ? "exp.gifts" : "";
  if (label === "Abbonamenti") { if (d.includes("NETFLIX")) return "exp.leisure"; if (d.includes("WIND")) return "exp.utilities"; return ""; }
  // "Matrimoni / Cerimonie", "Viaggi / Vacanze", "Scommesse": nessuna mappa deterministica nella v3.8.2.
  return "";
}

const isInvest = (t: MovementType) => t === "invest_buy" || t === "invest_sell";
const isBetting = (d: string) => d.includes("BETFAIR") || d.includes("SISAL");
const isPersonalCare = (d: string) => d.includes("BARBER") || d.includes("PARRUCCHIERE");
const isFinancialFee = (d: string) => d.includes("COMMISSIONE") || d.includes("COSTO CARTA");

/**
 * Categoria della baseline importatore (wrapper v3.8.2 di deriveImportClassificationV381):
 * prima i pattern di descrizione, poi la mappa dell'etichetta legacy assegnata dall'importatore.
 */
export function importCategoryId(legacyCategory: string, type: MovementType, description: string, amount: number): string {
  const d = norm(description);
  if (isInvest(type)) return "";
  if (d.includes("SPICCIOLI REVPOINTS")) return "exp.rewards";
  if (isBetting(d)) return "";
  if (d.includes("WIND TRE")) return "exp.utilities";
  if (d.includes("NETFLIX")) return "exp.leisure";
  if (d.includes("EASYPARK")) return "exp.mobility";
  if (isPersonalCare(d)) return "exp.personal_care";
  if (amount < 0 && isFinancialFee(d)) return "exp.financial_services";
  return categoryIdFromLegacy(legacyCategory, { type, description, amount });
}

export interface SavePlanInput { account: string; description: string; amount: number; type: MovementType; categoryId: string }
export interface SavePlanOutput { type: MovementType; categoryId: string; deferredWallet: boolean }

/**
 * genericPlanV382 applicato ai movimenti appena importati (nella v3.10 succede al primo
 * salvataggio). Solo le regole generiche: le due regole legate a casi personali del
 * titolare non sono portate. Nel ramo finale la v3.10 rimappava l'etichetta già
 * convertita e così cancellava categorie valide (es. "Tasse / Imposte / Tributi"):
 * qui la categoria dell'importatore resta.
 */
export function applySavePlan(m: SavePlanInput): SavePlanOutput {
  const d = norm(m.description), a = Number(m.amount || 0);
  const keep: SavePlanOutput = { type: m.type, categoryId: m.categoryId, deferredWallet: false };
  const asExpense = (categoryId: string): SavePlanOutput => ({ type: a < 0 ? "expense" : m.type, categoryId, deferredWallet: false });
  if (isBetting(d) && a < 0) return { type: m.type, categoryId: "", deferredWallet: true };
  if (d.includes("SPICCIOLI REVPOINTS")) return asExpense("exp.rewards");
  if (d.includes("WIND TRE")) return asExpense("exp.utilities");
  if (d.includes("NETFLIX")) return asExpense("exp.leisure");
  if (isPersonalCare(d)) return asExpense("exp.personal_care");
  if (d.includes("EASYPARK")) return asExpense("exp.mobility");
  if (norm(m.account) === "TRADE REPUBLIC") {
    if (isInvest(m.type)) return { ...keep, categoryId: "" };
    if (m.type === "income" && (d.includes("DIVIDEND") || d.includes("INTEREST"))) return { ...keep, categoryId: "inc.financial_income" };
  }
  if (a < 0 && isFinancialFee(d)) return { type: "expense", categoryId: "exp.financial_services", deferredWallet: false };
  return keep;
}
