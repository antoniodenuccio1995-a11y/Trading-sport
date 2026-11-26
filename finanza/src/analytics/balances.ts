// Saldi dei conti nel tempo, liquidità totale, capitale investito netto e patrimonio.
import type { Account, Line } from "../domain/types.ts";
import { monthKey } from "../domain/movement.ts";
import { dayNum, fromDayNum, monthFromIndex, monthIndex } from "./dates.ts";
import { investedOf, isInvestLine, type MonthOptions } from "./common.ts";
import { round2 } from "./stats.ts";

interface AccountRef { id: string; name: string; kind: Account["kind"]; archived: boolean; known: boolean; initialBalance: number; initialDate: string }

/** Conti noti + conti che compaiono solo nelle righe (saldo iniziale 0). */
function accountRefs(lines: readonly Line[], accounts: readonly Account[]): { refs: AccountRef[]; index: Map<string, number> } {
  const refs: AccountRef[] = [];
  const index = new Map<string, number>();
  for (const a of accounts) {
    if (index.has(a.id)) continue;
    index.set(a.id, refs.length);
    if (a.name && a.name !== a.id && !index.has(a.name)) index.set(a.name, refs.length);
    refs.push({ id: a.id, name: a.name || a.id, kind: a.kind, archived: a.archived, known: true, initialBalance: Number(a.initialBalance) || 0, initialDate: a.initialDate || "" });
  }
  const extra = new Set<string>();
  for (const l of lines) if (!index.has(l.account)) extra.add(l.account);
  for (const id of [...extra].sort()) {
    index.set(id, refs.length);
    refs.push({ id, name: id || "Senza conto", kind: "other", archived: false, known: false, initialBalance: 0, initialDate: "" });
  }
  return { refs, index };
}

/**
 * Base del conto: saldo "prima di ogni riga". Con initialDate il saldo iniziale è riferito a
 * quella data e comprende già le righe precedenti, che quindi vanno tolte per ricostruire lo storico.
 */
function bases(lines: readonly Line[], refs: readonly AccountRef[], index: Map<string, number>): Float64Array {
  const base = Float64Array.from(refs.map((r) => r.initialBalance));
  for (const l of lines) {
    const i = index.get(l.account)!;
    const d = refs[i].initialDate;
    if (d && l.date && l.date < d) base[i] -= l.amount;
  }
  return base;
}

export interface CurrentBalances {
  asOf: string | null;
  byAccount: Record<string, number>;
  /** Somma dei saldi di tutti i conti. */
  liquidity: number;
  /** Capitale investito netto: contanti versati negli investimenti − contanti rientrati (può essere negativo). */
  invested: number;
  /** Capitale investito al costo, mai negativo (vendite oltre il versato = plusvalenze già in liquidità). */
  investedAtCost: number;
  /** liquidity + investedAtCost. */
  netWorth: number;
}

/** Saldi dei conti, liquidità, capitale investito netto e patrimonio alla data `asOf` (inclusa; tutte le righe se omessa). */
export function currentBalances(lines: readonly Line[], accounts: readonly Account[], asOf?: string): CurrentBalances {
  const { refs, index } = accountRefs(lines, accounts);
  const bal = bases(lines, refs, index);
  let invested = 0;
  for (const l of lines) {
    if (asOf && l.date > asOf) continue;
    bal[index.get(l.account)!] += l.amount;
    if (isInvestLine(l)) invested += investedOf(l);
  }
  const byAccount: Record<string, number> = {};
  let liquidity = 0;
  refs.forEach((r, i) => { byAccount[r.id] = round2(bal[i]); liquidity += bal[i]; });
  const atCost = Math.max(0, invested);
  return { asOf: asOf ?? null, byAccount, liquidity: round2(liquidity), invested: round2(invested), investedAtCost: round2(atCost), netWorth: round2(liquidity + atCost) };
}

/** Capitale investito netto (versato − rientrato) fino alla data inclusa. */
export function netInvested(lines: readonly Line[], asOf?: string): number {
  let s = 0;
  for (const l of lines) if (isInvestLine(l) && (!asOf || l.date <= asOf)) s += investedOf(l);
  return round2(s);
}

export interface AccountSeries {
  id: string;
  name: string;
  kind: Account["kind"];
  archived: boolean;
  /** false se il conto compare nelle righe ma non nell'elenco dei conti. */
  known: boolean;
  /** Saldo alla fine del periodo. */
  current: number;
  /** Saldo a fine giorno/mese, allineato a `keys`. */
  series: number[];
}

export interface BalanceSeries {
  granularity: "day" | "month";
  /** Date ISO (giornaliera) o mesi "YYYY-MM" (mensile). */
  keys: string[];
  accounts: AccountSeries[];
  liquidity: number[];
  invested: number[];
  netWorth: number[];
  current: CurrentBalances;
}

export interface BalanceOptions extends MonthOptions {
  granularity?: "day" | "month";
  /** Inizio/fine della serie: date ISO per "day", mesi (o date) per "month". Default: estensione dei dati. */
  from?: string;
  to?: string;
}

/** Serie dei saldi per conto (giornaliera o mensile), liquidità totale, capitale investito netto e patrimonio. */
export function accountBalances(lines: readonly Line[], accounts: readonly Account[], opts: BalanceOptions = {}): BalanceSeries {
  const gran = opts.granularity ?? "month";
  const msd = opts.monthStartDay ?? 1;
  const { refs, index } = accountRefs(lines, accounts);
  const base = bases(lines, refs, index);
  const toKeyNum: (date: string, month?: string) => number = gran === "day"
    ? (date) => dayNum(date)
    : (date, month) => monthIndex(month || monthKey(date, msd));
  const optNum = (v: string) => (gran === "day" ? dayNum(v) : monthIndex(v.length > 7 ? monthKey(v, msd) : v));

  let lo = opts.from ? optNum(opts.from) : Infinity, hi = opts.to ? optNum(opts.to) : -Infinity;
  if (!opts.from || !opts.to) {
    for (const l of lines) {
      if (!l.date) continue;
      const k = toKeyNum(l.date, l.month);
      if (!opts.from && k < lo) lo = k;
      if (!opts.to && k > hi) hi = k;
    }
    if (!opts.from) for (const r of refs) if (r.initialDate) lo = Math.min(lo, toKeyNum(r.initialDate));
    if (!opts.to && hi === -Infinity && lo !== Infinity) hi = lo;
  }
  const n = Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo ? hi - lo + 1 : 0;
  const A = refs.length;
  const delta = new Float64Array(A * n);
  const opening = Float64Array.from(base);
  const invDelta = new Float64Array(n);
  let invOpening = 0;
  for (const l of lines) {
    if (!l.date) continue;
    const a = index.get(l.account)!;
    const k = toKeyNum(l.date, l.month) - lo;
    const inv = isInvestLine(l) ? investedOf(l) : 0;
    if (k < 0) { opening[a] += l.amount; invOpening += inv; }
    else if (k < n) { delta[a * n + k] += l.amount; invDelta[k] += inv; }
  }
  const keys: string[] = [];
  for (let i = 0; i < n; i++) keys.push(gran === "day" ? fromDayNum(lo + i) : monthFromIndex(lo + i));
  const liq = new Float64Array(n);
  const series: AccountSeries[] = refs.map((r, a) => {
    const s: number[] = new Array(n);
    let run = opening[a];
    for (let i = 0; i < n; i++) { run += delta[a * n + i]; s[i] = round2(run); liq[i] += run; }
    return { id: r.id, name: r.name, kind: r.kind, archived: r.archived, known: r.known, current: round2(n ? run : opening[a]), series: s };
  });
  const invested: number[] = new Array(n), netWorth: number[] = new Array(n), liquidity: number[] = new Array(n);
  let inv = invOpening;
  for (let i = 0; i < n; i++) {
    inv += invDelta[i];
    invested[i] = round2(inv);
    liquidity[i] = round2(liq[i]);
    netWorth[i] = round2(liq[i] + Math.max(0, inv));
  }
  const byAccount: Record<string, number> = {};
  let curLiq = 0;
  for (const s of series) { byAccount[s.id] = s.current; curLiq += s.current; }
  const curInv = n ? inv : invOpening;
  return {
    granularity: gran, keys, accounts: series, liquidity, invested, netWorth,
    current: {
      asOf: n ? keys[n - 1] : null, byAccount, liquidity: round2(curLiq), invested: round2(curInv),
      investedAtCost: round2(Math.max(0, curInv)), netWorth: round2(curLiq + Math.max(0, curInv)),
    },
  };
}

export interface NetWorthSeries { granularity: "day" | "month"; keys: string[]; liquidity: number[]; invested: number[]; netWorth: number[] }

/** Patrimonio nel tempo: liquidità + capitale investito netto al costo. */
export function netWorthSeries(lines: readonly Line[], accounts: readonly Account[], opts: BalanceOptions = {}): NetWorthSeries {
  const b = accountBalances(lines, accounts, opts);
  return { granularity: b.granularity, keys: b.keys, liquidity: b.liquidity, invested: b.invested, netWorth: b.netWorth };
}
