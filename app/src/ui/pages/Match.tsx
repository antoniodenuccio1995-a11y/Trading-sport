import { useMemo } from "preact/hooks";
import { dateShort, dayLong, kickoffTime } from "../../data/dates";
import { leagueName, matchById, teamName } from "../../data/store";
import { played, type Match as M } from "../../data/types";
import { leagueAll, matchForecast } from "../../stats/derived";
import { implied } from "../../stats/poisson";
import { standings } from "../../stats/standings";
import { avg, h2h, leagueAgg, pct, teamAgg, teamMatches } from "../../stats/team";
import { Card, Form, PctTd, TeamLink, fmtNum, fmtOdd, fmtPct, heat, useStore } from "../components/common";
import { href, type Route } from "../router";
import { StatRows } from "./Team";

export function MatchPage({ route }: { route: Route }) {
  useStore();
  const m = matchById(Number(route.path[1]));
  if (!m) return <Card><p class="empty">Partita non trovata nell'archivio.</p></Card>;
  return <Analysis m={m} />;
}

function Analysis({ m }: { m: M }) {
  const s = useStore();
  const all = leagueAll(m.lg);
  const done = played(m);
  const season = all.filter((x) => x.s === m.s);
  const fc = matchForecast(m);
  const H = m.h, A = m.a;
  const hHome = teamAgg(teamMatches(season, H, "home", { before: m.d }), H);
  const aAway = teamAgg(teamMatches(season, A, "away", { before: m.d }), A);
  const hAll = teamAgg(teamMatches(season, H, "all", { before: m.d }), H);
  const aAll = teamAgg(teamMatches(season, A, "all", { before: m.d }), A);
  const lgAgg = leagueAgg(season.filter((x) => x.d < m.d));
  const table = useMemo(() => standings(season, "all", m.d, teamName), [season, m.d]);
  const posH = table.find((r) => r.team === H), posA = table.find((r) => r.team === A);
  const meetings = h2h(s.matches, H, A, m.d);
  const lastH = teamMatches(s.byTeam.get(H) ?? [], H, "all", { before: m.d, last: 6 }).reverse();
  const lastA = teamMatches(s.byTeam.get(A) ?? [], A, "all", { before: m.d, last: 6 }).reverse();
  const imp = implied(m.oh, m.od, m.oa);
  const comb = (x: number | null, y: number | null) => (x === null || y === null ? null : (x + y) / 2);

  return (
    <>
      <p class="muted" style="margin:0 0 8px"><a href={href(["lega", m.lg], { s: m.s })}>{leagueName(m.lg)}</a> · {m.s} · {dayLong(m.d)} · ore {kickoffTime(m.ko)}</p>
      <Card>
        <div class="vs">
          <div><div class="tn"><TeamLink id={H} season={m.s} /></div><div class="muted">{posH ? `${posH.pos}° · ${posH.pts} pt` : ""} <Form list={posH?.form ?? []} /></div></div>
          <div class="big">{done ? `${m.fh} – ${m.fa}` : "vs"}{done && m.hh !== null && <div class="muted" style="font-size:13px;font-weight:600">1° tempo {m.hh}–{m.ha}</div>}</div>
          <div><div class="tn"><TeamLink id={A} season={m.s} /></div><div class="muted">{posA ? `${posA.pos}° · ${posA.pts} pt` : ""} <Form list={posA?.form ?? []} /></div></div>
        </div>
      </Card>

      <div class="grid2">
        <Card title="Previsione statistica (Poisson)">
          {fc ? (
            <>
              <div class="bar3" role="img" aria-label={`1 ${fmtPct(fc.home * 100)}, X ${fmtPct(fc.draw * 100)}, 2 ${fmtPct(fc.away * 100)}`}>
                <div class="b1" style={`width:${fc.home * 100}%`}>1 · {fmtPct(fc.home * 100)}</div>
                <div class="bx" style={`width:${fc.draw * 100}%`}>X · {fmtPct(fc.draw * 100)}</div>
                <div class="b2" style={`width:${fc.away * 100}%`}>2 · {fmtPct(fc.away * 100)}</div>
              </div>
              <div class="tw" style="margin-top:10px"><table class="t">
                <thead><tr><th class="l">Mercato</th><th>Probabilità</th><th>Quota equa</th><th>Quota media</th><th>Valore</th></tr></thead>
                <tbody>
                  {([["1", fc.home, m.oh], ["X", fc.draw, m.od], ["2", fc.away, m.oa], ["Over 2,5", fc.o25, m.oo], ["Under 2,5", 1 - fc.o25, m.ou],
                    ["Over 1,5", fc.o15, null], ["Over 3,5", fc.o35, null], ["Entrambe segnano", fc.btts, null], ["1° tempo Over 0,5", fc.ht05, null], ["1° tempo Over 1,5", fc.ht15, null]] as [string, number, number | null][])
                    .map(([k, p, o]) => {
                      const edge = o ? (p * o - 1) * 100 : null;
                      return <tr key={k}><td class="l">{k}</td><td class={k.length > 1 ? heat(p * 100) : ""}>{fmtPct(p * 100)}</td><td>{fmtOdd(1 / p)}</td><td>{fmtOdd(o)}</td>
                        <td class={edge === null ? "" : edge > 0 ? "pos" : "neg"}>{edge === null ? "—" : `${edge > 0 ? "+" : ""}${edge.toFixed(1)}%`}</td></tr>;
                    })}
                </tbody>
              </table></div>
              <p class="note">Gol attesi {fc.lh.toFixed(2)} – {fc.la.toFixed(2)}. Risultati più probabili: {fc.top.map((t) => `${t.score} (${fmtPct(t.p * 100)})`).join(", ")}.
                Campione: {fc.sample.home} gare in casa, {fc.sample.away} in trasferta, {fc.sample.league} di lega negli ultimi 12 mesi. Solo partite precedenti alla data.</p>
            </>
          ) : <p class="empty">Dati insufficienti per la previsione (servono almeno 30 partite di lega negli ultimi 12 mesi e partite delle due squadre).</p>}
        </Card>
        <Card title="Quote">
          <dl class="kv">
            <dt>Media bookmaker 1 · X · 2</dt><dd>{fmtOdd(m.oh)} · {fmtOdd(m.od)} · {fmtOdd(m.oa)}</dd>
            <dt>Media Over / Under 2,5</dt><dd>{fmtOdd(m.oo)} · {fmtOdd(m.ou)}</dd>
            <dt>Chiusura 1 · X · 2</dt><dd>{fmtOdd(m.ch)} · {fmtOdd(m.cd)} · {fmtOdd(m.ca)}</dd>
            <dt>Chiusura Over / Under 2,5</dt><dd>{fmtOdd(m.co)} · {fmtOdd(m.cu)}</dd>
            <dt>Betfair Exchange 1 · X · 2</dt><dd>{fmtOdd(m.bh)} · {fmtOdd(m.bd)} · {fmtOdd(m.ba)}</dd>
            {imp && <><dt>Probabilità implicite (senza margine)</dt><dd>{fmtPct(imp.home * 100)} · {fmtPct(imp.draw * 100)} · {fmtPct(imp.away * 100)}</dd>
              <dt>Margine del bookmaker</dt><dd>{(imp.margin * 100).toFixed(1)}%</dd></>}
          </dl>
          <p class="note">Fonte quote: football-data.co.uk (aggiornate più volte a settimana). Le partite fuori dai suoi campionati non hanno quote.</p>
        </Card>
      </div>

      <Card title="Confronto: casa in casa, ospite in trasferta (stagione)">
        <StatRows cols={[hHome, aAway, hAll, aAll]} labels={[`${teamName(H)} (casa)`, `${teamName(A)} (trasf.)`, `${teamName(H)} (tot.)`, `${teamName(A)} (tot.)`]} />
        <div class="tw" style="margin-top:12px"><table class="t">
          <thead><tr><th class="l">Media combinata</th><th>Over 1,5</th><th>Over 2,5</th><th>Over 3,5</th><th>GG</th><th>1T Over 0,5</th></tr></thead>
          <tbody>
            <tr><td class="l">{teamName(H)} casa + {teamName(A)} trasferta</td>
              <PctTd v={comb(pct(hHome.o15, hHome.n), pct(aAway.o15, aAway.n))} /><PctTd v={comb(pct(hHome.o25, hHome.n), pct(aAway.o25, aAway.n))} />
              <PctTd v={comb(pct(hHome.o35, hHome.n), pct(aAway.o35, aAway.n))} /><PctTd v={comb(pct(hHome.btts, hHome.n), pct(aAway.btts, aAway.n))} />
              <PctTd v={comb(pct(hHome.ht05, hHome.htN), pct(aAway.ht05, aAway.htN))} /></tr>
            <tr><td class="l">Media del campionato ({lgAgg.n} gare)</td>
              <PctTd v={pct(lgAgg.o15, lgAgg.n)} /><PctTd v={pct(lgAgg.o25, lgAgg.n)} /><PctTd v={pct(lgAgg.o35, lgAgg.n)} /><PctTd v={pct(lgAgg.btts, lgAgg.n)} /><PctTd v={pct(lgAgg.ht05, lgAgg.htN)} /></tr>
          </tbody>
        </table></div>
        <p class="note">Gol medi del campionato: {fmtNum(avg(lgAgg.hg, lgAgg.n))} in casa, {fmtNum(avg(lgAgg.ag, lgAgg.n))} in trasferta. Solo partite giocate prima di questa.</p>
      </Card>

      <div class="grid2">
        <LastMatches title={`Ultime 6 · ${teamName(H)}`} list={lastH} team={H} />
        <LastMatches title={`Ultime 6 · ${teamName(A)}`} list={lastA} team={A} />
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
          <td><a href={href(["partita", x.id])}><b>{f}–{a}</b></a></td><td><span class="form"><i class={r}>{r}</i></span></td></tr>;
      })}</tbody></table></div> : <p class="empty">Nessuna partita precedente.</p>}
    </Card>
  );
}
