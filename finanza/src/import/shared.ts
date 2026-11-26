// Pezzi comuni agli importatori: contesto, accesso alle colonne, costruzione della riga.
import type { ImportedRow, MovementType, RuleStatus, Split } from "../domain/types.ts";
import { applySavePlan, importCategoryId } from "./legacy-category.ts";
import { isIsoDate } from "./dates.ts";

/** Riga prodotta dagli importatori. `splits` e `deferredWallet` passano a makeMovement così come sono. */
export type ParsedRow = ImportedRow & { splits?: Split[]; deferredWallet?: boolean };

export interface ImportContext {
  file: string;
  ownerNames: string[];
  /**
   * Se impostato, Trade Republic, Hype, Tinaba ed Easy Bank importano solo quell'anno
   * (la v3.10 aveva il 2026 scritto nel codice). Se assente importano tutte le righe con
   * una data valida.
   */
  onlyYear?: number;
}

/** Campi della riga che vengono dal file (sono quelli della firma e del dettaglio). */
export type SourceFields = Omit<ImportedRow, "type" | "categoryId" | "counterparty" | "ruleStatus">;

/** Classificazione nei termini della v3.10: tipo, etichetta categoria legacy, controparte, stato testuale. */
export interface LegacyClass { type: MovementType; category: string; counterparty: string; status: string }
export const noClass = (): LegacyClass => ({ type: "", category: "", counterparty: "", status: "" });

/** r[i] come in JavaScript: indice -1 → undefined. */
export const at = (r: readonly unknown[] | undefined, i: number): unknown => (r && i >= 0 ? r[i] : undefined);
/** String(v || "") della v3.10: 0, null e undefined diventano "". */
export const str = (v: unknown): string => String(v || "");
export const isBlankRow = (r: readonly unknown[] | undefined) => !r || !r.some((x) => String(x ?? "").trim());

/** Riga grezza conservata: intestazione → valore, "COL_i" per le intestazioni vuote. */
export function rawFrom(heads: readonly string[], r: readonly unknown[]): Record<string, unknown> {
  return Object.fromEntries(heads.map((k, i) => [k || "COL_" + i, r[i] ?? ""]));
}

/** Filtro data degli importatori con anno (TR, Hype, Tinaba, Easy Bank). */
export function keepDate(date: string, ctx: ImportContext): boolean {
  return ctx.onlyYear !== undefined ? date.startsWith(ctx.onlyYear + "-") : isIsoDate(date);
}
export const outsideYearLabel = (ctx: ImportContext) =>
  ctx.onlyYear !== undefined ? `fuori dal ${ctx.onlyYear} o senza data` : "senza data valida";

/**
 * Riga finale: categoria v3.8.2 dall'etichetta legacy, poi il piano di salvataggio v3.8.2
 * (tipo Uscita per alcuni esercenti, wallet scommesse). ruleStatus: quello passato
 * (es. "candidate" da baseClassify), altrimenti "import" se l'importatore ha classificato.
 */
export function finishRow(src: SourceFields, cls: LegacyClass, ruleStatus?: RuleStatus, extra?: { splits?: Split[] }): ParsedRow {
  const baseCategory = importCategoryId(cls.category, cls.type, src.description, src.amount);
  const plan = applySavePlan({ account: src.account, description: src.description, amount: src.amount, type: cls.type, categoryId: baseCategory });
  const classified = Boolean(plan.type || plan.categoryId || cls.counterparty || extra?.splits?.length);
  const row: ParsedRow = {
    ...src,
    type: plan.type,
    categoryId: plan.categoryId,
    counterparty: cls.counterparty,
    ruleStatus: ruleStatus ?? (classified ? "import" : ""),
  };
  if (plan.deferredWallet) row.deferredWallet = true;
  if (extra?.splits?.length) row.splits = extra.splits;
  return row;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
