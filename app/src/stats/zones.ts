// Zone della classifica per campionato (regolamenti 2026/27, indicativi: i posti europei
// possono cambiare con le coppe nazionali e il ranking UEFA).

export type Tone = "cl" | "el" | "conf" | "promo" | "playoff" | "playout" | "releg" | "split";
export interface Zone { from: number; to: number; tone: Tone; label: string }

const Z = (from: number, to: number, tone: Tone, label: string): Zone => ({ from, to, tone, label });

const RULES: Record<string, (size: number) => Zone[]> = {
  I1: (n) => [Z(1, 4, "cl", "Champions League"), Z(5, 5, "el", "Europa League"), Z(6, 6, "conf", "Conference League"), Z(n - 2, n, "releg", "Retrocessione")],
  E0: (n) => [Z(1, 4, "cl", "Champions League"), Z(5, 5, "el", "Europa League"), Z(6, 6, "conf", "Conference League"), Z(n - 2, n, "releg", "Retrocessione")],
  SP1: (n) => [Z(1, 4, "cl", "Champions League"), Z(5, 5, "el", "Europa League"), Z(6, 6, "conf", "Conference League"), Z(n - 2, n, "releg", "Retrocessione")],
  D1: (n) => [Z(1, 4, "cl", "Champions League"), Z(5, 5, "el", "Europa League"), Z(6, 6, "conf", "Conference League"), Z(n - 2, n - 2, "playout", "Spareggio salvezza"), Z(n - 1, n, "releg", "Retrocessione")],
  F1: (n) => [Z(1, 3, "cl", "Champions League"), Z(4, 4, "cl", "Preliminari Champions"), Z(5, 5, "el", "Europa League"), Z(6, 6, "conf", "Conference League"), Z(n - 2, n - 2, "playout", "Spareggio salvezza"), Z(n - 1, n, "releg", "Retrocessione")],
  N1: (n) => [Z(1, 2, "cl", "Champions League"), Z(3, 3, "cl", "Preliminari Champions"), Z(4, 4, "el", "Europa League"), Z(5, 8, "conf", "Playoff Conference"), Z(n - 2, n - 1, "playout", "Playoff salvezza"), Z(n, n, "releg", "Retrocessione")],
  P1: (n) => [Z(1, 2, "cl", "Champions League"), Z(3, 3, "el", "Europa League"), Z(4, 4, "conf", "Conference League"), Z(n - 2, n - 2, "playout", "Spareggio salvezza"), Z(n - 1, n, "releg", "Retrocessione")],
  I2: (n) => [Z(1, 2, "promo", "Promozione"), Z(3, 8, "playoff", "Playoff promozione"), Z(n - 4, n - 3, "playout", "Playout"), Z(n - 2, n, "releg", "Retrocessione")],
  E1: (n) => [Z(1, 2, "promo", "Promozione"), Z(3, 6, "playoff", "Playoff promozione"), Z(n - 2, n, "releg", "Retrocessione")],
  E2: (n) => [Z(1, 2, "promo", "Promozione"), Z(3, 6, "playoff", "Playoff promozione"), Z(n - 3, n, "releg", "Retrocessione")],
  SP2: (n) => [Z(1, 2, "promo", "Promozione"), Z(3, 6, "playoff", "Playoff promozione"), Z(n - 3, n, "releg", "Retrocessione")],
  D2: (n) => [Z(1, 2, "promo", "Promozione"), Z(3, 3, "playoff", "Spareggio promozione"), Z(n - 2, n - 2, "playout", "Spareggio salvezza"), Z(n - 1, n, "releg", "Retrocessione")],
  F2: (n) => [Z(1, 2, "promo", "Promozione"), Z(3, 5, "playoff", "Playoff promozione"), Z(n - 2, n - 2, "playout", "Spareggio salvezza"), Z(n - 1, n, "releg", "Retrocessione")],
  DNK: () => [Z(1, 6, "split", "Gruppo per il titolo"), Z(11, 12, "releg", "Zona retrocessione")],
  ROU: () => [Z(1, 6, "split", "Playoff per il titolo"), Z(15, 16, "releg", "Zona retrocessione")],
  CRO: (n) => [Z(1, 1, "cl", "Titolo · Champions"), Z(2, 2, "el", "Coppe europee"), Z(n - 1, n - 1, "playout", "Spareggio"), Z(n, n, "releg", "Retrocessione")],
  CL: () => [Z(1, 8, "cl", "Ottavi diretti"), Z(9, 24, "playoff", "Spareggi"), Z(25, 36, "releg", "Eliminate")],
};

export function zones(lg: string, size: number): Zone[] {
  const r = RULES[lg];
  if (!r || size < 8) return [];
  return r(size).filter((z) => z.from >= 1 && z.to <= size && z.from <= z.to);
}

export function zoneOf(lg: string, size: number, pos: number): Zone | undefined {
  return zones(lg, size).find((z) => pos >= z.from && pos <= z.to);
}

export const ZONE_NOTE = "Zone indicative secondo i regolamenti attuali: i posti europei possono cambiare con le coppe nazionali e il ranking UEFA.";
