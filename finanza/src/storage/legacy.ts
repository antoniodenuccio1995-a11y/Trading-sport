// Migrazione dal backup JSON della v3.x ("Esporta JSON" = l'intero stato).
// Nulla viene scartato: i campi senza equivalente finiscono in movement.legacy.
import type { Account, Movement, MovementType, Rule, RuleStatus, Snapshot, Split } from "../domain/types.ts";
import { LEGACY_TYPE } from "../domain/categories.ts";
import { makeMovement, uid } from "../domain/movement.ts";
import { emptySnapshot } from "../state/defaults.ts";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function isLegacyBackup(d: unknown): d is Any {
  const x = d as Any;
  return !!x && Array.isArray(x.movements) && x.movements.every((m: Any) => m && typeof m.id === "string" && "descriptionRaw" in m && "source" in m);
}

const LEGACY_LABEL: Record<string, string> = {
  "Stipendio": "inc.salary", "Freelance / Fattura": "inc.self_employment", "Rimborso fiscale": "inc.tax_refund", "Altro Entrate": "inc.other",
  "Affitto / Mutuo": "exp.housing", "Spesa Alimentare": "exp.groceries", "Trasporti / Carburante": "exp.mobility", "Utenze": "exp.utilities",
  "Ristorazione": "exp.dining", "Salute / Farmacia": "exp.health", "Abbigliamento": "exp.clothing", "Svago / Hobby": "exp.leisure",
  "Istruzione / Formazione": "exp.education", "Tasse / F24": "exp.taxes", "Altro Uscite": "exp.other", "Spesa per la Casa": "exp.home",
  "Automezzi / Manutenzione": "exp.vehicle",
};

const typeOf = (t: unknown): MovementType => LEGACY_TYPE[String(t ?? "")] ?? "";

function catOf(o: Any, type: MovementType, valid: Set<string>): string {
  if (o.categoryId && valid.has(o.categoryId)) return o.categoryId;
  if (o.categoryId === "" && o.migrationVersion) return ""; // la v3.8.2 ha deciso esplicitamente "nessuna categoria"
  const label = String(o.category ?? "").trim();
  if (!label) return "";
  if (LEGACY_LABEL[label]) return LEGACY_LABEL[label];
  if (label === "Investimenti / Dividendi") return type === "income" ? "inc.financial_income" : "";
  if (label === "Regali") return type === "income" || Number(o.amount) > 0 ? "inc.gifts" : "exp.gifts";
  if (label === "Matrimoni / Cerimonie") return "exp.events";
  if (label === "Viaggi / Vacanze") return "exp.travel";
  if (label === "Scommesse") return "exp.betting";
  return "";
}

const RULE_STATUS: Record<string, RuleStatus> = { "Regola": "rule", "Ambigua": "ambiguous", "Match automatico": "auto-match", "Candidato giroconto": "candidate" };
const KNOWN = new Set(["id", "source", "account", "externalId", "date", "dateTime", "valueDate", "descriptionRaw", "amount", "currency", "sourceType", "sourceCategory", "raw",
  "type", "category", "categoryId", "counterparty", "manualLock", "ruleStatus", "matchedTo", "importId", "correctedDate", "correctedDescription", "correctedAmount",
  "inputIssue", "splits", "manualTransferMatch", "deletedAt", "excludedFromAccounting", "deferredWallet", "project", "signature", "note", "notes"]);

export function fromLegacy(d: Any): { snapshot: Snapshot; report: string[] } {
  const s = emptySnapshot();
  const valid = new Set(s.categories.map((c) => c.id));
  const report: string[] = [];
  let noCat = 0, keptCat = 0, splits = 0, trashed = 0;

  s.movements = (d.movements as Any[]).map((o): Movement => {
    const type = typeOf(o.type);
    const categoryId = catOf(o, type, valid);
    if (categoryId) keptCat++; else if (type === "income" || type === "expense") noCat++;
    const sp: Split[] = Array.isArray(o.splits) ? o.splits.map((x: Any) => {
      const t = typeOf(x.type);
      return { id: String(x.id ?? uid()), amount: Number(x.amount) || 0, type: t, categoryId: catOf(x, t, valid), counterparty: String(x.counterparty ?? ""), description: String(x.description ?? "") };
    }) : [];
    if (sp.length) splits++;
    if (o.deletedAt) trashed++;
    const legacy: Any = {};
    for (const k of Object.keys(o)) if (!KNOWN.has(k)) legacy[k] = o[k];
    if (o.category) legacy.category = o.category;
    if (o.type) legacy.type = o.type;
    const m = makeMovement({
      id: o.id, account: String(o.source || o.account || "Altro conto"), date: String(o.date ?? ""), dateTime: String(o.dateTime ?? ""),
      valueDate: String(o.valueDate ?? ""), description: String(o.descriptionRaw ?? ""), amount: Number(o.amount) || 0, currency: String(o.currency || "EUR"),
      externalId: String(o.externalId ?? ""), sourceType: String(o.sourceType ?? ""), sourceCategory: String(o.sourceCategory ?? ""), raw: (o.raw && typeof o.raw === "object") ? o.raw : {},
      type, categoryId, counterparty: String(o.counterparty ?? ""), note: String(o.note ?? o.notes ?? ""), project: String(o.project ?? ""),
      lock: !!o.manualLock, ruleStatus: RULE_STATUS[o.ruleStatus] ?? "", matchedTo: o.matchedTo ?? null, manualMatch: !!o.manualTransferMatch,
      splits: sp, corrected: {
        ...(o.correctedDate ? { date: String(o.correctedDate) } : {}),
        ...(o.correctedDescription != null ? { description: String(o.correctedDescription) } : {}),
        ...(o.correctedAmount != null && Number.isFinite(Number(o.correctedAmount)) ? { amount: Number(o.correctedAmount) } : {}),
      },
      inputIssue: String(o.inputIssue ?? ""), importId: String(o.importId ?? ""), deletedAt: o.deletedAt ? String(o.deletedAt) : null,
      excluded: !!o.excludedFromAccounting, deferredWallet: !!o.deferredWallet, legacy, signature: typeof o.signature === "string" ? o.signature : "",
    });
    return m;
  });

  // regole
  s.rules = Array.isArray(d.rules) ? d.rules.map((r: Any): Rule => {
    const type = typeOf(r.type);
    return { id: String(r.id ?? uid()), account: String(r.source ?? ""), contains: String(r.contains ?? ""), sign: r.sign === "+" || r.sign === "-" ? r.sign : "",
      type, categoryId: catOf(r, type, valid), counterparty: String(r.counterparty ?? ""), priority: Number(r.priority) || 0, active: r.active !== false };
  }) : s.rules;

  // conti e saldi iniziali
  const names = new Set<string>(s.accounts.map((a) => a.id));
  const ib: Any = d.initialBalances ?? {};
  for (const m of s.movements) names.add(m.account);
  for (const k of Object.keys(ib)) names.add(k);
  const base = new Map(s.accounts.map((a) => [a.id, a]));
  s.accounts = [...names].map((n): Account => ({ ...(base.get(n) ?? { id: n, name: n, kind: "other", color: "#6c7988", initialBalance: 0, initialDate: "", archived: false }), initialBalance: Number(ib[n]) || 0 }));
  for (const a of s.accounts) a.archived = !s.movements.some((m) => m.account === a.id) && !a.initialBalance;

  // budget: piano mensile v3.10.3A se presente, altrimenti il budget unico
  const plan: Any = d.budgetPlanV3103A?.values ?? {};
  const planMonths = Object.keys(plan).filter((k) => /^\d{4}-\d{2}$/.test(k));
  const flat: Record<string, number> = {};
  for (const [k, v] of Object.entries((d.budgets ?? {}) as Any)) {
    const id = valid.has(k) ? k : LEGACY_LABEL[k] ?? "";
    if (id && Number(v) > 0) flat[id] = Number(v);
  }
  if (planMonths.length) {
    s.budgets = { default: {}, months: {} };
    for (const mo of planMonths) { const vals: Record<string, number> = {}; for (const [k, v] of Object.entries(plan[mo] as Any)) if (valid.has(k) && Number.isFinite(Number(v))) vals[k] = Number(v); s.budgets.months[mo] = vals; }
    report.push(`Piano budget: ${planMonths.length} mesi`);
  } else {
    s.budgets = { default: flat, months: {} };
    if (Object.keys(flat).length) report.push(`Budget mensile: ${Object.keys(flat).length} categorie`);
  }

  s.imports = Array.isArray(d.imports) ? d.imports.map((x: Any) => ({ id: String(x.id ?? uid()), file: String(x.file ?? ""), account: String(x.source ?? ""), at: String(x.at ?? ""),
    added: Number(x.added) || 0, dups: Number(x.dups) || 0, skipped: Number(x.skipped) || 0, notes: [] })) : [];
  s.meta = { createdAt: new Date().toISOString(), migratedFrom: String(d.appVersion ?? d.version ?? "3.x") };

  report.unshift(`${s.movements.length} movimenti (${keptCat} con categoria, ${noCat} entrate/uscite senza categoria, ${splits} divisi, ${trashed} nel cestino)`, `${s.rules.length} regole`, `${s.accounts.filter((a) => !a.archived).length} conti`);
  return { snapshot: s, report };
}
