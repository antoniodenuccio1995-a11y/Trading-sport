// Azioni sulle categorie: nome, icona, gruppo, visibilità, budget, nuove categorie, unione e nomi dei gruppi.
// Le funzioni "pure" lavorano su un'istantanea (si provano senza archivio); quelle esportate in fondo
// passano da mutate(), che salva, ricostruisce il registro dei gruppi e aggiorna le pagine.
import type { Category, CategoryDirection, Snapshot } from "../domain/types.ts";
import { defaultCategories, defaultGroupId, defaultGroupLabel, isDefaultCategory, isGroupId } from "../domain/categories.ts";
import { mutate } from "./store.ts";

export interface CategoryPatch {
  label?: string;
  icon?: string;
  /** Id del gruppo (solo uscite); null o il gruppo predefinito = torna al predefinito. */
  group?: string | null;
  /** false = nascosta (non compare nei selettori). */
  active?: boolean;
  budgetEligible?: boolean;
}

export interface NewCategory {
  direction: CategoryDirection;
  label: string;
  icon?: string;
  group?: string;
  budgetEligible?: boolean;
}

export interface MergeImpact {
  /** Movimenti (fuori dal cestino) con la categoria o con una quota nella categoria. */
  movements: number;
  /** Quote di movimenti divisi. */
  splits: number;
  rules: number;
  /** Valori di budget (predefinito + mesi). */
  budgets: number;
}
export interface MergeResult extends MergeImpact {
  /** true = categoria eliminata; false = categoria predefinita, resta nascosta e vuota. */
  removed: boolean;
}

const MAX_LABEL = 60;
const MAX_GROUP_LABEL = 40;
export const DEFAULT_ICON = "🏷️";

/** Prima emoji (o primo carattere) del testo, così un'icona resta un solo simbolo. */
export function cleanIcon(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) for (const part of new Seg("it", { granularity: "grapheme" }).segment(t)) return part.segment;
  return Array.from(t)[0] ?? "";
}

/** Parte leggibile dell'id: minuscole senza accenti, parole unite da "_". */
export function slugOf(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32).replace(/_+$/, "");
}

/** Id nuovo e unico: "exp.u_<slug>" o "inc.u_<slug>" (con _2, _3… se già usato). */
export function newCategoryId(s: Pick<Snapshot, "categories">, direction: CategoryDirection, label: string): string {
  const base = (direction === "income" ? "inc.u_" : "exp.u_") + (slugOf(label) || "categoria");
  const used = new Set(s.categories.map((c) => c.id));
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
  return id;
}

/** Stato da ripristinare quando una categoria nascosta torna visibile (es. "conditional" per le scommesse). */
function shownStatus(c: Category): Category["status"] {
  if (c.status !== "inactive") return c.status;
  const seed = isDefaultCategory(c.id) ? defaultCategories().find((x) => x.id === c.id) : undefined;
  return seed && seed.status !== "inactive" ? seed.status : "active";
}

/** Applica le modifiche a una categoria dell'istantanea. Restituisce false se la categoria non esiste. */
export function applyCategoryPatch(s: Pick<Snapshot, "categories">, id: string, p: CategoryPatch): boolean {
  const c = s.categories.find((x) => x.id === id);
  if (!c) return false;
  if (p.label !== undefined) { const t = p.label.trim().slice(0, MAX_LABEL); if (t) c.label = t; }
  if (p.icon !== undefined) { const i = cleanIcon(p.icon); if (i) c.icon = i; }
  if (p.group !== undefined && c.direction === "expense") {
    if (p.group === null || p.group === defaultGroupId(c.id) || !isGroupId(p.group)) delete c.group;
    else c.group = p.group;
  }
  if (p.active !== undefined) c.status = p.active ? shownStatus(c) : "inactive";
  if (p.budgetEligible !== undefined && c.direction === "expense") c.budgetEligible = p.budgetEligible;
  return true;
}

/** Aggiunge una categoria e ne restituisce l'id ("" se il nome è vuoto). */
export function addCategory(s: Pick<Snapshot, "categories">, n: NewCategory): string {
  const label = n.label.trim().slice(0, MAX_LABEL);
  if (!label) return "";
  const id = newCategoryId(s, n.direction, label);
  const order = Math.max(n.direction === "income" ? 0 : 100, ...s.categories.filter((c) => c.direction === n.direction).map((c) => c.order || 0)) + 10;
  const c: Category = {
    id, label, direction: n.direction, status: "active", order, color: "",
    icon: cleanIcon(n.icon ?? "") || DEFAULT_ICON,
    budgetEligible: n.direction === "expense" ? (n.budgetEligible ?? true) : false,
    legacyAliases: [],
  };
  if (n.direction === "expense" && isGroupId(n.group) && n.group !== defaultGroupId(id)) c.group = n.group;
  s.categories.push(c);
  return id;
}

/** Cosa sposterebbe l'unione di `fromId` in un'altra categoria. */
export function mergeImpact(s: Pick<Snapshot, "movements" | "rules" | "budgets">, fromId: string): MergeImpact {
  let movements = 0, splits = 0, budgets = 0;
  for (const m of s.movements) {
    const n = m.splits.filter((x) => x.categoryId === fromId).length;
    splits += n;
    if (!m.deletedAt && (m.categoryId === fromId || n > 0)) movements++;
  }
  if (fromId in (s.budgets.default ?? {})) budgets++;
  for (const o of Object.values(s.budgets.months ?? {})) if (fromId in o) budgets++;
  return { movements, splits, rules: s.rules.filter((r) => r.categoryId === fromId).length, budgets };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Unisce `fromId` in `toId` (stessa direzione): movimenti (anche nel cestino), quote, regole e budget
 * passano a `toId`; i budget si sommano mese per mese. Poi `fromId` viene eliminata se creata dal
 * titolare, oppure nascosta se è una categoria predefinita. null se l'unione non è possibile.
 */
export function mergeCategoryInto(s: Snapshot, fromId: string, toId: string): MergeResult | null {
  const from = s.categories.find((c) => c.id === fromId), to = s.categories.find((c) => c.id === toId);
  if (!from || !to || fromId === toId || from.direction !== to.direction) return null;
  const impact = mergeImpact(s, fromId);
  for (const m of s.movements) {
    if (m.categoryId === fromId) m.categoryId = toId;
    for (const x of m.splits) if (x.categoryId === fromId) x.categoryId = toId;
  }
  for (const r of s.rules) if (r.categoryId === fromId) r.categoryId = toId;
  // Budget: in ogni mese con un valore proprio, il nuovo valore è la somma di quanto valevano le due categorie.
  const d = s.budgets.default;
  for (const o of Object.values(s.budgets.months)) {
    if (!(fromId in o) && !(toId in o)) continue;
    o[toId] = round2((o[fromId] ?? d[fromId] ?? 0) + (o[toId] ?? d[toId] ?? 0));
    delete o[fromId];
  }
  if (fromId in d) { d[toId] = round2((d[fromId] ?? 0) + (d[toId] ?? 0)); delete d[fromId]; }
  const removed = !isDefaultCategory(fromId);
  if (removed) s.categories = s.categories.filter((c) => c.id !== fromId);
  else from.status = "inactive";
  return { ...impact, removed };
}

/** Cambia il nome di un gruppo; vuoto o uguale al predefinito = torna al nome predefinito. */
export function setGroupLabel(s: Pick<Snapshot, "settings">, groupId: string, label: string): void {
  if (!isGroupId(groupId)) return;
  const t = label.trim().slice(0, MAX_GROUP_LABEL);
  const labels = { ...(s.settings.groupLabels ?? {}) };
  if (!t || t === defaultGroupLabel(groupId)) delete labels[groupId];
  else labels[groupId] = t;
  s.settings.groupLabels = labels; // resta un oggetto (anche vuoto) perché la sincronizzazione propaghi il ripristino
}

// ---------- azioni sullo stato ----------
export const updateCategory = (id: string, patch: CategoryPatch) => mutate((s) => { applyCategoryPatch(s, id, patch); });
export const rename = (id: string, label: string) => updateCategory(id, { label });
export const setIcon = (id: string, icon: string) => updateCategory(id, { icon });
export const setGroup = (id: string, group: string | null) => updateCategory(id, { group });
export const setActive = (id: string, active: boolean) => updateCategory(id, { active });
export const setBudgetEligible = (id: string, budgetEligible: boolean) => updateCategory(id, { budgetEligible });
export function create(n: NewCategory): string {
  let id = "";
  mutate((s) => { id = addCategory(s, n); });
  return id;
}
export function merge(fromId: string, toId: string): MergeResult | null {
  let r: MergeResult | null = null;
  mutate((s) => { r = mergeCategoryInto(s, fromId, toId); });
  return r;
}
export const renameGroup = (groupId: string, label: string) => mutate((s) => setGroupLabel(s, groupId, label));
