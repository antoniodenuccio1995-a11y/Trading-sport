// Aritmetica delle date su numeri di giorno interi (giorni dal 1970-01-01).
// Nessun oggetto Date e nessun fuso orario: "YYYY-MM-DD" -> intero -> "YYYY-MM-DD".

const pad2 = (n: number) => (n < 10 ? "0" : "") + n;

function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Numero di giorno (giorni dal 1970-01-01) di una data ISO "YYYY-MM-DD". */
export function dayNum(iso: string): number {
  return daysFromCivil(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10));
}

/** Data ISO "YYYY-MM-DD" da un numero di giorno. */
export function fromDayNum(z: number): string {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Aggiunge (o toglie) giorni a una data ISO. */
export const addDays = (iso: string, n: number): string => fromDayNum(dayNum(iso) + n);

/** Giorni da `a` a `b` (positivo se `b` è dopo `a`). */
export const daysBetween = (a: string, b: string): number => dayNum(b) - dayNum(a);

/** Giorno della settimana con lunedì = 0 … domenica = 6. */
export function weekdayOf(iso: string): number {
  return (((dayNum(iso) + 3) % 7) + 7) % 7;
}

/** Giorni di un mese di calendario. */
export function daysInMonth(y: number, m: number): number {
  return m === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Indice progressivo di un mese "YYYY-MM" (anno × 12 + mese − 1). */
export const monthIndex = (month: string): number => +month.slice(0, 4) * 12 + +month.slice(5, 7) - 1;

/** Mese "YYYY-MM" da un indice progressivo. */
export const monthFromIndex = (i: number): string => `${Math.floor(i / 12)}-${pad2((i % 12) + 1)}`;

/** Aggiunge (o toglie) mesi a una chiave "YYYY-MM". */
export const addMonths = (month: string, n: number): string => monthFromIndex(monthIndex(month) + n);

/** Aggiunge mesi a una data ISO mantenendo il giorno (troncato a fine mese: 31/01 + 1 = 28/02). */
export function addMonthsToDate(iso: string, n: number): string {
  const i = +iso.slice(0, 4) * 12 + +iso.slice(5, 7) - 1 + n;
  const y = Math.floor(i / 12), m = (i % 12) + 1;
  const d = Math.min(+iso.slice(8, 10), daysInMonth(y, m));
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Elenco continuo dei mesi da `from` a `to` inclusi. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = monthIndex(from), e = monthIndex(to); i <= e; i++) out.push(monthFromIndex(i));
  return out;
}

export interface MonthBounds { month: string; start: string; end: string; days: number }

/**
 * Primo e ultimo giorno del mese contabile, coerente con monthKey(): con
 * monthStartDay = 27 il mese "2026-11" va dal 27/10 al 26/11.
 */
export function monthBounds(month: string, monthStartDay = 1): MonthBounds {
  const y = +month.slice(0, 4), m = +month.slice(5, 7);
  const dim = daysInMonth(y, m);
  let start: string, end: string;
  if (monthStartDay <= 1) {
    start = `${month}-01`;
    end = `${month}-${pad2(dim)}`;
  } else {
    const prev = addMonths(month, -1);
    const dimPrev = daysInMonth(+prev.slice(0, 4), +prev.slice(5, 7));
    start = monthStartDay <= dimPrev ? `${prev}-${pad2(monthStartDay)}` : `${month}-01`;
    end = `${month}-${pad2(Math.min(monthStartDay - 1, dim))}`;
  }
  return { month, start, end, days: dayNum(end) - dayNum(start) + 1 };
}

/** Durata media di un mese in giorni (anno gregoriano). */
export const AVG_MONTH_DAYS = 365.2425 / 12;
