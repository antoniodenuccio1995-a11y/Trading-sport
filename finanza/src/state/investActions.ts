// Azioni sul portafoglio investimenti: strumenti, operazioni, proposte da Trade Republic, prezzi.
// Ogni modifica passa da mutate (salvataggio e nuovo disegno). I prezzi si scaricano solo su
// richiesta della pagina Investimenti, al massimo ogni 15 minuti.
import type { Snapshot } from "../domain/types.ts";
import { uid } from "../domain/movement.ts";
import { getSnap, mutate } from "./store.ts";
import { emptyInvest, type Instrument, type InstrumentKind, type InvestData, type PriceQuote, type Trade } from "../invest/types.ts";
import { findInstrument, mergeHistory, tradeCash, tradeFromProposal, type TradeProposal } from "../invest/portfolio.ts";
import { fetchAll, isOffline, PRICE_TTL_MS, type FetchOutcome } from "../invest/prices.ts";

/** Portafoglio dell'istantanea, creato e completato se serve (solo dentro mutate). */
function inv(s: Snapshot): InvestData {
  const d = (s.investments ??= emptyInvest());
  d.instruments ??= []; d.trades ??= []; d.prices ??= {};
  d.priceHistory ??= {}; d.ignoredMovements ??= []; d.historyAt ??= {};
  return d;
}

const clean = (v: string | undefined) => { const t = (v ?? "").trim(); return t || undefined; };
const round = (v: number, k = 1e6) => Math.round(v * k) / k;

// ---------- strumenti ----------

export type InstrumentInput = Omit<Instrument, "id"> & { id?: string };

/** Aggiunge uno strumento; se esiste già (stesso ISIN, id CoinGecko o nome) restituisce quello. */
export function addInstrument(input: InstrumentInput): Instrument {
  let out!: Instrument;
  mutate((s) => {
    const d = inv(s);
    const isin = clean(input.isin)?.toUpperCase();
    const found = findInstrument(d.instruments, { isin, name: input.name, coingeckoId: input.coingeckoId, symbol: input.kind === "crypto" ? undefined : input.symbol });
    if (found) { out = found; return; }
    out = {
      id: input.id ?? uid(), name: input.name.trim() || isin || input.symbol || "Strumento", kind: input.kind,
      isin, symbol: clean(input.symbol)?.toUpperCase(), coingeckoId: clean(input.coingeckoId),
      currency: (clean(input.currency) ?? "EUR").toUpperCase(), ...(input.manualPrice ? { manualPrice: true } : {}), ...(clean(input.note) ? { note: input.note } : {}),
    };
    d.instruments.push(out);
  });
  return out;
}

export function updateInstrument(id: string, patch: Partial<Omit<Instrument, "id">>) {
  mutate((s) => {
    const d = inv(s), i = d.instruments.find((x) => x.id === id);
    if (!i) return;
    const before = { isin: i.isin, symbol: i.symbol, coingeckoId: i.coingeckoId };
    Object.assign(i, patch);
    if (patch.isin !== undefined) i.isin = clean(patch.isin)?.toUpperCase();
    if (patch.symbol !== undefined) i.symbol = clean(patch.symbol)?.toUpperCase();
    if (patch.coingeckoId !== undefined) i.coingeckoId = clean(patch.coingeckoId);
    // fonte cambiata: il simbolo trovato e lo storico non valgono più
    if (before.isin !== i.isin || before.symbol !== i.symbol || before.coingeckoId !== i.coingeckoId) {
      delete i.quoteSymbol; delete d.historyAt![id];
    }
  });
}

export interface RemovedInstrument { instrument: Instrument; trades: Trade[]; price?: PriceQuote; history?: [string, number][] }

/** Elimina lo strumento con le sue operazioni e i prezzi. Restituisce quanto serve per annullare. */
export function deleteInstrument(id: string): RemovedInstrument | null {
  let removed: RemovedInstrument | null = null;
  mutate((s) => {
    const d = inv(s), instrument = d.instruments.find((x) => x.id === id);
    if (!instrument) return;
    removed = { instrument, trades: d.trades.filter((t) => t.instrumentId === id), price: d.prices[id], history: d.priceHistory![id] };
    d.instruments = d.instruments.filter((x) => x.id !== id);
    d.trades = d.trades.filter((t) => t.instrumentId !== id);
    delete d.prices[id]; delete d.priceHistory![id]; delete d.historyAt![id];
  });
  return removed;
}

export function restoreInstrument(r: RemovedInstrument) {
  mutate((s) => {
    const d = inv(s);
    if (!d.instruments.some((x) => x.id === r.instrument.id)) d.instruments.push(r.instrument);
    const ids = new Set(d.trades.map((t) => t.id));
    for (const t of r.trades) if (!ids.has(t.id)) d.trades.push(t);
    if (r.price) d.prices[r.instrument.id] = r.price;
    if (r.history) d.priceHistory![r.instrument.id] = r.history;
  });
}

// ---------- operazioni ----------

export type TradeInput = Omit<Trade, "id"> & { id?: string };

function normTrade(t: TradeInput): Trade {
  const quantity = Math.abs(Number(t.quantity) || 0), price = Math.abs(Number(t.price) || 0), fees = Math.abs(Number(t.fees) || 0);
  const base: Trade = { id: t.id ?? uid(), date: t.date, instrumentId: t.instrumentId, account: t.account, side: t.side, quantity: round(quantity, 1e10), price: round(price), fees: round(fees, 100), amount: 0 };
  const a = Number(t.amount);
  // l'importo del movimento collegato vince; altrimenti quantità × prezzo ± commissioni, col segno giusto
  base.amount = Math.round((Number.isFinite(a) && Math.abs(a) > 1e-6 ? (t.side === "buy" ? -Math.abs(a) : Math.abs(a)) : tradeCash(base)) * 100) / 100;
  if (t.movementId) base.movementId = t.movementId;
  if (clean(t.note)) base.note = t.note!.trim();
  return base;
}

export function addTrade(input: TradeInput): Trade {
  const t = normTrade(input);
  mutate((s) => { inv(s).trades.push(t); });
  return t;
}

export function updateTrade(id: string, patch: Partial<Omit<Trade, "id">>) {
  mutate((s) => {
    const d = inv(s), i = d.trades.findIndex((x) => x.id === id);
    if (i < 0) return;
    const merged = { ...d.trades[i], ...patch };
    // se cambiano quantità/prezzo/commissioni senza un movimento collegato, l'importo si ricalcola
    if (!merged.movementId && (patch.quantity !== undefined || patch.price !== undefined || patch.fees !== undefined || patch.side !== undefined) && patch.amount === undefined) merged.amount = 0;
    d.trades[i] = normTrade(merged);
  });
}

export function deleteTrade(id: string): Trade | null {
  let removed: Trade | null = null;
  mutate((s) => { const d = inv(s); removed = d.trades.find((t) => t.id === id) ?? null; d.trades = d.trades.filter((t) => t.id !== id); });
  return removed;
}

export function restoreTrade(t: Trade) {
  mutate((s) => { const d = inv(s); if (!d.trades.some((x) => x.id === t.id)) d.trades.push(t); });
}

// ---------- proposte da Trade Republic ----------

export interface AcceptOverrides { quantity?: number; kind?: InstrumentKind; name?: string }

function acceptInto(d: InvestData, p: TradeProposal, o: AcceptOverrides = {}): Trade | null {
  if (d.trades.some((t) => t.movementId === p.movementId)) return null; // già collegata
  if (p.duplicateOf) {
    const t = d.trades.find((x) => x.id === p.duplicateOf);
    if (t && !t.movementId) { t.movementId = p.movementId; t.amount = p.amount; return t; }
  }
  let inst = p.instrumentId ? d.instruments.find((i) => i.id === p.instrumentId) : undefined;
  inst ??= findInstrument(d.instruments, { isin: p.instrument.isin, name: o.name ?? p.instrument.name, symbol: p.instrument.symbol });
  if (!inst) {
    inst = { id: uid(), name: (o.name ?? p.instrument.name).trim() || p.instrument.isin || "Strumento", kind: o.kind ?? p.instrument.kind,
      currency: p.instrument.currency || "EUR", ...(p.instrument.isin ? { isin: p.instrument.isin } : {}), ...(p.instrument.symbol ? { symbol: p.instrument.symbol } : {}) };
    d.instruments.push(inst);
  }
  const base = tradeFromProposal(p, inst.id, o.quantity ?? p.quantity);
  if (!base) return null;
  const t = normTrade(base);
  d.trades.push(t);
  return t;
}

/** Conferma una proposta: crea lo strumento se manca e l'operazione collegata al movimento. */
export function acceptProposal(p: TradeProposal, o?: AcceptOverrides): Trade | null {
  let t: Trade | null = null;
  mutate((s) => { t = acceptInto(inv(s), p, o); });
  return t;
}

/** Conferma più proposte in un solo salvataggio; restituisce quante sono diventate operazioni. */
export function acceptProposals(list: { p: TradeProposal; o?: AcceptOverrides }[]): number {
  let n = 0;
  mutate((s) => { const d = inv(s); for (const { p, o } of list) if (acceptInto(d, p, o)) n++; });
  return n;
}

export function ignoreMovement(movementId: string) {
  mutate((s) => { const d = inv(s); if (!d.ignoredMovements!.includes(movementId)) d.ignoredMovements!.push(movementId); });
}
export function unignoreMovement(movementId: string) {
  mutate((s) => { const d = inv(s); d.ignoredMovements = d.ignoredMovements!.filter((x) => x !== movementId); });
}

// ---------- prezzi ----------

/** Prezzo inserito a mano (in euro). `lock` = non aggiornarlo più in automatico. */
export function setManualPrice(instrumentId: string, price: number, opts: { lock?: boolean; date?: string } = {}) {
  if (!(price >= 0) || !Number.isFinite(price)) return;
  mutate((s) => {
    const d = inv(s), i = d.instruments.find((x) => x.id === instrumentId);
    if (!i) return;
    const today = new Date().toISOString().slice(0, 10);
    const date = opts.date && opts.date <= today ? opts.date : today;
    const at = date === today ? new Date().toISOString() : date + "T12:00:00.000Z";
    if (opts.lock !== undefined) { if (opts.lock) i.manualPrice = true; else delete i.manualPrice; }
    const cur = d.prices[instrumentId];
    if (!cur || cur.at <= at || i.manualPrice) d.prices[instrumentId] = { price: round(price), currency: "EUR", at, source: "manuale" };
    d.priceHistory![instrumentId] = mergeHistory(d.priceHistory![instrumentId], [[date, round(price)]]);
  });
}

export interface RefreshReport {
  ran: boolean; // false = saltato (troppo presto, nessuno strumento, già in corso)
  updated: number;
  errors: FetchOutcome["errors"];
  rateLimited: FetchOutcome["rateLimited"];
  offline: boolean;
  unreachable: boolean;
  at: string;
}

let running: Promise<RefreshReport> | null = null;
let lastFailAt = 0; // fonti irraggiungibili: si riprova dopo qualche minuto, non a ogni controllo
const RETRY_AFTER_FAIL_MS = 3 * 60 * 1000;

/** È ora di aggiornare i prezzi? (ultimo aggiornamento più vecchio di 15 minuti) */
export function priceRefreshDue(now = Date.now()): boolean {
  const d = getSnap().investments;
  if (!d?.instruments.length || now - lastFailAt < RETRY_AFTER_FAIL_MS) return false;
  return !d.refreshedAt || now - Date.parse(d.refreshedAt) >= PRICE_TTL_MS;
}

export const isRefreshing = () => running !== null;

/**
 * Scarica i prezzi (e lo storico mensile, al massimo una volta al giorno). Senza `force`
 * non fa nulla se l'ultimo aggiornamento ha meno di 15 minuti. Offline non tocca i dati:
 * restano gli ultimi prezzi noti con la loro data.
 */
export function refreshPrices(opts: { force?: boolean; ids?: string[] } = {}): Promise<RefreshReport> {
  const skip = (extra: Partial<RefreshReport> = {}): Promise<RefreshReport> =>
    Promise.resolve({ ran: false, updated: 0, errors: [], rateLimited: [], offline: false, unreachable: false, at: new Date().toISOString(), ...extra });
  if (running) return running;
  const d = getSnap().investments;
  if (!d?.instruments.length) return skip();
  if (!opts.force && !opts.ids && !priceRefreshDue()) return skip();
  if (isOffline()) return skip({ offline: true });
  const list = opts.ids ? d.instruments.filter((i) => opts.ids!.includes(i.id)) : d.instruments;
  running = (async () => {
    try {
      const res = await fetchAll(list.map((i) => ({ ...i })), { ...(d.historyAt ?? {}) });
      const at = new Date().toISOString();
      let updated = 0;
      if (res.offline || res.unreachable) lastFailAt = Date.now();
      else {
        mutate((s) => {
          const x = inv(s);
          const byId = new Map(x.instruments.map((i) => [i.id, i]));
          for (const [id, patch] of Object.entries(res.patches)) { const i = byId.get(id); if (i) Object.assign(i, patch); }
          for (const [id, h] of Object.entries(res.history)) {
            if (!byId.has(id)) continue;
            x.priceHistory![id] = mergeHistory(x.priceHistory![id], h);
            x.historyAt![id] = at;
          }
          for (const [id, q] of Object.entries(res.quotes)) {
            const i = byId.get(id);
            if (!i || i.manualPrice) continue;
            x.prices[id] = q;
            if (q.currency.toUpperCase() === "EUR") x.priceHistory![id] = mergeHistory(x.priceHistory![id], [[q.at.slice(0, 10), q.price]]);
            updated++;
          }
          if (!opts.ids) x.refreshedAt = at;
        });
      }
      return { ran: true, updated, errors: res.errors, rateLimited: res.rateLimited, offline: res.offline, unreachable: res.unreachable, at };
    } finally { running = null; }
  })();
  return running;
}
