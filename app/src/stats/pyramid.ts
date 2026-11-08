// "Piramide" nazionale: posizione di una squadra stagione per stagione, tenendo conto
// della categoria (Serie A sopra, Serie B sotto…). Così promozioni e retrocessioni si vedono.
import type { Store } from "../data/store";
import { finalRank } from "./timeline";

export interface Band { lg: string; name: string; tier: number; from: number; to: number; size: number }
export interface PyrCell { season: string; lg: string | null; tier: number | null; rank: number | null; size: number | null; y: number | null; pts?: number; p?: number; move: "up" | "down" | null }
export interface Pyramid { country: string; bands: Band[]; max: number; seasons: string[]; teams: { team: number; cells: PyrCell[] }[] }

export function pyramid(s: Pick<Store, "leagues" | "seasons" | "byLeagueSeason" | "teams">, teams: number[], teamName?: (id: number) => string): Pyramid[] {
  const byCountry = new Map<string, number[]>();
  for (const t of teams) {
    const c = s.teams.get(t)?.country;
    if (!c || c === "UEFA") continue;
    (byCountry.get(c) ?? byCountry.set(c, []).get(c)!).push(t);
  }
  const out: Pyramid[] = [];
  for (const [country, list] of byCountry) {
    const leagues = s.leagues.filter((l) => l.country === country && l.code !== "CL").sort((a, b) => a.tier - b.tier);
    if (!leagues.length) continue;
    // ogni categoria occupa una fascia alta quanto il suo massimo numero di squadre
    let off = 0;
    const bands: Band[] = leagues.map((l) => {
      const size = Math.max(0, ...s.seasons.map((x) => new Set((s.byLeagueSeason.get(`${l.code}|${x}`) ?? []).flatMap((m) => [m.h, m.a])).size));
      const b = { lg: l.code, name: l.name, tier: l.tier, from: off + 1, to: off + size, size };
      off += size;
      return b;
    }).filter((b) => b.size > 0);
    const rows = list.map((team) => {
      let prevTier: number | null = null;
      const cells = s.seasons.map((season): PyrCell => {
        for (const b of bands) {
          const ms = s.byLeagueSeason.get(`${b.lg}|${season}`) ?? [];
          if (!ms.some((m) => m.h === team || m.a === team)) continue;
          const r = finalRank(ms, team, teamName);
          const move = prevTier === null ? null : b.tier < prevTier ? "up" : b.tier > prevTier ? "down" : null;
          prevTier = b.tier;
          const size = new Set(ms.flatMap((m) => [m.h, m.a])).size;
          return r ? { season, lg: b.lg, tier: b.tier, rank: r.rank, size, y: b.from - 1 + r.rank, pts: r.pts, p: r.p, move }
            : { season, lg: b.lg, tier: b.tier, rank: null, size, y: null, move };
        }
        // fuori dalle categorie in archivio (categoria inferiore, o campionato non seguito)
        const move = prevTier !== null && prevTier !== 99 ? "down" : null;
        if (prevTier !== null) prevTier = 99;
        return { season, lg: null, tier: null, rank: null, size: null, y: null, move };
      });
      return { team, cells };
    });
    out.push({ country, bands, max: off, seasons: s.seasons, teams: rows });
  }
  return out;
}
