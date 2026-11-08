import { dayLong, dayToIso, isoToDay, relativeDay, todayDay } from "../../data/dates";
import { MatchGroups } from "../components/MatchList";
import { Card, useStore, usePref } from "../components/common";
import { go, href, type Route } from "../router";

export function Home({ route }: { route: Route }) {
  const s = useStore();
  const today = todayDay();
  const day = isoToDay(route.q.get("d") ?? "") ?? today;
  const [onlyFav, setOnlyFav] = usePref<boolean>("onlyFav", false);
  const [fav] = usePref<string[]>("favLeagues", []);
  const order = s.leagues.map((l) => l.code);
  const all = (s.byDay.get(day) ?? []).filter((m) => s.leagueByCode.has(m.lg));
  const list = onlyFav && fav.length ? all.filter((m) => fav.includes(m.lg)) : all;
  const days = [-1, 0, 1, 2, 3, 4, 5, 6].map((x) => today + x);
  const nextDay = (dir: 1 | -1) => {
    // salta ai giorni con partite
    for (let d = day + dir, i = 0; i < 60; i++, d += dir) if (s.byDay.get(d)?.length) return d;
    return day + dir;
  };

  return (
    <>
      <div class="page-head">
        <h1>Partite</h1>
        <span class="sub">{dayLong(day)}</span>
      </div>
      <div class="datebar" role="navigation" aria-label="Scegli il giorno">
        <a href={href([], { d: dayToIso(nextDay(-1)) })} aria-label="Giorno precedente con partite">‹</a>
        {days.map((d) => <a key={d} class={d === day ? "on" : ""} href={href([], { d: d === today ? undefined : dayToIso(d) })}>{relativeDay(d, today)} <span class="muted" style={d === day ? "color:inherit;opacity:.8" : ""}>{s.byDay.get(d)?.length ?? 0}</span></a>)}
        <a href={href([], { d: dayToIso(nextDay(1)) })} aria-label="Giorno successivo con partite">›</a>
        <input class="input" style="width:auto" type="date" value={dayToIso(day)} aria-label="Data"
          onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) go([], { d: v }); }} />
        <span class="spacer" />
        {fav.length > 0 && <label class="row" style="gap:6px"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav((e.target as HTMLInputElement).checked)} /> Solo campionati preferiti</label>}
      </div>
      {list.length
        ? <MatchGroups matches={list} order={order} />
        : <Card><p class="empty">Nessuna partita in archivio per questo giorno{onlyFav && all.length ? " nei campionati preferiti" : ""}.</p></Card>}
      <p class="note">1 / X / 2: probabilità del modello di Poisson calcolate solo con partite precedenti. O2,5 e GG: media tra la squadra di casa (gare in casa) e l'ospite (gare in trasferta) nella stagione. Quota 1: media dei bookmaker (football-data).</p>
    </>
  );
}
