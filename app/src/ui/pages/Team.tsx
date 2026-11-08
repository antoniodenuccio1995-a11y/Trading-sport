import { useMemo } from "preact/hooks";
import { todayDay } from "../../data/dates";
import { leagueName } from "../../data/store";
import { played } from "../../data/types";
import { avg, leagueTeamAgg, pct, scorelines, teamAgg, teamMatches, type Agg } from "../../stats/team";
import { Card, Form, PctTd, fmtNum, fmtPct, useStore } from "../components/common";
import { TeamHalves } from "../sections/Halves";
import { HistoryRankChart, SeasonRankChart } from "../sections/RankCharts";
import { StatTable } from "../sections/StatTable";
import { href, type Route } from "../router";
import { Results } from "./League";

export function Team({ route }: { route: Route }) {
  const s = useStore();
  const id = Number(route.path[1]);
  const team = s.teams.get(id);
  const all = s.byTeam.get(id) ?? [];
  const seasons = [...new Set(all.map((m) => m.s))].sort().reverse();
  const season = route.q.get("s") && seasons.includes(route.q.get("s")!) ? route.q.get("s")! : seasons[0];
  const inSeason = useMemo(() => all.filter((m) => m.s === season), [all, season]);
  // statistiche sul campionato nazionale (le coppe sono mostrate tra le partite)
  const leagues = [...new Set(inSeason.map((m) => m.lg))];
  const domestic = leagues.find((l) => l !== "CL") ?? leagues[0];
  const dom = inSeason.filter((m) => m.lg === domestic);
  const tot = teamAgg(teamMatches(dom, id, "all"), id), home = teamAgg(teamMatches(dom, id, "home"), id), away = teamAgg(teamMatches(dom, id, "away"), id);
  const leagueList = s.byLeagueSeason.get(`${domestic}|${season}`) ?? [];
  const L = leagueTeamAgg(leagueList, "all"), LH = leagueTeamAgg(leagueList, "home"), LA = leagueTeamAgg(leagueList, "away");
  const last = teamAgg(teamMatches(all, id, "all", { last: 10 }), id);
  const trend = seasons.map((x) => {
    const lgOf = all.find((m) => m.s === x && m.lg !== "CL")?.lg;
    return { s: x, lg: lgOf, g: teamAgg(all.filter((m) => m.s === x && m.lg === lgOf && played(m)), id) };
  });
  if (!team) return <Card><p class="empty">Squadra non trovata.</p></Card>;
  const today = todayDay();
  const next = inSeason.filter((m) => !played(m) && m.d >= today - 2).slice(0, 8);
  const results = inSeason.filter(played).slice(-12).reverse();

  return (
    <>
      <div class="page-head">
        <h1>{team.name}</h1>
        <span class="sub">{leagues.map((l) => leagueName(l)).join(" · ")}</span>
        <select class="input" aria-label="Stagione" value={season} onChange={(e) => { location.hash = href(["squadra", id], { s: (e.target as HTMLSelectElement).value }); }}>
          {seasons.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <span class="spacer" />
        <span class="muted">Ultime 10:</span> <Form list={last.form} n={10} />
      </div>
      <div class="tiles">
        <div class="tile"><b>{tot.w}-{tot.d}-{tot.l}</b><span>V-N-P in {leagueName(domestic ?? "")}</span></div>
        <div class="tile"><b>{fmtNum(avg(tot.pts, tot.n))}</b><span>punti a partita</span></div>
        <div class="tile"><b>{tot.gf}:{tot.ga}</b><span>gol fatti : subiti</span></div>
        <div class="tile"><b>{fmtPct(pct(tot.o25, tot.n))}</b><span>Over 2,5</span></div>
        <div class="tile"><b>{fmtPct(pct(tot.btts, tot.n))}</b><span>Entrambe segnano</span></div>
      </div>
      <div class="grid2">
        <Card title={`Statistiche ${season}`}>
          <StatTable cols={[{ label: "Totale", agg: tot, ref: L }, { label: "Casa", agg: home, ref: LH }, { label: "Trasferta", agg: away, ref: LA }]} refCol={{ label: "Media lega", agg: L }} />
          <p class="note">Le frecce ▲▼ indicano la differenza dalla media del campionato nella stessa sede (casa con casa, trasferta con trasferta).</p>
        </Card>
        <div>
          <Results title="Prossime partite" list={next} upcoming />
          <Card title="Risultati esatti più frequenti">
            <div class="row">{scorelines(dom, id).map(([sc, n]) => <span key={sc} class="tile" style="padding:6px 10px"><b style="font-size:16px">{sc}</b><span>{n === 1 ? "1 volta" : `${n} volte`}</span></span>)}</div>
            <p class="note">Dal punto di vista della squadra (fatti–subiti), campionato nazionale.</p>
          </Card>
        </div>
      </div>
      {domestic && domestic !== "CL" && <Card title={`Posizione nel corso della stagione · ${leagueName(domestic)}`}><SeasonRankChart lg={domestic} season={season} teams={[id]} /></Card>}
      <Card title="Gol e tempi"><TeamHalves team={id} list={dom} leagueList={leagueList} /></Card>
      <Results title="Ultimi risultati" list={results} />
      <Card title="Posizioni per stagione"><HistoryRankChart teams={[id]} /></Card>
      <Card title="Andamento per stagione" flush>
        <div class="tw"><table class="t">
          <thead><tr><th class="l">Stagione</th><th class="l">Campionato</th><th>G</th><th>Pt/G</th><th>GF</th><th>GS</th><th>O2,5</th><th>GG</th><th>CS</th><th>1T O0,5</th></tr></thead>
          <tbody>{trend.map(({ s: x, lg, g }) => <TrendRow key={x} s={x} lg={lg} g={g} />)}</tbody>
        </table></div>
      </Card>
    </>
  );
}

function TrendRow({ s, lg, g }: { s: string; lg?: string; g: Agg }) {
  return (
    <tr><td class="l">{s}</td><td class="l">{lg ? leagueName(lg) : "—"}</td><td>{g.n}</td><td>{fmtNum(avg(g.pts, g.n))}</td>
      <td>{fmtNum(avg(g.gf, g.n))}</td><td>{fmtNum(avg(g.ga, g.n))}</td>
      <PctTd v={pct(g.o25, g.n)} /><PctTd v={pct(g.btts, g.n)} /><PctTd v={pct(g.cs, g.n)} /><PctTd v={pct(g.ht05, g.htN)} /></tr>
  );
}

