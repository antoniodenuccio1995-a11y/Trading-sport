import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, Loading, useStore, usePref } from "./components/common";
import { DataStatus } from "./pages/DataStatus";
import { Home } from "./pages/Home";
import { League } from "./pages/League";
import { MatchPage } from "./pages/Match";
import { Personal } from "./pages/Personal";
import { Team } from "./pages/Team";
import { go, href, useRoute } from "./router";

type Theme = "auto" | "light" | "dark";

export function App() {
  const s = useStore();
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = usePref<Theme>("theme", "auto");
  const [fav] = usePref<string[]>("favLeagues", []);
  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => setMenu(false), [route]);

  const page = route.path[0] ?? "";
  const countries = useMemo(() => {
    const m = new Map<string, typeof s.leagues>();
    for (const l of s.leagues) (m.get(l.countryName) ?? m.set(l.countryName, []).get(l.countryName)!).push(l);
    return [...m.entries()];
  }, [s.leagues]);

  let body;
  if (page === "personale") body = <Personal />;
  else if (s.status === "loading") body = <Card><Loading /></Card>;
  else if (s.status === "error") body = <div class="banner err">{s.error}</div>;
  else if (page === "lega") body = <League route={route} />;
  else if (page === "squadra") body = <Team route={route} />;
  else if (page === "partita") body = <MatchPage route={route} />;
  else if (page === "dati") body = <DataStatus />;
  else body = <Home route={route} />;

  const active = (p: string, code?: string) => (page === p && (!code || route.path[1] === code) ? "active" : "");
  return (
    <div class="layout">
      <aside class={`side${menu ? " open" : ""}`} aria-label="Menu">
        <div class="brand"><span class="brand-mark">↗</span>Trading Analytics</div>
        <nav class="nav">
          <a class={page === "" ? "active" : ""} href="#/">Partite</a>
          <a class={active("personale")} href="#/personale">Area personale</a>
          <a class={active("dati")} href="#/dati">Stato dei dati</a>
          {fav.length > 0 && <div class="nav-title">Preferiti</div>}
          {fav.map((c) => s.leagueByCode.get(c)).filter(Boolean).map((l) => <a key={l!.code} class={`lg ${active("lega", l!.code)}`} href={href(["lega", l!.code])}>★ {l!.name}</a>)}
          <div class="nav-title">Campionati</div>
          {countries.map(([c, ls]) => (
            <div key={c}>
              <div class="country">{c}</div>
              {ls.map((l) => <a key={l.code} class={`lg ${active("lega", l.code)}`} href={href(["lega", l.code])}>{l.name}</a>)}
            </div>
          ))}
        </nav>
        <div class="side-foot">
          <label class="row" style="gap:6px">Tema
            <select class="input" value={theme} onChange={(e) => setTheme((e.target as HTMLSelectElement).value as Theme)}>
              <option value="auto">Automatico</option><option value="light">Chiaro</option><option value="dark">Scuro</option>
            </select>
          </label>
          <span class="muted">Strumento di studio: le statistiche passate non garantiscono risultati futuri. Il gioco può causare dipendenza.</span>
        </div>
      </aside>
      <div class="main">
        <header class="top">
          <button type="button" class="btn menu-btn" aria-label="Apri il menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
          <Search />
          <span class={`status-pill${s.error ? " err" : ""}`} role="status">
            {s.syncing ? <><span class="dot sync" />Aggiornamento…</> : s.error ? s.error : s.generatedAt ? <><span class="dot" />Dati del {new Date(s.generatedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</> : null}
          </span>
        </header>
        <main class="content">{body}</main>
      </div>
    </div>
  );
}

function Search() {
  const s = useStore();
  const [q, setQ] = useState(""), [sel, setSel] = useState(0);
  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hits = useMemo(() => {
    const n = norm(q.trim());
    if (n.length < 2) return [];
    const teams = [...s.teams.values()].filter((t) => s.byTeam.has(t.id) && norm(t.name).includes(n)).slice(0, 8)
      .map((t) => ({ label: t.name, sub: t.country, to: href(["squadra", t.id]) }));
    const lgs = s.leagues.filter((l) => norm(l.name).includes(n)).slice(0, 4).map((l) => ({ label: l.name, sub: l.countryName, to: href(["lega", l.code]) }));
    return [...lgs, ...teams];
  }, [q, s.teams, s.leagues]);
  const open = (to: string) => { setQ(""); location.hash = to; };
  return (
    <div class="search">
      <input type="search" placeholder="Cerca squadra o campionato" aria-label="Cerca squadra o campionato" value={q}
        onInput={(e) => { setQ((e.target as HTMLInputElement).value); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(sel + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
          else if (e.key === "Enter" && hits[sel]) open(hits[sel].to);
          else if (e.key === "Escape") setQ("");
        }} />
      {hits.length > 0 && <ul role="listbox">{hits.map((h, i) => <li key={h.to}><a class={i === sel ? "sel" : ""} href={h.to} onClick={() => setQ("")}>{h.label}<span class="muted">{h.sub}</span></a></li>)}</ul>}
    </div>
  );
}

export { go };
