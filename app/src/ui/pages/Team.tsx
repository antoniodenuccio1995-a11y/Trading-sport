import { useMemo } from "preact/hooks";
import { todayDay } from "../../data/dates";
import { leagueName } from "../../data/store";
import { played } from "../../data/types";
import { avg, pct, scorelines, teamAgg, teamMatches, type Agg } from "../../stats/team";
import { Card, Form, PctTd, fmtNum, fmtPct, useStore } from "../components/common";
import { href, type Route } from "../router";
import { Results } from "./League";

export function StatRows({ cols, labels }: { cols: Agg[]; labels: string[] }) {
  const R = ({ t, f, pc, inv }: { t: string; f: (g: Agg) => number | null; pc?: boolean; inv?: boolean }) => (
    <tr><td class="l">{t}</td>{cols.map((g, i) => pc ? <PctTd key={i} v={f(g)} invert={inv} /> : <td key={i}>{fmtNum(f(g))}</td>)}</tr>
  );
  return (
    <div class="tw"><table class="t">
      <thead><tr><th class="l">Statistica</th>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
      <tbody>
        <tr><td class="l">Partite</td>{cols.map((g, i) => <td key={i}>{g.n}</td>)}</tr>
        <R t="Punti a partita" f={(g) => avg(g.pts, g.n)} />
        <R t="Vittorie" f={(g) => pct(g.w, g.n)} pc />
        <tr><td class="l">Pareggi</td>{cols.map((g, i) => <td key={i}>{fmtPct(pct(g.d, g.n))}</td>)}</tr>
        <R t="Sconfitte" f={(g) => pct(g.l, g.n)} pc inv />
        <R t="Gol fatti (media)" f={(g) => avg(g.gf, g.n)} />
        <R t="Gol subiti (media)" f={(g) => avg(g.ga, g.n)} />
        <R t="Gol totali (media)" f={(g) => avg(g.gf + g.ga, g.n)} />
        <R t="Over 0,5" f={(g) => pct(g.o05, g.n)} pc />
        <R t="Over 1,5" f={(g) => pct(g.o15, g.n)} pc />
        <R t="Over 2,5" f={(g) => pct(g.o25, g.n)} pc />
        <R t="Over 3,5" f={(g) => pct(g.o35, g.n)} pc />
        <R t="Entrambe segnano (GG)" f={(g) => pct(g.btts, g.n)} pc />
        <R t="Porta inviolata" f={(g) => pct(g.cs, g.n)} pc />
        <R t="Non ha segnato" f={(g) => pct(g.fts, g.n)} pc inv />
        <R t="1° tempo: gol medi" f={(g) => avg(g.htGf + g.htGa, g.htN)} />
        <R t="1° tempo: Over 0,5" f={(g) => pct(g.ht05, g.htN)} pc />
        <R t="1° tempo: Over 1,5" f={(g) => pct(g.ht15, g.htN)} pc />
        <R t="In vantaggio all'intervallo" f={(g) => pct(g.htW, g.htN)} pc />
        <R t="2° tempo: Over 0,5" f={(g) => pct(g.sh05, g.htN)} pc />
        <R t="2° tempo: Over 1,5" f={(g) => pct(g.sh15, g.htN)} pc />
        <R t="Corner a favore (media)" f={(g) => avg(g.coF, g.coN)} />
        <R t="Corner contro (media)" f={(g) => avg(g.coA, g.coN)} />
        <R t="Tiri in porta a favore" f={(g) => avg(g.soF, g.soN)} />
        <R t="Tiri in porta contro" f={(g) => avg(g.soA, g.soN)} />
        <R t="Cartellini gialli (media)" f={(g) => avg(g.yeF, g.yeN)} />
      </tbody>
    </table></div>
  );
}

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
        <Card title={`Statistiche ${season}`}><StatRows cols={[tot, home, away]} labels={["Totale", "Casa", "Trasferta"]} /></Card>
        <div>
          <Results title="Prossime partite" list={next} upcoming />
          <Card title="Risultati esatti più frequenti">
            <div class="row">{scorelines(dom, id).map(([sc, n]) => <span key={sc} class="tile" style="padding:6px 10px"><b style="font-size:16px">{sc}</b><span>{n === 1 ? "1 volta" : `${n} volte`}</span></span>)}</div>
            <p class="note">Dal punto di vista della squadra (fatti–subiti), campionato nazionale.</p>
          </Card>
        </div>
      </div>
      <Results title="Ultimi risultati" list={results} />
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

