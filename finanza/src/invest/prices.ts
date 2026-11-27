// Prezzi in tempo reale, scaricati solo quando la pagina Investimenti è aperta.
//  - Cripto: API pubblica di CoinGecko (CORS aperto, nessuna chiave). Con 429 si aspetta.
//  - Azioni / ETF / obbligazioni: funzione Supabase fp-prices (Yahoo Finance lato server).
// Nessuna scrittura qui: le funzioni restituiscono dati, investActions.ts li salva con mutate.
import { SUPABASE_KEY, SUPABASE_URL, accessToken } from "../sync/engine.ts";
import { monthlyPoints } from "./portfolio.ts";
import type { Instrument, PriceQuote } from "./types.ts";

const CG = "https://api.coingecko.com/api/v3";
export const PRICES_FN = `${SUPABASE_URL}/functions/v1/fp-prices`;
/** Aggiornamento automatico al massimo ogni 15 minuti. */
export const PRICE_TTL_MS = 15 * 60 * 1000;
/** Storico mensile: al massimo una volta al giorno per strumento. */
export const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
/** Storici cripto scaricati per aggiornamento (CoinGecko gratuito: poche richieste al minuto). */
const CRYPTO_HISTORY_PER_RUN = 3;

export class RateLimited extends Error {
  constructor(public source: "coingecko" | "yahoo", public retryAfterMs: number) {
    super(source === "coingecko" ? "CoinGecko chiede di rallentare: riprovo più tardi." : "Il servizio prezzi chiede di rallentare: riprovo più tardi.");
  }
}
export class NotFound extends Error {}

const backoff: Record<"coingecko" | "yahoo", number> = { coingecko: 0, yahoo: 0 };
export const backoffUntil = (src: "coingecko" | "yahoo") => backoff[src];

const isNetErr = (e: unknown) => e instanceof TypeError || /fetch|network|Load failed|abort/i.test(String((e as Error)?.message ?? e));
export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

async function getJson(url: string, src: "coingecko" | "yahoo", init: RequestInit = {}, timeoutMs = 12000): Promise<unknown> {
  if (Date.now() < backoff[src]) throw new RateLimited(src, backoff[src] - Date.now());
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: init.signal ?? ac.signal });
    if (res.status === 429 || res.status === 503) {
      const ra = Number(res.headers.get("retry-after")) || 0;
      const wait = Math.min(30 * 60_000, Math.max(60_000, ra * 1000)); // almeno 1 minuto, al massimo 30
      backoff[src] = Date.now() + wait;
      throw new RateLimited(src, wait);
    }
    const who = src === "coingecko" ? "CoinGecko" : "Servizio prezzi";
    if (res.status === 404) {
      const body = await res.text().catch(() => "");
      if (/requested function|function not found/i.test(body)) throw new Error("Servizio prezzi non ancora pubblicato");
      throw new NotFound("Non trovato");
    }
    if (!res.ok) throw new Error(`${who}: errore ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

// ---------- cripto (CoinGecko) ----------

export interface CryptoHit { id: string; name: string; symbol: string; rank: number | null }

/** Ricerca di una cripto per nome o simbolo (es. "btc", "solana"). */
export async function searchCrypto(query: string, signal?: AbortSignal): Promise<CryptoHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const j = await getJson(`${CG}/search?query=${encodeURIComponent(q)}`, "coingecko", { signal }) as { coins?: { id: string; name: string; symbol: string; market_cap_rank?: number | null }[] };
  return (j.coins ?? []).slice(0, 8).map((c) => ({ id: c.id, name: c.name, symbol: String(c.symbol ?? "").toUpperCase(), rank: c.market_cap_rank ?? null }));
}

/** Prezzi in euro per id CoinGecko. */
export async function cryptoPrices(ids: string[]): Promise<Record<string, { eur: number; at: string }>> {
  const out: Record<string, { eur: number; at: string }> = {};
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50);
    const j = await getJson(`${CG}/simple/price?ids=${chunk.map(encodeURIComponent).join(",")}&vs_currencies=eur&include_last_updated_at=true`, "coingecko") as Record<string, { eur?: number; last_updated_at?: number }>;
    for (const [id, v] of Object.entries(j ?? {})) if (typeof v?.eur === "number") out[id] = { eur: v.eur, at: v.last_updated_at ? new Date(v.last_updated_at * 1000).toISOString() : new Date().toISOString() };
  }
  return out;
}

/** Storico mensile in euro dell'ultimo anno (il piano gratuito di CoinGecko arriva a 365 giorni). */
export async function cryptoHistory(id: string): Promise<[string, number][]> {
  const j = await getJson(`${CG}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=365&interval=daily`, "coingecko") as { prices?: [number, number][] };
  return monthlyPoints((j.prices ?? []).map(([ms, p]) => [new Date(ms).toISOString().slice(0, 10), p] as [string, number]));
}

/** id CoinGecko dal simbolo: corrispondenza esatta del simbolo, la più capitalizzata. */
export async function resolveCoingeckoId(symbolOrName: string): Promise<string | null> {
  const hits = await searchCrypto(symbolOrName);
  const s = symbolOrName.trim().toUpperCase();
  const exact = hits.filter((h) => h.symbol === s || h.name.toUpperCase() === s).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  return exact[0]?.id ?? null;
}

// ---------- azioni / ETF (funzione fp-prices) ----------

export interface SecurityQuote {
  symbol: string; name: string; exchange: string;
  price: number; currency: string; at: string;
  native: { price: number; currency: string; rate: number | null } | null;
  history: [string, number][];
}

export async function securityQuote(q: { isin?: string; symbol?: string }, withHistory: boolean): Promise<SecurityQuote> {
  const p = new URLSearchParams();
  if (q.isin) p.set("isin", q.isin);
  if (q.symbol) p.set("symbol", q.symbol);
  if (!withHistory) p.set("history", "0");
  // la funzione è riservata al titolare: serve l'accesso (lo stesso della sincronizzazione)
  const token = await accessToken().catch(() => null);
  if (!token) throw new Error("Per i prezzi di ETF e azioni accedi da Impostazioni → Sincronizzazione (le cripto funzionano anche senza).");
  const j = await getJson(`${PRICES_FN}?${p}`, "yahoo", { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } }) as Partial<SecurityQuote> & { ok?: boolean; message?: string };
  if (!j?.ok || typeof j.price !== "number") throw new Error(j?.message || "Prezzo non disponibile");
  return { symbol: j.symbol ?? "", name: j.name ?? "", exchange: j.exchange ?? "", price: j.price, currency: j.currency ?? "EUR", at: j.at ?? new Date().toISOString(), native: j.native ?? null, history: j.history ?? [] };
}

// ---------- aggiornamento di tutti gli strumenti ----------

export interface FetchOutcome {
  quotes: Record<string, PriceQuote>;
  history: Record<string, [string, number][]>;
  patches: Record<string, Partial<Instrument>>; // quoteSymbol / coingeckoId trovati
  errors: { instrumentId: string; message: string }[];
  rateLimited: ("coingecko" | "yahoo")[];
  offline: boolean; // il browser dice di essere senza rete
  unreachable: boolean; // in rete, ma nessuna fonte ha risposto
  skipped: number; // strumenti senza fonte (solo prezzo manuale)
}

/** Strumento aggiornabile in automatico? */
export const hasLiveSource = (i: Instrument) => !i.manualPrice && (i.kind === "crypto" ? !!(i.coingeckoId || i.symbol) : !!(i.isin || i.symbol || i.quoteSymbol));

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) await fn(items[k++]); }));
}

export async function fetchAll(instruments: readonly Instrument[], historyAt: Record<string, string> = {}, now = Date.now()): Promise<FetchOutcome> {
  const out: FetchOutcome = { quotes: {}, history: {}, patches: {}, errors: [], rateLimited: [], offline: false, unreachable: false, skipped: 0 };
  const live = instruments.filter(hasLiveSource);
  out.skipped = instruments.length - live.length;
  if (!live.length) return out;
  if (isOffline()) { out.offline = true; return out; }
  const needsHistory = (id: string) => !historyAt[id] || now - Date.parse(historyAt[id]) > HISTORY_TTL_MS;
  let netFailures = 0, attempts = 0;
  const fail = (id: string, e: unknown) => {
    if (e instanceof RateLimited) { if (!out.rateLimited.includes(e.source)) out.rateLimited.push(e.source); return; }
    if (isNetErr(e)) netFailures++;
    out.errors.push({ instrumentId: id, message: e instanceof NotFound ? "Strumento non trovato dal servizio prezzi" : String((e as Error)?.message ?? e) });
  };

  // cripto: prima gli id mancanti, poi un'unica richiesta di prezzi, poi pochi storici
  const crypto = live.filter((i) => i.kind === "crypto");
  const cgId = new Map<string, string>();
  for (const i of crypto) {
    if (i.coingeckoId) { cgId.set(i.id, i.coingeckoId); continue; }
    attempts++;
    try { const id = await resolveCoingeckoId(i.symbol!); if (id) { cgId.set(i.id, id); out.patches[i.id] = { coingeckoId: id }; } else out.errors.push({ instrumentId: i.id, message: "Cripto non trovata su CoinGecko" }); }
    catch (e) { fail(i.id, e); }
  }
  if (cgId.size) {
    attempts++;
    try {
      const p = await cryptoPrices([...cgId.values()]);
      for (const [iid, cid] of cgId) {
        const v = p[cid];
        if (v) out.quotes[iid] = { price: v.eur, currency: "EUR", at: v.at, source: "coingecko" };
        else out.errors.push({ instrumentId: iid, message: "Prezzo non disponibile su CoinGecko" });
      }
      let n = 0;
      for (const [iid, cid] of cgId) {
        if (n >= CRYPTO_HISTORY_PER_RUN || !needsHistory(iid)) continue;
        n++;
        try { out.history[iid] = await cryptoHistory(cid); } catch (e) { fail(iid, e); break; }
      }
    } catch (e) { for (const iid of cgId.keys()) fail(iid, e); }
  }

  // azioni, ETF e il resto: due richieste alla volta
  const sec = live.filter((i) => i.kind !== "crypto");
  await pool(sec, 2, async (i) => {
    attempts++;
    try {
      const wantHistory = needsHistory(i.id);
      const q = await securityQuote({ isin: i.isin, symbol: i.quoteSymbol || (i.isin ? undefined : i.symbol) }, wantHistory);
      out.quotes[i.id] = { price: q.price, currency: q.currency, at: q.at, source: "yahoo", ...(q.native ? { native: { price: q.native.price, currency: q.native.currency } } : {}) };
      if (wantHistory && q.currency.toUpperCase() === "EUR" && q.history.length) out.history[i.id] = q.history;
      if (q.symbol && q.symbol !== i.quoteSymbol) out.patches[i.id] = { ...out.patches[i.id], quoteSymbol: q.symbol };
    } catch (e) { fail(i.id, e); }
  });

  if (attempts > 0 && netFailures >= attempts && !Object.keys(out.quotes).length) { out.unreachable = true; out.offline = isOffline(); }
  return out;
}
