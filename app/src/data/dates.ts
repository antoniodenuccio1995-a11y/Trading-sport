// Date: le partite usano "giorni dal 1/1/1970" (d) e minuti UTC (ko). Mostriamo l'ora italiana.
const DAY = 86400000;
const TZ = "Europe/Rome";

const fmtDay = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
const fmtDayLong = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtDate = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });
const fmtTime = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtParts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Giorno corrente in Italia. */
export function todayDay(now = Date.now()): number {
  const p = fmtParts.formatToParts(new Date(now));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day")) / DAY;
}
export const dayLabel = (d: number) => fmtDay.format(new Date(d * DAY));
export const dayLong = (d: number) => fmtDayLong.format(new Date(d * DAY));
export const dateShort = (d: number) => fmtDate.format(new Date(d * DAY));
export const kickoffTime = (ko: number | null) => (ko === null ? "—" : fmtTime.format(new Date(ko * 60000)));
export const dayToIso = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
export function isoToDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null;
}
export function relativeDay(d: number, today = todayDay()): string {
  const diff = d - today;
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  if (diff === -1) return "Ieri";
  return dayLabel(d);
}
