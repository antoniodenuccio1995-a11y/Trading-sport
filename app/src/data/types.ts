export interface League {
  code: string; name: string; country: string; countryName: string; tier: number; sort: number;
}
export interface Team { id: number; country: string; name: string; status: string }

/** Una partita. Valori assenti = null. */
export interface Match {
  i: number;            // posizione nell'archivio in memoria (ordinato per data)
  id: number;
  lg: string;           // codice campionato
  s: string;            // stagione '2026/27'
  d: number;            // giorno (giorni dal 1/1/1970)
  ko: number | null;    // calcio d'inizio UTC in minuti dal 1/1/1970
  h: number; a: number; // id squadre
  fh: number | null; fa: number | null; hh: number | null; ha: number | null;
  shh: number | null; sha: number | null; soh: number | null; soa: number | null;
  coh: number | null; coa: number | null; yeh: number | null; yea: number | null;
  reh: number | null; rea: number | null;
  oh: number | null; od: number | null; oa: number | null; oo: number | null; ou: number | null;
  ch: number | null; cd: number | null; ca: number | null; co: number | null; cu: number | null;
  bh: number | null; bd: number | null; ba: number | null;
}

/** Istantanea colonnare di una stagione (prodotta da ta_snapshot). */
export interface SeasonSnapshot {
  v: number; season: string; n: number; updatedAt: string;
  [col: string]: unknown;
}
export interface RefSnapshot {
  v: number; leagues: League[]; teams: [number, string, string, string][];
}
export interface Manifest {
  v: number; generatedAt: string; ref: { path: string };
  seasons: { season: string; path: string; n: number; updatedAt: string }[];
}

export const played = (m: Match) => m.fh !== null && m.fa !== null;
