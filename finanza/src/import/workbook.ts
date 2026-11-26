// Lettura dei file Excel con le STESSE opzioni della v3.10. La libreria arriva dal
// chiamante (import dinamico), così SheetJS non entra nel bundle di avvio.
import type { WorkBook, WorkSheet } from "xlsx";
import { norm } from "../domain/movement.ts";

export type XLSXLike = typeof import("xlsx");

export interface SheetInput {
  xlsx: XLSXLike;
  wb: WorkBook;
  /** Primo foglio del file. */
  ws: WorkSheet;
  /** sheet_to_json(ws, { header: 1, defval: "", raw: true }) */
  matrix: unknown[][];
}

export function readWorkbook(xlsx: XLSXLike, buf: ArrayBuffer): SheetInput {
  let wb: WorkBook;
  try {
    wb = xlsx.read(buf, { type: "array", cellDates: true, cellNF: true, cellText: true });
  } catch (e) {
    throw new Error("File Excel illeggibile: " + String((e as Error)?.message || e));
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("File Excel senza fogli");
  const matrix = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  return { xlsx, wb, ws, matrix };
}

/** Testo delle prime 30 righe, su cui importOne riconosce la banca. */
export const sheetProbe = (matrix: unknown[][]) => matrix.slice(0, 30).flat().map(norm).join(" | ");
