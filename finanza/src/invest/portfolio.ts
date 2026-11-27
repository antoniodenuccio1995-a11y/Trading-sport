// Calcoli del portafoglio: funzioni pure (niente rete, niente DOM), testate in tests/invest.test.ts.
//
// Metodo del prezzo medio: COSTO MEDIO PONDERATO (lo stesso che usano i broker italiani in regime
// amministrato per il "prezzo medio di carico"). Ogni acquisto aggiunge quantità e costo (commissioni
// comprese); ogni vendita toglie quantità × prezzo medio dal costo e registra come realizzato
// incasso netto − costo tolto. Il prezzo medio non cambia con le vendite.
// Tutti gli importi sono in euro; le operazioni si applicano in ordine di data (a parità, in ordine
// di inserimento).
import type { Line, Movement } from "../domain/types.ts";
import { amountOf, dateOf, descOf, norm } from "../domain/movement.ts";
import { KIND_LABEL, type Instrument, type InstrumentKind, type InvestData, type PriceQuote, type Trade, type TradeSide } from "./types.ts";

const EPS = 1e-9;
const r2 = (v: number) => Math.round(v * 100) / 100;
const rq = (v: number) => Math.round(v * 1e8) / 1e8;

// ---------- operazioni ----------

/** Movimento di cassa dell'operazione (segno del conto). Se manca, lo ricava da quantità × prezzo ± commissioni. */
export function tradeCash(t: Pick<Trade, "side" | "quantity" | "price" | "fees" | "amount">): number {
  if (Number.isFinite(t.amount) && Math.abs(t.amount) > 1e-6) return t.amount;
  const gross = (Number(t.quantity) || 0) * (Number(t.price) || 0), fees = Math.abs(Number(t.fees) || 0);
  return t.side === "buy" ? -(gross + fees) : gross - fees;
}

export const sortTrades = (ts: readonly Trade[]): Trade[] => [...ts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

/** Stato progressivo di una posizione (costo medio ponderato). */
export interface Book { qty: number; cost: number; realized: number; bought: number; sold: number; fees: number; issues: string[] }
export const emptyBook = (): Book => ({ qty: 0, cost: 0, realized: 0, bought: 0, sold: 0, fees: 0, issues: [] });

export function applyTrade(b: Book, t: Trade): Book {
  const q = Math.abs(Number(t.quantity) || 0), cash = tradeCash(t);
  b.fees += Math.abs(Number(t.fees) || 0);
  if (t.side === "buy") {
    b.qty += q; b.cost += Math.abs(cash); b.bought += Math.abs(cash);
  } else {
    const proceeds = Math.abs(cash); // vendita: incasso netto
    b.sold += proceeds;
    let costOut: number;
    if (q > b.qty + EPS) {
      if (!b.issues.includes("oversell")) b.issues.push("oversell");
      costOut = b.cost; // la parte venduta in più non ha un costo noto
      b.qty = 0;
    } else {
      costOut = b.qty > EPS ? (b.cost / b.qty) * q : 0;
      b.qty -= q;
    }
    b.cost -= costOut;
    b.realized += proceeds - costOut;
  }
  if (b.qty < 1e-8) { b.qty = 0; b.cost = 0; }
  return b;
}

export function bookOf(trades: readonly Trade[]): Book {
  const b = emptyBook();
  for (const t of sortTrades(trades)) applyTrade(b, t);
  return b;
}

// ---------- posizioni ----------

export interface Position {
  instrument: Instrument;
  quantity: number;
  avgCost: number; // € per unità, commissioni comprese
  invested: number; // costo della quantità ancora in portafoglio
  price: number | null; // ultimo prezzo noto in euro
  quote: PriceQuote | null;
  marketValue: number; // quantità × prezzo; al costo se il prezzo non c'è
  valuedAtCost: boolean;
  unrealized: number; // € (0 se valutata al costo)
  unrealizedPct: number | null; // su invested
  realized: number; // € dalle vendite (netto commissioni e imposte trattenute)
  bought: number; sold: number; fees: number;
  trades: Trade[]; // in ordine di data
  firstDate: string; lastDate: string;
  accounts: string[];
  weight: number; // quota del valore totale (0..1)
  closed: boolean;
  issues: string[]; // "oversell" = vendute più quote di quelle registrate
}

/** Prezzo in euro utilizzabile per la valutazione (null se assente o non valido). */
export function quotePrice(q: PriceQuote | undefined | null): number | null {
  if (!q || !Number.isFinite(q.price) || q.price < 0) return null;
  return q.currency && q.currency.toUpperCase() !== "EUR" ? null : q.price;
}

export function positions(data: InvestData | undefined): Position[] {
  if (!data) return [];
  const byInst = new Map<string, Trade[]>();
  for (const t of data.trades) { const a = byInst.get(t.instrumentId); if (a) a.push(t); else byInst.set(t.instrumentId, [t]); }
  const out: Position[] = [];
  for (const inst of data.instruments) {
    const trades = sortTrades(byInst.get(inst.id) ?? []);
    const b = emptyBook();
    for (const t of trades) applyTrade(b, t);
    const quote = data.prices[inst.id] ?? null;
    const price = quotePrice(quote);
    const qty = rq(b.qty);
    const valuedAtCost = qty > 0 && price == null;
    const marketValue = qty > 0 ? (price != null ? qty * price : b.cost) : 0;
    const unrealized = qty > 0 && price != null ? marketValue - b.cost : 0;
    out.push({
      instrument: inst, quantity: qty, avgCost: qty > 0 ? b.cost / qty : 0, invested: r2(b.cost), price, quote,
      marketValue: r2(marketValue), valuedAtCost, unrealized: r2(unrealized),
      unrealizedPct: qty > 0 && price != null && b.cost > EPS ? unrealized / b.cost : null,
      realized: r2(b.realized), bought: r2(b.bought), sold: r2(b.sold), fees: r2(b.fees), trades,
      firstDate: trades[0]?.date ?? "", lastDate: trades.at(-1)?.date ?? "",
      accounts: [...new Set(trades.map((t) => t.account).filter(Boolean))],
      weight: 0, closed: qty <= 0, issues: b.issues,
    });
  }
  const total = out.reduce((s, p) => s + p.marketValue, 0);
  for (const p of out) p.weight = total > EPS ? p.marketValue / total : 0;
  return out.sort((a, b) => b.marketValue - a.marketValue || b.realized - a.realized || a.instrument.name.localeCompare(b.instrument.name));
}

export interface Totals {
  marketValue: number;
  invested: number; // costo delle posizioni aperte
  unrealized: number; // solo posizioni con prezzo
  unrealizedPct: number | null; // su costo delle posizioni con prezzo
  realized: number;
  fees: number;
  open: number; // posizioni aperte
  unpriced: number; // posizioni aperte valutate al costo
  lastQuoteAt: string | null; // prezzo più recente
  oldestQuoteAt: string | null; // prezzo più vecchio tra le posizioni aperte con prezzo
}

export function totals(pos: readonly Position[]): Totals {
  let mv = 0, inv = 0, un = 0, pricedCost = 0, real = 0, fees = 0, open = 0, unpriced = 0;
  let last: string | null = null, oldest: string | null = null;
  for (const p of pos) {
    real += p.realized; fees += p.fees;
    if (p.closed) continue;
    open++; mv += p.marketValue; inv += p.invested;
    if (p.valuedAtCost) { unpriced++; continue; }
    un += p.unrealized; pricedCost += p.invested;
    const at = p.quote?.at ?? null;
    if (at && (!last || at > last)) last = at;
    if (at && (!oldest || at < oldest)) oldest = at;
  }
  return { marketValue: r2(mv), invested: r2(inv), unrealized: r2(un), unrealizedPct: pricedCost > EPS ? un / pricedCost : null,
    realized: r2(real), fees: r2(fees), open, unpriced, lastQuoteAt: last, oldestQuoteAt: oldest };
}

// ---------- ripartizione ----------

export interface Slice { id: string; label: string; value: number; pct: number; kind: InstrumentKind }

export function allocationByKind(pos: readonly Position[]): Slice[] {
  const m = new Map<InstrumentKind, number>();
  for (const p of pos) if (!p.closed && p.marketValue > 0) m.set(p.instrument.kind, (m.get(p.instrument.kind) ?? 0) + p.marketValue);
  const tot = [...m.values()].reduce((s, v) => s + v, 0);
  return [...m].map(([kind, value]) => ({ id: kind, label: KIND_LABEL[kind] ?? kind, value: r2(value), pct: tot > EPS ? value / tot : 0, kind }))
    .sort((a, b) => b.value - a.value);
}

export function allocationByInstrument(pos: readonly Position[]): Slice[] {
  const open = pos.filter((p) => !p.closed && p.marketValue > 0);
  const tot = open.reduce((s, p) => s + p.marketValue, 0);
  return open.map((p) => ({ id: p.instrument.id, label: p.instrument.name, value: p.marketValue, pct: tot > EPS ? p.marketValue / tot : 0, kind: p.instrument.kind }))
    .sort((a, b) => b.value - a.value);
}

// ---------- valore nel tempo ----------

const ymOf = (d: string) => d.slice(0, 7);
function nextYm(ym: string): string {
  let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + 1;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}
const ymIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const ymFromIndex = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;

/**
 * Prezzo di fine mese dallo storico: il punto del mese stesso, altrimenti quello del mese
 * precedente (tolleranza di un mese). null se lo storico non copre il mese.
 */
export function historyPrice(hist: readonly (readonly [string, number])[] | undefined, ym: string): number | null {
  if (!hist?.length) return null;
  let best: readonly [string, number] | null = null;
  for (const p of hist) if (ymOf(p[0]) <= ym && (!best || p[0] > best[0])) best = p;
  if (!best || !Number.isFinite(best[1])) return null;
  return ymIndex(ym) - ymIndex(ymOf(best[0])) <= 1 ? best[1] : null;
}

export interface ValueSeries {
  keys: string[]; // "YYYY-MM"
  value: number[]; // valore di mercato a fine mese (al costo dove manca il prezzo)
  invested: number[]; // costo delle posizioni aperte a fine mese
  estimated: boolean[]; // true se nel mese almeno una posizione è valutata al costo
}

/**
 * Valore del portafoglio a fine mese, dal mese della prima operazione a `asOf`.
 * Prezzo di fine mese dallo storico (priceHistory); nel mese di `asOf` l'ultimo prezzo noto;
 * senza prezzo la posizione vale il suo costo (e il mese è segnato come stimato).
 */
export function valueOverTime(data: InvestData | undefined, opts: { asOf: string; maxMonths?: number }): ValueSeries {
  const out: ValueSeries = { keys: [], value: [], invested: [], estimated: [] };
  if (!data?.trades.length) return out;
  const asOf = opts.asOf, lastYm = ymOf(asOf);
  const known = new Set(data.instruments.map((i) => i.id));
  const trades = sortTrades(data.trades.filter((t) => known.has(t.instrumentId) && t.date <= asOf));
  if (!trades.length) return out;
  let ym = ymOf(trades[0].date);
  const max = Math.max(1, opts.maxMonths ?? 120);
  if (ymIndex(lastYm) - ymIndex(ym) + 1 > max) ym = ymFromIndex(ymIndex(lastYm) - max + 1); // le operazioni precedenti entrano nel primo mese
  const books = new Map<string, Book>();
  let ti = 0;
  for (; ym <= lastYm; ym = nextYm(ym)) {
    const end = ym === lastYm ? asOf : ym + "-31";
    while (ti < trades.length && trades[ti].date <= end) {
      const t = trades[ti++];
      let b = books.get(t.instrumentId);
      if (!b) books.set(t.instrumentId, (b = emptyBook()));
      applyTrade(b, t);
    }
    let value = 0, invested = 0, est = false;
    for (const [id, b] of books) {
      if (b.qty <= 0) continue;
      invested += b.cost;
      const p = ym === lastYm ? (quotePrice(data.prices[id]) ?? historyPrice(data.priceHistory?.[id], ym)) : historyPrice(data.priceHistory?.[id], ym);
      if (p == null) { value += b.cost; est = true; } else value += b.qty * p;
    }
    out.keys.push(ym); out.value.push(r2(value)); out.invested.push(r2(invested)); out.estimated.push(est);
  }
  return out;
}

// ---------- storico prezzi ----------

/** Un punto per mese (l'ultimo del mese) da una serie giornaliera [data, prezzo]. */
export function monthlyPoints(points: readonly (readonly [string, number])[]): [string, number][] {
  const m = new Map<string, [string, number]>();
  for (const [d, v] of points) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(d) || !Number.isFinite(v)) continue;
    const k = d.slice(0, 7), cur = m.get(k);
    if (!cur || d >= cur[0]) m.set(k, [d.slice(0, 10), v]);
  }
  return [...m.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Unisce lo storico salvato con quello nuovo (il nuovo vince sullo stesso mese) e tiene gli ultimi `max` mesi. */
export function mergeHistory(old: readonly (readonly [string, number])[] | undefined, fresh: readonly (readonly [string, number])[], max = 120): [string, number][] {
  const m = new Map<string, [string, number]>();
  for (const p of monthlyPoints(old ?? [])) m.set(p[0].slice(0, 7), p);
  for (const p of monthlyPoints(fresh)) m.set(p[0].slice(0, 7), p);
  return [...m.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-max);
}

// ---------- dividendi ----------

export interface DividendInfo { total: number; byYear: Record<string, number>; lineIds: string[] }
export interface DividendReport {
  byInstrument: Record<string, DividendInfo>;
  other: DividendInfo; // rendite finanziarie non attribuite (es. interessi sulla liquidità)
  byYear: Record<string, number>; // tutte le rendite attribuite a uno strumento
  years: string[];
}
const emptyDiv = (): DividendInfo => ({ total: 0, byYear: {}, lineIds: [] });
const addDiv = (d: DividendInfo, l: Line) => {
  const y = l.date.slice(0, 4);
  d.total = r2(d.total + l.amount); d.byYear[y] = r2((d.byYear[y] ?? 0) + l.amount); d.lineIds.push(l.parentId);
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GENERIC = new Set(["ETF", "UCITS", "ACC", "DIST", "INC", "USD", "EUR", "THE", "INC.", "CORP", "PLC", "SA", "AG", "NV", "SPA", "FUND", "INDEX"]);

/**
 * Dividendi e cedole per strumento, migliore ipotesi: righe Entrata con categoria
 * "inc.financial_income" la cui descrizione o controparte contiene, nell'ordine,
 * l'ISIN, il nome completo, il ticker (parola intera, almeno 3 caratteri) o le prime
 * tre parole significative del nome (almeno 8 caratteri). Le altre righe della categoria
 * (interessi sulla liquidità, cashback…) finiscono in `other`.
 */
export function dividends(lines: readonly Line[], instruments: readonly Instrument[]): DividendReport {
  const rep: DividendReport = { byInstrument: {}, other: emptyDiv(), byYear: {}, years: [] };
  const keys = instruments.map((i) => {
    const name = norm(i.name);
    const words = name.split(" ").filter((w) => w.length > 1 && !GENERIC.has(w));
    const prefix = words.slice(0, 3).join(" ");
    const sym = norm(i.symbol ?? "");
    return {
      id: i.id, isin: norm(i.isin ?? ""), name: name.length >= 4 ? name : "",
      sym: sym.length >= 3 && !GENERIC.has(sym) ? new RegExp("(^|[^A-Z0-9])" + escapeRe(sym) + "($|[^A-Z0-9])") : null,
      prefix: prefix.length >= 8 && prefix !== name ? prefix : "",
    };
  });
  const years = new Set<string>();
  for (const l of lines) {
    if (l.type !== "income" || l.categoryId !== "inc.financial_income" || l.unbalanced) continue;
    const hay = norm(l.description + " " + l.counterparty);
    const hit = keys.find((k) => k.isin && hay.includes(k.isin)) ?? keys.find((k) => k.name && hay.includes(k.name))
      ?? keys.find((k) => k.sym && k.sym.test(hay)) ?? keys.find((k) => k.prefix && hay.includes(k.prefix));
    if (!hit) { addDiv(rep.other, l); continue; }
    addDiv((rep.byInstrument[hit.id] ??= emptyDiv()), l);
    const y = l.date.slice(0, 4);
    years.add(y);
    rep.byYear[y] = r2((rep.byYear[y] ?? 0) + l.amount);
  }
  rep.years = [...years].sort();
  return rep;
}

// ---------- ISIN e numeri ----------

/** ISIN valido (formato + cifra di controllo). */
export function isValidIsin(s: string): boolean {
  const v = String(s ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(v)) return false;
  const digits = v.slice(0, 11).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let sum = 0, dbl = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10 === Number(v[11]);
}

/** Primo ISIN valido in un testo. */
export function findIsin(text: string): string {
  for (const m of norm(text).matchAll(/(?:^|[^A-Z0-9])([A-Z]{2}[A-Z0-9]{9}\d)(?=$|[^A-Z0-9])/g)) if (isValidIsin(m[1])) return m[1];
  return "";
}

/**
 * Numero scritto da una macchina (CSV Trade Republic: punto decimale, niente migliaia) o a mano:
 * "0.512345" → 0.512345; "1,5" → 1.5; "1.234,56" / "1,234.56" → 1234.56. NaN se illeggibile.
 * Diverso da parseBankAmount, che leggerebbe "1.234" come 1234.
 */
export function machineNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? "").trim().replace(/[\s€]/g, "");
  if (!s) return NaN;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc >= 0 && ld >= 0) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc >= 0) s = (s.match(/,/g)!.length > 1 ? s.replace(/,/g, "") : s.replace(",", "."));
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

// ---------- proposte da Trade Republic ----------

export interface TradeProposal {
  movementId: string;
  date: string;
  account: string;
  side: TradeSide;
  instrumentId?: string; // strumento già presente con lo stesso ISIN / nome
  instrument: { name: string; kind: InstrumentKind; isin?: string; symbol?: string; currency: string };
  quantity: number | null; // null = non leggibile: la chiede l'interfaccia, mai inventata
  price: number | null; // € per unità (dal file, o lordo ÷ quantità)
  fees: number;
  amount: number; // movimento di cassa (con segno)
  description: string;
  missing: string[]; // es. ["quantità"]
  from: "colonne" | "descrizione"; // dove sono stati letti ISIN/quantità
  duplicateOf?: string; // operazione manuale già presente (stesso conto, ±3 giorni, stesso importo) senza movimento
}

/** Valore di raw per chiave, senza badare a maiuscole/spazi (il CSV TR ha intestazioni minuscole, la v3.10 maiuscole). */
export function rawGet(raw: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  if (!raw) return undefined;
  const want = new Set(keys.map(norm));
  for (const [k, v] of Object.entries(raw)) if (want.has(norm(k)) && v !== "" && v != null) return v;
  return undefined;
}

const QTY_RE = [
  /(?:QUANTITY|QUANTITA|QUANTITA'|QTA|QTY|ANZAHL|STUCK|STUECK|SHARES|QUOTE|PEZZI|NOMINALE)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/,
  /(\d+(?:[.,]\d+)?)\s*(?:PZ|PEZZI|QUOTE|AZIONI|SHARES|STK|STUCK|UNITS|UNITA|TITOLI)(?![A-Z])/,
];
const PRICE_RE = /(?:@|PREZZO|PRICE|KURS|CORSO)\s*[:=]?\s*(?:EUR|€)?\s*(\d+(?:[.,]\d+)?)/;
const decimalNum = (s: string) => Number(s.replace(",", "."));

function kindFrom(assetClass: string, name: string, isin: string): InstrumentKind {
  const a = norm(assetClass);
  if (/CRYPTO/.test(a)) return "crypto";
  if (/BOND/.test(a)) return "bond";
  if (/FUND|ETF|ETC|ETN/.test(a)) return "etf";
  if (/STOCK|EQUITY|SHARE/.test(a)) return "stock";
  const n = norm(name);
  if (/\bETF\b|UCITS|ISHARES|VANGUARD|XTRACKERS|AMUNDI|SPDR|LYXOR|INVESCO|WISDOMTREE|VANECK/.test(n)) return "etf";
  if (/\b(BTC|BITCOIN|ETHEREUM|ETH|SOLANA|XRP|CARDANO)\b/.test(n)) return "crypto";
  if (/^(IE|LU)/.test(isin)) return "etf";
  return isin ? "stock" : "other";
}

const TR_WORDS = /^(BUY TRADE|SELL TRADE|SAVINGS PLAN EXECUTION|ESECUZIONE (DEL )?PIANO DI ACCUMULO|PIANO DI ACCUMULO|ACQUISTO|VENDITA|BUY|SELL|KAUF|VERKAUF|SPARPLAN AUSGEFUHRT|SAVEBACK|ROUND ?UP)\b\s*/;
function nameFrom(m: Movement, isin: string, accounts: Set<string>): string {
  const rn = String(rawGet(m.raw, "name", "nome", "instrument", "titolo") ?? "").trim();
  if (rn) return rn;
  if (m.counterparty && !accounts.has(norm(m.counterparty))) return m.counterparty;
  let d = norm(descOf(m)).replace(TR_WORDS, "");
  if (isin) d = d.replace(isin, " ");
  d = d.replace(/,?\s*(QUANTITY|QUANTITA|QTA|QTY)\s*[:=]?\s*[\d.,]+/g, " ").replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "");
  return d || descOf(m);
}

/** Strumento già presente: stesso ISIN, poi stesso nome, poi stesso ticker. */
export function findInstrument(list: readonly Instrument[], q: { isin?: string; name?: string; symbol?: string; coingeckoId?: string }): Instrument | undefined {
  const isin = norm(q.isin ?? ""), name = norm(q.name ?? ""), sym = norm(q.symbol ?? ""), cg = q.coingeckoId ?? "";
  return (cg ? list.find((i) => i.coingeckoId === cg) : undefined)
    ?? (isin ? list.find((i) => norm(i.isin ?? "") === isin) : undefined)
    ?? (name ? list.find((i) => norm(i.name) === name) : undefined)
    ?? (sym && !cg ? list.find((i) => norm(i.symbol ?? "") === sym && !i.coingeckoId) : undefined);
}

const isInvestMovement = (m: Movement) =>
  m.type === "invest_buy" || m.type === "invest_sell" ||
  (norm(m.account) === "TRADE REPUBLIC" && !m.type && /\b(BUY|SELL)\b|SAVINGS|SAVEBACK|ROUND_?UP/.test(norm(m.sourceType)));

/** Movimenti di investimento non ancora collegati a un'operazione e non ignorati. */
export function unlinkedInvestMovements(movements: readonly Movement[], data: InvestData | undefined): Movement[] {
  const linked = new Set((data?.trades ?? []).map((t) => t.movementId).filter(Boolean));
  const ignored = new Set(data?.ignoredMovements ?? []);
  return movements.filter((m) => !m.deletedAt && !m.excluded && !linked.has(m.id) && !ignored.has(m.id) && isInvestMovement(m));
}

/**
 * Proposte di operazioni dai movimenti di investimento (pensato per Trade Republic: l'export CSV
 * ha le colonne `symbol` = ISIN, `shares` = quantità, `price` = prezzo, `name`, `asset_class`,
 * `fee`, conservate in movement.raw). Se le colonne mancano si cercano ISIN e "quantity: …"
 * nella descrizione. Una proposta nasce solo se c'è almeno l'ISIN o la quantità; la quantità
 * non viene mai stimata (null = da chiedere). Restano da confermare: nulla è scritto qui.
 */
export function proposeTrades(movements: readonly Movement[], data: InvestData | undefined, accountNames: readonly string[] = ["Trade Republic", "Binance"]): TradeProposal[] {
  const accounts = new Set(accountNames.map(norm));
  const out: TradeProposal[] = [];
  const trades = data?.trades ?? [];
  const instruments = data?.instruments ?? [];
  for (const m of unlinkedInvestMovements(movements, data)) {
    const desc = descOf(m), amount = amountOf(m);
    const rawSym = String(rawGet(m.raw, "symbol", "isin") ?? "").trim().toUpperCase();
    let from: TradeProposal["from"] = "colonne";
    let isin = isValidIsin(rawSym) ? rawSym : "";
    if (!isin) { isin = findIsin(desc); if (isin) from = "descrizione"; }
    const symbol = !isin && rawSym && /^[A-Z0-9.:-]{1,12}$/.test(rawSym) ? rawSym : undefined;

    let quantity: number | null = null;
    const rq0 = machineNum(rawGet(m.raw, "shares", "quantity", "qty", "quantita", "quantità"));
    if (Number.isFinite(rq0) && Math.abs(rq0) > 0) quantity = Math.abs(rq0);
    else {
      const nd = norm(desc);
      for (const re of QTY_RE) { const x = nd.match(re); if (x) { const q = decimalNum(x[1]); if (q > 0) { quantity = q; from = "descrizione"; break; } } }
    }
    if (!isin && quantity == null) continue;

    const feeRaw = typeof m.raw?.__TR_FEE === "number" ? (m.raw.__TR_FEE as number) : machineNum(rawGet(m.raw, "fee", "fees", "commissione"));
    const fees = Number.isFinite(feeRaw) ? Math.abs(feeRaw) : 0;
    const st = norm(m.sourceType);
    const side: TradeSide = m.type === "invest_sell" || (!m.type && /\bSELL\b/.test(st)) ? "sell" : m.type === "invest_buy" || (!m.type && /\bBUY\b|SAVINGS/.test(st)) ? "buy" : amount > 0 ? "sell" : "buy";

    let price: number | null = null;
    const rp = machineNum(rawGet(m.raw, "price", "prezzo", "kurs"));
    if (Number.isFinite(rp) && rp > 0) price = rp;
    else {
      const x = norm(desc).match(PRICE_RE);
      if (x && decimalNum(x[1]) > 0) price = decimalNum(x[1]);
      else if (quantity) {
        const gross = typeof m.raw?.__TR_GROSS_AMOUNT === "number" ? Math.abs(m.raw.__TR_GROSS_AMOUNT as number) : side === "buy" ? Math.abs(amount) - fees : Math.abs(amount) + fees;
        if (gross > 0) price = gross / quantity;
      }
    }

    const name = nameFrom(m, isin, accounts);
    const existing = findInstrument(instruments, { isin, name, symbol });
    const kind = existing?.kind ?? kindFrom(String(rawGet(m.raw, "asset_class", "assetclass") ?? ""), name, isin);
    const date = dateOf(m);
    const dup = trades.find((t) => !t.movementId && t.account === m.account && Math.abs(tradeCash(t) - amount) < 0.01 &&
      Math.abs(Date.parse(t.date) - Date.parse(date)) <= 3 * 86400000 && (!existing || t.instrumentId === existing.id));
    out.push({
      movementId: m.id, date, account: m.account, side, instrumentId: existing?.id,
      instrument: { name: existing?.name ?? name, kind, isin: isin || existing?.isin || undefined, symbol: symbol ?? existing?.symbol, currency: "EUR" },
      quantity, price: price != null ? Math.round(price * 1e6) / 1e6 : null, fees, amount, description: desc,
      missing: quantity == null ? ["quantità"] : [], from, duplicateOf: dup?.id,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Operazione pronta da salvare a partire da una proposta (quantità obbligatoria). */
export function tradeFromProposal(p: TradeProposal, instrumentId: string, quantity = p.quantity): Omit<Trade, "id"> | null {
  if (quantity == null || !(quantity > 0)) return null;
  const price = p.price ?? (Math.abs(p.amount) - (p.side === "buy" ? p.fees : -p.fees)) / quantity;
  return { date: p.date, instrumentId, account: p.account, side: p.side, quantity, price: Math.round(price * 1e6) / 1e6, fees: p.fees, amount: p.amount, movementId: p.movementId };
}
