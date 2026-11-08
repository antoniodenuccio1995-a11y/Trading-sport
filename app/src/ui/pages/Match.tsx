import { useMemo } from "preact/hooks";
import { dateShort, dayLong, kickoffTime } from "../../data/dates";
import { leagueName, matchById, teamName } from "../../data/store";
import { played, type Match as M } from "../../data/types";
import { leagueAll, matchForecast } from "../../stats/derived";
import { implied, type Forecast } from "../../stats/poisson";
import { standings } from "../../stats/standings";
import { h2h, leagueTeamAgg, teamAgg, teamMatches } from "../../stats/team";
import { Card, Form, Tabs, TeamLink, fmtOdd, fmtPct, heat, useStore } from "../components/common";
import { href, type Route } from "../router";
import { MatchHalves } from "../sections/Halves";
import { MarketCompare } from "../sections/Market";
import { HistoryRankChart, SeasonRankChart } from "../sections/RankCharts";
import { StatTable } from "../sections/StatTable";

const TABS: [string, string][] = [["panoramica", "Panoramica e mercato"], ["statistiche", "Statistiche"], ["tempi", "Gol e tempi"], ["classifica", "Classifica"], ["forma", "Forma e precedenti"]];

export function MatchPage({ route }: { route: Route }) {
  useStore();
  const m = matchById(Number(route.path[1]));
  if (!m) return <Card><p class="empty">Partita non trovata nell'archivio.</p></Card>;
  return <Analysis m={m} tab={route.q.get("tab") ?? "panoramica"} />;
}

function Analysis({ m, tab }: { m: M; tab: string }) {
  const all = leagueAll(m.lg);
  const done = played(m);
  const season = useMemo(() => all.filter((x) => x.s === m.s), [all, m.s]);
  const fc = matchForecast(m);
  const table = useMemo(() => standings(season, "all", m.d, teamName), [season, m.d]);
  const posH = table.find((r) => r.team === m.h), posA = table.find((r) => r.team === m.a);

  return (
    <>
      <p class="muted" style="margin:0 0 8px"><a href={href(["lega", m.lg], { s: m.s })}>{leagueName(m.lg)}</a> · {m.s} · {dayLong(m.d)} · ore {kickoffTime(m.ko)}</p>
      <Card>
        <div class="vs">
          <div><div class="tn"><TeamLink id={m.h} season={m.s} /></div><div class="muted">{posH ? `${posH.pos}° · ${posH.pts} pt` : ""} <Form list={posH?.form ?? []} /></div></div>
          <div class="big">{done ? `${m.fh} – ${m.fa}` : "vs"}{done && m.hh !== null && <div class="muted" style="font-size:13px;font-weight:600">1° tempo {m.hh}–{m.ha}</div>}</div>
          <div><div class="tn"><TeamLink id={m.a} season={m.s} /></div><div class="muted">{posA ? `${posA.pos}° · ${posA.pts} pt` : ""} <Form list={posA?.form ?? []} /></div></div>
        </div>
        {fc && (
          <div class="bar3" style="margin-top:14px" role="img" aria-label={`Modello: 1 ${fmtPct(fc.home * 100)}, X ${fmtPct(fc.draw * 100)}, 2 ${fmtPct(fc.away * 100)}`}>
            <div class="b1" style={`width:${fc.home * 100}%`}>1 · {fmtPct(fc.home * 100)}</div>
            <div class="bx" style={`width:${fc.draw * 100}%`}>X · {fmtPct(fc.draw * 100)}</div>
            <div class="b2" style={`width:${fc.away * 100}%`}>2 · {fmtPct(fc.away * 100)}</div>
          </div>
        )}
      </Card>
      <Tabs tabs={TABS} active={tab} link={(k) => href(["partita", m.id], { tab: k })} />
      {tab === "panoramica" && <Overview m={m} fc={fc} />}
      {tab === "statistiche" && <Stats m={m} season={season} />}
      {tab === "tempi" && <MatchHalves m={m} leagueAll={all} model={fc?.halves ?? null} />}
      {tab === "classifica" && <StandingsTab m={m} season={season} />}
      {tab === "forma" && <FormTab m={m} />}
    </>
  );
}

function Overview({ m, fc }: { m: M; fc: Forecast | null }) {
  const imp = implied(m.oh, m.od, m.oa);
  return (
    <>
      <div class="grid2">
        <Card title="Previsione statistica (Poisson)">
          {fc ? (
            <>
              <div class="tw"><table class="t">
                <thead><tr><th class="l">Mercato</th><th>Probabilità</th><th>Quota equa</th></tr></thead>
                <tbody>
                  {([["1", fc.home], ["X", fc.draw], ["2", fc.away], ["Over 1,5", fc.o15], ["Over 2,5", fc.o25], ["Over 3,5", fc.o35], ["Goal (GG)", fc.btts],
                    ["Gol nel 1° tempo", fc.ht05], ["Over 1,5 nel 1° tempo", fc.ht15], ...(fc.halves ? [["Gol nel 2° tempo", fc.halves.h2.goal]] : [])] as [string, number][])
                    .map(([k, p]) => <tr key={k}><td class="l">{k}</td><td class={k.length > 1 ? heat(p * 100) : ""}>{fmtPct(p * 100)}</td><td>{fmtOdd(1 / p)}</td></tr>)}
                </tbody>
              </table></div>
              <p class="note">Gol attesi {fc.lh.toFixed(2)} – {fc.la.toFixed(2)}. Risultati più probabili: {fc.top.map((t) => `${t.score} (${fmtPct(t.p * 100)})`).join(", ")}.
                Campione: {fc.sample.home} gare in casa, {fc.sample.away} in trasferta, {fc.sample.league} di lega negli ultimi 12 mesi; solo partite precedenti a questa.{fc.halves ? " Primo e secondo tempo calcolati dai risultati all'intervallo." : " Primo tempo stimato (mancano i risultati all'intervallo)."}</p>
            </>
          ) : <p class="empty">Dati insufficienti per la previsione: servono almeno 30 partite di lega negli ultimi 12 mesi e partite delle due squadre.</p>}
        </Card>
        <Card title="Quote dalle fonti">
          <dl class="kv">
            <dt>Media bookmaker 1 · X · 2</dt><dd>{fmtOdd(m.oh)} · {fmtOdd(m.od)} · {fmtOdd(m.oa)}</dd>
            <dt>Media Over / Under 2,5</dt><dd>{fmtOdd(m.oo)} · {fmtOdd(m.ou)}</dd>
            <dt>Chiusura 1 · X · 2</dt><dd>{fmtOdd(m.ch)} · {fmtOdd(m.cd)} · {fmtOdd(m.ca)}</dd>
            <dt>Chiusura Over / Under 2,5</dt><dd>{fmtOdd(m.co)} · {fmtOdd(m.cu)}</dd>
            <dt>Betfair Exchange (chiusura) 1 · X · 2</dt><dd>{fmtOdd(m.bh)} · {fmtOdd(m.bd)} · {fmtOdd(m.ba)}</dd>
            {imp && <><dt>Probabilità implicite (senza margine)</dt><dd>{fmtPct(imp.home * 100)} · {fmtPct(imp.draw * 100)} · {fmtPct(imp.away * 100)}</dd>
              <dt>Margine del bookmaker</dt><dd>{(imp.margin * 100).toFixed(1)}%</dd></>}
          </dl>
          <p class="note">Fonte: football-data.co.uk, aggiornata più volte a settimana. Le quote live di Betfair o Betflag le inserisci tu qui sotto.</p>
        </Card>
      </div>
      {fc ? <MarketCompare m={m} fc={fc} /> : null}
    </>
  );
}

function Stats({ m, season }: { m: M; season: M[] }) {
  const before = season.filter((x) => x.d < m.d);
  const hHome = teamAgg(teamMatches(before, m.h, "home"), m.h), aAway = teamAgg(teamMatches(before, m.a, "away"), m.a);
  const hAll = teamAgg(teamMatches(before, m.h, "all"), m.h), aAll = teamAgg(teamMatches(before, m.a, "all"), m.a);
  const LH = leagueTeamAgg(before, "home"), LA = leagueTeamAgg(before, "away"), L = leagueTeamAgg(before, "all");
  return (
    <>
      <Card title="Casa in casa, ospite in trasferta">
        <StatTable cols={[
          { label: `${teamName(m.h)} (casa)`, agg: hHome, ref: LH },
          { label: "Media lega in casa", agg: LH, isRef: true },
          { label: `${teamName(m.a)} (trasf.)`, agg: aAway, ref: LA },
          { label: "Media lega in trasf.", agg: LA, isRef: true },
        ]} />
        <p class="note">Le frecce ▲▼ indicano quanto la squadra è sopra o sotto la media del campionato nella stessa sede (in punti percentuali o in gol). Solo partite della stagione {m.s} giocate prima di questa.</p>
      </Card>
      <Card title="Tutte le partite della stagione">
        <StatTable cols={[
          { label: teamName(m.h), agg: hAll, ref: L },
          { label: teamName(m.a), agg: aAll, ref: L },
        ]} refCol={{ label: "Media lega", agg: L }} />
      </Card>
    </>
  );
}

function StandingsTab({ m, season }: { m: M; season: M[] }) {
  const table = standings(season, "all", m.d, teamName);
  return (
    <>
      <Card title="Posizione nel corso della stagione"><SeasonRankChart lg={m.lg} season={m.s} teams={[m.h, m.a]} before={m.d} /></Card>
      <Card title="Posizioni per stagione · storico"><HistoryRankChart teams={[m.h, m.a]} lg={m.lg === "CL" ? undefined : m.lg} /></Card>
      <Card title="Classifica prima della partita" flush>
        <div class="tw"><table class="t">
          <thead><tr><th>#</th><th class="l">Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th><th class="l">Forma</th></tr></thead>
          <tbody>{table.map((r) => (
            <tr key={r.team} class={r.team === m.h || r.team === m.a ? "hl" : ""}><td>{r.pos}</td><td class="team"><TeamLink id={r.team} season={m.s} /></td>
              <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td><td>{r.gf - r.ga}</td><td><b>{r.pts}</b></td><td class="l"><Form list={r.form} /></td></tr>))}
          </tbody>
        </table></div>
      </Card>
    </>
  );
}

function FormTab({ m }: { m: M }) {
  const s = useStore();
  const meetings = h2h(s.matches, m.h, m.a, m.d);
  const lastH = teamMatches(s.byTeam.get(m.h) ?? [], m.h, "all", { before: m.d, last: 10 }).reverse();
  const lastA = teamMatches(s.byTeam.get(m.a) ?? [], m.a, "all", { before: m.d, last: 10 }).reverse();
  return (
    <>
      <div class="grid2">
        <LastMatches title={`Ultime 10 · ${teamName(m.h)}`} list={lastH} team={m.h} />
        <LastMatches title={`Ultime 10 · ${teamName(m.a)}`} list={lastA} team={m.a} />
      </div>
      <Card title={`Precedenti (${meetings.length})`} flush>
        {meetings.length ? <div class="tw"><table class="t"><tbody>{meetings.map((x) => (
          <tr key={x.id}><td class="l">{dateShort(x.d)}</td><td class="l muted">{leagueName(x.lg)}</td><td style="font-weight:600">{teamName(x.h)}</td>
            <td class="c"><a href={href(["partita", x.id])}><b>{x.fh}–{x.fa}</b></a></td><td class="l" style="font-weight:600">{teamName(x.a)}</td><td class="muted">{x.hh !== null ? `1T ${x.hh}–${x.ha}` : ""}</td></tr>))}
        </tbody></table></div> : <p class="empty">Nessun precedente nell'archivio (dal 2021/22).</p>}
      </Card>
    </>
  );
}

function LastMatches({ title, list, team }: { title: string; list: M[]; team: number }) {
  return (
    <Card title={title} flush>
      {list.length ? <div class="tw"><table class="t"><tbody>{list.map((x) => {
        const f = x.h === team ? x.fh! : x.fa!, a = x.h === team ? x.fa! : x.fh!;
        const r = f > a ? "V" : f === a ? "N" : "P";
        return <tr key={x.id}><td class="l">{dateShort(x.d)}</td><td class="l muted">{x.h === team ? "C" : "T"}</td>
          <td class="l"><TeamLink id={x.h === team ? x.a : x.h} season={x.s} /></td>
          <td><a href={href(["partita", x.id])}><b>{f}–{a}</b></a></td><td class="muted">{x.hh !== null ? `1T ${x.h === team ? x.hh : x.ha}–${x.h === team ? x.ha : x.hh}` : ""}</td><td><span class="form"><i class={r}>{r}</i></span></td></tr>;
      })}</tbody></table></div> : <p class="empty">Nessuna partita precedente.</p>}
    </Card>
  );
}
