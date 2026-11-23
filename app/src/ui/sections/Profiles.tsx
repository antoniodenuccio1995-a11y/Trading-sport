// Grafici di sintesi: profilo a esagono delle squadre e ciambelle (esiti, gol per tempo, Over/Under).
import { useMemo } from "preact/hooks";
import { getStore, leagueName, teamName } from "../../data/store";
import type { Match } from "../../data/types";
import { halfLeague, halfTeam } from "../../stats/halves";
import { PROFILE_AXES, leagueProfiles, type Profile } from "../../stats/profile";
import { leagueAgg, teamAgg, teamMatches } from "../../stats/team";
import { Donut, Legend, PALETTE, Radar } from "../components/charts";
import { Card, heat } from "../components/common";

const NOTE = "Ogni punta dell'esagono confronta la squadra con le altre del campionato nella stessa stagione: verso l'esterno è tra le migliori, la linea tratteggiata è la squadra media. Difesa: più è in fuori, meno gol subisce.";

function ProfileTable({ cols }: { cols: { name: string; p: Profile }[] }) {
  return (
    <div class="tw"><table class="t">
      <thead><tr><th class="l">Qualità</th>{cols.map((c) => <th key={c.name}>{c.name}</th>)}</tr></thead>
      <tbody>{PROFILE_AXES.map((a, k) => (
        <tr key={a}><td class="l">{a}</td>{cols.map((c) => {
          const x = c.p.axes[k];
          return <td key={c.name} class={x.pct === null ? "" : heat(x.pct * 100)} title={x.pct === null ? undefined : `${x.text} · meglio del ${Math.round(x.pct * 100)}% delle squadre`}>{x.short}</td>;
        })}</tr>
      ))}</tbody>
    </table></div>
  );
}

/** Partita: le due squadre a confronto (stagione, solo partite prima di questa). */
export function MatchProfiles({ m }: { m: Match }) {
  const s = getStore();
  const list = s.byLeagueSeason.get(`${m.lg}|${m.s}`) ?? [];
  const prof = useMemo(() => leagueProfiles(list, { before: m.d }), [list, m.d]);
  const ph = prof.get(m.h), pa = prof.get(m.a);
  if (!ph || !pa) return null;
  const H = teamName(m.h), A = teamName(m.a);
  return (
    <Card title="Profilo delle squadre">
      <div class="profile-grid">
        <div>
          <Legend items={[{ name: H, color: PALETTE[0] }, { name: A, color: PALETTE[1] }]} />
          <Radar axes={PROFILE_AXES} label={`Profilo di ${H} e ${A}`} series={[
            { name: H, color: PALETTE[0], values: ph.axes.map((x) => x.pct) },
            { name: A, color: PALETTE[1], values: pa.axes.map((x) => x.pct) },
          ]} />
        </div>
        <ProfileTable cols={[{ name: H, p: ph }, { name: A, p: pa }]} />
      </div>
      <p class="note">{NOTE} Partite considerate: {ph.n} e {pa.n}, in {leagueName(m.lg)} {m.s}.</p>
    </Card>
  );
}

/** Pagina squadra: profilo nella stagione e tre ciambelle. */
export function TeamOverview({ team, list, league }: { team: number; list: Match[]; league: Match[] }) {
  const prof = useMemo(() => leagueProfiles(league), [league]);
  const p = prof.get(team);
  const a = teamAgg(teamMatches(list, team, "all"), team);
  const h = halfTeam(teamMatches(list, team, "all"), team);
  if (!a.n) return null;
  return (
    <Card title="Profilo della stagione">
      <div class="profile-grid">
        {p ? <Radar axes={PROFILE_AXES} label={`Profilo di ${teamName(team)}`} series={[{ name: teamName(team), color: PALETTE[0], values: p.axes.map((x) => x.pct) }]} />
          : <p class="muted">Il profilo compare dopo 3 partite di campionato.</p>}
        <div class="donuts">
          <Donut label="Risultati" center={`${a.n}`} sub="partite" parts={[{ label: "Vinte", value: a.w, color: "var(--f-v)" }, { label: "Pareggiate", value: a.d, color: "var(--f-n)" }, { label: "Perse", value: a.l, color: "var(--f-p)" }]} />
          <Donut label="Gol per tempo" center={`${h.f1 + h.a1 + h.f2 + h.a2}`} sub="gol" parts={[{ label: "1° tempo", value: h.f1 + h.a1, color: "var(--c2)" }, { label: "2° tempo", value: h.f2 + h.a2, color: "var(--c3)" }]} />
          <Donut label="Over/Under 2,5" center={`${Math.round((100 * a.o25) / a.n)}%`} sub="Over" parts={[{ label: "Over 2,5", value: a.o25, color: "var(--c1)" }, { label: "Under 2,5", value: a.n - a.o25, color: "var(--c4)" }]} />
        </div>
      </div>
      {p && <p class="note">{NOTE}</p>}
    </Card>
  );
}

/** Campionato: esiti, gol per tempo, Over/Under. */
export function LeagueDonuts({ list }: { list: Match[] }) {
  const L = leagueAgg(list), H = halfLeague(list);
  if (!L.n) return null;
  return (
    <Card title="Il campionato in tre numeri">
      <div class="donuts">
        <Donut label="Esiti" center={`${L.n}`} sub="partite" parts={[{ label: "1 · casa", value: L.hw, color: "var(--c1)" }, { label: "X · pareggio", value: L.dr, color: "var(--f-n)" }, { label: "2 · ospite", value: L.aw, color: "var(--c2)" }]} />
        <Donut label="Gol per tempo" center={`${L.hg + L.ag}`} sub="gol" parts={[{ label: "1° tempo", value: H.f1 + H.a1, color: "var(--c2)" }, { label: "2° tempo", value: H.f2 + H.a2, color: "var(--c3)" }]} />
        <Donut label="Over/Under 2,5" center={`${Math.round((100 * L.o25) / L.n)}%`} sub="Over" parts={[{ label: "Over 2,5", value: L.o25, color: "var(--c1)" }, { label: "Under 2,5", value: L.n - L.o25, color: "var(--c4)" }]} />
      </div>
    </Card>
  );
}
