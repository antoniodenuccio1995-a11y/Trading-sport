import type { Account, Rule, Settings, Snapshot } from "../domain/types.ts";
import { defaultCategories } from "../domain/categories.ts";
import { uid } from "../domain/movement.ts";

const ACC: [string, Account["kind"], string][] = [
  ["Banca Sella", "bank", "#338ced"], ["Revolut", "card", "#9887ef"], ["Cassa", "cash", "#0aac23"],
  ["Intesa Sanpaolo", "bank", "#00a888"], ["Hype", "card", "#e24d8b"], ["Poste Italiane", "bank", "#d28e05"],
  ["Trade Republic", "broker", "#e76624"], ["Easy Bank", "bank", "#5ec8f2"], ["Binance", "crypto", "#f4ad2d"],
  ["Tinaba", "bank", "#eb6263"], ["Altro conto", "other", "#6c7988"],
];
export const defaultAccounts = (): Account[] =>
  ACC.map(([name, kind, color]) => ({ id: name, name, kind, color, initialBalance: 0, initialDate: "", archived: false }));

/** Regole iniziali con catene e servizi noti (nessun dato personale). */
const R: [string, Rule["type"], string, Rule["sign"]?][] = [
  ["CONAD", "expense", "exp.groceries"], ["COOP", "expense", "exp.groceries"], ["ESSELUNGA", "expense", "exp.groceries"],
  ["EUROSPIN", "expense", "exp.groceries"], ["LIDL", "expense", "exp.groceries"], ["CARREFOUR", "expense", "exp.groceries"],
  ["DESPAR", "expense", "exp.groceries"], ["MD SPA", "expense", "exp.groceries"], ["PENNY", "expense", "exp.groceries"],
  ["ENI", "expense", "exp.mobility"], ["Q8", "expense", "exp.mobility"], ["IPMATIC", "expense", "exp.mobility"], ["ESSO", "expense", "exp.mobility"],
  ["TAMOIL", "expense", "exp.mobility"], ["TELEPASS", "expense", "exp.mobility"], ["EASYPARK", "expense", "exp.mobility"],
  ["TRENITALIA", "expense", "exp.mobility"], ["ITALO", "expense", "exp.mobility"],
  ["NETFLIX", "expense", "exp.leisure"], ["SPOTIFY", "expense", "exp.leisure"], ["DISNEY PLUS", "expense", "exp.leisure"], ["DAZN", "expense", "exp.leisure"],
  ["WIND TRE", "expense", "exp.utilities"], ["VODAFONE", "expense", "exp.utilities"], ["ILIAD", "expense", "exp.utilities"],
  ["FASTWEB", "expense", "exp.utilities"], ["TIM ", "expense", "exp.utilities"], ["ENEL ENERGIA", "expense", "exp.utilities"],
  ["FARMACIA", "expense", "exp.health"], ["RYANAIR", "expense", "exp.travel"], ["BOOKING.COM", "expense", "exp.travel"],
  ["MCDONALD", "expense", "exp.dining"], ["DELIVEROO", "expense", "exp.dining"], ["JUST EAT", "expense", "exp.dining"], ["GLOVO", "expense", "exp.dining"],
  ["F24", "expense", "exp.taxes", "-"], ["COMMISSIONE", "expense", "exp.financial_services", "-"], ["COSTO CARTA", "expense", "exp.financial_services", "-"],
  ["STIPENDIO", "income", "inc.salary", "+"], ["EMOLUMENTI", "income", "inc.salary", "+"],
];
export const defaultRules = (): Rule[] =>
  R.map(([contains, type, categoryId, sign]) => ({ id: uid(), account: "", contains, sign: sign ?? (type === "income" ? "+" : "-"), type, categoryId, counterparty: "", priority: 50, active: true }));

export const defaultSettings = (): Settings => ({
  ownerNames: [], theme: "auto", accent: "indaco", reduceMotion: "auto", monthStartDay: 1, hideAmounts: false,
});

export const DEFAULT_BUDGET: Record<string, number> = {
  "exp.housing": 250, "exp.groceries": 250, "exp.mobility": 160, "exp.dining": 130, "exp.health": 115,
  "exp.leisure": 40, "exp.education": 25, "exp.vehicle": 200,
};

export function emptySnapshot(): Snapshot {
  return {
    schema: 4, movements: [], rules: defaultRules(), accounts: defaultAccounts(), categories: defaultCategories(),
    budgets: { default: { ...DEFAULT_BUDGET }, months: {} }, imports: [], settings: defaultSettings(),
    meta: { createdAt: new Date().toISOString() },
  };
}

/** Completa un'istantanea letta dall'archivio con i campi aggiunti nelle versioni successive. */
export function normalize(s: Snapshot): Snapshot {
  const base = emptySnapshot();
  const out: Snapshot = { ...base, ...s, settings: { ...base.settings, ...s.settings }, budgets: { ...base.budgets, ...s.budgets }, meta: { ...base.meta, ...s.meta } };
  if (!out.categories?.length) out.categories = base.categories;
  for (const c of base.categories) if (!out.categories.some((x) => x.id === c.id)) out.categories.push(c);
  if (!out.accounts?.length) out.accounts = base.accounts;
  const names = new Set(out.accounts.map((a) => a.id));
  for (const m of out.movements) if (m.account && !names.has(m.account)) {
    names.add(m.account);
    out.accounts.push({ id: m.account, name: m.account, kind: "other", color: "#6c7988", initialBalance: 0, initialDate: "", archived: false });
  }
  return out;
}
