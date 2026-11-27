// Portafoglio investimenti (azioni, ETF, cripto…): strumenti, operazioni, prezzi.
// Vive in Snapshot.investments. Tutti gli importi sono in euro: chi inserisce un'operazione
// in un'altra valuta (es. USDT su Binance) scrive il controvalore in euro.

export type InstrumentKind = "etf" | "stock" | "crypto" | "bond" | "fund" | "other";

export interface Instrument {
  id: string;
  name: string;
  kind: InstrumentKind;
  isin?: string; // azioni, ETF, obbligazioni (es. IE00B4L5Y983)
  symbol?: string; // ticker (es. "VWCE", "BTC")
  coingeckoId?: string; // cripto: id CoinGecko (es. "bitcoin")
  currency: string; // valuta di quotazione dichiarata ("EUR" se non si sa)
  /** Simbolo trovato dal servizio prezzi (es. "EUNL.DE"): evita una nuova ricerca a ogni aggiornamento. */
  quoteSymbol?: string;
  /** Prezzo solo manuale: l'aggiornamento automatico non lo tocca. */
  manualPrice?: boolean;
  note?: string;
}

export type TradeSide = "buy" | "sell";

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  instrumentId: string;
  account: string; // conto (es. "Trade Republic", "Binance")
  side: TradeSide;
  quantity: number; // sempre positiva
  price: number; // prezzo unitario in euro, senza commissioni
  fees: number; // commissioni in euro, positive
  /** Movimento di cassa in euro, con il segno del conto: acquisto < 0 (commissioni comprese), vendita > 0 (al netto). */
  amount: number;
  movementId?: string; // movimento di cassa collegato (es. riga Trade Republic)
  note?: string;
}

export interface PriceQuote {
  price: number; // prezzo unitario in euro
  currency: string; // valuta del prezzo salvato (di norma "EUR")
  at: string; // ISO: quando è stato rilevato
  source: "coingecko" | "yahoo" | "manuale";
  /** Prezzo nella valuta di quotazione, se diversa dall'euro (solo informativo). */
  native?: { price: number; currency: string };
}

export interface InvestData {
  instruments: Instrument[];
  trades: Trade[];
  prices: Record<string, PriceQuote>; // instrumentId -> ultimo prezzo noto
  /** Storico mensile in euro: [data, prezzo], un punto per mese (al massimo ~10 anni). */
  priceHistory?: Record<string, [string, number][]>;
  /** Movimenti che il titolare ha scelto di non trasformare in operazioni. */
  ignoredMovements?: string[];
  /** Ultimo aggiornamento automatico dei prezzi (ISO). */
  refreshedAt?: string;
  /** Ultimo download dello storico per strumento (ISO). */
  historyAt?: Record<string, string>;
}

export const emptyInvest = (): InvestData => ({ instruments: [], trades: [], prices: {}, priceHistory: {}, ignoredMovements: [], historyAt: {} });

export const KIND_LABEL: Record<InstrumentKind, string> = {
  etf: "ETF", stock: "Azioni", crypto: "Cripto", bond: "Obbligazioni", fund: "Fondi", other: "Altro",
};
/** Colori categoriali della palette (evita lo slot 3 = Entrate e lo slot 8 = Uscite). */
export const KIND_COLOR: Record<InstrumentKind, string> = {
  etf: "var(--s1)", stock: "var(--s7)", crypto: "var(--s4)", bond: "var(--s5)", fund: "var(--s2)", other: "var(--s0)",
};
export const KINDS: InstrumentKind[] = ["etf", "stock", "crypto", "bond", "fund", "other"];
