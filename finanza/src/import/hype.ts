// Hype: export CSV (a volte con estensione .xls) — importHypeCsv della v3.10.
import { fnv, norm } from "../domain/movement.ts";
import { parseBankAmount } from "./amounts.ts";
import { parseDelimited } from "./csv.ts";
import { dateOnly } from "./dates.ts";
import { mentionsOwner } from "./owner.ts";
import { at, finishRow, hasValidDate, noClass, rawFrom, str, type ImportContext, type ParsedImport, type LegacyClass, type ParsedRow } from "./shared.ts";

export const HYPE_ACCOUNT = "Hype";

/** Riconoscimento dalla prima riga del file, qualunque sia l'estensione (importOne). */
export const isHypeHead = (h: string) =>
  h.includes("DATA OPERAZIONE") && h.includes("DATA CONTABILE") && h.includes("IBAN") && h.includes("TIPOLOGIA") && h.includes("NOME") && h.includes("DESCRIZIONE");

export function parseHypeCsv(txt: string, ctx: ImportContext): ParsedImport {
  const rows = parseDelimited(txt, ",");
  if (!rows.length) throw new Error("CSV Hype vuoto");
  const heads = rows[0].map((x) => String(x).trim()), h = heads.map(norm);
  const ix = (k: string) => h.indexOf(norm(k));
  const iOp = ix("Data operazione"), iCont = ix("Data contabile"), iIban = ix("Iban"), iType = ix("Tipologia"), iName = ix("Nome"), iDesc = ix("Descrizione");
  const iAmt = h.findIndex((x) => x.includes("IMPORTO"));
  if ([iOp, iCont, iIban, iType, iName, iDesc, iAmt].some((i) => i < 0)) throw new Error("Il file non sembra un export Hype: mancano colonne obbligatorie.");

  const out: ParsedRow[] = [];
  let skipped = 0, transferCandidates = 0, withdrawals = 0, issues = 0;
  const occ = new Map<string, number>();

  for (const r of rows.slice(1)) {
    if (!r.some((x) => String(x ?? "").trim())) continue;
    const date = dateOnly(at(r, iOp) || "");
    if (!hasValidDate(date)) { skipped++; continue; }
    const valueDate = dateOnly(at(r, iCont) || "");
    const type = str(at(r, iType));
    const name = str(at(r, iName));
    const desc = String(at(r, iDesc) || name);
    const iban = str(at(r, iIban));
    const ap = parseBankAmount(at(r, iAmt));
    if (ap.issue) issues++;

    // Hype non espone un identificativo: ID deterministico dall'intera riga + numero di
    // occorrenza nel file, così due movimenti identici restano entrambi.
    const key = [date, valueDate, iban, type, name, desc, Number(ap.value).toFixed(2)].map(norm).join("|");
    const n = (occ.get(key) || 0) + 1; occ.set(key, n);
    const externalId = "HYPE-" + fnv(key + "|" + n);
    const raw = rawFrom(heads, r);
    raw.__HYPE_OCCURRENCE = n;

    const a = ap.value, nt = norm(type), nd = norm(desc);
    const self = mentionsOwner(name, ctx.ownerNames);
    const transferLike = nt.includes("GIROCONTO") || nt.includes("BONIFICO");
    let cls: LegacyClass = noClass();
    if (a > 0 && self && transferLike) {
      cls = { type: "transfer_in", category: "", counterparty: "", status: "Hype: candidato giroconto" }; transferCandidates++;
    } else if (a < 0 && self && transferLike) {
      cls = { type: "transfer_out", category: "", counterparty: "", status: "Hype: candidato giroconto" }; transferCandidates++;
    } else if (a > 0 && (nt.includes("RICARICA CARTA") || nd.includes("RICARICA HYPE"))) {
      cls = { type: "transfer_in", category: "", counterparty: "", status: "Hype: ricarica da riconciliare" }; transferCandidates++;
    } else if (a < 0 && nt === "PRELIEVO") {
      cls = { type: "transfer_out", category: "", counterparty: "Cassa", status: "Hype: prelievo → Cassa" }; withdrawals++;
    } else if (a < 0 && nt.includes("COMMISSIONE")) {
      cls = { type: "expense", category: "Altro Uscite", counterparty: "", status: "Hype: commissione" };
    } else if (a < 0 && nt.includes("BOLLO")) {
      cls = { type: "expense", category: "Tasse / F24", counterparty: "", status: "Hype: bollo" };
    } else if (a < 0 && nt.includes("PAGAMENTO")) {
      cls = { ...noClass(), type: "expense" };
    } else if (a > 0) {
      cls = { ...noClass(), type: "income", status: "Hype: entrata da verificare" };
    }

    out.push(finishRow({
      account: HYPE_ACCOUNT, externalId, date, valueDate, dateTime: "", description: desc, amount: a, currency: "EUR",
      sourceType: type, sourceCategory: name, raw, inputIssue: ap.issue,
    }, cls));
  }

  const notes = [`Diagnostica Hype · righe lette ${out.length} · candidati giroconto ${transferCandidates} · prelievi ${withdrawals} · anomalie input ${issues}`];
  if (skipped) notes.push(`${skipped} righe escluse (senza data valida).`);
  return { account: HYPE_ACCOUNT, file: ctx.file, rows: out, skipped, notes };
}
