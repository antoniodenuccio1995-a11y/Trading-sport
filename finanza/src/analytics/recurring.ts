// Riconoscimento di abbonamenti, bollette e stipendi: stesso esercente, intervalli regolari, importi stabili.
import type { Line } from "../domain/types.ts";
import { addDays, addMonthsToDate, dayNum, daysInMonth } from "./dates.ts";
import { isExpenseLine, isIncomeLine } from "./common.ts";
import { displayName } from "./format.ts";
import { median, robustScale, round2 } from "./stats.ts";

export type Cadence = "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";

export interface CadenceSpec {
  id: Cadence;
  label: string;
  /** Durata nominale in giorni. */
  days: number;
  /** Intervallo accettato tra due addebiti consecutivi (giorni, inclusi). */
  min: number;
  max: number;
  /** Passo in mesi di calendario per la prossima data (0 = settimanale, passo di 7 giorni). */
  months: number;
  /** Giorni di ritardo tollerati prima di "in ritardo". */
  grace: number;
  /** Oltre questi giorni di ritardo la ricorrenza è considerata terminata. */
  endAfter: number;
  perYear: number;
  /** Occorrenze minime. */
  minCount: number;
}

/** Cadenze riconosciute, con tolleranze. */
export const CADENCES: readonly CadenceSpec[] = [
  { id: "weekly", label: "settimanale", days: 7, min: 5, max: 9, months: 0, grace: 3, endAfter: 14, perYear: 365.2425 / 7, minCount: 4 },
  { id: "monthly", label: "mensile", days: 30.44, min: 25, max: 36, months: 1, grace: 7, endAfter: 35, perYear: 12, minCount: 3 },
  { id: "bimonthly", label: "bimestrale", days: 60.87, min: 52, max: 70, months: 2, grace: 10, endAfter: 61, perYear: 6, minCount: 3 },
  { id: "quarterly", label: "trimestrale", days: 91.31, min: 80, max: 102, months: 3, grace: 15, endAfter: 92, perYear: 4, minCount: 3 },
  { id: "semiannual", label: "semestrale", days: 182.62, min: 165, max: 200, months: 6, grace: 20, endAfter: 120, perYear: 2, minCount: 3 },
  { id: "yearly", label: "annuale", days: 365.24, min: 350, max: 380, months: 12, grace: 30, endAfter: 90, perYear: 1, minCount: 2 },
];
const CADENCE_BY_ID = new Map(CADENCES.map((c) => [c.id, c]));

/** Specifica di una cadenza. */
export const cadenceSpec = (id: Cadence): CadenceSpec => CADENCE_BY_ID.get(id)!;

/** Data successiva secondo la cadenza (mesi di calendario, o 7 giorni per la settimanale). */
export const nextByCadence = (date: string, cadence: Cadence): string => {
  const c = cadenceSpec(cadence);
  return c.months ? addMonthsToDate(date, c.months) : addDays(date, 7);
};

/** Categorie con importi naturalmente variabili (bollette, affitto, tasse, auto): ammessa una variabilità maggiore. */
const BILL_CATEGORIES = new Set(["exp.utilities", "exp.housing", "exp.taxes", "exp.vehicle", "exp.financial_services"]);
/** Categorie della spesa quotidiana: per non scambiarle per abbonamenti servono più occorrenze e importi fissi. */
const EVERYDAY_CATEGORIES = new Set(["exp.groceries", "exp.dining", "exp.mobility"]);

export interface PriceChange {
  from: number;
  to: number;
  pct: number;
  /** Data del primo addebito al nuovo prezzo. */
  since: string;
}

export interface RecurringItem {
  id: string;
  merchant: string;
  /** Nome leggibile ("NETFLIX" -> "Netflix"). */
  label: string;
  direction: "in" | "out";
  kind: "subscription" | "bill" | "income";
  cadence: Cadence;
  cadenceLabel: string;
  /** Intervallo mediano osservato in giorni. */
  intervalDays: number;
  categoryId: string;
  account: string;
  count: number;
  first: string;
  last: string;
  nextExpected: string;
  /** Giorni trascorsi dalla data attesa (negativo = non ancora dovuto). */
  daysOverdue: number;
  status: "active" | "late" | "ended";
  /** Importi in valore assoluto. */
  amount: { median: number; min: number; max: number; last: number };
  /** Importo atteso al prossimo addebito (ultimo prezzo, o mediana recente se variabile). */
  expectedAmount: number;
  /** Importi variabili (bolletta a consumo, stipendio con straordinari…). */
  variable: boolean;
  annualized: number;
  monthly: number;
  /** Cambio di prezzo più recente oltre il 5% (solo uscite a importo stabile). */
  priceChange: PriceChange | null;
  /** 0–1: regolarità × stabilità × numerosità. */
  confidence: number;
  dates: string[];
  lineIds: string[];
}

interface Occ { date: string; day: number; amount: number; maxPart: number; lineIds: string[]; categoryId: string; account: string }

const WINDOW = 24; // occorrenze recenti usate per cadenza e stabilità

/** Coppie consecutive con variazione oltre la tolleranza relativa. */
function violations(amounts: readonly number[], tol: number): number {
  let v = 0;
  for (let i = 1; i < amounts.length; i++) {
    const a = amounts[i - 1], b = amounts[i];
    if (Math.abs(b - a) > Math.max(0.5, tol * Math.max(a, b))) v++;
  }
  return v;
}

function mostFrequent(values: readonly string[]): string {
  const counts = new Map<string, number>();
  let best = "", bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n >= bestN) { best = v; bestN = n; } // a parità vince il più recente
  }
  return best;
}

/** Unisce gli addebiti dello stesso giorno (occorrenze già ordinate per data); copia solo ciò che modifica. */
function mergeSameDay(occs: readonly Occ[]): Occ[] {
  const out: Occ[] = [];
  let copied = -1;
  for (const o of occs) {
    const i = out.length - 1;
    if (i >= 0 && out[i].day === o.day) {
      if (copied !== i) { out[i] = { ...out[i], lineIds: out[i].lineIds.slice() }; copied = i; }
      out[i].amount += o.amount;
      for (const id of o.lineIds) out[i].lineIds.push(id);
    } else out.push(o);
  }
  return out;
}

function analyze(all: Occ[], merchant: string, direction: "in" | "out", today: string, cluster: string | null): RecurringItem | null {
  const n = all.length;
  if (n < 2) return null;
  const occs = all.slice(-WINDOW);
  const k = occs.length - 1;
  const iv: number[] = [];
  for (let i = 1; i < occs.length; i++) iv.push(occs[i].day - occs[i - 1].day);

  let best: CadenceSpec | null = null, bestMatched = 0;
  for (const c of CADENCES) {
    if (n < c.minCount) continue;
    let matched = 0;
    for (const x of iv) if (x >= c.min && x <= c.max) matched++;
    if (matched > bestMatched) { best = c; bestMatched = matched; }
  }
  if (!best) return null;
  const need = k <= 3 ? k : Math.ceil(0.75 * k);
  if (bestMatched < need) return null;
  const medIv = median(iv);
  if (medIv < best.min || medIv > best.max) return null;
  if (n === 2 && (iv[0] < 358 || iv[0] > 373)) return null; // annuale con due sole occorrenze: data quasi identica

  const categoryId = mostFrequent(occs.map((o) => o.categoryId));
  if (EVERYDAY_CATEGORIES.has(categoryId) && n < 5) return null;
  if (cluster !== null && n < 3) return null;

  const amounts = occs.map((o) => o.amount);
  const med = median(amounts);
  const strictOk = n === 2
    ? violations(amounts, 0.15) === 0
    : violations(amounts, 0.08) <= (EVERYDAY_CATEGORIES.has(categoryId) ? 1 : Math.max(1, Math.floor(0.25 * k)));
  const relaxedAllowed = cluster === null && best.months >= 1 && !EVERYDAY_CATEGORIES.has(categoryId) && (direction === "in" || BILL_CATEGORIES.has(categoryId));
  let relaxedOk = false;
  if (!strictOk && relaxedAllowed && med > 0) {
    if (n === 2) relaxedOk = violations(amounts, 0.3) === 0;
    else {
      let inside = 0;
      for (const a of amounts) if (a >= med / 3 && a <= med * 3) inside++;
      relaxedOk = robustScale(amounts, med) / med <= 0.4 && inside >= 0.8 * amounts.length;
    }
  }
  if (!strictOk && !relaxedOk) return null;

  const lastOcc = occs[occs.length - 1];
  const last = lastOcc.amount;
  const recent = amounts.slice(-6);
  const expectedAmount = strictOk && direction === "out" ? last : median(recent);

  let priceChange: PriceChange | null = null;
  if (direction === "out" && strictOk && n >= 3) {
    let s = amounts.length - 1;
    while (s > 0 && Math.abs(amounts[s - 1] - last) <= Math.max(0.01, 0.05 * last)) s--;
    if (s > 0) {
      const from = median(amounts.slice(Math.max(0, s - 6), s));
      const pct = (last - from) / from;
      if (Math.abs(pct) > 0.05) priceChange = { from: round2(from), to: round2(last), pct, since: occs[s].date };
    }
  }

  const nextExpected = nextDate(occs, best);
  const daysOverdue = dayNum(today) - dayNum(nextExpected);
  const status = daysOverdue <= best.grace ? "active" : daysOverdue <= best.endAfter ? "late" : "ended";
  const annualized = expectedAmount * best.perYear;
  let min = Infinity, max = -Infinity;
  for (const a of amounts) { if (a < min) min = a; if (a > max) max = a; }
  const kind = direction === "in" ? "income" : BILL_CATEGORIES.has(categoryId) ? "bill" : "subscription";
  const confidence = (bestMatched / Math.max(1, k)) * (strictOk ? 1 : 0.8) * Math.min(1, n / 6);
  const sign = direction === "in" ? "+" : "-";
  return {
    id: `${merchant}|${sign}` + (cluster !== null ? `|${cluster}` : ""),
    merchant,
    label: displayName(merchant),
    direction,
    kind,
    cadence: best.id,
    cadenceLabel: best.label,
    intervalDays: medIv,
    categoryId,
    account: lastOcc.account,
    count: n,
    first: all[0].date,
    last: lastOcc.date,
    nextExpected,
    daysOverdue,
    status,
    amount: { median: round2(med), min: round2(min), max: round2(max), last: round2(last) },
    expectedAmount: round2(expectedAmount),
    variable: !strictOk,
    annualized: round2(annualized),
    monthly: round2(annualized / 12),
    priceChange,
    confidence: Math.round(confidence * 100) / 100,
    dates: all.map((o) => o.date),
    lineIds: all.flatMap((o) => o.lineIds),
  };
}

/**
 * Prossima data attesa. Per le cadenze a mesi il giorno è la mediana dei giorni del mese degli
 * ultimi 3 addebiti (31/08, 30/09 -> 31/10; un addebito slittato dall'1 al 3 non sposta il successivo).
 */
function nextDate(occs: readonly Occ[], c: CadenceSpec): string {
  const lastDate = occs[occs.length - 1].date;
  const plain = nextByCadence(lastDate, c.id);
  if (!c.months || occs.length < 3) return plain;
  const anchor = Math.round(median(occs.slice(-3).map((o) => +o.date.slice(8, 10))));
  const y = +plain.slice(0, 4), m = +plain.slice(5, 7);
  const day = Math.min(anchor, daysInMonth(y, m));
  const anchored = `${plain.slice(0, 8)}${day < 10 ? "0" : ""}${day}`;
  return Math.abs(dayNum(anchored) - dayNum(plain)) <= Math.min(10, c.days / 3) ? anchored : plain;
}

/** Prova a separare per fascia di importo un esercente misto (es. abbonamento + acquisti sporadici). */
function clusters(perParent: readonly Occ[]): Occ[][] {
  const byAmount = [...perParent].sort((a, b) => a.amount - b.amount);
  const out: Occ[][] = [];
  let cur: Occ[] = [];
  const flush = () => {
    // Fasce troppo ampie (catene di importi vicini) non possono essere un prezzo stabile.
    if (cur.length >= 3 && cur[cur.length - 1].amount <= cur[0].amount * 1.35 + 0.5) out.push(cur);
    cur = [];
  };
  for (const o of byAmount) {
    const prev = cur[cur.length - 1];
    if (prev && o.amount > prev.amount * 1.08 + 0.3) flush();
    cur.push(o);
  }
  flush();
  return out;
}

const STATUS_ORDER = { active: 0, late: 1, ended: 2 } as const;

interface Bucket { occs: Occ[]; split: Map<string, Occ> | null }

/**
 * Abbonamenti, bollette e stipendi: raggruppa per esercente e segno, riconosce la
 * cadenza (settimanale … annuale) con tolleranza e richiede importi stabili.
 * Considera solo le righe con data ≤ today.
 */
export function detectRecurring(lines: readonly Line[], today: string): RecurringItem[] {
  // esercente -> [uscite, entrate]; le quote di uno stesso movimento diventano un solo addebito.
  const groups = new Map<string, [Bucket | null, Bucket | null]>();
  for (const l of lines) {
    if (!l.merchant || l.date > today) continue;
    if (!isExpenseLine(l) && !isIncomeLine(l)) continue;
    if (Math.abs(l.amount) < 0.005) continue;
    let pair = groups.get(l.merchant);
    if (!pair) { pair = [null, null]; groups.set(l.merchant, pair); }
    const side = l.amount < 0 ? 0 : 1;
    const b = pair[side] ?? (pair[side] = { occs: [], split: null });
    const part = Math.abs(l.amount);
    if (l.isSplit) {
      const split = b.split ?? (b.split = new Map());
      const pid = l.parentId || l.id;
      const o = split.get(pid);
      if (o) {
        if (part > o.maxPart) { o.maxPart = part; o.categoryId = l.categoryId; } // categoria della quota più grande
        o.amount += part;
        o.lineIds.push(l.id);
        continue;
      }
      const occ: Occ = { date: l.date, day: dayNum(l.date), amount: part, maxPart: part, lineIds: [l.id], categoryId: l.categoryId, account: l.account };
      split.set(pid, occ);
      b.occs.push(occ);
    } else {
      b.occs.push({ date: l.date, day: dayNum(l.date), amount: part, maxPart: part, lineIds: [l.id], categoryId: l.categoryId, account: l.account });
    }
  }
  const out: RecurringItem[] = [];
  const byDay = (a: Occ, b: Occ) => a.day - b.day;
  for (const [merchant, pair] of groups) {
    for (let side = 0; side < 2; side++) {
      const b = pair[side];
      if (!b || b.occs.length < 2) continue;
      const direction = side === 0 ? "out" : "in";
      const perParent = b.occs;
      const item = analyze(mergeSameDay([...perParent].sort(byDay)), merchant, direction, today, null);
      if (item) { out.push(item); continue; }
      if (perParent.length < 6) continue;
      for (const c of clusters(perParent)) {
        const hit = analyze(mergeSameDay(c.sort(byDay)), merchant, direction, today, String(Math.round(median(c.map((o) => o.amount)))));
        if (hit) out.push(hit);
      }
    }
  }
  out.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.monthly - a.monthly || a.merchant.localeCompare(b.merchant));
  return out;
}
