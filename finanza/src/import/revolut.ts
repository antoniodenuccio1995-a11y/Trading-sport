// Revolut: estratto conto CSV in italiano (importRevolutCsv della v3.10).
import { norm } from "../domain/movement.ts";
import { parseBankAmount } from "./amounts.ts";
import { baseClassify } from "./base-classify.ts";
import { parseCsv } from "./csv.ts";
import { dateOnly } from "./dates.ts";
import { at, finishRow, plural, type ImportContext, type ParsedImport, type ParsedRow } from "./shared.ts";

export const REVOLUT_ACCOUNT = "Revolut";

/** Intestazioni obbligatorie (normalizzate). */
export const isRevolutHeader = (h: readonly string[]) =>
  h.includes("TIPO") && h.includes("DATA DI INIZIO") && h.includes("DESCRIZIONE") && h.includes("IMPORTO") && h.includes("STATE");

export function parseRevolutCsv(txt: string, ctx: ImportContext): ParsedImport {
  const rows = parseCsv(txt);
  if (!rows.length) throw new Error("CSV vuoto");
  const h = rows[0].map(norm);
  if (!isRevolutHeader(h)) {
    throw new Error("CSV non riconosciuto: le intestazioni non corrispondono a Revolut (Tipo, Data di inizio, Descrizione, Importo, State), Trade Republic, Tinaba o Hype.");
  }
  const ix = (k: string) => h.indexOf(norm(k));
  const out: ParsedRow[] = [];
  let skipped = 0, issues = 0;

  for (const r of rows.slice(1)) {
    if (!r.some(Boolean)) continue;
    const st = at(r, ix("State")) || "";
    if (norm(st) === "OPERAZIONE ANNULLATA") { skipped++; continue; }
    const ap = parseBankAmount(at(r, ix("Importo")));
    if (ap.issue) issues++;
    const description = String(at(r, ix("Descrizione")) || "");
    const sourceType = String(at(r, ix("Tipo")) || "");
    const base = baseClassify({ account: REVOLUT_ACCOUNT, amount: ap.value, description, sourceType, type: "", counterparty: "", ruleStatus: "" }, ctx.ownerNames);
    out.push(finishRow({
      account: REVOLUT_ACCOUNT, externalId: "",
      date: dateOnly(at(r, ix("Data di completamento")) || at(r, ix("Data di inizio"))),
      dateTime: String(at(r, ix("Data di inizio")) || ""), valueDate: "",
      description, amount: ap.value, currency: String(at(r, ix("Valuta")) || "EUR"),
      sourceType, sourceCategory: "",
      // La v3.10 conserva la riga Revolut con le intestazioni normalizzate (maiuscole).
      raw: Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])),
      inputIssue: ap.issue,
    }, { type: base.type ?? "", category: "", counterparty: base.counterparty ?? "", status: "" }, base.ruleStatus));
  }

  const notes = [`Diagnostica Revolut · righe lette ${out.length} · operazioni annullate ignorate ${skipped}`];
  if (issues) notes.push(plural(issues, "importo non leggibile o corretto", "importi non leggibili o corretti") + ": vedi “Input”.");
  return { account: REVOLUT_ACCOUNT, file: ctx.file, rows: out, skipped, notes };
}
