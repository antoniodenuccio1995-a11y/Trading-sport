// Formattazione italiana: valuta, percentuali, date. Formatter creati una volta sola.
// useGrouping "always": in it-IT i numeri a 4 cifre non avrebbero il punto delle migliaia ("1234 €").
const G = { useGrouping: "always" } as unknown as Intl.NumberFormatOptions;
const eur2 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", ...G });
const eur0 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, ...G });
const eurC = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });
const pct0 = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 });
const n0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, ...G });

/** € con decimali sotto 100, senza sopra (per i riepiloghi). */
export const eur = (v: number) => (Math.abs(v) >= 100 ? eur0 : eur2).format(v);
export const eurExact = (v: number) => eur2.format(v);
export const eurShort = (v: number) => (Math.abs(v) >= 10000 ? eurC.format(v) : eur0.format(v));
export const signed = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + eur(Math.abs(v));
export const pct = (v: number, digits = 0) => (digits ? pct1 : pct0).format(v);
export const int = (v: number) => n0.format(v);

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MONTHS_S = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const DAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
export const monthName = (ym: string, short = false) => {
  const m = Number(ym.slice(5, 7)) - 1;
  return (short ? MONTHS_S : MONTHS)[m] ?? ym;
};
export const monthLabel = (ym: string, short = false) => `${monthName(ym, short)} ${short ? "’" + ym.slice(2, 4) : ym.slice(0, 4)}`;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const dayLabel = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const shortDate = (iso: string) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS_S[Number(iso.slice(5, 7)) - 1]}` : "");
export const fullDate = (iso: string) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS_S[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "");
export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const addMonths = (ym: string, n: number) => {
  let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
};
/** Testo italiano → numero (accetta "1.234,56", "-12,5", "12.5"). */
export const parseAmount = (s: string) => {
  let t = String(s ?? "").trim().replace(/[€\s]/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
