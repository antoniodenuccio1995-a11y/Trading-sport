// fp-prices · parti pure (nessuna API Deno): scelta del simbolo Yahoo, lettura del grafico,
// conversione in euro. Testate da finanza/tests/invest.test.ts con risposte sintetiche.

export interface SearchHit {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
}

/** Borse europee in euro, in ordine di preferenza (Xetra e Borsa Italiana prima). */
export const EUR_SUFFIXES = [".DE", ".MI", ".AS", ".PA", ".F", ".MC", ".BR", ".VI", ".IR", ".HE", ".LS", ".SG", ".DU", ".MU", ".BE", ".HM", ".HA"];
const OK_TYPES = new Set(["ETF", "EQUITY", "MUTUALFUND", "BOND", "INDEX", "CRYPTOCURRENCY", "MONEYMARKET"]);

/** Simbolo più adatto tra i risultati della ricerca: quotazione in euro se c'è, poi la prima valida. */
export function pickSymbol(quotes: readonly SearchHit[] | undefined): SearchHit | null {
  const ok = (quotes ?? []).filter((q) => q && typeof q.symbol === "string" && q.symbol && (!q.quoteType || OK_TYPES.has(q.quoteType.toUpperCase())));
  if (!ok.length) return null;
  const rank = (q: SearchHit) => {
    const s = q.symbol.toUpperCase();
    const i = EUR_SUFFIXES.findIndex((x) => s.endsWith(x));
    return i >= 0 ? i : 100;
  };
  return [...ok].map((q, i) => ({ q, i, r: rank(q) })).sort((a, b) => a.r - b.r || a.i - b.i)[0].q;
}

export interface ChartData {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency: string; // dopo la correzione dei centesimi (GBp → GBP)
  price: number;
  at: string; // ISO
  history: [string, number][]; // fine mese (o ultimo giorno disponibile del mese corrente), dal più vecchio
}

// Valute quotate in centesimi su Yahoo.
const MINOR: Record<string, [string, number]> = { GBp: ["GBP", 100], GBX: ["GBP", 100], ZAc: ["ZAR", 100], ILA: ["ILS", 100] };

const pad = (n: number) => String(n).padStart(2, "0");
function monthEnd(y: number, m: number): string { // m = 1..12
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Legge la risposta di /v8/finance/chart/{symbol} (intervallo mensile). null se non valida. */
// deno-lint-ignore no-explicit-any
export function parseChart(json: any): ChartData | null {
  const r = json?.chart?.result?.[0];
  const meta = r?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  let currency = String(meta.currency ?? "");
  let div = 1;
  if (MINOR[currency]) { [currency, div] = MINOR[currency]; }
  const off = Number(meta.gmtoffset) || 0;
  const ts: number[] = Array.isArray(r.timestamp) ? r.timestamp : [];
  const close: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
  const atMs = (Number(meta.regularMarketTime) || Date.now() / 1000) * 1000;
  const at = new Date(atMs).toISOString();
  const nowYm = new Date(atMs + off * 1000).toISOString().slice(0, 7);
  const byMonth = new Map<string, [string, number]>();
  for (let i = 0; i < ts.length; i++) {
    const v = close[i];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const local = new Date((ts[i] + off) * 1000);
    const y = local.getUTCFullYear(), m = local.getUTCMonth() + 1;
    const ym = `${y}-${pad(m)}`;
    if (ym > nowYm) continue;
    byMonth.set(ym, [ym === nowYm ? new Date(atMs + off * 1000).toISOString().slice(0, 10) : monthEnd(y, m), v / div]);
  }
  const price = meta.regularMarketPrice / div;
  byMonth.set(nowYm, [new Date(atMs + off * 1000).toISOString().slice(0, 10), price]);
  const history = [...byMonth.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, v]) => [d, round6(v)] as [string, number]);
  return {
    symbol: String(meta.symbol ?? ""), name: String(meta.longName ?? meta.shortName ?? meta.symbol ?? ""),
    exchange: String(meta.fullExchangeName ?? meta.exchangeName ?? ""), type: String(meta.instrumentType ?? ""),
    currency, price: round6(price), at, history,
  };
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Converte prezzo e storico in euro con il cambio {valuta}EUR (storico mensile del cambio, se c'è). */
export function toEur(d: ChartData, fx: ChartData | null): { price: number; history: [string, number][]; rate: number } | null {
  if (d.currency.toUpperCase() === "EUR") return { price: d.price, history: d.history, rate: 1 };
  if (!fx || !(fx.price > 0)) return null;
  const rates = new Map(fx.history.map(([date, v]) => [date.slice(0, 7), v]));
  let lastRate = fx.history[0]?.[1] ?? fx.price;
  const history = d.history.map(([date, v]) => {
    const r = rates.get(date.slice(0, 7));
    if (r && r > 0) lastRate = r;
    return [date, round6(v * lastRate)] as [string, number];
  });
  return { price: round6(d.price * fx.price), history, rate: fx.price };
}

export const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
export const SYMBOL_RE = /^[A-Za-z0-9.^=:-]{1,24}$/;
export const RANGES = new Set(["1y", "2y", "5y", "10y", "max"]);
