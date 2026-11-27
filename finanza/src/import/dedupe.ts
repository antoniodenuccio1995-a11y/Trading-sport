// Chiavi anti-doppione degli import, come nella v3.10.
// La v3.10 considera già presente una riga se esiste un movimento (anche nel Cestino) con:
//  - lo stesso codice della banca sullo stesso conto (Sella, Tinaba, Hype, Easy Bank,
//    Trade Republic con transaction_id), oppure
//  - la stessa firma (Revolut, Poste, Sella, Tinaba, Trade Republic senza id).
// Hype ed Easy Bank hanno sempre un codice; Trade Republic con id confronta solo il codice.
// La firma contiene conto e codice, quindi stessa firma ⇒ stesso codice: restituire sempre
// entrambe le chiavi dà, per ogni banca, gli stessi abbinamenti della v3.10.
// A differenza della v3.10, le righe identiche dello STESSO file non vanno scartate:
// gli importatori le restituiscono tutte e l'app confronta le occorrenze per chiave.
import type { ImportedRow } from "../domain/types.ts";
import { signature } from "../domain/movement.ts";

/**
 * Chiavi di una riga importata o di un movimento esistente: "ext:<conto>:<codice>" se c'è
 * un codice della banca, poi sempre "sig:<firma>". Per un movimento già salvato usa la
 * firma memorizzata (campo `signature`), se presente.
 */
export function dedupeKeys(row: ImportedRow): string[] {
  const keys: string[] = [];
  if (row.externalId) keys.push("ext:" + row.account + ":" + row.externalId);
  const stored = (row as ImportedRow & { signature?: string }).signature;
  keys.push("sig:" + (stored || signature(row)));
  return keys;
}
