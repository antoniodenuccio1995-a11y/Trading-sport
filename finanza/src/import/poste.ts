// Poste Italiane: lista movimenti .xlsx (importPosteXlsx della v3.10).
import { norm } from "../domain/movement.ts";
import { parseBankAmount } from "./amounts.ts";
import { dateOnly } from "./dates.ts";
import { finishRow, isBlankRow, noClass, rawFrom, str, type ImportContext, type ParsedImport, type LegacyClass, type ParsedRow } from "./shared.ts";
import type { SheetInput } from "./workbook.ts";

export const POSTE_ACCOUNT = "Poste Italiane";

/** Riconoscimento sulle prime 30 righe (importOne). */
export const isPosteProbe = (p: string) => p.includes("DATA VALUTA") && p.includes("DATA CONTABILE") && p.includes("IMPORTO (EURO)");

export function parsePosteSheet({ matrix }: SheetInput, ctx: ImportContext): ParsedImport {
  let hr = -1;
  for (let i = 0; i < Math.min(30, matrix.length); i++) {
    const n = matrix[i].map(norm);
    if (n.some((x) => x === "DATA VALUTA") && n.some((x) => x === "DATA CONTABILE") && n.some((x) => x.includes("IMPORTO"))) { hr = i; break; }
  }
  if (hr < 0) throw new Error("Intestazioni Poste non riconosciute (Data Valuta, Data Contabile, Importo).");

  const heads = matrix[hr].map((x) => String(x).trim()), hn = heads.map(norm);
  const find = (...ks: string[]) => { for (const k of ks) { const i = hn.findIndex((x) => x === norm(k) || x.includes(norm(k))); if (i >= 0) return i; } return -1; };
  const iVal = find("Data Valuta"), iDate = find("Data Contabile"), iDesc = find("Descrizione"), iAmt = find("Importo (euro)", "Importo");
  if (iVal < 0 || iDate < 0 || iDesc < 0 || iAmt < 0) throw new Error("Colonne Poste essenziali mancanti (Data Valuta, Data Contabile, Descrizione, Importo).");

  const out: ParsedRow[] = [];
  let skipped = 0, withdrawals = 0, issues = 0, toReview = 0;

  for (let idx = hr + 1; idx < matrix.length; idx++) {
    const r = matrix[idx];
    if (isBlankRow(r)) continue;
    const dateVal = dateOnly(r[iVal]);
    const dateCont = dateOnly(r[iDate]);
    if (!dateVal && !dateCont) { skipped++; continue; }

    const desc = str(r[iDesc]);
    const ap = parseBankAmount(r[iAmt]);
    if (ap.issue) issues++;
    const raw = rawFrom(heads, r);
    raw.__POSTE_DATA_VALUTA = dateVal;
    raw.__POSTE_DATA_CONTABILE = dateCont;

    let cls: LegacyClass;
    if (ap.value < 0 && norm(desc).includes("PRELIEVO CONTANTI ATM")) {
      cls = { type: "transfer_out", category: "", counterparty: "Cassa", status: "Poste: prelievo ATM → Cassa" }; withdrawals++;
    } else {
      // Per eventuali export Poste più ricchi non si indovina il tipo.
      cls = { ...noClass(), status: "Movimento Poste da verificare" }; toReview++;
    }

    // Come nella v3.10: data = data valuta (o contabile se manca), valueDate = data contabile.
    out.push(finishRow({
      account: POSTE_ACCOUNT, externalId: "", date: dateVal || dateCont, dateTime: "", valueDate: dateCont,
      description: desc, amount: ap.value, currency: "EUR", sourceType: "", sourceCategory: "", raw, inputIssue: ap.issue,
    }, cls));
  }

  const notes = [`Diagnostica Poste · righe lette ${out.length} · prelievi ATM riconosciuti ${withdrawals} · da verificare ${toReview} · anomalie input ${issues}`];
  if (skipped) notes.push(`${skipped} righe escluse (senza data valuta né data contabile).`);
  return { account: POSTE_ACCOUNT, file: ctx.file, rows: out, skipped, notes };
}
