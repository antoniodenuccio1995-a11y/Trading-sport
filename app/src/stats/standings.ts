import { played, type Match } from "../data/types";
import type { Venue } from "./team";

export interface Row {
  team: number; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
  form: ("V" | "N" | "P")[]; pos: number;
}

/**
 * Classifica di una lega/stagione. Criteri: punti, differenza reti, gol fatti, nome.
 * (Gli scontri diretti, usati da alcune leghe, non sono applicati.)
 */
export function standings(list: Match[], venue: Venue = "all", before?: number, teamName?: (id: number) => string): Row[] {
  const rows = new Map<number, Row>();
  const row = (t: number) => rows.get(t) ?? rows.set(t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [], pos: 0 }).get(t)!;
  for (const m of list) {
    // ogni squadra del calendario compare anche senza partite giocate
    row(m.h); row(m.a);
    if (!played(m) || (before !== undefined && m.d >= before)) continue;
    const sides: ["home" | "away", number, number, number][] = [["home", m.h, m.fh!, m.fa!], ["away", m.a, m.fa!, m.fh!]];
    for (const [side, t, f, a] of sides) {
      if (venue !== "all" && venue !== side) continue;
      const r = row(t);
      r.p++; r.gf += f; r.ga += a;
      if (f > a) { r.w++; r.pts += 3; r.form.push("V"); } else if (f === a) { r.d++; r.pts++; r.form.push("N"); } else { r.l++; r.form.push("P"); }
    }
  }
  const name = teamName ?? ((id: number) => String(id));
  const out = [...rows.values()].sort((x, y) =>
    y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || name(x.team).localeCompare(name(y.team)));
  out.forEach((r, i) => (r.pos = i + 1));
  return out;
}

/** Classifica delle ultime N partite (forma). */
export function formTable(list: Match[], n = 6, teamName?: (id: number) => string): Row[] {
  const byTeam = new Map<number, Match[]>();
  for (const m of list) {
    if (!played(m)) continue;
    for (const t of [m.h, m.a]) (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(m);
  }
  const subset = new Set<Match>();
  const rows: Row[] = [];
  for (const [t, ms] of byTeam) {
    const last = ms.slice(-n);
    const r: Row = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [], pos: 0 };
    for (const m of last) {
      subset.add(m);
      const f = m.h === t ? m.fh! : m.fa!, a = m.h === t ? m.fa! : m.fh!;
      r.p++; r.gf += f; r.ga += a;
      if (f > a) { r.w++; r.pts += 3; r.form.push("V"); } else if (f === a) { r.d++; r.pts++; r.form.push("N"); } else { r.l++; r.form.push("P"); }
    }
    rows.push(r);
  }
  const name = teamName ?? ((id: number) => String(id));
  rows.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || name(x.team).localeCompare(name(y.team)));
  rows.forEach((r, i) => (r.pos = i + 1));
  return rows;
}
