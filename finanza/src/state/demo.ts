// Dati dimostrativi: inventati e deterministici, per provare grafici e analisi
// senza toccare i dati veri. Contrassegnati con meta.demo = true.
import type { Movement, MovementType, Snapshot } from "../domain/types.ts";
import type { InvestData, Trade } from "../invest/types.ts";
import { makeMovement } from "../domain/movement.ts";
import { rematchTransfers } from "../domain/classify.ts";
import { emptySnapshot } from "./defaults.ts";

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function demoSnapshot(today = new Date()): Snapshot {
  const r = rng(20261126);
  const s = emptySnapshot();
  s.meta.demo = true;
  s.settings.ownerNames = ["MARIO ROSSI"];
  const out: Movement[] = [];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 15, 1));
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const amt = (lo: number, hi: number) => -Math.round((lo + r() * (hi - lo)) * 100) / 100;
  const add = (account: string, date: Date, description: string, amount: number, type: MovementType, categoryId = "", counterparty = "") => {
    if (date > end || date < start) return;
    out.push(makeMovement({ account, date: iso(date), description, amount, type, categoryId, counterparty, ruleStatus: categoryId || type ? "rule" : "" }));
  };
  const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())));

  for (let t = new Date(start); t <= end; t = D(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)) {
    const y = t.getUTCFullYear(), m = t.getUTCMonth(), idx = (y - start.getUTCFullYear()) * 12 + m - start.getUTCMonth();
    add("Banca Sella", D(y, m, 27), "STIPENDIO ACME SRL EMOLUMENTI MESE", 2190 + (idx > 8 ? 90 : 0), "income", "inc.salary");
    if (m === 11) add("Banca Sella", D(y, m, 18), "TREDICESIMA ACME SRL", 1750, "income", "inc.salary");
    add("Banca Sella", D(y, m, 2), "BONIFICO AFFITTO APPARTAMENTO VIA ROMA", -520, "expense", "exp.housing");
    add("Banca Sella", D(y, m, 6), "ADDEBITO SDD WIND TRE MOBILE", -12.99, "expense", "exp.utilities");
    add("Banca Sella", D(y, m, 9), "ADDEBITO SDD FASTWEB SPA", -29.95, "expense", "exp.utilities");
    if (m % 2 === 0) add("Banca Sella", D(y, m, 14), "ADDEBITO SDD ENEL ENERGIA BOLLETTA", amt(62, 118), "expense", "exp.utilities");
    add("Revolut", D(y, m, 11), "NETFLIX.COM", idx > 10 ? -15.99 : -13.99, "expense", "exp.leisure");
    add("Revolut", D(y, m, 19), "SPOTIFY AB", -10.99, "expense", "exp.leisure");
    add("Banca Sella", D(y, m, 4), "PALESTRA FIT CLUB QUOTA MENSILE", -39, "expense", "exp.personal_care");
    if (m === 3) add("Revolut", D(y, m, 21), "AMAZON PRIME RINNOVO ANNUALE", -49.9, "expense", "exp.leisure");
    // giroconti e investimenti
    for (const d of [5, 19]) {
      const v = Math.round(470 + r() * 110);
      add("Banca Sella", D(y, m, d), "RICARICA REVOLUT CARTA", -v, "transfer_out", "", "Revolut");
      add("Revolut", D(y, m, d), "RICARICA DA MARIO ROSSI", v, "transfer_in", "", "Banca Sella");
    }
    add("Banca Sella", D(y, m, 28), "GIROCONTO TR PUB PIANO ACCUMULO", -200, "transfer_out", "", "Trade Republic");
    add("Trade Republic", D(y, m, 29), "BONIFICO IN ENTRATA", 200, "transfer_in", "", "Banca Sella");
    add("Trade Republic", D(y, m, 30), "PIANO DI ACCUMULO ETF MSCI WORLD", -200, "invest_buy");
    if (m % 3 === 2) add("Trade Republic", D(y, m, 15), "DIVIDENDO ETF DISTRIBUZIONE", Math.round(3 + r() * 6), "income", "inc.financial_income");
    add("Banca Sella", D(y, m, 8), "PRELIEVO BANCOMAT ATM", -100, "transfer_out", "", "Cassa");
    add("Cassa", D(y, m, 8), "PRELIEVO CONTANTI", 100, "transfer_in", "", "Banca Sella");
    // spese variabili
    const season = m >= 5 && m <= 7 ? 1.15 : m === 11 ? 1.3 : 1;
    for (let d = 1; d <= 31; d++) {
      const day = D(y, m, d);
      if (day.getUTCMonth() !== m) break;
      const wd = day.getUTCDay();
      if (r() < 0.36) add("Revolut", day, pick(["CONAD SUPERSTORE", "LIDL ITALIA", "ESSELUNGA", "EUROSPIN", "COOP ALLEANZA"]), amt(12, 74) * season, "expense", "exp.groceries");
      if (r() < (wd === 5 || wd === 6 ? 0.42 : 0.14)) add("Revolut", day, pick(["PIZZERIA DA GINO", "BAR CENTRALE", "SUSHI ZEN", "TRATTORIA LA PERGOLA", "DELIVEROO ITALY"]), amt(6, 46) * season, "expense", "exp.dining");
      if (r() < 0.07) add("Revolut", day, pick(["ENI STATION", "Q8 EASY", "IPMATIC"]), amt(38, 62), "expense", "exp.mobility");
      if (r() < 0.12) add("Cassa", day, pick(["CAFFE E CORNETTO", "MERCATO RIONALE", "EDICOLA"]), amt(2, 18), "expense", pick(["exp.dining", "exp.groceries", "exp.leisure"]));
      if (r() < 0.025) add("Revolut", day, pick(["ZARA ITALIA", "DECATHLON", "OVS"]), amt(19, 89), "expense", "exp.clothing");
      if (r() < 0.025) add("Revolut", day, "FARMACIA COMUNALE", amt(6, 38), "expense", "exp.health");
      if (r() < 0.02) add("Revolut", day, pick(["CINEMA THE SPACE", "LIBRERIA FELTRINELLI", "STEAM GAMES"]), amt(8, 35), "expense", "exp.leisure");
      if (r() < 0.012) add("Revolut", day, pick(["IKEA ITALIA", "LEROY MERLIN"]), amt(15, 140), "expense", "exp.home");
    }
    if (m === 6) {
      add("Revolut", D(y, m, 4), "RYANAIR VOLO", -186.4, "expense", "exp.travel");
      add("Revolut", D(y, m, 6), "BOOKING.COM HOTEL", -412, "expense", "exp.travel");
    }
    if (m === 5 || m === 10) add("Banca Sella", D(y, m, 16), "PAGAMENTO F24 AGENZIA ENTRATE", amt(120, 260), "expense", "exp.taxes");
    if (m === 9 && y === end.getUTCFullYear()) add("Banca Sella", D(y, m, 12), "OFFICINA AUTO RIPARAZIONE FRIZIONE", -684, "expense", "exp.vehicle");
    if (m === 2 && y === end.getUTCFullYear()) add("Banca Sella", D(y, m, 20), "ASSICURAZIONE AUTO RCA", -412, "expense", "exp.vehicle");
    if (idx % 4 === 1) {
      add("Revolut", D(y, m, 13), "CENA ANTICIPATA PER LUCA", -64, "advance_out", "", "Luca");
      add("Revolut", D(y, m, 20), "PAGAMENTO DA LUCA BIANCHI", 64, "refund_in", "", "Luca");
    }
  }
  // un paio di movimenti da controllare
  add("Revolut", new Date(end.getTime() - 3 * 86400000), "POS 4471 NEGOZIO SCONOSCIUTO", -27.5, "expense");
  add("Banca Sella", new Date(end.getTime() - 6 * 86400000), "BONIFICO DA SIG. VERDI", 150, "");
  add("Revolut", new Date(end.getTime() - 2 * 86400000), "CENA ANTICIPATA PER LUCA", -48, "advance_out", "", "Luca");

  s.budgets = { default: { "exp.housing": 520, "exp.groceries": 520, "exp.dining": 280, "exp.mobility": 140, "exp.utilities": 110, "exp.leisure": 70, "exp.clothing": 50, "exp.health": 40, "exp.personal_care": 45, "exp.travel": 80 }, months: {} };
  s.movements = out;
  rematchTransfers(s.movements);
  s.investments = demoPortfolio(out, r, iso(end));
  for (const a of s.accounts) a.initialBalance = ({ "Banca Sella": 3400, Revolut: 120, Cassa: 60, "Trade Republic": 0 } as Record<string, number>)[a.id] ?? 0;
  s.accounts = s.accounts.filter((a) => ["Banca Sella", "Revolut", "Cassa", "Trade Republic"].includes(a.id)).concat(s.accounts.filter((a) => !["Banca Sella", "Revolut", "Cassa", "Trade Republic"].includes(a.id)).map((a) => ({ ...a, archived: true })));
  return s;
}

/** Portafoglio dimostrativo: ETF in piano di accumulo (dai movimenti Trade Republic) e un po' di Bitcoin. Prezzi inventati. */
function demoPortfolio(movs: Movement[], r: () => number, today: string): InvestData {
  const etf = { id: "demo-etf", name: "iShares Core MSCI World (dimostrativo)", kind: "etf" as const, isin: "IE00B4L5Y983", symbol: "EUNL", currency: "EUR", manualPrice: true };
  const btc = { id: "demo-btc", name: "Bitcoin (dimostrativo)", kind: "crypto" as const, symbol: "BTC", coingeckoId: "bitcoin", currency: "EUR", manualPrice: true };
  const trades: Trade[] = [];
  const hist: [string, number][] = [];
  let price = 92;
  for (const m of movs.filter((x) => x.type === "invest_buy").sort((a, b) => a.date.localeCompare(b.date))) {
    price = Math.round(price * (1.006 + (r() - 0.45) * 0.035) * 100) / 100;
    const qty = Math.floor((Math.abs(m.amount) / price) * 10000) / 10000;
    trades.push({ id: "demo-t-" + m.id.slice(0, 8), date: m.date, instrumentId: etf.id, account: m.account, side: "buy", quantity: qty, price, fees: 0, amount: m.amount, movementId: m.id });
    hist.push([m.date.slice(0, 7) + "-28", price]);
  }
  const btcHist: [string, number][] = [];
  let bp = 58000;
  for (let i = 0; i < hist.length; i++) { bp = Math.round(bp * (1.01 + (r() - 0.5) * 0.12)); btcHist.push([hist[i][0], bp]); }
  const buyAt = [Math.max(0, hist.length - 9), Math.max(0, hist.length - 6), Math.max(0, hist.length - 3)];
  for (const [k, i] of buyAt.entries()) {
    const p = btcHist[i]?.[1] ?? bp;
    trades.push({ id: "demo-b-" + k, date: hist[i]?.[0] ?? today, instrumentId: btc.id, account: "Binance", side: "buy", quantity: Math.round((150 / p) * 1e6) / 1e6, price: p, fees: 1.5, amount: -151.5 });
  }
  const at = today + "T09:00:00.000Z";
  return {
    instruments: [etf, btc], trades,
    prices: { [etf.id]: { price: Math.round(price * 1.018 * 100) / 100, currency: "EUR", at, source: "manuale" }, [btc.id]: { price: Math.round(bp * 1.03), currency: "EUR", at, source: "manuale" } },
    priceHistory: { [etf.id]: hist, [btc.id]: btcHist }, ignoredMovements: [], historyAt: {}, refreshedAt: at,
  };
}
