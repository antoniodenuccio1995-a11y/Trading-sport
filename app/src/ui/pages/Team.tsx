import { useMemo } from "preact/hooks";
import { todayDay } from "../../data/dates";
import { leagueName } from "../../data/store";
import { played } from "../../data/types";
import { avg, leagueTeamAgg, pct, scorelines, teamAgg, teamMatches, type Agg } from "../../stats/team";
import { Card, Form, PctTd, fmtNum, fmtPct, usePref, useStore } from "../components/common";
import { PeriodSeg, periodLabel, periodSeasons, type Period } from "../components/period";
import { TeamHalves } from "../sections/Halves";
import { GoalMinutes } from "../sections/GoalMinutes";
import { TeamOverview } from "../sections/Profiles";
import { HistoryRankChart, SeasonRankChart } from "../sections/RankCharts";
import { StatTable } from "../sections/StatTable";
import { TeamBadge } from "../components/badge";
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
  const tot = teamAgg(teamMatches(dom, id, "all"), id);
  // periodo scelto: stagioni dello stesso campionato (stessa categoria)
  const [period, setPeriod] = usePref<Period>("period.team", "season");
  const lgSeasons = s.seasons.filter((x) => s.byLeagueSeason.has(`${domestic}|${x}`));
  const keep = new Set(periodSeasons(lgSeasons, season, period));
  const domP = all.filter((m) => m.lg === domestic && keep.has(m.s));
  const leagueListP = [...keep].flatMap((x) => s.byLeagueSeason.get(`${domestic}|${x}`) ?? []);
  const pTot = teamAgg(teamMatches(domP, id, "all"), id), pHome = teamAgg(teamMatches(domP, id, "home"), id), pAway = teamAgg(teamMatches(domP, id, "away"), id);
  const L = leagueTeamAgg(leagueListP, "all"), LH = leagueTeamAgg(leagueListP, "home"), LA = leagueTeamAgg(leagueListP, "away");
  // stagione scelta contro le stagioni precedenti nello stesso campionato
  const hist = all.filter((m) => m.lg === domestic && m.s < season);
  const histSeasons = [...new Set(hist.map((m) => m.s))].sort();
  const hTot = teamAgg(teamMatches(hist, id, "all"), id), hHome = teamAgg(teamMatches(hist, id, "home"), id), hAway = teamAgg(teamMatches(hist, id, "away"), id);
  const sHome = teamAgg(teamMatches(dom, id, "home"), id), sAway = teamAgg(teamMatches(dom, id, "away"), id);
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
        <TeamBadge id={id} size={48} />
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
      <TeamOverview team={id} list={dom} league={s.byLeagueSeason.get(`${domestic}|${season}`) ?? []} />
      <div class="grid2">
        <Card title="Statistiche" right={<PeriodSeg value={period} onChange={setPeriod} />}>
          <p class="muted" style="margin-top:0">{periodLabel(period, season, lgSeasons)} · {leagueName(domestic ?? "")}</p>
          <StatTable cols={[{ label: "Totale", agg: pTot, ref: L }, { label: "Casa", agg: pHome, ref: LH }, { label: "Trasferta", agg: pAway, ref: LA }]} refCol={{ label: "Media lega", agg: L }} />
          <p class="note">Le frecce ▲▼ indicano la differenza dalla media del campionato nella stessa sede e nello stesso periodo. Solo partite di {leagueName(domestic ?? "")}: le stagioni in un'altra categoria non vengono mescolate.</p>
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
      <Card title={`${season} rispetto allo storico`}>
        {histSeasons.length ? (
          <>
            <StatTable refName="lo storico della squadra" cols={[
              { label: `Totale ${season}`, agg: tot, ref: hTot }, { label: "Storico totale", agg: hTot, isRef: true },
              { label: `Casa ${season}`, agg: sHome, ref: hHome }, { label: `Trasferta ${season}`, agg: sAway, ref: hAway },
            ]} />
            <p class="note">Storico: {histSeasons[0]} – {histSeasons[histSeasons.length - 1]} in {leagueName(domestic ?? "")}. Le frecce indicano la differenza dallo storico della squadra nella stessa sede.</p>
          </>
        ) : <p class="muted">Nessuna stagione precedente di questa squadra in {leagueName(domestic ?? "")} nell'archivio.</p>}
      </Card>
      <Card title="Gol e tempi"><TeamHalves team={id} list={domP} leagueList={leagueListP} label={periodLabel(period, season, lgSeasons)} /></Card>
      <GoalMinutes title={`Minuti dei gol · ${season}`} cols={[{ label: team.name, list: inSeason }, { label: leagueName(domestic ?? ""), list: s.byLeagueSeason.get(`${domestic}|${season}`) ?? [] }]} />
      <Results title="Ultimi risultati" list={results} />
      <Card title="Storico per stagione e categoria"><HistoryRankChart teams={[id]} /></Card>
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

