// Trade Republic: export CSV delle transazioni (importTradeRepublicCsv della v3.10).
import { norm } from "../domain/movement.ts";
import { parseBankAmount } from "./amounts.ts";
import { parseCsv } from "./csv.ts";
import { dateOnly } from "./dates.ts";
import { at, finishRow, hasValidDate, noClass, rawFrom, str, type ImportContext, type ParsedImport, type LegacyClass, type ParsedRow } from "./shared.ts";

export const TR_ACCOUNT = "Trade Republic";
const REQUIRED = ["datetime", "date", "category", "type", "amount", "fee", "tax", "currency", "description", "transaction_id"];

/** Riconoscimento dalla prima riga del CSV (importOne). */
export const isTradeRepublicHead = (h: string) =>
  h.includes("TRANSACTION_ID") && h.includes("ACCOUNT_TYPE") && h.includes("ASSET_CLASS") && h.includes("PAYMENT_REFERENCE");

/** Commissione/imposta facoltativa: vuota o illeggibile → 0. */
export function trOptionalAmount(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const p = parseBankAmount(v);
  return Number.isFinite(p.value) ? p.value : 0;
}

export function parseTradeRepublicCsv(txt: string, ctx: ImportContext): ParsedImport {
  const rows = parseCsv(txt);
  if (!rows.length) throw new Error("CSV Trade Republic vuoto");
  const heads = rows[0].map((x) => String(x).trim()), h = heads.map(norm);
  const ix = (k: string) => h.indexOf(norm(k));
  if (REQUIRED.some((k) => ix(k) < 0)) throw new Error("Il CSV non sembra un export Trade Republic: mancano colonne obbligatorie (" + REQUIRED.filter((k) => ix(k) < 0).join(", ") + ").");

  const out: ParsedRow[] = [];
  let skipped = 0, transfers = 0, buys = 0, sells = 0, dividends = 0, interests = 0, taxes = 0, issues = 0, unknown = 0;

  for (const r of rows.slice(1)) {
    if (!r.some((x) => String(x ?? "").trim())) continue;
    const date = dateOnly(at(r, ix("date")) || at(r, ix("datetime")) || "");
    if (!hasValidDate(date)) { skipped++; continue; }

    const sourceType = str(at(r, ix("type")));
    const sourceCategory = str(at(r, ix("category")));
    const assetClass = ix("asset_class") >= 0 ? str(at(r, ix("asset_class"))) : "";
    const name = ix("name") >= 0 ? str(at(r, ix("name"))) : "";
    const desc = String(at(r, ix("description")) || name || sourceType);
    const txid = str(at(r, ix("transaction_id"))).trim();
    const currency = String(at(r, ix("currency")) || "EUR");

    const grossObj = parseBankAmount(at(r, ix("amount")));
    if (grossObj.issue) issues++;
    const gross = grossObj.value;
    const fee = trOptionalAmount(at(r, ix("fee")));
    const tax = trOptionalAmount(at(r, ix("tax")));
    // Importo = movimento di cassa netto (lordo + commissione + imposta, già con segno).
    const net = Math.round((gross + fee + tax) * 1000000) / 1000000;

    const raw = rawFrom(heads, r);
    raw.__TR_GROSS_AMOUNT = gross;
    raw.__TR_FEE = fee;
    raw.__TR_TAX = tax;
    raw.__TR_NET_CASH = net;

    const nt = norm(sourceType);
    let cls: LegacyClass = noClass();
    if (nt === "TRANSFER_INBOUND" || nt === "TRANSFER_INSTANT_INBOUND") {
      cls = { type: "transfer_in", category: "", counterparty: "", status: "Trade Republic: bonifico in entrata da riconciliare" }; transfers++;
    } else if (nt === "BUY") {
      cls = { type: "invest_buy", category: "Investimenti / Dividendi", counterparty: name, status: "Trade Republic: acquisto investimento" }; buys++;
    } else if (nt === "SELL") {
      cls = { type: "invest_sell", category: "Investimenti / Dividendi", counterparty: name, status: "Trade Republic: vendita investimento" }; sells++;
    } else if (nt === "DIVIDEND") {
      // Anche le rettifiche negative restano rendimento: il segno riduce il totale delle entrate.
      cls = { type: "income", category: "Investimenti / Dividendi", counterparty: name, status: "Trade Republic: dividendo netto" }; dividends++;
    } else if (nt === "INTEREST_PAYMENT") {
      cls = { type: "income", category: "Investimenti / Dividendi", counterparty: TR_ACCOUNT, status: "Trade Republic: interessi netti" }; interests++;
    } else if (nt === "TAX_OPTIMIZATION") {
      // Gli storni fiscali positivi restano Uscita con importo positivo e riducono la spesa.
      cls = { type: "expense", category: "Tasse / F24", counterparty: TR_ACCOUNT, status: net >= 0 ? "Trade Republic: storno imposta" : "Trade Republic: imposta" }; taxes++;
    } else {
      cls = { ...noClass(), status: "Trade Republic: tipo da verificare" }; unknown++;
    }

    out.push(finishRow({
      account: TR_ACCOUNT, externalId: txid, date, dateTime: str(at(r, ix("datetime"))), valueDate: "",
      description: desc, amount: net, currency, sourceType,
      sourceCategory: [sourceCategory, assetClass].filter(Boolean).join(" · "),
      raw, inputIssue: grossObj.issue,
    }, cls));
  }

  const notes = [
    `Diagnostica Trade Republic · righe lette ${out.length} · giroconti ${transfers} · acquisti ${buys} · vendite ${sells} · dividendi ${dividends} · interessi ${interests} · fiscali ${taxes} · anomalie ${issues}`,
  ];
  if (unknown) notes.push(`${unknown} righe con tipo operazione non riconosciuto: da classificare.`);
  if (skipped) notes.push(`${skipped} righe escluse (senza data valida).`);
  return { account: TR_ACCOUNT, file: ctx.file, rows: out, skipped, notes };
}
