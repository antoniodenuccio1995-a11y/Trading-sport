import { kickoffTime } from "../../data/dates";
import { leagueName, teamName } from "../../data/store";
import { played, type Match } from "../../data/types";
import { leagueAll, matchForecast } from "../../stats/derived";
import { pct, teamAgg, teamMatches } from "../../stats/team";
import { href } from "../router";
import { fmtPct, heat } from "./common";
import { Flag, TeamBadge } from "./badge";
import { getStore } from "../../data/store";

/** Percentuale combinata stile soccerstats: casa (in casa) + ospite (in trasferta), stagione corrente. */
function combined(m: Match) {
  const all = leagueAll(m.lg);
  const hs = teamAgg(teamMatches(all, m.h, "home", { season: m.s, before: m.d }), m.h);
  const as = teamAgg(teamMatches(all, m.a, "away", { season: m.s, before: m.d }), m.a);
  const c = (x: number | null, y: number | null) => (x === null || y === null ? null : (x + y) / 2);
  return {
    o25: c(pct(hs.o25, hs.n), pct(as.o25, as.n)),
    btts: c(pct(hs.btts, hs.n), pct(as.btts, as.n)),
    n: Math.min(hs.n, as.n),
  };
}

export function MatchRow({ m }: { m: Match }) {
  const done = played(m);
  const fc = done ? null : matchForecast(m);
  const cb = combined(m);
  const link = href(["partita", m.id]);
  return (
    <a class="mrow" href={link} aria-label={`${teamName(m.h)} contro ${teamName(m.a)}`}>
      <span class="num muted ko">{kickoffTime(m.ko)}</span>
      <span class="home"><span>{teamName(m.h)}</span><TeamBadge id={m.h} size={20} /></span>
      {done
        ? <span class="mid"><div class="score ft">{m.fh}–{m.fa}</div>{m.hh !== null && <div class="ht">1T {m.hh}–{m.ha}</div>}</span>
        : <span class="mid score vs">vs</span>}
      <span class="away"><TeamBadge id={m.a} size={20} /><span>{teamName(m.a)}</span></span>
      {(["home", "draw", "away"] as const).map((k) => {
        const best = fc && fc[k] === Math.max(fc.home, fc.draw, fc.away);
        const odd = k === "home" ? m.oh : k === "draw" ? m.od : m.oa;
        const what = k === "home" ? "vittoria casa" : k === "draw" ? "pareggio" : "vittoria ospite";
        return (
          <span key={k} class={`q opt x12${best ? " best" : ""}`} title={`${what}: probabilità del modello${odd ? `, quota media bookmaker ${odd.toFixed(2)}` : ""}`}>
            <b>{fc ? fmtPct(fc[k] * 100) : "—"}</b>{odd ? <small>{odd.toFixed(2)}</small> : null}
          </span>
        );
      })}
      <span class={`q o25 ${heat(cb.o25)}`} title={`Over 2,5 combinato (${cb.n} partite min.)`}>{fmtPct(cb.o25)}</span>
      <span class={`q gg ${heat(cb.btts)}`} title="Entrambe segnano combinato">{fmtPct(cb.btts)}</span>
    </a>
  );
}

export function MatchHead() {
  return (
    <div class="mrow mhead" aria-hidden="true">
      <span>Ora</span><span class="home">Casa</span><span /><span>Ospite</span>
      <span class="q opt" title="Probabilità del modello; sotto, quota media dei bookmaker">1</span><span class="q opt" title="Probabilità del modello; sotto, quota media dei bookmaker">X</span><span class="q opt" title="Probabilità del modello; sotto, quota media dei bookmaker">2</span>
      <span class="q" title="Over 2,5: media casa (in casa) e ospite (in trasferta)">O2,5</span><span class="q" title="Entrambe segnano: media casa (in casa) e ospite (in trasferta)">GG</span>
    </div>
  );
}

/** Partite raggruppate per campionato. */
export function MatchGroups({ matches, order }: { matches: Match[]; order: string[] }) {
  const groups = new Map<string, Match[]>();
  for (const m of matches) (groups.get(m.lg) ?? groups.set(m.lg, []).get(m.lg)!).push(m);
  const keys = [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return (
    <>
      {keys.map((lg) => (
        <section key={lg} class="card flush mgroup">
          <div class="card-h"><Flag country={getStore().leagueByCode.get(lg)?.country ?? ""} size={14} /><a href={href(["lega", lg])}>{leagueName(lg)}</a><span class="spacer" /><span class="muted" style="font-weight:400;font-size:12px">{groups.get(lg)!.length} partite</span></div>
          <MatchHead />
          {groups.get(lg)!.map((m) => <MatchRow key={m.id} m={m} />)}
        </section>
      ))}
    </>
  );
}
