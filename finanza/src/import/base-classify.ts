// baseClassify della v3.10 (nella forma effettiva della v3.8.1, deriveImportClassificationV381):
// classificazione strutturale di Revolut e Banca Sella dal tipo operazione e dalla causale.
// Le altre banche hanno la loro classificazione nell'importatore (ruleStatus "import").
import type { MovementType, RuleStatus } from "../domain/types.ts";
import { norm } from "../domain/movement.ts";
import { ownerAfter, ownerOrFirstNameAfter } from "./owner.ts";

export interface BaseClassifyInput {
  account: string;
  amount: number;
  description: string;
  sourceType: string;
  type: MovementType;
  counterparty: string;
  ruleStatus: RuleStatus;
}
export type BaseClassifyOutput = Partial<{ type: MovementType; counterparty: string; ruleStatus: RuleStatus }>;

const REVOLUT_PAYMENTS = ["PAGAMENTO CON CARTA", "PAGAMENTO", "PAGAMENTO REVOLUT"];

/**
 * Restituisce solo i campi che la v3.10 imposterebbe (oggetto vuoto se nessuna regola scatta).
 * - Revolut: pagamenti con segno − → Uscita; "Rimborso su carta" con segno + → Entrata;
 *   "Ricarica" + "PAGAMENTO DA <titolare>" → Giroconto entrata candidato.
 * - Banca Sella (segno −): causale con "REVOLUT" → Giroconto uscita verso Revolut;
 *   "GIROCONTO TR PUB" → Giroconto uscita verso Trade Republic;
 *   "RICARICA A <titolare>" → Giroconto uscita candidato, controparte da abbinare.
 */
export function baseClassify(m: BaseClassifyInput, ownerNames: string[]): BaseClassifyOutput {
  const out: BaseClassifyOutput = {};
  const a = Number(m.amount || 0), d = norm(m.description), nt = norm(m.sourceType);
  if (m.account === "Revolut") {
    if (REVOLUT_PAYMENTS.includes(nt) && a < 0) out.type = "expense";
    if (nt === "RIMBORSO SU CARTA" && a > 0) out.type = "income";
    if (nt === "RICARICA" && a > 0 && ownerOrFirstNameAfter(d, "PAGAMENTO DA", ownerNames)) {
      out.type = "transfer_in";
      out.ruleStatus = "candidate";
    }
  } else if (m.account === "Banca Sella") {
    if (a < 0 && (d.includes("RICARICA REVOLUT") || d.includes("REVOLUT"))) { out.type = "transfer_out"; out.counterparty = "Revolut"; }
    if (a < 0 && d.includes("GIROCONTO TR PUB")) { out.type = "transfer_out"; out.counterparty = "Trade Republic"; }
    if (a < 0 && ownerAfter(d, "RICARICA A", ownerNames)) { out.type = "transfer_out"; out.ruleStatus = "candidate"; out.counterparty = ""; }
  }
  return out;
}
