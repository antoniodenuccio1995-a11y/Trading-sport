// Calcoli riutilizzati, memorizzati per istanza dell'archivio (si azzerano a ogni aggiornamento dati).
import { getStore, type Store } from "../data/store";
import type { Match } from "../data/types";
import { forecast, type Forecast } from "./poisson";

let owner: Store | null = null;
let leagueCache = new Map<string, Match[]>();
let fcCache = new Map<number, Forecast | null>();

function check() {
  const s = getStore();
  if (s !== owner && s.matches !== owner?.matches) { owner = s; leagueCache = new Map(); fcCache = new Map(); }
  else owner = s;
  return s;
}

/** Tutte le partite di un campionato (tutte le stagioni), in ordine di data. */
export function leagueAll(lg: string): Match[] {
  const s = check();
  let l = leagueCache.get(lg);
  if (!l) {
    l = s.seasons.flatMap((season) => s.byLeagueSeason.get(`${lg}|${season}`) ?? []);
    leagueCache.set(lg, l);
  }
  return l;
}

export function matchForecast(m: Match): Forecast | null {
  check();
  if (fcCache.has(m.id)) return fcCache.get(m.id)!;
  const f = forecast(leagueAll(m.lg), m.lg, m.d, m.h, m.a);
  fcCache.set(m.id, f);
  return f;
}
