// fp-prices · prezzi di azioni, ETF e obbligazioni per Finanza Personale (sola lettura, nessun dato personale).
//
// GET /functions/v1/fp-prices?isin=IE00B4L5Y983          (oppure ?symbol=EUNL.DE / ?symbol=AAPL)
//   parametri facoltativi: history=0 (niente storico), range=1y|2y|5y|10y|max (storico mensile, default 5y)
//
// Risposta 200:
//   { ok: true, query, symbol, name, exchange, type,
//     price,            // ultimo prezzo IN EURO (se la conversione riesce)
//     currency,         // "EUR"; la valuta originale se il cambio non è disponibile (fxError: true)
//     native: { price, currency, rate } | null,   // quotazione originale se non in euro
//     at,               // ISO dell'ultimo prezzo
//     history: [["YYYY-MM-DD", prezzo €], ...]    // un punto per mese, dal più vecchio
//     cached: boolean }
// Errori: 400 {ok:false,error:"bad_request"} · 404 {ok:false,error:"not_found"}
//         503 {ok:false,error:"rate_limited"} (Retry-After) · 502 {ok:false,error:"upstream"}
//
// Fonte: Yahoo Finance (v1/finance/search per trovare il simbolo, v8/finance/chart per prezzo e
// storico). Cache in memoria di 15 minuti per istanza + Cache-Control. Nessuna chiave richiesta:
// da pubblicare con verify_jwt = false (la chiave publishable non è un JWT).
import { ISIN_RE, RANGES, SYMBOL_RE, parseChart, pickSymbol, toEur, type ChartData } from "./yahoo.ts";

const HOSTS = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TTL = 15 * 60 * 1000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const cache = new Map<string, { at: number; body: Record<string, unknown> }>();

class Upstream extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function yahoo(path: string): Promise<unknown> {
  let last: Upstream | null = null;
  for (const host of HOSTS) {
    const res = await fetch(host + path, { headers: { "user-agent": UA, accept: "application/json" } });
    if (res.ok) return await res.json();
    last = new Upstream(res.status, `Yahoo ${res.status}`);
    await res.body?.cancel();
    if (res.status === 404) break;
  }
  throw last ?? new Upstream(502, "Yahoo non raggiungibile");
}

async function chart(symbol: string, range: string, withHistory: boolean): Promise<ChartData | null> {
  const q = withHistory ? `range=${range}&interval=1mo` : "range=5d&interval=1d";
  try {
    return parseChart(await yahoo(`/v8/finance/chart/${encodeURIComponent(symbol)}?${q}&includePrePost=false&events=`));
  } catch (e) {
    if (e instanceof Upstream && e.status === 404) return null;
    throw e;
  }
}

async function resolve(query: string): Promise<{ symbol: string; name: string } | null> {
  // deno-lint-ignore no-explicit-any
  const j = await yahoo(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false`) as any;
  const hit = pickSymbol(j?.quotes);
  return hit ? { symbol: hit.symbol, name: hit.longname ?? hit.shortname ?? hit.symbol } : null;
}

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", ...extra } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json(405, { ok: false, error: "method_not_allowed" });
  const url = new URL(req.url);
  const isin = (url.searchParams.get("isin") ?? "").trim().toUpperCase();
  const symbolIn = (url.searchParams.get("symbol") ?? "").trim();
  const withHistory = url.searchParams.get("history") !== "0";
  const range = RANGES.has(url.searchParams.get("range") ?? "") ? url.searchParams.get("range")! : "5y";
  if ((!isin && !symbolIn) || (isin && !ISIN_RE.test(isin)) || (symbolIn && !SYMBOL_RE.test(symbolIn))) {
    return json(400, { ok: false, error: "bad_request", message: "Serve ?isin= (12 caratteri) oppure ?symbol=." });
  }
  const key = `${isin}|${symbolIn}|${withHistory ? range : "-"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return json(200, { ...hit.body, cached: true }, { "cache-control": "public, max-age=900" });

  try {
    // 1. simbolo: quello dato se esiste su Yahoo, altrimenti ricerca (ISIN o ticker) preferendo le borse in euro
    let symbol = symbolIn, name = "";
    let data = symbol ? await chart(symbol, range, withHistory) : null;
    if (!data) {
      const found = await resolve(isin || symbolIn);
      if (!found) return json(404, { ok: false, error: "not_found", message: "Strumento non trovato su Yahoo Finance." });
      symbol = found.symbol; name = found.name;
      data = await chart(symbol, range, withHistory);
      if (!data) return json(404, { ok: false, error: "not_found", message: "Nessun prezzo per " + symbol });
    }
    // 2. conversione in euro
    const cur = data.currency.toUpperCase();
    const fx = cur && cur !== "EUR" ? await chart(`${cur}EUR=X`, range, withHistory).catch(() => null) : null;
    const eur = toEur(data, fx);
    const body: Record<string, unknown> = {
      ok: true, query: isin || symbolIn, symbol: data.symbol || symbol, name: name || data.name, exchange: data.exchange, type: data.type,
      price: eur ? eur.price : data.price, currency: eur ? "EUR" : data.currency,
      native: cur === "EUR" ? null : { price: data.price, currency: data.currency, rate: eur?.rate ?? null },
      at: data.at, history: withHistory ? (eur ? eur.history : data.history) : [],
      ...(eur ? {} : { fxError: true }), cached: false,
    };
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 500) for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
    return json(200, body, { "cache-control": "public, max-age=900" });
  } catch (e) {
    const status = e instanceof Upstream ? e.status : 502;
    if (status === 429) return json(503, { ok: false, error: "rate_limited", message: "Yahoo Finance chiede di rallentare: riprova tra qualche minuto." }, { "retry-after": "300" });
    return json(502, { ok: false, error: "upstream", message: String((e as Error)?.message ?? e).slice(0, 200) });
  }
});
