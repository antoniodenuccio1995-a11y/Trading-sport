// Motore regole, abbinamento giroconti e stato dei movimenti.
// Stessa logica della v3.10 (priorità, ambiguità, blocco manuale, abbinamento univoco
// entro 5 giorni) ma con indici per non essere quadratico sui grandi archivi.
import type { Movement, MovementType, Rule, RuleStatus } from "./types.ts";
import { amountOf, dateOf, descOf, hasSplits, norm, splitBalanced } from "./movement.ts";
import { isTransfer, needsCategory } from "./categories.ts";

export type BaseClassifier = (
  m: { account: string; amount: number; description: string; sourceType: string; type: MovementType; counterparty: string; ruleStatus: RuleStatus },
  ownerNames: string[],
) => Partial<{ type: MovementType; counterparty: string; ruleStatus: RuleStatus }>;

export function ruleMatches(r: Rule, m: Movement): boolean {
  if (m.deletedAt || !r.active) return false;
  const needle = norm(r.contains);
  if (!needle) return false;
  if (r.account && norm(r.account) !== norm(m.account)) return false;
  if (!norm(descOf(m)).includes(needle)) return false;
  const a = amountOf(m);
  if (r.sign === "+" && !(a > 0)) return false;
  if (r.sign === "-" && !(a < 0)) return false;
  return true;
}

/** Applica classificazione di base della banca e regole. Non tocca i movimenti bloccati. */
export function applyRules(m: Movement, rules: Rule[], base?: BaseClassifier, ownerNames: string[] = []) {
  if (m.lock) return;
  if (base) Object.assign(m, base({ account: m.account, amount: amountOf(m), description: descOf(m), sourceType: m.sourceType, type: m.type, counterparty: m.counterparty, ruleStatus: m.ruleStatus }, ownerNames));
  const hits = rules.filter((r) => ruleMatches(r, m)).sort((a, b) => b.priority - a.priority);
  if (!hits.length) return;
  const top = hits.filter((r) => r.priority === hits[0].priority);
  const outputs = new Set(top.map((r) => [r.type, r.categoryId, r.counterparty].join("|")));
  if (outputs.size > 1) { m.ruleStatus = "ambiguous"; m.ruleId = ""; return; }
  const r = top[0];
  if (r.type) m.type = r.type;
  if (r.categoryId) m.categoryId = r.categoryId;
  if (r.counterparty) m.counterparty = r.counterparty;
  m.ruleStatus = "rule";
  m.ruleId = r.id;
}

/** Riclassifica tutto ciò che non è bloccato (come "Ricalcola" della v3.10). */
export function reprocess(movements: Movement[], rules: Rule[], base?: BaseClassifier, ownerNames: string[] = [], keepImport = true) {
  for (const m of movements) {
    if (m.lock || m.deletedAt) continue;
    const imp = keepImport && m.ruleStatus === "import" ? { type: m.type, categoryId: m.categoryId, counterparty: m.counterparty } : null;
    m.type = imp?.type ?? ""; m.categoryId = imp?.categoryId ?? ""; m.counterparty = imp?.counterparty ?? ""; m.ruleStatus = imp ? "import" : ""; m.ruleId = "";
    applyRules(m, rules, base, ownerNames);
  }
  rematchTransfers(movements);
}

const day = (d: string) => Math.floor(Date.parse((d || "1970-01-01") + "T00:00:00Z") / 86400000);

/** Abbina i giroconti: importo opposto, conto diverso, entro 5 giorni, solo se il candidato è unico. */
export function rematchTransfers(movements: Movement[]) {
  const byId = new Map(movements.map((m) => [m.id, m]));
  for (const m of movements) {
    if (m.manualMatch && m.matchedTo) {
      const x = byId.get(m.matchedTo);
      if (!x || x.matchedTo !== m.id || !x.manualMatch) { m.matchedTo = null; m.manualMatch = false; }
    }
  }
  for (const m of movements) {
    if (m.manualMatch) continue;
    m.matchedTo = null;
    if (!m.lock && isTransfer(m.type) && m.ruleStatus === "auto-match") m.counterparty = "";
  }
  const transfers = movements.filter((m) => isTransfer(m.type) && !m.deletedAt);
  const used = new Set(transfers.filter((m) => m.manualMatch && m.matchedTo).map((m) => m.id));
  // indice per importo assoluto in centesimi
  const idx = new Map<string, Movement[]>();
  for (const x of transfers) {
    const k = x.type + "|" + Math.round(Math.abs(amountOf(x)) * 100);
    (idx.get(k) ?? idx.set(k, []).get(k)!).push(x);
  }
  for (const m of transfers) {
    if (used.has(m.id)) continue;
    const target: MovementType = m.type === "transfer_in" ? "transfer_out" : "transfer_in";
    const t = day(dateOf(m));
    let c = (idx.get(target + "|" + Math.round(Math.abs(amountOf(m)) * 100)) ?? []).filter((x) =>
      x.id !== m.id && !used.has(x.id) && Math.abs(amountOf(x) + amountOf(m)) < 0.005 &&
      norm(x.account) !== norm(m.account) && Math.abs(day(dateOf(x)) - t) <= 5);
    if (m.counterparty) c = c.filter((x) => norm(x.account) === norm(m.counterparty));
    else c = c.filter((x) => !x.counterparty || norm(x.counterparty) === norm(m.account));
    if (c.length === 1) {
      const x = c[0];
      m.matchedTo = x.id; x.matchedTo = m.id; m.manualMatch = false; x.manualMatch = false;
      if (!m.counterparty) { m.counterparty = x.account; if (!m.lock) m.ruleStatus = "auto-match"; }
      if (!x.counterparty) { x.counterparty = m.account; if (!x.lock) x.ruleStatus = "auto-match"; }
      used.add(m.id); used.add(x.id);
    }
  }
}

export type StatusKind = "ok" | "warn" | "trash" | "split";
export interface Status { kind: StatusKind; label: string; code: string }

export function statusOf(m: Movement, byId?: Map<string, Movement>): Status {
  if (m.deletedAt) return { kind: "trash", label: "Nel cestino", code: "trash" };
  if (hasSplits(m) && !splitBalanced(m)) return { kind: "warn", label: "Quote non quadrate", code: "split" };
  if (m.inputIssue) return { kind: "warn", label: "Da verificare: " + m.inputIssue, code: "input" };
  if (m.ruleStatus === "ambiguous") return { kind: "warn", label: "Regole in conflitto", code: "ambiguous" };
  if (hasSplits(m)) return { kind: "split", label: "Diviso in quote", code: "ok" };
  if (!m.type) return { kind: "warn", label: "Tipo mancante", code: "type" };
  if (needsCategory(m.type) && !m.categoryId && !m.deferredWallet) return { kind: "warn", label: "Categoria mancante", code: "category" };
  if (isTransfer(m.type)) {
    if (!m.matchedTo) return { kind: "warn", label: "Giroconto non abbinato", code: "transfer" };
    const pair = byId?.get(m.matchedTo);
    if (byId && (!pair || pair.deletedAt)) return { kind: "warn", label: "Gemello del giroconto nel cestino", code: "transfer" };
    return { kind: "ok", label: m.manualMatch ? "Giroconto collegato a mano" : "Giroconto abbinato", code: "ok" };
  }
  if ((m.type === "advance_out" || m.type === "refund_in") && !m.counterparty) return { kind: "warn", label: "Controparte mancante", code: "counterparty" };
  return { kind: "ok", label: "OK", code: "ok" };
}

/** Testo stabile per una nuova regola a partire da una descrizione (toglie numeri e date). */
export function ruleTextFrom(description: string): string {
  return norm(description).replace(/\d{2}[/.-]\d{2}([/.-]\d{2,4})?/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
}
