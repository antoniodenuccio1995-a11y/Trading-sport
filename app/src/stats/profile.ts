// Profilo a esagono di una squadra: sei qualità confrontate con le altre squadre dello stesso campionato.
// Ogni valore è un percentile (0 = la peggiore, 1 = la migliore, 0,5 = la squadra media).
import { played, type Match } from "../data/types";
import { teamAgg, teamMatches, type Agg } from "./team";

export const PROFILE_AXES = ["Attacco", "Difesa", "Rendimento", "Over 2,5", "Goal (GG)", "Gol 1° tempo"] as const;

const f1 = (x: number) => x.toFixed(1).replace(".", ",");
const pc = (x: number) => `${Math.round(x * 100)}%`;
/** Valore grezzo di ogni asse (più alto = meglio, tranne la difesa che viene invertita). */
const RAW: ((a: Agg) => number | null)[] = [
  (a) => (a.n ? a.gf / a.n : null),
  (a) => (a.n ? a.ga / a.n : null),
  (a) => (a.n ? a.pts / a.n : null),
  (a) => (a.n ? a.o25 / a.n : null),
  (a) => (a.n ? a.btts / a.n : null),
  (a) => (a.htN ? a.ht05 / a.htN : null),
];
const SHOW: ((v: number) => string)[] = [
  (v) => `${f1(v)} gol fatti a partita`, (v) => `${f1(v)} gol subiti a partita`, (v) => `${f1(v)} punti a partita`,
  (v) => `${pc(v)} delle partite`, (v) => `${pc(v)} delle partite`, (v) => `${pc(v)} delle partite`,
];

export interface ProfileAxis { raw: number | null; text: string; short: string; pct: number | null }
export interface Profile { team: number; n: number; axes: ProfileAxis[] }

/** Profili di tutte le squadre di un elenco di partite (es. un campionato in una stagione, prima di una data). */
export function leagueProfiles(list: Match[], opts: { before?: number } = {}, minGames = 3): Map<number, Profile> {
  const games = list.filter((m) => played(m) && (opts.before === undefined || m.d < opts.before));
  const teams = [...new Set(games.flatMap((m) => [m.h, m.a]))];
  const aggs = teams.map((t) => ({ t, a: teamAgg(teamMatches(games, t, "all"), t) })).filter((x) => x.a.n >= minGames);
  const out = new Map<number, Profile>();
  const cols = RAW.map((f, k) => aggs.map((x) => { const v = f(x.a); return v === null ? null : k === 1 ? -v : v; }));
  aggs.forEach((x, i) => {
    out.set(x.t, {
      team: x.t, n: x.a.n,
      axes: RAW.map((f, k) => {
        const raw = f(x.a), mine = cols[k][i];
        if (raw === null || mine === null) return { raw: null, text: "—", short: "—", pct: null };
        const vals = cols[k].filter((v): v is number => v !== null);
        const below = vals.filter((v) => v < mine).length, same = vals.filter((v) => v === mine).length;
        const pct = vals.length > 1 ? (below + (same - 1) / 2) / (vals.length - 1) : 0.5;
        return { raw, text: SHOW[k](raw), short: k < 3 ? f1(raw) : pc(raw), pct };
      }),
    });
  });
  return out;
}
