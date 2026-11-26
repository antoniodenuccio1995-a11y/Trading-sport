// Formattazione italiana per le frasi generate (insight, anomalie).

const EUR2 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const EUR0 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

/** Importo in euro all'italiana, senza decimali da 100 € in su ("312 €", "41,50 €"). */
export function formatEUR(v: number): string {
  return (Math.abs(v) >= 99.995 ? EUR0 : EUR2).format(v === 0 ? 0 : v);
}

/** Importo con segno esplicito ("+850 €", "−120 €"). */
export function formatSignedEUR(v: number): string {
  if (Math.abs(v) < 0.005) return formatEUR(0);
  return (v > 0 ? "+" : "−") + formatEUR(Math.abs(v));
}

/** Percentuale intera da una frazione (0.38 -> "38%", con segno -> "+38%"). */
export function formatPct(p: number, signed = false): string {
  const r = Math.round(p * 100);
  if (!signed || r === 0) return `${Math.abs(r) === 0 ? 0 : r}%`.replace("-", "−");
  return (r > 0 ? "+" : "−") + Math.abs(r) + "%";
}

/** Numero con al massimo un decimale ("5,2"). */
export const formatNumber1 = (v: number): string => NUM1.format(v);

export const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
export const WEEKDAYS_IT = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
export const WEEKDAYS_SHORT_IT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

/** Nome del mese ("2026-11" -> "novembre"). */
export const monthName = (month: string): string => MONTHS_IT[+month.slice(5, 7) - 1] ?? month;

/** Mese e anno ("2026-11" -> "novembre 2026"). */
export const monthLabel = (month: string): string => `${monthName(month)} ${month.slice(0, 4)}`;

const withYear = (month: string, refYear?: string) =>
  refYear && month.slice(0, 4) !== refYear ? monthLabel(month) : monthName(month);

/** "a novembre", "ad aprile", "ad agosto" (anno aggiunto se diverso da refYear). */
export function inMonth(month: string, refYear?: string): string {
  const name = withYear(month, refYear);
  return (name.startsWith("a") ? "ad " : "a ") + name;
}

/** "di novembre" (anno aggiunto se diverso da refYear). */
export const ofMonth = (month: string, refYear?: string): string => "di " + withYear(month, refYear);

/** Data breve "12/11". */
export const shortDate = (iso: string): string => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;

/** Data estesa "12 novembre". */
export const longDate = (iso: string): string => `${+iso.slice(8, 10)} ${MONTHS_IT[+iso.slice(5, 7) - 1]}`;

/** Nome esercente leggibile ("NETFLIX COM" -> "Netflix Com"). */
export function displayName(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s'.&-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
