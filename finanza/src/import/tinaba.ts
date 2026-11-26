// Tinaba: export CSV separato da punto e virgola (importTinabaCsv della v3.10).
import type { ImportResult, Split } from "../domain/types.ts";
import { norm, uid } from "../domain/movement.ts";
import { parseItalianFormattedAmount, type ParsedAmount } from "./amounts.ts";
import { parseDelimited } from "./csv.ts";
import { dateOnly, isIsoDate } from "./dates.ts";
import { categoryIdFromLegacy } from "./legacy-category.ts";
import { mentionsOwner, ownerAfter } from "./owner.ts";
import { at, finishRow, keepDate, noClass, outsideYearLabel, rawFrom, type ImportContext, type LegacyClass, type ParsedRow } from "./shared.ts";

export const TINABA_ACCOUNT = "Tinaba";

/** Riconoscimento dalla prima riga del CSV (importOne). */
export const isTinabaHead = (h: string) => h.includes("CRO/NOP") && h.includes("CONTROPARTE") && h.includes("COMMUNITY");

/**
 * Tinaba esporta importi senza segno: il segno si ricostruisce da descrizione,
 * categoria e causale. Se non si capisce la direzione l'importo resta positivo
 * con una segnalazione.
 */
export function tinabaSignedAmount(rawAmount: unknown, desc: unknown, category: unknown, message: unknown): ParsedAmount {
  const parsed = parseItalianFormattedAmount(rawAmount);
  if (!Number.isFinite(parsed)) return { value: 0, issue: "Importo Tinaba non leggibile: " + String(rawAmount ?? "") };
  if (parsed < 0) return { value: parsed, issue: "" };
  const d = norm([desc, category, message].join(" "));
  const a = Math.abs(parsed);
  if (d.includes("EFFETTUATO A FAVORE DI") || d.includes("NUOVA SOTTOSCRIZIONE") || d.includes("ADDEBITO")) return { value: -a, issue: "" };
  if (d.includes("RICEVUTO DA") || d.includes("ACCREDITO") || d.includes("RIMBORSO") || d.includes("DISINVESTIMENTO") || d.includes("LIQUIDAZIONE")) return { value: a, issue: "" };
  return { value: a, issue: "Direzione movimento Tinaba non riconosciuta" };
}

const isDepositSubscription = (cat: string, desc: string) => norm(cat).includes("CONTI DEPOSITO") && norm(desc).includes("NUOVA SOTTOSCRIZIONE");
const isDepositReturn = (amount: number, cat: string, desc: string) => {
  const nd = norm(desc);
  return amount > 0 && norm(cat).includes("CONTI DEPOSITO") && nd.includes("ACCREDITO CAPITALE INVESTITO") && nd.includes("INTERESSI");
};
const round2 = (x: number) => Math.round(x * 100) / 100;
const validSplit = (principal: number, interest: number) => principal > 0 && interest >= 0 && interest <= principal * 0.2;

export function parseTinabaCsv(txt: string, ctx: ImportContext): ImportResult {
  const rows = parseDelimited(txt, ";");
  if (!rows.length) throw new Error("CSV Tinaba vuoto");
  const heads = rows[0].map((x) => String(x).trim()), h = heads.map(norm);
  const ix = (k: string) => h.indexOf(norm(k));
  if (ix("Data") < 0 || ix("Descrizione") < 0 || ix("Importo") < 0 || ix("Categoria") < 0) throw new Error("Il CSV non sembra un export Tinaba: mancano Data, Descrizione, Importo o Categoria.");
  const iMsg = ix("Causale/Messaggio"), iCp = ix("Controparte"), iCro = ix("CRO/NOP");
  const body = rows.slice(1);

  // Capitale del conto deposito, ricostruito dalle sottoscrizioni presenti nello stesso export.
  // Con l'anno (come la v3.10): somma delle sottoscrizioni precedenti a quell'anno, che non
  // vengono importate. Senza anno: per ogni rientro, sottoscrizioni precedenti meno il
  // capitale già rientrato con i rientri precedenti.
  const subs: { date: string; amount: number }[] = [];
  for (const r of body) {
    const dt = dateOnly(at(r, ix("Data")) || "");
    if (dt && isDepositSubscription(String(at(r, ix("Categoria")) || ""), String(at(r, ix("Descrizione")) || ""))) {
      const p = parseItalianFormattedAmount(at(r, ix("Importo")));
      if (Number.isFinite(p)) subs.push({ date: dt, amount: Math.abs(p) });
    }
  }
  const principalFor = new Map<string[], number>();
  if (ctx.onlyYear !== undefined) {
    const cutoff = `${ctx.onlyYear}-01-01`;
    const fixed = subs.filter((s) => s.date < cutoff).reduce((t, s) => t + s.amount, 0);
    for (const r of body) principalFor.set(r, fixed);
  } else {
    const returns = body
      .map((r, i) => {
        const date = dateOnly(at(r, ix("Data")) || ""), desc = at(r, ix("Descrizione")) || "", cat = at(r, ix("Categoria")) || "";
        const msg = iMsg >= 0 ? at(r, iMsg) || "" : "";
        const value = tinabaSignedAmount(at(r, ix("Importo")), desc, cat, msg).value;
        return { r, i, date, value, ok: isIsoDate(date) && isDepositReturn(value, String(cat), String(desc)) };
      })
      .filter((x) => x.ok)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i));
    let consumed = 0;
    for (const x of returns) {
      const available = Math.max(0, subs.filter((s) => s.date < x.date).reduce((t, s) => t + s.amount, 0) - consumed);
      principalFor.set(x.r, available);
      const principal = Math.min(available, x.value);
      if (validSplit(principal, round2(x.value - principal))) consumed += principal;
    }
  }

  const out: ParsedRow[] = [];
  let skipped = 0, issues = 0, depositSplits = 0;

  for (const r of body) {
    if (!r.some((x) => String(x ?? "").trim())) continue;
    const dtRaw = at(r, ix("Data")) || "";
    const date = dateOnly(dtRaw);
    if (!keepDate(date, ctx)) { skipped++; continue; }

    const desc = at(r, ix("Descrizione")) || "";
    const cat = at(r, ix("Categoria")) || "";
    const msg = iMsg >= 0 ? at(r, iMsg) || "" : "";
    const cp = iCp >= 0 ? at(r, iCp) || "" : "";
    const cro = iCro >= 0 ? at(r, iCro) || "" : "";
    const ap = tinabaSignedAmount(at(r, ix("Importo")), desc, cat, msg);
    if (ap.issue) issues++;
    const raw = rawFrom(heads, r);
    let inputIssue = ap.issue;

    const a = ap.value, nd = norm(desc), nm = norm(msg), ncp = norm(cp);
    const cls: LegacyClass = noClass();
    // Giroconto verso se stessi: il conto di destinazione lo ricostruisce l'abbinamento.
    if (a < 0 && ownerAfter(nd, "EFFETTUATO A FAVORE DI", ctx.ownerNames) && nm.includes("GIROCONTO")) {
      cls.type = "transfer_out";
      cls.status = "Candidato giroconto";
    }
    // Bonifico a terzi: si conserva la controparte senza decidere se è spesa, anticipo o altro.
    if (a < 0 && cp && ctx.ownerNames.length && !mentionsOwner(ncp, ctx.ownerNames) && !cls.counterparty) {
      cls.counterparty = String(cp);
      if (!cls.type) cls.status = "Bonifico a terzi: verifica tipo";
    }

    // Rientro dal conto deposito: capitale (giroconto) + interessi (entrata), se ricostruibile.
    let splits: Split[] | undefined;
    if (isDepositReturn(a, String(cat), String(desc))) {
      const principal = Math.min(principalFor.get(r) ?? 0, a);
      const interest = round2(a - principal);
      if (validSplit(principal, interest)) {
        splits = [
          { id: uid(), amount: principal, type: "transfer_in", categoryId: "", counterparty: "Tinaba Conto deposito", description: "Rientro capitale Conto deposito" },
          { id: uid(), amount: interest, type: "income", categoryId: categoryIdFromLegacy("Investimenti / Dividendi", { type: "income" }), counterparty: "", description: "Interessi netti Conto deposito" },
        ];
        cls.status = "Tinaba: capitale + interessi";
        inputIssue = "";
        raw.__TINABA_CAPITALE_RICOSTRUITO = principal;
        raw.__TINABA_INTERESSI_NETTI = interest;
        depositSplits++;
      } else {
        inputIssue = "Rientro conto deposito: capitale/interessi da verificare";
        issues++;
      }
    }

    out.push(finishRow({
      account: TINABA_ACCOUNT, externalId: String(cro || ""), date, dateTime: String(dtRaw), valueDate: "",
      description: String(desc), amount: a, currency: "EUR", sourceType: String(cat), sourceCategory: String(msg),
      raw, inputIssue,
    }, cls, undefined, { splits }));
  }

  const notes = [`Diagnostica Tinaba · righe lette ${out.length} · rientri deposito divisi in capitale e interessi ${depositSplits} · anomalie input ${issues}`];
  if (skipped) notes.push(`${skipped} righe escluse (${outsideYearLabel(ctx)}).`);
  return { account: TINABA_ACCOUNT, file: ctx.file, rows: out, skipped, notes };
}
