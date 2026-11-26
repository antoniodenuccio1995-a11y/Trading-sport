import type { ImportedRow, Line, Movement, Snapshot } from "./types.ts";

/** Maiuscolo, senza accenti e spazi doppi: identica alla norm() della v3.10. */
export const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

export function fnv(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

/** Firma anti-doppione, calcolata come nella v3.10 (sig): conto, id esterno, data/ora, descrizione, importo, valuta. */
export function signature(m: Pick<Movement, "account" | "externalId" | "dateTime" | "date" | "description" | "amount" | "currency">): string {
  return fnv([m.account, m.externalId || "", m.dateTime || m.date, m.description, Number(m.amount).toFixed(2), m.currency || "EUR"].map(norm).join("|"));
}

export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

export const dateOf = (m: Movement) => m.corrected.date || m.date;
export const descOf = (m: Movement) => m.corrected.description ?? m.description;
export const amountOf = (m: Movement) => m.corrected.amount ?? m.amount;
export const hasSplits = (m: Movement) => m.splits.length > 0;
export const splitTotal = (m: Movement) => m.splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
export const splitBalanced = (m: Movement) => !hasSplits(m) || Math.abs(splitTotal(m) - amountOf(m)) < 0.005;

export function makeMovement(row: Partial<ImportedRow> & Partial<Movement>, importId = ""): Movement {
  const m: Movement = {
    id: uid(), account: "", date: "", dateTime: "", valueDate: "", description: "", amount: 0, currency: "EUR",
    externalId: "", sourceType: "", sourceCategory: "", raw: {}, type: "", categoryId: "", counterparty: "",
    note: "", tags: [], project: "", lock: false, ruleStatus: "", ruleId: "", matchedTo: null, manualMatch: false,
    splits: [], corrected: {}, inputIssue: "", importId, signature: "", deletedAt: null, excluded: false, deferredWallet: false,
    ...row,
  } as Movement;
  if (!m.signature) m.signature = signature(m);
  return m;
}

/**
 * Descrizione ripulita per raggruppare gli esercenti: toglie prefissi bancari
 * (PAGAMENTO POS, CARTA N., date, codici) e numeri lunghi.
 */
export function merchantOf(description: string): string {
  let s = norm(description)
    .replace(/\b(PAGAMENTO|PAG\.?|ACQUISTO|POS|CARTA|CARD|N\.?|NUM\.?|DEL|ORE|PRESSO|C\/O|OPERAZIONE|TRANSAZIONE|CONTACTLESS|APPLE PAY|GOOGLE PAY|DISPOSIZIONE|ADDEBITO|SDD|BONIFICO|A FAVORE DI|DA|A|VS|FAVORE|BENEF\.?|ORDINANTE|SEPA|INSTANT|ISTANTANEO)\b/g, " ")
    .replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, " ")
    .replace(/[*#]+\w*/g, " ")
    .replace(/\b[A-Z]*\d[A-Z\d]{4,}\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^\p{L}\p{N}&' .-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter((w) => w.length > 1);
  s = words.slice(0, 3).join(" ");
  return s || norm(description).slice(0, 24);
}

/** Mese contabile: con monthStartDay > 1 i giorni dal monthStartDay in poi appartengono al mese successivo. */
export function monthKey(date: string, monthStartDay = 1): string {
  if (!date) return "";
  if (monthStartDay <= 1) return date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  if (day < monthStartDay) return date.slice(0, 7);
  let y = Number(date.slice(0, 4)), mo = Number(date.slice(5, 7)) + 1;
  if (mo > 12) { mo = 1; y++; }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** Righe effettive per le analisi: esclude cestino ed esclusi, espande le quote quadrate. */
export function toLines(s: Pick<Snapshot, "movements" | "settings">): Line[] {
  const out: Line[] = [];
  const start = s.settings.monthStartDay || 1;
  for (const m of s.movements) {
    if (m.deletedAt || m.excluded) continue;
    const date = dateOf(m), month = monthKey(date, start), desc = descOf(m);
    const merchant = merchantOf(desc);
    if (hasSplits(m) && splitBalanced(m)) {
      for (const p of m.splits) {
        out.push({ id: m.id + "::" + p.id, parentId: m.id, account: m.account, date, month, amount: Number(p.amount) || 0,
          type: p.type, categoryId: p.categoryId, counterparty: p.counterparty, description: p.description || desc,
          merchant, isSplit: true, unbalanced: false, deferredWallet: m.deferredWallet });
      }
    } else {
      out.push({ id: m.id, parentId: m.id, account: m.account, date, month, amount: amountOf(m), type: m.type,
        categoryId: m.categoryId, counterparty: m.counterparty, description: desc, merchant, isSplit: false,
        unbalanced: hasSplits(m), deferredWallet: m.deferredWallet });
    }
  }
  return out;
}

/** Riga che entra nei KPI di entrate/uscite reali (no giroconti, investimenti, anticipi/rimborsi, wallet, quote non quadrate). */
export const isEconomic = (l: Line) => (l.type === "income" || l.type === "expense") && !l.deferredWallet && !l.unbalanced;
