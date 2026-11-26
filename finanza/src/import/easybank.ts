// Easy Bank: export .xlsx dei movimenti (importEasyBankXlsx della v3.10).
import type { ImportResult } from "../domain/types.ts";
import { fnv, norm } from "../domain/movement.ts";
import { parseBankAmount } from "./amounts.ts";
import { dateOnly } from "./dates.ts";
import { mentionsOwner } from "./owner.ts";
import { finishRow, isBlankRow, keepDate, outsideYearLabel, rawFrom, str, type ImportContext, type LegacyClass, type ParsedRow } from "./shared.ts";
import type { SheetInput } from "./workbook.ts";

export const EASYBANK_ACCOUNT = "Easy Bank";

/** Riconoscimento sulle prime 30 righe (importOne). */
export const isEasyBankProbe = (p: string) =>
  p.includes("CONTO O CARTA") && p.includes("CONTABILIZZAZIONE") && p.includes("OPERAZIONE") && p.includes("DETTAGLI") && p.includes("IMPORTO");

export function parseEasyBankSheet({ matrix }: SheetInput, ctx: ImportContext): ImportResult {
  let hr = -1;
  for (let i = 0; i < Math.min(35, matrix.length); i++) {
    const n = matrix[i].map(norm);
    if (n.includes("DATA") && n.includes("OPERAZIONE") && n.includes("DETTAGLI") && n.includes("CONTO O CARTA") && n.some((x) => x.includes("IMPORTO"))) { hr = i; break; }
  }
  if (hr < 0) throw new Error("Intestazioni Easy Bank non riconosciute (Data, Operazione, Dettagli, Conto o carta, Importo).");

  const heads = matrix[hr].map((x) => String(x).trim()), hn = heads.map(norm);
  const ixExact = (k: string) => hn.indexOf(norm(k));
  const iDate = ixExact("Data"), iOp = ixExact("Operazione"), iDet = ixExact("Dettagli"), iAcc = ixExact("Conto o carta");
  const iCat = hn.findIndex((x) => x === "CATEGORIA"), iCur = ixExact("Valuta"), iAmt = hn.findIndex((x) => x.includes("IMPORTO"));
  if ([iDate, iOp, iDet, iAcc, iCat, iCur, iAmt].some((i) => i < 0)) throw new Error("Colonne Easy Bank essenziali mancanti (Data, Operazione, Dettagli, Conto o carta, Categoria, Valuta, Importo).");

  const out: ParsedRow[] = [];
  let skipped = 0, selfTransfers = 0, gamePayments = 0, fees = 0, issues = 0;
  const occ = new Map<string, number>();

  for (let idx = hr + 1; idx < matrix.length; idx++) {
    const r = matrix[idx];
    if (isBlankRow(r)) continue;
    const date = dateOnly(r[iDate]);
    if (!keepDate(date, ctx)) { skipped++; continue; }

    const op = str(r[iOp]), details = str(r[iDet]), bankCat = str(r[iCat]), account = str(r[iAcc]);
    const currency = String(r[iCur] || "EUR");
    const ap = parseBankAmount(r[iAmt]);
    if (ap.issue) issues++;
    const raw = rawFrom(heads, r);

    // Per i bonifici l'ID è il codice disposizione; altrimenti un ID stabile dall'intera riga
    // con il numero di occorrenza nel file.
    const codMatch = details.match(/COD\.\s*DISP\.\s*([A-Z0-9]+)/i);
    const stableKey = [date, op, details, account, bankCat, currency, Number(ap.value).toFixed(2)].map(norm).join("|");
    const n = (occ.get(stableKey) || 0) + 1; occ.set(stableKey, n);
    const externalId = codMatch ? "EASY-" + codMatch[1] : "EASY-" + fnv(stableKey + "|" + n);
    raw.__EASY_OCCURRENCE = n;

    const a = ap.value, no = norm(op), nd = norm(details), nc = norm(bankCat);
    const selfIncoming = a > 0 && no.includes("BONIFICO") && mentionsOwner(nd, ctx.ownerNames);
    let cls: LegacyClass;
    if (selfIncoming) {
      const fromHype = nd.includes("GIROCONTO") && nd.includes("HYEEIT22");
      cls = { type: "transfer_in", category: "", counterparty: fromHype ? "Hype" : "", status: fromHype ? "Easy Bank: giroconto da Hype" : "Easy Bank: bonifico da te stesso da riconciliare" };
      selfTransfers++;
    } else if (a < 0 && no.includes("COSTO CARTA")) {
      cls = { type: "expense", category: "Altro Uscite", counterparty: EASYBANK_ACCOUNT, status: "Easy Bank: costo carta" }; fees++;
    } else if (a < 0 && (no.includes("BETFAIR") || no.includes("SISAL") || nc.includes("SCOMMESSE") || nd.includes("BETFAIR") || nd.includes("SISAL"))) {
      cls = { type: "expense", category: "Scommesse", counterparty: no.includes("BETFAIR") ? "Betfair" : no.includes("SISAL") ? "Sisal" : "", status: "Easy Bank: scommesse" };
      gamePayments++;
    } else {
      cls = { type: a < 0 ? "expense" : "income", category: "", counterparty: "", status: "Easy Bank: classificazione base" };
    }

    out.push(finishRow({
      account: EASYBANK_ACCOUNT, externalId, date, dateTime: "", valueDate: "", description: op, amount: a, currency,
      sourceType: bankCat, sourceCategory: details, raw, inputIssue: ap.issue,
    }, cls));
  }

  const notes = [`Diagnostica Easy Bank · righe lette ${out.length} · giroconti ${selfTransfers} · scommesse ${gamePayments} · costi carta ${fees} · anomalie ${issues}`];
  if (skipped) notes.push(`${skipped} righe escluse (${outsideYearLabel(ctx)}).`);
  return { account: EASYBANK_ACCOUNT, file: ctx.file, rows: out, skipped, notes };
}
