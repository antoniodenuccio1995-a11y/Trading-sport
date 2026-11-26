// Banca Sella: lista movimenti .xls/.xlsx (importSellaXls della v3.10).
// L'importo si legge dalla cella del foglio (valore .v E testo visualizzato .w)
// per correggere il vecchio .xls Sella in cui 1.000,00 arriva come 1.
import type { CellObject } from "xlsx";
import type { ImportResult } from "../domain/types.ts";
import { norm } from "../domain/movement.ts";
import { parseSellaAmountCell, SELLA_UNREADABLE, SELLA_XLS_CORRECTED, SELLA_XLS_FROM_TEXT } from "./amounts.ts";
import { baseClassify } from "./base-classify.ts";
import { dateOnly } from "./dates.ts";
import { finishRow, isBlankRow, rawFrom, str, type ImportContext, type ParsedRow } from "./shared.ts";
import type { SheetInput } from "./workbook.ts";

export const SELLA_ACCOUNT = "Banca Sella";

export function parseSellaSheet({ xlsx, ws, matrix }: SheetInput, ctx: ImportContext): ImportResult {
  let hr = -1;
  for (let i = 0; i < Math.min(30, matrix.length); i++) {
    const n = matrix[i].map(norm);
    if (n.some((x) => x.includes("DATA OPERAZIONE")) && n.some((x) => x === "IMPORTO") && n.some((x) => x.includes("DESCRIZIONE"))) { hr = i; break; }
  }
  if (hr < 0) {
    throw new Error("File Excel non riconosciuto: nelle prime 30 righe non ci sono le intestazioni di Banca Sella (Data operazione, Descrizione, Importo), Poste Italiane o Easy Bank.");
  }

  const heads = matrix[hr].map((x) => String(x).trim()), hn = heads.map(norm);
  // Come nella v3.10: prima colonna uguale o che CONTIENE il nome cercato.
  const find = (...ks: string[]) => { for (const k of ks) { const i = hn.findIndex((x) => x === norm(k) || x.includes(norm(k))); if (i >= 0) return i; } return -1; };
  const iId = find("Codice identificativo", "Identificativo"),
    iDate = find("Data operazione"),
    iVal = find("Data valuta"),
    iDesc = find("Descrizione"),
    iAmt = find("Importo"),
    iCur = find("Divisa", "Valuta"),
    iCat = find("Categoria"),
    iSub = find("Sottocategoria");
  if (iDate < 0 || iDesc < 0 || iAmt < 0) throw new Error("Colonne Sella essenziali mancanti (Data operazione, Descrizione, Importo).");

  const out: ParsedRow[] = [];
  let skipped = 0, corrected = 0, fromText = 0, unreadable = 0;

  for (let idx = hr + 1; idx < matrix.length; idx++) {
    const r = matrix[idx];
    if (isBlankRow(r)) continue;

    // Cella importo letta dal foglio per avere sia .v sia .w.
    const amountCell = ws[xlsx.utils.encode_cell({ r: idx, c: iAmt })] as CellObject | undefined;
    const amountParsed = parseSellaAmountCell(amountCell);
    if (amountParsed.issue === SELLA_XLS_CORRECTED) corrected++;
    if (amountParsed.issue === SELLA_XLS_FROM_TEXT) fromText++;
    if (amountParsed.issue === SELLA_UNREADABLE) unreadable++;

    const raw = rawFrom(heads, r);
    raw.__IMPORTO_CELL_V = amountCell ? amountCell.v : null;
    raw.__IMPORTO_CELL_W = amountCell ? amountCell.w : null;
    raw.__IMPORTO_CELL_Z = amountCell ? amountCell.z : null;

    const description = str(r[iDesc]);
    const amount = amountParsed.value;
    if (!description && !amount) continue;
    // Riga informativa "SALDO AL …" a importo zero: non è un movimento.
    if (Math.abs(Number(amount || 0)) < 0.000001 && /^SALDO AL\b/.test(norm(description))) { skipped++; continue; }

    const sourceType = iSub >= 0 ? str(r[iSub]) : "";
    const base = baseClassify({ account: SELLA_ACCOUNT, amount, description, sourceType, type: "", counterparty: "", ruleStatus: "" }, ctx.ownerNames);
    out.push(finishRow({
      account: SELLA_ACCOUNT,
      externalId: iId >= 0 ? str(r[iId]) : "",
      date: dateOnly(r[iDate]),
      dateTime: "",
      valueDate: iVal >= 0 ? dateOnly(r[iVal]) : "",
      description,
      amount,
      currency: iCur >= 0 ? String(r[iCur] || "EUR") : "EUR",
      sourceType,
      sourceCategory: iCat >= 0 ? str(r[iCat]) : "",
      raw,
      inputIssue: amountParsed.issue === SELLA_UNREADABLE ? amountParsed.issue : "",
    }, { type: base.type ?? "", category: "", counterparty: base.counterparty ?? "", status: "" }, base.ruleStatus));
  }

  const notes = [`Diagnostica Sella · righe lette ${out.length} · correzioni XLS automatiche ${corrected} · importi non leggibili ${unreadable}`];
  if (corrected) notes.push(`${corrected} importi corretti: valore della cella diverso di un fattore 1000 dal testo visualizzato (separatore delle migliaia).`);
  if (fromText) notes.push(`${fromText} importi presi dal testo visualizzato della cella perché diverso dal valore.`);
  if (unreadable) notes.push(`ATTENZIONE: ${unreadable} importi Sella non leggibili.`);
  if (skipped) notes.push(`${skipped} righe "SALDO AL" ignorate.`);
  return { account: SELLA_ACCOUNT, file: ctx.file, rows: out, skipped, notes };
}
