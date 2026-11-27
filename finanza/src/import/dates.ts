// dateOnly della v3.10: Date di SheetJS, numeri seriali Excel, "YYYY-MM-DD…", "GG/MM/AAAA…".

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * Data YYYY-MM-DD dal valore di una cella/colonna.
 * - Date (SheetJS con cellDates): giorno locale.
 * - Numero tra 20000 e 100000: seriale Excel (1899-12-30 = 0), giorno UTC.
 * - "YYYY-MM-DD…" → primi 10 caratteri; "G/M/AAAA…" → riordinata.
 * - Altro testo: primi 10 caratteri così come sono (come la v3.10).
 */
export function dateOnly(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 100000) {
    return new Date(EXCEL_EPOCH + v * 86400000).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split(/[/ ]/);
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s.slice(0, 10);
}

/** Data ISO completa (usata quando non c'è il filtro per anno). */
export const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
