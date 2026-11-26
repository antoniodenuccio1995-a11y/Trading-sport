// Azioni sui dati: importazione, modifica dei movimenti, regole, backup.
import type { ImportedRow, Movement, MovementType, Rule, Snapshot, Split } from "../domain/types.ts";
import { amountOf, descOf, makeMovement, norm, uid } from "../domain/movement.ts";
import { applyRules, reprocess, rematchTransfers, ruleTextFrom, type BaseClassifier } from "../domain/classify.ts";
import { isTransfer } from "../domain/categories.ts";
import { getSnap, mutate, replace } from "./store.ts";
import { emptySnapshot } from "./defaults.ts";
import { parseBankFile, baseClassify as bankBase, dedupeKeys } from "../import/index.ts";
import type { XLSXLike } from "../import/index.ts";
import { fromLegacy, isLegacyBackup } from "../storage/legacy.ts";

const base: BaseClassifier = (m, owners) => bankBase(m, owners);

// ---------- SheetJS su richiesta ----------
let xlsxPromise: Promise<XLSXLike> | null = null;
export function loadXlsx(): Promise<XLSXLike> {
  const w = globalThis as unknown as { XLSX?: XLSXLike };
  if (w.XLSX) return Promise.resolve(w.XLSX);
  return (xlsxPromise ??= new Promise<XLSXLike>((resolve, reject) => {
    const s = document.createElement("script");
    const embedded = document.getElementById("xlsx-src");
    if (embedded) s.textContent = embedded.textContent; // file unico: libreria incorporata come testo, eseguita solo ora
    else s.src = "./vendor/xlsx.full.min.js";
    s.onload = () => (w.XLSX ? resolve(w.XLSX) : reject(new Error("Lettore Excel non disponibile")));
    s.onerror = () => { xlsxPromise = null; reject(new Error("Impossibile caricare il lettore Excel")); };
    document.head.appendChild(s);
    if (embedded) w.XLSX ? resolve(w.XLSX) : reject(new Error("Lettore Excel non disponibile"));
  }));
}
export const prefetchXlsx = () => { void loadXlsx().catch(() => {}); };

// ---------- importazione estratti conto ----------
export interface FileReport { file: string; account: string; added: number; dups: number; skipped: number; notes: string[]; error?: string }

function rowOf(m: Movement): ImportedRow {
  return { account: m.account, date: m.date, dateTime: m.dateTime, valueDate: m.valueDate, description: m.description, amount: m.amount, currency: m.currency,
    externalId: m.externalId, sourceType: m.sourceType, sourceCategory: m.sourceCategory, raw: m.raw, inputIssue: m.inputIssue,
    type: m.type, categoryId: m.categoryId, counterparty: m.counterparty, ruleStatus: m.ruleStatus };
}

export async function importBankFiles(files: File[]): Promise<FileReport[]> {
  const s = getSnap();
  const needsXlsx = files.some((f) => /\.xlsx?$/i.test(f.name));
  const xlsx = needsXlsx ? await loadXlsx() : undefined;
  const known = new Set<string>();
  for (const m of s.movements) for (const k of dedupeKeys(rowOf(m))) known.add(k);
  const reports: FileReport[] = [];
  const fresh: Movement[] = [];
  for (const f of files) {
    try {
      const res = await parseBankFile(f, { xlsx, ownerNames: s.settings.ownerNames });
      const importId = uid();
      let added = 0, dups = 0;
      for (const row of res.rows) {
        const keys = dedupeKeys(row);
        if (keys.some((k) => known.has(k))) { dups++; continue; }
        keys.forEach((k) => known.add(k));
        const m = makeMovement({ ...row, ruleStatus: row.type || row.categoryId ? "import" : row.ruleStatus }, importId);
        applyRules(m, s.rules, base, s.settings.ownerNames);
        fresh.push(m); added++;
      }
      reports.push({ file: f.name, account: res.account, added, dups, skipped: res.skipped, notes: res.notes });
      s.imports.push({ id: importId, file: f.name, account: res.account, at: new Date().toISOString(), added, dups, skipped: res.skipped, notes: res.notes });
    } catch (e) {
      reports.push({ file: f.name, account: "", added: 0, dups: 0, skipped: 0, notes: [], error: (e as Error).message });
    }
  }
  mutate((x) => {
    if (x.meta.demo && fresh.length) { x.movements = []; x.meta.demo = false; }
    x.movements.push(...fresh);
    for (const m of fresh) if (!x.accounts.some((a) => a.id === m.account)) x.accounts.push({ id: m.account, name: m.account, kind: "other", color: "#6c7988", initialBalance: 0, initialDate: "", archived: false });
    rematchTransfers(x.movements);
  });
  return reports;
}

// ---------- modifica movimenti ----------
const find = (s: Snapshot, id: string) => s.movements.find((m) => m.id === id);

export function updateMovement(id: string, patch: Partial<Movement>, lock = true) {
  mutate((s) => {
    const m = find(s, id); if (!m) return;
    const wasTransfer = isTransfer(m.type);
    Object.assign(m, patch);
    if (lock) { m.lock = true; m.ruleStatus = m.ruleStatus === "ambiguous" ? "" : m.ruleStatus; }
    if (wasTransfer !== isTransfer(m.type) || "counterparty" in patch || "amount" in patch) rematchTransfers(s.movements);
  });
}
export const setCategory = (id: string, categoryId: string) => {
  const m = find(getSnap(), id);
  const type: MovementType | undefined = m && !m.type ? (categoryId.startsWith("inc.") ? "income" : categoryId ? "expense" : "") : undefined;
  updateMovement(id, type !== undefined ? { categoryId, type } : { categoryId });
};
export function setCategoryMany(ids: string[], categoryId: string) {
  mutate((s) => { const set = new Set(ids); for (const m of s.movements) if (set.has(m.id)) { m.categoryId = categoryId; if (!m.type) m.type = categoryId.startsWith("inc.") ? "income" : "expense"; m.lock = true; } });
}
export const trash = (id: string, on = true) => mutate((s) => { const m = find(s, id); if (m) { m.deletedAt = on ? new Date().toISOString() : null; rematchTransfers(s.movements); } });
export const unlock = (id: string) => mutate((s) => { const m = find(s, id); if (m) { m.lock = false; m.ruleStatus = ""; applyRules(m, s.rules, base, s.settings.ownerNames); rematchTransfers(s.movements); } });

export function linkTransfer(a: string, b: string) {
  mutate((s) => {
    const x = find(s, a), y = find(s, b); if (!x || !y) return;
    for (const m of s.movements) if (m.matchedTo === a || m.matchedTo === b) { m.matchedTo = null; m.manualMatch = false; }
    x.matchedTo = b; y.matchedTo = a; x.manualMatch = y.manualMatch = true;
    x.counterparty = y.account; y.counterparty = x.account; x.lock = y.lock = true;
  });
}
export function unlinkTransfer(a: string) {
  mutate((s) => { const x = find(s, a); if (!x) return; const y = x.matchedTo ? find(s, x.matchedTo) : null; x.matchedTo = null; x.manualMatch = false; if (y) { y.matchedTo = null; y.manualMatch = false; } });
}
export function transferCandidates(id: string): Movement[] {
  const s = getSnap(), m = find(s, id); if (!m) return [];
  const t = Date.parse(m.date), a = amountOf(m);
  return s.movements.filter((x) => x.id !== id && !x.deletedAt && x.account !== m.account && Math.abs(amountOf(x) + a) < 0.005 && Math.abs(Date.parse(x.date) - t) <= 12 * 86400000)
    .sort((p, q) => Math.abs(Date.parse(p.date) - t) - Math.abs(Date.parse(q.date) - t)).slice(0, 8);
}

export function setSplits(id: string, splits: Split[]) { updateMovement(id, { splits }); }
export const newSplit = (amount: number, categoryId = "", type: MovementType = "expense"): Split => ({ id: uid(), amount, type, categoryId, counterparty: "", description: "" });

export function addManual(p: { account: string; date: string; description: string; amount: number; type: MovementType; categoryId: string; counterparty?: string }) {
  mutate((s) => {
    const m = makeMovement({ ...p, counterparty: p.counterparty ?? "", lock: true, raw: { manuale: true } }, "manual");
    s.movements.push(m);
    if (isTransfer(m.type)) rematchTransfers(s.movements);
  });
}

// ---------- regole ----------
export function ruleFromMovement(id: string): Rule | null {
  const s = getSnap(), m = find(s, id); if (!m) return null;
  return { id: uid(), account: m.account, contains: ruleTextFrom(descOf(m)), sign: amountOf(m) < 0 ? "-" : "+", type: m.type, categoryId: m.categoryId, counterparty: isTransfer(m.type) ? m.counterparty : "", priority: 60, active: true };
}
export function saveRule(r: Rule, applyNow = true) {
  mutate((s) => {
    const i = s.rules.findIndex((x) => x.id === r.id);
    if (i >= 0) s.rules[i] = r; else s.rules.push(r);
    if (applyNow) for (const m of s.movements) if (!m.lock && !m.deletedAt) applyRules(m, s.rules, base, s.settings.ownerNames);
    rematchTransfers(s.movements);
  });
}
export const deleteRule = (id: string) => mutate((s) => { s.rules = s.rules.filter((r) => r.id !== id); });
export const reclassifyAll = () => mutate((s) => reprocess(s.movements, s.rules, base, s.settings.ownerNames));
export const rulePreview = (r: Rule) => {
  const n = norm(r.contains); if (!n) return 0;
  return getSnap().movements.filter((m) => !m.deletedAt && (!r.account || m.account === r.account) && norm(descOf(m)).includes(n) && (r.sign !== "+" || amountOf(m) > 0) && (r.sign !== "-" || amountOf(m) < 0)).length;
};

// ---------- backup ----------
export function download(name: string, content: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function exportBackup() {
  const s = getSnap();
  download(`finanza-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "finanza-personale", schema: 4, exportedAt: new Date().toISOString(), snapshot: s }));
}
export function exportCsv() {
  const s = getSnap(), cats = new Map(s.categories.map((c) => [c.id, c.label]));
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Data", "Conto", "Descrizione", "Importo", "Tipo", "Categoria", "Controparte", "Note"].join(";")];
  for (const m of [...s.movements].filter((m) => !m.deletedAt).sort((a, b) => a.date.localeCompare(b.date)))
    rows.push([m.corrected.date || m.date, m.account, descOf(m), String(amountOf(m)).replace(".", ","), m.type, cats.get(m.categoryId) ?? "", m.counterparty, m.note].map(q).join(";"));
  download(`movimenti-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + rows.join("\n"), "text/csv;charset=utf-8");
}

/** Legge un backup JSON della v4 o della v3.10 e restituisce l'istantanea pronta, senza applicarla. */
export async function readBackup(file: File): Promise<{ snapshot: Snapshot; source: string; report: string[] }> {
  const data = JSON.parse(await file.text());
  if (data?.app === "finanza-personale" && data.snapshot?.schema === 4) return { snapshot: data.snapshot, source: "v4", report: [`${data.snapshot.movements.length} movimenti`] };
  if (data?.schema === 4 && Array.isArray(data.movements)) return { snapshot: data, source: "v4", report: [`${data.movements.length} movimenti`] };
  if (isLegacyBackup(data)) { const r = fromLegacy(data); return { snapshot: r.snapshot, source: "v3.10", report: r.report }; }
  throw new Error("File non riconosciuto: serve un backup JSON di Finanza Personale (v3.x o v4).");
}
export const applyBackup = (s: Snapshot) => replace(s);
export const resetAll = () => replace(emptySnapshot());
export function updateSettings(patch: Partial<Snapshot["settings"]>) { mutate((s) => Object.assign(s.settings, patch)); }
