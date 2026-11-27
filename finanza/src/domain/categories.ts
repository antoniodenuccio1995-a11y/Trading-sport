import type { Category, MovementType } from "./types.ts";

/**
 * Gruppi di spesa: al massimo 7 colori categoriali fissi + "Altro" neutro.
 * Il colore segue il gruppo (non la posizione in classifica), così resta uguale
 * in ogni grafico e con ogni filtro. Id, colori e icone dei gruppi sono fissi;
 * il titolare può cambiare il nome dei gruppi (Settings.groupLabels) e il gruppo
 * di ogni categoria (Category.group): vedi configureCategories().
 */
export interface Group { id: string; label: string; slot: number; icon: string }
export const DEFAULT_GROUP_LABELS: Readonly<Record<string, string>> = {
  casa: "Casa e bollette",
  cibo: "Spesa alimentare",
  svago: "Svago e uscite",
  persona: "Salute e persona",
  crescita: "Formazione e tecnologia",
  mobilita: "Auto e trasporti",
  altro: "Tasse, banche e altro",
};
/** Elenco ordinato dei gruppi. `label` riflette i nomi scelti dal titolare (aggiornato da configureCategories). */
export const GROUPS: Group[] = [
  { id: "casa", label: DEFAULT_GROUP_LABELS.casa, slot: 1, icon: "🏠" },
  { id: "cibo", label: DEFAULT_GROUP_LABELS.cibo, slot: 2, icon: "🛒" },
  { id: "svago", label: DEFAULT_GROUP_LABELS.svago, slot: 4, icon: "🎟️" },
  { id: "persona", label: DEFAULT_GROUP_LABELS.persona, slot: 5, icon: "🩺" },
  { id: "crescita", label: DEFAULT_GROUP_LABELS.crescita, slot: 6, icon: "🎓" },
  { id: "mobilita", label: DEFAULT_GROUP_LABELS.mobilita, slot: 7, icon: "🚗" },
  { id: "altro", label: DEFAULT_GROUP_LABELS.altro, slot: 0, icon: "🧾" },
];
// slot 3 (acqua) = Entrate e slot 8 (rosso) = Uscite in tutti i grafici: non usati dai gruppi.
const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));
export const GROUP_IDS: readonly string[] = GROUPS.map((g) => g.id);
export const isGroupId = (id: unknown): id is string => typeof id === "string" && GROUP_BY_ID.has(id);
/** Gruppo per id (undefined se l'id non è un gruppo). */
export const findGroup = (id: string): Group | undefined => GROUP_BY_ID.get(id);

/** Gruppo predefinito di ogni categoria di spesa (le categorie non elencate vanno in "altro"). */
const G: Record<string, string> = {
  "exp.housing": "casa", "exp.utilities": "casa", "exp.home": "casa",
  "exp.groceries": "cibo",
  "exp.mobility": "mobilita", "exp.vehicle": "mobilita",
  // Ristorazione: soprattutto uscite a mangiare fuori, quindi svago più che spesa alimentare.
  "exp.dining": "svago", "exp.leisure": "svago", "exp.travel": "svago", "exp.betting": "svago", "exp.gifts": "svago", "exp.events": "svago",
  "exp.health": "persona", "exp.personal_care": "persona", "exp.clothing": "persona",
  "exp.education": "crescita", "exp.technology": "crescita",
  "exp.taxes": "altro", "exp.financial_services": "altro", "exp.rewards": "altro", "exp.other": "altro",
};
/** Id del gruppo predefinito di una categoria (senza le scelte del titolare). */
export const defaultGroupId = (categoryId: string): string => G[categoryId] ?? "altro";
/** Id del gruppo di una categoria: quello scelto dal titolare se valido, altrimenti il predefinito. */
export const categoryGroupId = (c: Pick<Category, "id" | "group">): string => (isGroupId(c.group) ? c.group : defaultGroupId(c.id));
/** Nome predefinito di un gruppo. */
export const defaultGroupLabel = (groupId: string): string => DEFAULT_GROUP_LABELS[groupId] ?? groupId;

// ---------- registro a runtime ----------
// Lo stato (store.ts) chiama configureCategories() a ogni cambio dell'istantanea, così
// groupOf(), GROUPS[].label e tutto ciò che ne dipende seguono le scelte del titolare.
let overrides = new Map<string, string>();

/**
 * Ricostruisce il registro: gruppi scelti per le categorie (Category.group) e nomi dei gruppi
 * (Settings.groupLabels). Aggiorna sul posto `label` degli oggetti di GROUPS.
 */
export function configureCategories(categories: readonly Pick<Category, "id" | "group">[] = [], groupLabels: Readonly<Record<string, string>> = {}): void {
  const next = new Map<string, string>();
  for (const c of categories) if (isGroupId(c.group) && c.group !== defaultGroupId(c.id)) next.set(c.id, c.group);
  overrides = next;
  for (const g of GROUPS) {
    const custom = typeof groupLabels?.[g.id] === "string" ? groupLabels[g.id].trim() : "";
    g.label = custom || DEFAULT_GROUP_LABELS[g.id];
  }
}

/** Gruppo di spesa di una categoria, secondo il registro (scelta del titolare, poi predefinito). */
export function groupOf(categoryId: string): Group {
  return GROUP_BY_ID.get(overrides.get(categoryId) ?? defaultGroupId(categoryId))!;
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
const DEFAULT_IDS = new Set([...INCOME, ...EXPENSE].map((s) => s[0]));
/** Categoria predefinita dell'app (non si elimina: normalize() la ricreerebbe; al massimo si nasconde). */
export const isDefaultCategory = (id: string): boolean => DEFAULT_IDS.has(id);

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
