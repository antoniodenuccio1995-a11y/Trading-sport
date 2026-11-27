// Modello dati della v4. Compatibile con la v3.10 tramite storage/legacy.ts:
// i nomi dei conti restano gli identificativi ("Banca Sella", "Revolut", "Cassa"…)
// e la firma dei movimenti è calcolata come nella v3.10, così reimportare un
// estratto conto già presente non crea doppioni.

/** Tipo economico del movimento. Solo income/expense entrano nei KPI di spesa. */
export type MovementType =
  | ""
  | "income" // ✅ Entrata reale
  | "expense" // ❌ Uscita reale
  | "transfer_out" // 🔄 Giroconto uscita
  | "transfer_in" // 🔄 Giroconto entrata
  | "invest_buy" // 📈 Acquisto investimento
  | "invest_sell" // 📉 Vendita investimento
  | "advance_out" // 💸 Anticipo pagato (per conto di altri)
  | "refund_in"; // 💰 Rimborso ricevuto

export type RuleStatus = "" | "rule" | "ambiguous" | "auto-match" | "candidate" | "import";

export interface Split {
  id: string;
  amount: number; // con segno, la somma deve uguagliare l'importo del movimento
  type: MovementType;
  categoryId: string;
  counterparty: string;
  description: string;
}

export interface Movement {
  id: string;
  account: string; // nome del conto = identificativo
  date: string; // YYYY-MM-DD come da banca
  dateTime: string; // data e ora se la banca la fornisce ("" altrimenti)
  valueDate: string;
  description: string; // descrizione originale della banca
  amount: number; // con segno: + entra, − esce
  currency: string;
  externalId: string; // codice identificativo della banca, se presente
  sourceType: string; // tipo operazione secondo la banca (es. Revolut "Pagamento con carta")
  sourceCategory: string;
  raw: Record<string, unknown>; // riga originale, mai riscritta
  type: MovementType;
  categoryId: string;
  counterparty: string; // conto di destinazione per i giroconti, persona per anticipi/rimborsi
  note: string;
  tags: string[];
  project: string;
  lock: boolean; // classificazione manuale: regole e ricalcoli non la toccano
  ruleStatus: RuleStatus;
  ruleId: string;
  matchedTo: string | null; // id del movimento gemello del giroconto
  manualMatch: boolean;
  splits: Split[];
  corrected: { date?: string; description?: string; amount?: number };
  inputIssue: string; // problema di lettura del file (importo non numerico…)
  importId: string;
  signature: string;
  deletedAt: string | null; // cestino
  excluded: boolean; // escluso dalla contabilità (es. riga tecnica)
  deferredWallet: boolean; // deposito su wallet scommesse: non è una spesa reale finché non si chiude
  legacy?: Record<string, unknown>; // campi della v3.10 conservati senza interpretarli
}

export interface Rule {
  id: string;
  account: string; // "" = tutti i conti
  contains: string; // testo da cercare nella descrizione (normalizzata)
  sign: "" | "+" | "-";
  type: MovementType;
  categoryId: string;
  counterparty: string;
  priority: number;
  active: boolean;
  note?: string;
}

export interface Account {
  id: string; // = nome
  name: string;
  kind: "bank" | "card" | "cash" | "broker" | "crypto" | "wallet" | "other";
  initialBalance: number;
  initialDate: string; // saldo iniziale riferito a questa data ("" = prima del primo movimento)
  color: string;
  archived: boolean;
}

export type CategoryDirection = "income" | "expense";

export interface Category {
  id: string; // es. "exp.groceries"
  label: string;
  direction: CategoryDirection;
  status: "active" | "inactive" | "conditional";
  budgetEligible: boolean;
  order: number;
  color: string;
  icon: string; // un'emoji breve
  legacyAliases: string[];
  /** Gruppo di spesa scelto dal titolare (id di GROUPS); assente = gruppo predefinito. */
  group?: string;
}

/** Budget mensile per categoria. `default` vale per ogni mese senza override. */
export interface Budgets {
  default: Record<string, number>; // categoryId -> € al mese (positivo)
  months: Record<string, Record<string, number>>; // "YYYY-MM" -> categoryId -> €
}

export interface ImportLog {
  id: string;
  file: string;
  account: string;
  at: string;
  added: number;
  dups: number;
  skipped: number;
  notes: string[];
}

export interface Settings {
  ownerNames: string[]; // nomi del titolare usati per riconoscere i giroconti ("PAGAMENTO DA …")
  theme: "auto" | "dark" | "light";
  accent: string;
  reduceMotion: "auto" | "on" | "off";
  monthStartDay: number; // 1 = mese solare; 27 = "mese dello stipendio"
  hideAmounts: boolean;
  /** Nomi dei gruppi di spesa cambiati dal titolare (id gruppo -> nome). */
  groupLabels?: Record<string, string>;
}

export interface Snapshot {
  schema: 4;
  movements: Movement[];
  rules: Rule[];
  accounts: Account[];
  categories: Category[];
  budgets: Budgets;
  imports: ImportLog[];
  settings: Settings;
  meta: { createdAt: string; migratedFrom?: string; demo?: boolean };
  /** Portafoglio investimenti (strumenti, operazioni, prezzi): vedi src/invest/types.ts. */
  investments?: import("../invest/types.ts").InvestData;
}

/** Riga prodotta da un importatore, prima di diventare Movement. */
export interface ImportedRow {
  account: string;
  date: string;
  dateTime: string;
  valueDate: string;
  description: string;
  amount: number;
  currency: string;
  externalId: string;
  sourceType: string;
  sourceCategory: string;
  raw: Record<string, unknown>;
  inputIssue: string;
  /** Classificazione proposta dall'importatore (regole specifiche della banca). */
  type: MovementType;
  categoryId: string;
  counterparty: string;
  ruleStatus: RuleStatus;
  /** Quote proposte dall'importatore (es. rientro deposito Tinaba = capitale + interessi). */
  splits?: Split[];
}

export interface ImportResult {
  account: string;
  file: string;
  rows: ImportedRow[];
  skipped: number; // righe ignorate (annullate, intestazioni, vuote)
  notes: string[]; // diagnostica leggibile, in italiano
}

/** Riga "effettiva" per le analisi: i movimenti divisi in quote diventano più righe. */
export interface Line {
  id: string;
  parentId: string;
  account: string;
  date: string; // data effettiva (corretta se corretta)
  month: string; // YYYY-MM secondo Settings.monthStartDay
  amount: number;
  type: MovementType;
  categoryId: string;
  counterparty: string;
  description: string;
  merchant: string; // descrizione ripulita per raggruppare (es. "CONAD")
  isSplit: boolean;
  unbalanced: boolean; // movimento diviso in quote che non quadrano: escluso dai KPI
  deferredWallet: boolean;
}
