// Periodo di analisi: stagione, stagione precedente, ultime 3 o tutto lo storico.
import { Seg } from "./common";

export type Period = "season" | "prev" | "last3" | "all";
export const PERIODS: [Period, string][] = [["season", "Stagione"], ["prev", "Stagione prec."], ["last3", "Ultime 3"], ["all", "Tutto lo storico"]];

/** Stagioni incluse nel periodo, rispetto alla stagione di riferimento. */
export function periodSeasons(seasons: string[], cur: string, p: Period): string[] {
  const sorted = [...new Set(seasons)].sort(), i = sorted.indexOf(cur);
  if (i < 0) return [cur];
  if (p === "season") return [cur];
  if (p === "prev") return i > 0 ? [sorted[i - 1]] : [];
  if (p === "last3") return sorted.slice(Math.max(0, i - 2), i + 1);
  return sorted.slice(0, i + 1);
}

export function periodLabel(p: Period, cur: string, seasons: string[]): string {
  const s = periodSeasons(seasons, cur, p);
  if (!s.length) return "nessuna stagione precedente";
  return s.length === 1 ? s[0] : `${s[0]} – ${s[s.length - 1]}`;
}

export function PeriodSeg({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return <Seg<Period> label="Periodo" value={value} onChange={onChange} options={PERIODS} />;
}
