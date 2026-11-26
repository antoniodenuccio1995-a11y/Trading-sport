// Importatori degli estratti conto (porting della v3.10).
// Riconoscimento della banca identico a importOne della v3.10:
//  1. prima riga con le intestazioni Hype → Hype (anche se il file si chiama .xls);
//  2. .csv → Trade Republic, Tinaba o Revolut dalle intestazioni;
//  3. .xls/.xlsx → Easy Bank, Poste o (in mancanza d'altro) Banca Sella.
// SheetJS non è importato qui: il chiamante lo passa in opts.xlsx (import dinamico).
import { norm } from "../domain/movement.ts";
import { firstLine } from "./csv.ts";
import { isEasyBankProbe, parseEasyBankSheet } from "./easybank.ts";
import { isHypeHead, parseHypeCsv } from "./hype.ts";
import { isPosteProbe, parsePosteSheet } from "./poste.ts";
import { parseRevolutCsv } from "./revolut.ts";
import { parseSellaSheet } from "./sella.ts";
import type { ImportContext, ParsedImport } from "./shared.ts";
import { isTinabaHead, parseTinabaCsv } from "./tinaba.ts";
import { isTradeRepublicHead, parseTradeRepublicCsv } from "./traderepublic.ts";
import { readWorkbook, sheetProbe, type XLSXLike } from "./workbook.ts";

export type { XLSXLike } from "./workbook.ts";
export type { ParsedImport, ParsedRow } from "./shared.ts";
export { baseClassify } from "./base-classify.ts";
export { dedupeKeys } from "./dedupe.ts";
export { num, parseBankAmount, parseItalianFormattedAmount, parseSellaAmountCell } from "./amounts.ts";
export { dateOnly } from "./dates.ts";
export { parseCsv, parseDelimited } from "./csv.ts";
export { categoryIdFromLegacy } from "./legacy-category.ts";

export interface BankFile {
  name: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ParseOptions {
  /** Modulo SheetJS (`await import("xlsx")`): obbligatorio per .xls/.xlsx. */
  xlsx?: XLSXLike;
  /** Nomi del titolare (Settings.ownerNames) per riconoscere i giroconti verso se stessi. */
  ownerNames: string[];
}

const decode = (bytes: Uint8Array) => new TextDecoder("utf-8").decode(bytes);

/**
 * Legge un estratto conto e restituisce TUTTE le righe, pronte per makeMovement
 * (anche quelle identiche tra loro: i doppioni rispetto all'archivio li gestisce
 * l'app con dedupeKeys). Lancia un Error con un messaggio in italiano se il file
 * non è riconosciuto o se serve la libreria XLSX e manca.
 */
export async function parseBankFile(file: BankFile, opts: ParseOptions): Promise<ParsedImport> {
  const name = norm(file.name);
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const head = norm(firstLine(decode(bytes.slice(0, Math.min(bytes.length, 8192)))));
  const ctx: ImportContext = { file: file.name, ownerNames: opts.ownerNames ?? [] };

  // Hype esporta talvolta un vero CSV con estensione .xls.
  if (isHypeHead(head)) return parseHypeCsv(decode(bytes), ctx);

  if (name.endsWith(".CSV")) {
    const txt = decode(bytes);
    const csvHead = norm(firstLine(txt));
    if (isTradeRepublicHead(csvHead)) return parseTradeRepublicCsv(txt, ctx);
    if (isTinabaHead(csvHead)) return parseTinabaCsv(txt, ctx);
    return parseRevolutCsv(txt, ctx);
  }

  if (name.endsWith(".XLS") || name.endsWith(".XLSX")) {
    if (!opts.xlsx) throw new Error("Per leggere i file Excel (.xls/.xlsx) serve la libreria XLSX, che non è stata caricata. Riprova quando l'app è online o usa un export CSV.");
    const sheet = readWorkbook(opts.xlsx, buf);
    const probe = sheetProbe(sheet.matrix);
    if (isEasyBankProbe(probe)) return parseEasyBankSheet(sheet, ctx);
    if (isPosteProbe(probe)) return parsePosteSheet(sheet, ctx);
    return parseSellaSheet(sheet, ctx);
  }

  throw new Error(`Formato non supportato: "${file.name}". Carica un estratto conto .csv, .xls o .xlsx.`);
}
