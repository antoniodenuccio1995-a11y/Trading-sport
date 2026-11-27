// Riconoscimento del titolare nelle causali ("PAGAMENTO DA …", "RICARICA A …",
// "EFFETTUATO A FAVORE DI …"). La v3.10 aveva il nome scritto nel codice: qui i
// pattern si costruiscono da Settings.ownerNames. Senza nomi le regole che
// dipendono dal titolare non scattano.
import { norm } from "../domain/movement.ts";

/**
 * Varianti normalizzate di ogni nome: com'è scritto, con il primo token in fondo
 * ("MARIO ROSSI" → "ROSSI MARIO") e con l'ultimo token in testa. Le banche
 * scrivono a volte nome-cognome, a volte cognome-nome.
 */
export function ownerVariants(ownerNames: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of ownerNames) {
    const n = norm(raw);
    if (!n) continue;
    out.add(n);
    const t = n.split(" ");
    if (t.length > 1) {
      out.add([...t.slice(1), t[0]].join(" "));
      out.add([t[t.length - 1], ...t.slice(0, -1)].join(" "));
    }
  }
  return [...out];
}

/** Il testo (già normalizzato o no) contiene uno dei nomi del titolare. */
export function mentionsOwner(text: string, ownerNames: readonly string[]): boolean {
  const t = norm(text);
  return ownerVariants(ownerNames).some((v) => t.includes(v));
}

/** Il testo contiene "<prefisso> <nome del titolare>", es. "RICARICA A ROSSI MARIO". */
export function ownerAfter(text: string, prefix: string, ownerNames: readonly string[]): boolean {
  const t = norm(text), p = norm(prefix);
  return ownerVariants(ownerNames).some((v) => t.includes(p + " " + v));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Come ownerAfter, ma basta anche il solo primo nome (la v3.10 cercava
 * "PAGAMENTO DA <nome>" senza cognome). Il primo nome deve essere una parola
 * intera di almeno 3 lettere, per non confondere particelle come "DE".
 */
export function ownerOrFirstNameAfter(text: string, prefix: string, ownerNames: readonly string[]): boolean {
  if (ownerAfter(text, prefix, ownerNames)) return true;
  const t = norm(text), p = norm(prefix);
  return ownerNames.some((raw) => {
    const first = norm(raw).split(" ")[0];
    return first.length >= 3 && new RegExp(escapeRe(p + " " + first) + "(?![\\p{L}\\p{N}])", "u").test(t);
  });
}
