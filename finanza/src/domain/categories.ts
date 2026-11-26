import type { Category, MovementType } from "./types.ts";

/**
 * Gruppi di spesa: al massimo 7 colori categoriali fissi + "Altro" neutro.
 * Il colore segue il gruppo (non la posizione in classifica), così resta uguale
 * in ogni grafico e con ogni filtro.
 */
export interface Group { id: string; label: string; slot: number; icon: string }
export const GROUPS: Group[] = [
  { id: "casa", label: "Casa e utenze", slot: 1, icon: "🏠" },
  { id: "cibo", label: "Cibo", slot: 2, icon: "🍝" },
  { id: "svago", label: "Svago, viaggi e regali", slot: 4, icon: "🎟️" },
  { id: "persona", label: "Salute e persona", slot: 5, icon: "🩺" },
  { id: "crescita", label: "Formazione e tecnologia", slot: 6, icon: "🎓" },
  { id: "mobilita", label: "Mobilità e auto", slot: 7, icon: "🚗" },
  { id: "altro", label: "Tasse, servizi e altro", slot: 0, icon: "🧾" },
];
// slot 3 (acqua) = Entrate e slot 8 (rosso) = Uscite in tutti i grafici: non usati dai gruppi.

const G: Record<string, string> = {
  "exp.housing": "casa", "exp.utilities": "casa", "exp.home": "casa",
  "exp.groceries": "cibo", "exp.dining": "cibo",
  "exp.mobility": "mobilita", "exp.vehicle": "mobilita",
  "exp.leisure": "svago", "exp.travel": "svago", "exp.betting": "svago", "exp.gifts": "svago", "exp.events": "svago",
  "exp.health": "persona", "exp.personal_care": "persona", "exp.clothing": "persona",
  "exp.education": "crescita", "exp.technology": "crescita",
  "exp.taxes": "altro", "exp.financial_services": "altro", "exp.rewards": "altro", "exp.other": "altro",
};
export function groupOf(categoryId: string): Group {
  const id = G[categoryId] ?? "altro";
  return GROUPS.find((g) => g.id === id)!;
}

type Seed = [id: string, label: string, icon: string, status?: Category["status"], budgetEligible?: boolean, aliases?: string[]];
const INCOME: Seed[] = [
  ["inc.salary", "Stipendio", "💼", "active", false, ["Stipendio"]],
  ["inc.self_employment", "Lavoro autonomo / Prestazioni", "🧑‍💻", "active", false, ["Freelance / Fattura"]],
  ["inc.financial_income", "Interessi / Dividendi / Rendite", "📈", "active", false, ["Investimenti / Dividendi"]],
  ["inc.public_support", "Contributi / Agevolazioni", "🏛️", "active", false],
  ["inc.tax_refund", "Rimborso fiscale", "🧾", "active", false, ["Rimborso fiscale"]],
  ["inc.gifts", "Regali ricevuti", "🎁", "active", false, ["Regali"]],
  ["inc.other", "Altro Entrate", "➕", "active", false, ["Altro Entrate"]],
];
const EXPENSE: Seed[] = [
  ["exp.housing", "Affitto / Mutuo", "🏠", "active", true, ["Affitto / Mutuo"]],
  ["exp.groceries", "Alimentari / Supermercato", "🛒", "active", true, ["Spesa Alimentare"]],
  ["exp.dining", "Ristorazione", "🍽️", "active", true, ["Ristorazione"]],
  ["exp.mobility", "Mobilità / Carburante", "⛽", "active", true, ["Trasporti / Carburante"]],
  ["exp.vehicle", "Auto / Gestione e manutenzione", "🔧", "active", true, ["Automezzi / Manutenzione"]],
  ["exp.utilities", "Utenze / Telefonia / Internet", "💡", "active", true, ["Utenze"]],
  ["exp.health", "Salute / Farmacia", "💊", "active", true, ["Salute / Farmacia"]],
  ["exp.personal_care", "Cura personale", "💈", "active", true],
  ["exp.clothing", "Abbigliamento / Accessori", "👕", "active", true, ["Abbigliamento"]],
  ["exp.home", "Casa / Beni e manutenzione", "🛋️", "active", true, ["Spesa per la Casa"]],
  ["exp.education", "Istruzione / Formazione", "📚", "active", true, ["Istruzione / Formazione"]],
  ["exp.leisure", "Svago / Intrattenimento / Hobby", "🎮", "active", true, ["Svago / Hobby", "Abbonamenti"]],
  ["exp.gifts", "Regali / Donazioni", "🎀", "active", true, ["Regali"]],
  ["exp.events", "Eventi / Cerimonie", "💒", "active", true, ["Matrimoni / Cerimonie"]],
  ["exp.travel", "Viaggi / Servizi di viaggio", "✈️", "active", true, ["Viaggi / Vacanze"]],
  ["exp.taxes", "Tasse / Imposte / Tributi", "🏛️", "active", true, ["Tasse / F24"]],
  ["exp.financial_services", "Servizi finanziari / Commissioni", "🏦", "active", true],
  ["exp.rewards", "Rewards / Punti fedeltà", "⭐", "active", true],
  ["exp.betting", "Scommesse / Trading sportivo", "🎲", "conditional", false, ["Scommesse"]],
  ["exp.other", "Altro Uscite", "📦", "active", true, ["Altro Uscite"]],
  ["exp.technology", "Tecnologia / Elettronica", "💻", "active", true],
];

export function defaultCategories(): Category[] {
  const mk = (direction: Category["direction"], base: number) => (s: Seed, i: number): Category => ({
    id: s[0], label: s[1], icon: s[2], status: s[3] ?? "active", budgetEligible: s[4] ?? direction === "expense",
    legacyAliases: s[5] ?? [], direction, order: base + i * 10, color: "",
  });
  return [...INCOME.map(mk("income", 10)), ...EXPENSE.map(mk("expense", 110))];
}

export const TYPE_LABEL: Record<MovementType, string> = {
  "": "Da classificare",
  income: "Entrata",
  expense: "Uscita",
  transfer_out: "Giroconto in uscita",
  transfer_in: "Giroconto in entrata",
  invest_buy: "Acquisto investimento",
  invest_sell: "Vendita investimento",
  advance_out: "Anticipo pagato",
  refund_in: "Rimborso ricevuto",
};
export const TYPE_ICON: Record<MovementType, string> = {
  "": "❔", income: "↘", expense: "↗", transfer_out: "⇄", transfer_in: "⇄",
  invest_buy: "📈", invest_sell: "📉", advance_out: "🤝", refund_in: "↩",
};
export const TYPES: MovementType[] = ["income", "expense", "transfer_out", "transfer_in", "invest_buy", "invest_sell", "advance_out", "refund_in"];

/** Valori della v3.10 ("✅ Entrata reale"…) -> codice v4. */
export const LEGACY_TYPE: Record<string, MovementType> = {
  "✅ Entrata reale": "income",
  "❌ Uscita reale": "expense",
  "🔄 Giroconto uscita": "transfer_out",
  "🔄 Giroconto entrata": "transfer_in",
  "📈 Acquisto investimento": "invest_buy",
  "📉 Vendita investimento": "invest_sell",
  "💸 Anticipo pagato": "advance_out",
  "💰 Rimborso ricevuto": "refund_in",
};
export const isTransfer = (t: MovementType) => t === "transfer_in" || t === "transfer_out";
export const isInvest = (t: MovementType) => t === "invest_buy" || t === "invest_sell";
export const needsCategory = (t: MovementType) => t === "income" || t === "expense";
