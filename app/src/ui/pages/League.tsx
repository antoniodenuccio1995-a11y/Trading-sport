import { useMemo, useState } from "preact/hooks";
import { dateShort, kickoffTime, todayDay } from "../../data/dates";
import { currentSeasonOf, teamName } from "../../data/store";
import { played, type Match } from "../../data/types";
import { formTable, standings } from "../../stats/standings";
import { avg, leagueAgg, pct, teamAgg, teamMatches, type Agg, type Venue } from "../../stats/team";
import { Card, Form, PctTd, Seg, Tabs, TeamLink, fmtNum, fmtPct, useSort, useStore, usePref } from "../components/common";
import { href, type Route } from "../router";

const TABS: [string, string][] = [["classifica", "Classifica"], ["gol", "Statistiche gol"], ["forma", "Forma"], ["risultati", "Risultati"], ["calendario", "Calendario"]];

export function League({ route }: { route: Route }) {
  const s = useStore();
  const code = route.path[1];
  const lg = s.leagueByCode.get(code);
  const season = route.q.get("s") ?? currentSeasonOf(code);
  const tab = route.q.get("tab") ?? "classifica";
  const [fav, setFav] = usePref<string[]>("favLeagues", []);
  if (!lg) return <Card><p class="empty">Campionato non trovato.</p></Card>;
  const list = s.byLeagueSeason.get(`${code}|${season}`) ?? [];
  const seasons = s.seasons.filter((x) => s.byLeagueSeason.has(`${code}|${x}`)).reverse();
  const g = leagueAgg(list);
  const isFav = fav.includes(code);

  return (
    <>
      <div class="page-head">
        <h1>{lg.name}</h1>
        <span class="sub">{lg.countryName}</span>
        <select class="input" aria-label="Stagione" value={season} onChange={(e) => { location.hash = href(["lega", code], { s: (e.target as HTMLSelectElement).value, tab }); }}>
          {seasons.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button type="button" class="btn" aria-pressed={isFav} onClick={() => setFav(isFav ? fav.filter((x) => x !== code) : [...fav, code])}>{isFav ? "★ Preferito" : "☆ Aggiungi ai preferiti"}</button>
      </div>
      <div class="tiles">
        <div class="tile"><b>{g.n}</b><span>partite giocate di {list.length}</span></div>
        <div class="tile"><b>{fmtNum(avg(g.hg + g.ag, g.n))}</b><span>gol a partita</span></div>
        <div class="tile"><b style="font-size:17px">{fmtPct(pct(g.hw, g.n))} · {fmtPct(pct(g.dr, g.n))} · {fmtPct(pct(g.aw, g.n))}</b><span>esiti 1 · X · 2</span></div>
        <div class="tile"><b>{fmtPct(pct(g.o25, g.n))}</b><span>Over 2,5</span></div>
        <div class="tile"><b>{fmtPct(pct(g.btts, g.n))}</b><span>Entrambe segnano</span></div>
        <div class="tile"><b>{fmtPct(pct(g.ht05, g.htN))}</b><span>Over 0,5 primo tempo{g.htN < g.n ? ` (${g.htN} gare)` : ""}</span></div>
      </div>
      <Tabs tabs={TABS} active={tab} link={(k) => href(["lega", code], { s: season, tab: k })} />
      {tab === "classifica" && <Standings list={list} season={season} />}
      {tab === "gol" && <GoalStats list={list} season={season} />}
      {tab === "forma" && <FormTable list={list} season={season} />}
      {tab === "risultati" && <Results list={list.filter(played).slice(-60).reverse()} />}
      {tab === "calendario" && <Results list={list.filter((m) => !played(m) && m.d >= todayDay() - 3).slice(0, 80)} upcoming />}
    </>
  );
}

function Standings({ list, season }: { list: Match[]; season: string }) {
  const [venue, setVenue] = useState<Venue>("all");
  const rows = useMemo(() => standings(list, venue, undefined, teamName), [list, venue]);
  return (
    <Card flush title="Classifica" right={<Seg label="Sede" value={venue} onChange={setVenue} options={[["all", "Totale"], ["home", "Casa"], ["away", "Trasferta"]]} />}>
      <div class="tw"><table class="t">
        <thead><tr><th>#</th><th class="l">Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th><th>Pt/G</th><th class="l">Forma</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.team}><td>{r.pos}</td><td class="team"><TeamLink id={r.team} season={season} /></td>
            <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td>
            <td class={r.gf - r.ga > 0 ? "pos" : r.gf - r.ga < 0 ? "neg" : ""}>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td>
            <td><b>{r.pts}</b></td><td>{fmtNum(avg(r.pts, r.p))}</td><td class="l"><Form list={r.form} /></td></tr>))}
        </tbody></table></div>
      <p class="note" style="padding:0 14px 12px">Ordine: punti, differenza reti, gol fatti. Gli scontri diretti non sono considerati.</p>
    </Card>
  );
}

type GKey = "n" | "gf" | "ga" | "tot" | "o15" | "o25" | "o35" | "btts" | "cs" | "fts" | "ht05" | "co";
function GoalStats({ list, season }: { list: Match[]; season: string }) {
  const [venue, setVenue] = useState<Venue>("all");
  const [key, desc, sortBy] = useSort<GKey>("o25");
  const teams = useMemo(() => [...new Set(list.flatMap((m) => [m.h, m.a]))], [list]);
  const rows = useMemo(() => teams.map((t) => ({ t, g: teamAgg(teamMatches(list, t, venue), t) })), [teams, list, venue]);
  const val = (g: Agg, k: GKey): number | null => ({
    n: g.n, gf: avg(g.gf, g.n), ga: avg(g.ga, g.n), tot: avg(g.gf + g.ga, g.n), o15: pct(g.o15, g.n), o25: pct(g.o25, g.n),
    o35: pct(g.o35, g.n), btts: pct(g.btts, g.n), cs: pct(g.cs, g.n), fts: pct(g.fts, g.n), ht05: pct(g.ht05, g.htN), co: avg(g.coF + g.coA, g.coN),
  })[k];
  const sorted = [...rows].sort((a, b) => ((val(b.g, key) ?? -1) - (val(a.g, key) ?? -1)) * (desc ? 1 : -1));
  const H = ({ k, children, title }: { k: GKey; children: string; title?: string }) =>
    <th class={`sortable${k === key ? " sorted" : ""}`} title={title} onClick={() => sortBy(k)} aria-sort={k === key ? (desc ? "descending" : "ascending") : undefined}>{children}{k === key ? (desc ? " ↓" : " ↑") : ""}</th>;
  return (
    <Card flush title="Statistiche gol per squadra" right={<Seg label="Sede" value={venue} onChange={setVenue} options={[["all", "Totale"], ["home", "Casa"], ["away", "Trasferta"]]} />}>
      <div class="tw"><table class="t">
        <thead><tr><th class="l">Squadra</th><H k="n">G</H><H k="gf" title="Media gol fatti">GF</H><H k="ga" title="Media gol subiti">GS</H><H k="tot" title="Media gol totali">Tot</H>
          <H k="o15">O1,5</H><H k="o25">O2,5</H><H k="o35">O3,5</H><H k="btts" title="Entrambe segnano">GG</H><H k="cs" title="Porta inviolata">CS</H><H k="fts" title="Non ha segnato">FTS</H><H k="ht05" title="Over 0,5 primo tempo">1T O0,5</H><H k="co" title="Media corner totali">Corner</H></tr></thead>
        <tbody>{sorted.map(({ t, g }) => (
          <tr key={t}><td class="team"><TeamLink id={t} season={season} /></td><td>{g.n}</td>
            <td>{fmtNum(avg(g.gf, g.n))}</td><td>{fmtNum(avg(g.ga, g.n))}</td><td>{fmtNum(avg(g.gf + g.ga, g.n))}</td>
            <PctTd v={pct(g.o15, g.n)} /><PctTd v={pct(g.o25, g.n)} /><PctTd v={pct(g.o35, g.n)} /><PctTd v={pct(g.btts, g.n)} />
            <PctTd v={pct(g.cs, g.n)} /><PctTd v={pct(g.fts, g.n)} invert /><PctTd v={pct(g.ht05, g.htN)} n={g.htN} /><td>{fmtNum(avg(g.coF + g.coA, g.coN), 1)}</td></tr>))}
        </tbody></table></div>
    </Card>
  );
}

function FormTable({ list, season }: { list: Match[]; season: string }) {
  const [n, setN] = useState<"4" | "6" | "8">("6");
  const rows = useMemo(() => formTable(list, Number(n), teamName), [list, n]);
  return (
    <Card flush title="Classifica delle ultime partite" right={<Seg label="Partite" value={n} onChange={setN} options={[["4", "Ultime 4"], ["6", "Ultime 6"], ["8", "Ultime 8"]]} />}>
      <div class="tw"><table class="t">
        <thead><tr><th>#</th><th class="l">Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>Pt</th><th class="l">Sequenza</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.team}><td>{r.pos}</td><td class="team"><TeamLink id={r.team} season={season} /></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td><td><b>{r.pts}</b></td><td class="l"><Form list={r.form} n={8} /></td></tr>)}</tbody>
      </table></div>
    </Card>
  );
}

export function Results({ list, upcoming, title }: { list: Match[]; upcoming?: boolean; title?: string }) {
  if (!list.length) return <Card title={title} flush={!!title}><p class="empty">{upcoming ? "Nessuna partita in programma." : "Nessun risultato."}</p></Card>;
  return (
    <Card flush title={title}>
      <div class="tw"><table class="t">
        <thead><tr><th class="l">Data</th><th class="l">Ora</th><th class="l" style="text-align:right">Casa</th><th class="c">{upcoming ? "Quote 1X2" : "Ris."}</th><th class="l">Ospite</th>{!upcoming && <th>1T</th>}</tr></thead>
        <tbody>{list.map((m) => (
          <tr key={m.id}><td class="l">{dateShort(m.d)}</td><td class="l muted">{kickoffTime(m.ko)}</td>
            <td style="font-weight:600"><TeamLink id={m.h} season={m.s} /></td>
            <td class="c"><a href={href(["partita", m.id])}><b>{played(m) ? `${m.fh}–${m.fa}` : m.oh ? `${m.oh.toFixed(2)} ${m.od?.toFixed(2)} ${m.oa?.toFixed(2)}` : "analisi"}</b></a></td>
            <td class="l" style="font-weight:600"><TeamLink id={m.a} season={m.s} /></td>{!upcoming && <td class="muted">{m.hh !== null ? `${m.hh}–${m.ha}` : "—"}</td>}</tr>))}
        </tbody></table></div>
    </Card>
  );
}
