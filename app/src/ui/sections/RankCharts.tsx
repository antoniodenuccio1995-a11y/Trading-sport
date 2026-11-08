// Grafici della classifica nel tempo: nella stagione (settimana per settimana) e stagione per stagione.
import { useMemo, useState } from "preact/hooks";
import { dateShort } from "../../data/dates";
import { getStore, leagueName, teamName } from "../../data/store";
import { finalRank, rankTimeline, zones } from "../../stats/timeline";
import type { Venue } from "../../stats/team";
import { Legend, PALETTE, RankChart } from "../components/charts";
import { Seg } from "../components/common";

/** Posizione settimana per settimana nella stagione, per le squadre indicate. */
export function SeasonRankChart({ lg, season, teams, before, venue: initialVenue = "all" }: {
  lg: string; season: string; teams: number[]; before?: number; venue?: Venue;
}) {
  const [venue, setVenue] = useState<Venue>(initialVenue);
  const list = getStore().byLeagueSeason.get(`${lg}|${season}`) ?? [];
  const tl = useMemo(() => rankTimeline(list, venue, teamName, before), [list, venue, before]);
  if (!tl.dates.length) return <p class="muted">Nessuna partita giocata in questa stagione.</p>;
  const series = teams.map((t, i) => ({
    name: teamName(t), color: PALETTE[i % PALETTE.length], values: tl.ranks.get(t) ?? [],
    info: (k: number) => `${tl.pts.get(t)?.[k]} punti in ${tl.games.get(t)?.[k]} gare`,
  }));
  return (
    <div>
      <div class="row" style="margin-bottom:6px">
        <Legend items={series} />
        <span class="spacer" />
        <Seg label="Tipo di classifica" value={venue} onChange={setVenue} options={[["all", "Generale"], ["home", "Casa"], ["away", "Trasferta"]]} />
      </div>
      <RankChart x={tl.dates.map(dateShort)} series={series} max={tl.size} zones={venue === "all" ? zones(lg, tl.size) : []}
        label={`Posizione in classifica ${season}, ${series.map((s) => s.name).join(" e ")}`} />
      {venue === "all" && zones(lg, tl.size).length > 0 && (
        <div class="legend">{zones(lg, tl.size).map((z) => <span key={z.label}><i style={`background:var(--zone-${z.tone});opacity:.5`} />{z.label}</span>)}</div>
      )}
      <p class="note">Una posizione per settimana con partite; 1° posto in alto. Passa sui punti per vedere punti e gare giocate.</p>
    </div>
  );
}

/** Posizione finale stagione per stagione. Se lg manca, usa il campionato nazionale di ogni stagione. */
export function HistoryRankChart({ teams, lg }: { teams: number[]; lg?: string }) {
  const s = getStore();
  const data = useMemo(() => {
    const seasons = s.seasons;
    const rows = teams.map((t) => seasons.map((season) => {
      const code = lg ?? (s.byTeam.get(t) ?? []).find((m) => m.s === season && m.lg !== "CL")?.lg;
      if (!code) return null;
      const list = s.byLeagueSeason.get(`${code}|${season}`) ?? [];
      if (!list.some((m) => m.h === t || m.a === t)) return null;
      const r = finalRank(list, t, teamName);
      return r ? { ...r, lg: code } : null;
    }));
    const max = Math.max(10, ...rows.flat().map((r) => r?.size ?? 0));
    return { seasons, rows, max };
  }, [teams.join(","), lg, s.matches]);
  if (!data.rows.flat().some(Boolean)) return <p class="muted">Nessuna stagione disponibile.</p>;
  const series = teams.map((t, i) => ({
    name: teamName(t), color: PALETTE[i % PALETTE.length],
    values: data.rows[i].map((r) => r?.rank ?? null),
    info: (k: number) => { const r = data.rows[i][k]; return r ? `${leagueName(r.lg)} · ${r.pts} punti in ${r.p} gare` : ""; },
  }));
  const leagues = [...new Set(data.rows.flat().filter(Boolean).map((r) => r!.lg))];
  return (
    <div>
      <Legend items={series} />
      <RankChart x={data.seasons} series={series} max={data.max} height={220} label="Posizione finale per stagione" />
      <p class="note">Posizione a fine stagione (stagione in corso: posizione attuale).{leagues.length > 1 ? ` Campionati: ${leagues.map(leagueName).join(", ")}; una retrocessione o promozione cambia la scala.` : ""}</p>
    </div>
  );
}
