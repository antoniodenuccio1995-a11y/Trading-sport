// Classifica nel tempo: posizione di ogni squadra alla fine di ogni settimana con partite.
import { played, type Match } from "../data/types";
import { standings } from "./standings";
import type { Venue } from "./team";

export interface Timeline {
  /** giorno (d) dell'ultima partita di ogni settimana */
  dates: number[];
  ranks: Map<number, number[]>;
  pts: Map<number, number[]>;
  games: Map<number, number[]>;
  size: number;
}

/** Settimana lunedì–domenica (il 1/1/1970 era giovedì). */
const week = (d: number) => Math.floor((d + 3) / 7);

export function rankTimeline(list: Match[], venue: Venue = "all", teamName?: (id: number) => string, before?: number): Timeline {
  const teams = [...new Set(list.flatMap((m) => [m.h, m.a]))];
  const done = list.filter((m) => played(m) && (before === undefined || m.d < before));
  const out: Timeline = { dates: [], ranks: new Map(teams.map((t) => [t, []])), pts: new Map(teams.map((t) => [t, []])), games: new Map(teams.map((t) => [t, []])), size: teams.length };
  if (!done.length) return out;
  const name = teamName ?? ((id: number) => String(id));
  type R = { team: number; p: number; gf: number; ga: number; pts: number };
  const rows = new Map<number, R>(teams.map((t) => [t, { team: t, p: 0, gf: 0, ga: 0, pts: 0 }]));
  const snapshot = (d: number) => {
    const order = [...rows.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || name(x.team).localeCompare(name(y.team)));
    out.dates.push(d);
    order.forEach((r, i) => { out.ranks.get(r.team)!.push(i + 1); out.pts.get(r.team)!.push(r.pts); out.games.get(r.team)!.push(r.p); });
  };
  let cur = week(done[0].d), last = done[0].d;
  for (const m of done) {
    if (week(m.d) !== cur) { snapshot(last); cur = week(m.d); }
    last = m.d;
    for (const [side, t, f, a] of [["home", m.h, m.fh!, m.fa!], ["away", m.a, m.fa!, m.fh!]] as const) {
      if (venue !== "all" && venue !== side) continue;
      const r = rows.get(t)!;
      r.p++; r.gf += f; r.ga += a; r.pts += f > a ? 3 : f === a ? 1 : 0;
    }
  }
  snapshot(last);
  return out;
}

/** Posizione finale (o attuale) di una squadra in una lega/stagione. */
export function finalRank(list: Match[], team: number, teamName?: (id: number) => string) {
  const t = standings(list, "all", undefined, teamName);
  const r = t.find((x) => x.team === team);
  return r && r.p ? { rank: r.pos, size: t.length, pts: r.pts, p: r.p } : null;
}

/** Zone della classifica (descrittive) per i campionati principali. */
export function zones(lg: string, size: number): { from: number; to: number; tone: "top" | "mid" | "low"; label: string }[] {
  const Z: Record<string, [number, string, number, string, number]> = {
    // [prime posizioni, etichetta, posizioni intermedie (playoff/Europa), etichetta, ultime]
    I1: [4, "Champions", 2, "Europa", 3], E0: [4, "Champions", 2, "Europa", 3], SP1: [4, "Champions", 2, "Europa", 3],
    D1: [4, "Champions", 2, "Europa", 2], F1: [3, "Champions", 2, "Europa", 2], N1: [2, "Champions", 2, "Europa", 2],
    P1: [2, "Champions", 2, "Europa", 2], I2: [2, "Promozione", 6, "Playoff", 3], E1: [2, "Promozione", 4, "Playoff", 3],
    E2: [2, "Promozione", 4, "Playoff", 4], SP2: [2, "Promozione", 4, "Playoff", 4], F2: [2, "Promozione", 3, "Playoff", 2],
  };
  const z = Z[lg];
  if (!z || size < 10) return [];
  return [
    { from: 1, to: z[0], tone: "top", label: z[1] },
    { from: z[0] + 1, to: z[0] + z[2], tone: "mid", label: z[3] },
    { from: size - z[4] + 1, to: size, tone: "low", label: "Retrocessione" },
  ];
}
