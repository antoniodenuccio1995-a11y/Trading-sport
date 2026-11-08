// Gol e tempi: dove arrivano i gol (1° o 2° tempo) per squadra, lega e modello.
import { useState } from "preact/hooks";
import { teamName } from "../../data/store";
import type { Match } from "../../data/types";
import { halfLeague, halfTeam, type HalfAgg } from "../../stats/halves";
import type { Halves } from "../../stats/poisson";
import { pct, teamMatches, type Venue } from "../../stats/team";
import { PctBar, SplitBar } from "../components/charts";
import { Card, Seg, fmtNum, fmtPct } from "../components/common";

const per = (x: number, n: number) => (n ? x / n : null);

/** Scheda di una squadra (o della media lega se team è null). */
export function HalfCard({ title, sub, g, bench, color }: { title: string; sub: string; g: HalfAgg; bench: HalfAgg; color: string }) {
  if (!g.n) return <Card title={title}><p class="muted">Nessuna partita con risultato all'intervallo.</p></Card>;
  const P = (x: number, n = g.n) => pct(x, n);
  const R = (x: number) => pct(x, bench.n);
  const rows: [string, number | null, number | null][] = [
    ["Gol nel 1° tempo", P(g.g1), R(bench.g1)],
    ["Gol nel 2° tempo", P(g.g2), R(bench.g2)],
    ["Over 1,5 nel 1° tempo", P(g.g1o15), R(bench.g1o15)],
    ["Over 1,5 nel 2° tempo", P(g.g2o15), R(bench.g2o15)],
    ["Segna nel 1° tempo", P(g.s1), R(bench.s1)],
    ["Segna nel 2° tempo", P(g.s2), R(bench.s2)],
    ["Subisce nel 1° tempo", P(g.c1), R(bench.c1)],
    ["Subisce nel 2° tempo", P(g.c2), R(bench.c2)],
    ["0-0 all'intervallo", P(g.zero1), R(bench.zero1)],
    ["2° tempo con più gol", P(g.more2), R(bench.more2)],
  ];
  return (
    <section class="card half-card">
      <h3><span style={`color:${color}`}>{title}</span><span class="muted" style="text-transform:none;letter-spacing:0">{sub} · {g.n} gare</span></h3>
      <div class="kpis">
        <div class="kpi"><b>{fmtNum(per(g.f1, g.n))}</b><span>fatti 1° tempo / gara</span></div>
        <div class="kpi"><b>{fmtNum(per(g.a1, g.n))}</b><span>subiti 1° tempo / gara</span></div>
        <div class="kpi"><b>{fmtNum(per(g.f2, g.n))}</b><span>fatti 2° tempo / gara</span></div>
        <div class="kpi"><b>{fmtNum(per(g.a2, g.n))}</b><span>subiti 2° tempo / gara</span></div>
      </div>
      <div class="half-rows">
        <div class="half-row"><span class="muted">Dove cadono i gol</span><SplitBar a={g.f1 + g.a1} b={g.f2 + g.a2} la="1T" lb="2T" /></div>
        {rows.map(([l, v, r]) => <div class="half-row" key={l}><span>{l}</span><PctBar v={v} mark={r} color={color} /></div>)}
      </div>
      <HtFt g={g} />
    </section>
  );
}

function HtFt({ g }: { g: HalfAgg }) {
  const R = ["V", "N", "P"] as const, L = { V: "In vantaggio", N: "In parità", P: "In svantaggio" };
  return (
    <details style="margin-top:10px">
      <summary class="muted">Dall'intervallo al finale (rimonte e vantaggi tenuti)</summary>
      <table class="htft" style="margin-top:8px">
        <thead><tr><th>All'intervallo</th><th>Vince</th><th>Pareggia</th><th>Perde</th><th>Gare</th></tr></thead>
        <tbody>{R.map((h) => {
          const n = R.reduce((s, f) => s + (g.htft[`${h}>${f}`] ?? 0), 0);
          return <tr key={h}><th>{L[h]}</th>{R.map((f) => <td key={f}>{n ? fmtPct(pct(g.htft[`${h}>${f}`] ?? 0, n)) : "—"}</td>)}<td>{n}</td></tr>;
        })}</tbody>
      </table>
    </details>
  );
}

type Period = "season" | "two";

/** Sezione completa per una partita: casa (in casa) contro ospite (in trasferta), lega, incrocio e modello. */
export function MatchHalves({ m, leagueAll, model }: { m: Match; leagueAll: Match[]; model: Halves | null }) {
  const [period, setPeriod] = useState<Period>("season");
  const seasons = [...new Set(leagueAll.map((x) => x.s))].sort();
  const keep = period === "season" ? [m.s] : seasons.slice(Math.max(0, seasons.indexOf(m.s) - 1), seasons.indexOf(m.s) + 1);
  const base = leagueAll.filter((x) => keep.includes(x.s) && x.d < m.d);
  const H = halfTeam(teamMatches(base, m.h, "home"), m.h), A = halfTeam(teamMatches(base, m.a, "away"), m.a);
  const LH = halfLeague(base, "home"), LA = halfLeague(base, "away");
  const few = H.n < 5 || A.n < 5;
  const cross = (label: string, f: number | null, a: number | null, lg: number | null) => (
    <tr><td class="l">{label}</td><td>{fmtNum(f)}</td><td>{fmtNum(a)}</td><td class="ref">{fmtNum(lg)}</td></tr>
  );
  return (
    <>
      <div class="row" style="margin-bottom:10px">
        <Seg<Period> label="Periodo" value={period} onChange={setPeriod} options={[["season", "Questa stagione"], ["two", "Ultime 2 stagioni"]]} />
        {few && period === "season" && <span class="muted">Poche partite in questa stagione: prova "Ultime 2 stagioni".</span>}
      </div>
      {model && <HalfModel model={model} />}
      <div class="half-grid">
        <HalfCard title={teamName(m.h)} sub="in casa" g={H} bench={LH} color="var(--c1)" />
        <HalfCard title={teamName(m.a)} sub="in trasferta" g={A} bench={LA} color="var(--c2)" />
      </div>
      <Card title="Incrocio attacco / difesa per tempo">
        <div class="tw"><table class="t">
          <thead><tr><th class="l">Gol a partita</th><th>Attacco</th><th>Difesa avversaria</th><th class="ref">Media lega</th></tr></thead>
          <tbody>
            {cross(`${teamName(m.h)} segna nel 1° tempo`, per(H.f1, H.n), per(A.a1, A.n), per(LH.f1, LH.n))}
            {cross(`${teamName(m.a)} segna nel 1° tempo`, per(A.f1, A.n), per(H.a1, H.n), per(LA.f1, LA.n))}
            {cross(`${teamName(m.h)} segna nel 2° tempo`, per(H.f2, H.n), per(A.a2, A.n), per(LH.f2, LH.n))}
            {cross(`${teamName(m.a)} segna nel 2° tempo`, per(A.f2, A.n), per(H.a2, H.n), per(LA.f2, LA.n))}
          </tbody>
        </table></div>
        <p class="note">Campionato, {LH.n} partite con risultato all'intervallo: {fmtNum(per(LH.f1 + LH.a1, LH.n))} gol a partita nel 1° tempo e {fmtNum(per(LH.f2 + LH.a2, LH.n))} nel 2°; almeno un gol nel 1° tempo nel {fmtPct(pct(LH.g1, LH.n))} delle partite, nel 2° tempo nel {fmtPct(pct(LH.g2, LH.n))}. Nelle schede sopra, la tacca scura sulle barre è la media del campionato.</p>
      </Card>
      <p class="note">Dati dal risultato all'intervallo e finale: non indicano il minuto esatto dei gol. Le partite di Danimarca e Romania non hanno il risultato all'intervallo.</p>
    </>
  );
}

function HalfModel({ model }: { model: Halves }) {
  const g1 = model.h1.goal, g2 = model.h2.goal;
  const lean = Math.abs(g2 - g1) < 0.04 ? "I due tempi sono simili per il modello." :
    g2 > g1 ? `Il modello vede più probabile il gol nel 2° tempo (+${Math.round((g2 - g1) * 100)} punti).` :
      `Il modello vede più probabile il gol nel 1° tempo (+${Math.round((g1 - g2) * 100)} punti).`;
  return (
    <Card title="Modello per tempo (Poisson)">
      <div class="big-prob">
        <div class="kpi"><b>{fmtPct(g1 * 100)}</b><span>almeno un gol nel 1° tempo · Over 1,5 {fmtPct(model.h1.o15 * 100)}</span></div>
        <div class="kpi"><b>{fmtPct(g2 * 100)}</b><span>almeno un gol nel 2° tempo · Over 1,5 {fmtPct(model.h2.o15 * 100)}</span></div>
        <div class="kpi"><b>{fmtPct(model.more2 * 100)}</b><span>2° tempo con più gol del 1° (meno: {fmtPct(model.more1 * 100)}, uguali: {fmtPct(model.same * 100)})</span></div>
      </div>
      <p style="margin:10px 0 0"><b>{lean}</b></p>
      <p class="note">Gol attesi: 1° tempo {model.h1.lh.toFixed(2)} – {model.h1.la.toFixed(2)}, 2° tempo {model.h2.lh.toFixed(2)} – {model.h2.la.toFixed(2)}.
        Segna nel 1° tempo: casa {fmtPct(model.h1.home * 100)}, ospite {fmtPct(model.h1.away * 100)}. Campione: {model.sample.home} gare in casa e {model.sample.away} in trasferta con risultato all'intervallo.</p>
    </Card>
  );
}

/** Versione per la pagina squadra: casa, trasferta e totale nella stagione. */
export function TeamHalves({ team, list, leagueList }: { team: number; list: Match[]; leagueList: Match[] }) {
  const [venue, setVenue] = useState<Venue>("all");
  const g = halfTeam(teamMatches(list, team, venue), team);
  const ref = halfLeague(leagueList, venue);
  return (
    <div>
      <div class="row" style="margin-bottom:8px"><span class="spacer" /><Seg label="Sede" value={venue} onChange={setVenue} options={[["all", "Totale"], ["home", "Casa"], ["away", "Trasferta"]]} /></div>
      <HalfCard title={teamName(team)} sub={venue === "home" ? "in casa" : venue === "away" ? "in trasferta" : "tutte le gare"} g={g} bench={ref} color="var(--c1)" />
    </div>
  );
}
