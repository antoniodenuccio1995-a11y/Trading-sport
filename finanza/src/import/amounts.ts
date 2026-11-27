// Lettura degli importi bancari: porting 1:1 delle funzioni della v3.10
// (num, parseBankAmount, parseItalianFormattedAmount, parseSellaAmountCell).
// Gli importi finiscono nella firma anti-doppione, quindi anche le stranezze
// della v3.10 sono mantenute (vedi docs/IMPORTATORI.md).

export interface ParsedAmount { value: number; issue: string }

/** Numero da testo "all'italiana" o all'inglese. Mai NaN: se illeggibile restituisce 0 (come la v3.10). */
export function num(v: unknown): number {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/[€\s]/g, "");
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");
  if (s.includes(",")) {
    if (s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(s)) {
    // formato italiano senza decimali, es. 1.000 -> 1000
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : 0;
}

/**
 * Importo di una cella/colonna bancaria con diagnostica.
 * Nota v3.10: con le parentesi e i separatori delle migliaia, es. "(1.234,56)",
 * la "correzione separatore migliaia" restituisce il valore POSITIVO. È mantenuto
 * così perché l'importo entra nella firma dei movimenti già importati.
 */
export function parseBankAmount(v: unknown): ParsedAmount {
  if (typeof v === "number" && Number.isFinite(v)) return { value: v, issue: "" };
  const original = String(v ?? "").trim();
  if (!original) return { value: 0, issue: "Importo mancante" };
  const value = num(original);
  const cleaned = original.replace(/[€\s()]/g, "");
  const looksNumeric = /^-?[\d.,]+$/.test(cleaned);
  if (!looksNumeric || !Number.isFinite(value)) return { value: 0, issue: "Importo non numerico: " + original };
  // Difesa specifica per separatori delle migliaia italiani.
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(cleaned)) {
    const expected = Number(cleaned.replace(/\./g, "").replace(",", "."));
    if (Math.abs(value - expected) > 0.000001) return { value: expected, issue: "Correzione separatore migliaia: " + original };
  }
  return { value, issue: "" };
}

/** Testo formattato italiano (punto = migliaia, virgola = decimali). NaN se illeggibile. */
export function parseItalianFormattedAmount(v: unknown): number {
  let s = String(v ?? "").trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[€\s()]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : NaN;
}

/** Cella SheetJS: basta il valore (.v) e il testo visualizzato (.w). */
export interface AmountCell { v?: unknown; w?: string; z?: unknown }

export const SELLA_XLS_CORRECTED = "Disallineamento XLS corretto automaticamente";
export const SELLA_XLS_FROM_TEXT = "Valore XLS verificato sul formato visualizzato";
export const SELLA_UNREADABLE = "Importo Sella non leggibile";

export interface SellaAmount { value: number; issue: string; raw: unknown; formatted: string }

/**
 * Importo Sella dal vecchio .xls: confronta il valore della cella (.v) con il testo
 * visualizzato (.w). Se differiscono di un fattore 1000 (1 ↔ "1.000,00") sceglie il
 * valore più grande; altrimenti si fida del testo visualizzato.
 */
export function parseSellaAmountCell(cell: AmountCell | undefined | null): SellaAmount {
  if (!cell) return { value: 0, issue: "Cella importo mancante", raw: null, formatted: "" };
  const raw = typeof cell.v === "number" && Number.isFinite(cell.v) ? cell.v : NaN;
  const formattedText = cell.w ?? cell.v ?? "";
  const formatted = parseItalianFormattedAmount(formattedText);

  if (Number.isFinite(raw) && Number.isFinite(formatted)) {
    const same = Math.abs(raw - formatted) < 0.000001;
    if (same) return { value: raw, issue: "", raw, formatted: String(formattedText) };

    // Caso tipico del vecchio .xls Sella: 1 ↔ 1.000,00 oppure 1.4 ↔ 1.400,00.
    const absRaw = Math.abs(raw), absFmt = Math.abs(formatted);
    const ratio = absRaw > 0 ? absFmt / absRaw : 1;
    if (Math.abs(ratio - 1000) < 0.000001 || Math.abs(ratio - 0.001) < 0.000001) {
      const chosen = absFmt > absRaw ? formatted : raw;
      return { value: chosen, issue: SELLA_XLS_CORRECTED, raw, formatted: String(formattedText) };
    }

    // Il testo visualizzato dalla cella Sella è il riferimento principale per il vecchio XLS.
    return { value: formatted, issue: SELLA_XLS_FROM_TEXT, raw, formatted: String(formattedText) };
  }
  if (Number.isFinite(formatted)) return { value: formatted, issue: "", raw: null, formatted: String(formattedText) };
  if (Number.isFinite(raw)) return { value: raw, issue: "", raw, formatted: "" };
  return { value: 0, issue: SELLA_UNREADABLE, raw: cell.v, formatted: String(formattedText) };
}
