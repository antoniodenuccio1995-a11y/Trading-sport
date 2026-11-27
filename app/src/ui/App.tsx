import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, Loading, useStore, usePref } from "./components/common";
import { DataStatus } from "./pages/DataStatus";
import { Home } from "./pages/Home";
import { League } from "./pages/League";
import { MatchPage } from "./pages/Match";
import { Personal } from "./pages/Personal";
import { Team } from "./pages/Team";
import { TradesPage } from "./pages/Trades";
import { requestServerRefresh } from "../data/store";
import { Flag, TeamBadge } from "./components/badge";
import { BrandMark, Stadium } from "./components/Stadium";
import { InstallButton } from "./components/Install";
import { go, href, useRoute } from "./router";

type Theme = "auto" | "diurna" | "notturna" | "azzurri" | "classica";
const THEMES: { key: Theme; label: string; preview: string }[] = [
  { key: "auto", label: "Auto", preview: "linear-gradient(135deg, #5aa463 0 50%, #10301d 50%)" },
  { key: "diurna", label: "Diurna", preview: "linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,.55)), repeating-linear-gradient(90deg, #4f9a57 0 6px, #468f4e 6px 12px)" },
  { key: "notturna", label: "Notturna", preview: "radial-gradient(circle at 18% 0, rgba(255,240,200,.75), transparent 55%), linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), repeating-linear-gradient(90deg, #1d6b3a 0 6px, #175c31 6px 12px)" },
  { key: "azzurri", label: "Azzurri", preview: "linear-gradient(180deg, rgba(10,40,120,.45), rgba(8,30,90,.8)), repeating-linear-gradient(90deg, #1f6a43 0 6px, #195c39 6px 12px)" },
  { key: "classica", label: "Classica", preview: "linear-gradient(135deg, #f4f6f8 0 55%, #1d7a4d 55%)" },
];
/** Tema effettivo: "auto" segue il telefono o il computer (chiaro → Diurna, scuro → Notturna). */
export function resolveTheme(t: string): Exclude<Theme, "auto"> {
  const v = t === "light" ? "diurna" : t === "dark" ? "notturna" : t;
  if (v === "diurna" || v === "notturna" || v === "azzurri" || v === "classica") return v;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "notturna" : "diurna";
}

export function App() {
  const s = useStore();
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const [themePref, setTheme] = usePref<string>("theme", "auto");
  const theme: Theme = themePref === "light" ? "diurna" : themePref === "dark" ? "notturna" : (themePref as Theme);
  const [fav] = usePref<string[]>("favLeagues", []);
  useEffect(() => {
    const apply = () => {
      const t = resolveTheme(theme);
      document.documentElement.setAttribute("data-theme", t);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", t === "notturna" ? "#06120c" : t === "azzurri" ? "#04102a" : t === "classica" ? "#1d7a4d" : "#1b6b43");
    };
    apply();
    if (theme !== "auto" || typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
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
  else if (page === "registro") body = s.status === "loading" ? <Card><Loading /></Card> : <TradesPage />;
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
      <Stadium />
      <aside class={`side${menu ? " open" : ""}`} aria-label="Menu">
        <div class="brand"><span class="brand-mark"><BrandMark /></span><span>Trading Analytics<small>Statistiche, modello e quote</small></span></div>
        <nav class="nav">
          <a class={page === "" ? "active" : ""} href="#/"><span class="ico">⚽</span>Partite</a>
          <a class={active("registro")} href="#/registro"><span class="ico">📒</span>Registro trade</a>
          <a class={active("personale")} href="#/personale"><span class="ico">👤</span>Area personale</a>
          <a class={active("dati")} href="#/dati"><span class="ico">🗂</span>Stato dei dati</a>
          {fav.length > 0 && <div class="nav-title">Preferiti</div>}
          {fav.map((c) => s.leagueByCode.get(c)).filter(Boolean).map((l) => <a key={l!.code} class={`lg ${active("lega", l!.code)}`} href={href(["lega", l!.code])}>★ {l!.name}</a>)}
          <div class="nav-title">Campionati</div>
          {countries.map(([c, ls]) => (
            <div key={c}>
              <div class="country"><Flag country={ls[0].country} size={12} />{c}</div>
              {ls.map((l) => <a key={l.code} class={`lg ${active("lega", l.code)}`} href={href(["lega", l.code])}>{l.name}</a>)}
            </div>
          ))}
        </nav>
        <div class="side-foot">
          <InstallButton />
          <div class="theme-pick">
            <span>Tema: <b>{theme === "auto" ? `automatico (${THEMES.find((x) => x.key === resolveTheme("auto"))!.label})` : THEMES.find((x) => x.key === theme)?.label}</b></span>
            <div role="radiogroup" aria-label="Tema" class="themes">
              {THEMES.map((x) => (
                <button key={x.key} type="button" role="radio" aria-checked={theme === x.key} aria-label={x.label} class="theme-sw" title={x.key === "auto" ? "Automatico: segue il telefono o il computer (chiaro → Diurna, scuro → Notturna)" : x.label} onClick={() => setTheme(x.key)}>
                  <i style={`background:${x.preview}`} />
                </button>
              ))}
            </div>
          </div>
          <span class="muted">Strumento di studio: le statistiche passate non garantiscono risultati futuri. Il gioco può causare dipendenza.</span>
        </div>
      </aside>
      <div class="main">
        <header class="top">
          <button type="button" class="btn menu-btn" aria-label="Apri il menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
          <Search />
          <RefreshButton />
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
      .map((t) => ({ label: t.name, sub: t.country, to: href(["squadra", t.id]), team: t.id }));
    const lgs = s.leagues.filter((l) => norm(l.name).includes(n)).slice(0, 4).map((l) => ({ label: l.name, sub: l.countryName, to: href(["lega", l.code]), team: 0 }));
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
      {hits.length > 0 && <ul role="listbox">{hits.map((h, i) => <li key={h.to}><a class={i === sel ? "sel" : ""} href={h.to} onClick={() => setQ("")}><span class="team-link">{h.team ? <TeamBadge id={h.team} size={18} /> : null}<span>{h.label}</span></span><span class="muted">{h.sub}</span></a></li>)}</ul>}
    </div>
  );
}

export { go };

function RefreshButton() {
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" class="btn refresh" disabled={busy} title="Scarica subito i risultati più recenti da tutte le fonti"
        onClick={async () => { setBusy(true); await requestServerRefresh(setMsg); setBusy(false); setTimeout(() => setMsg(""), 8000); }}>
        <span class={busy ? "spin" : ""}>↻</span> Aggiorna
      </button>
      {msg && <span class="refresh-msg" role="status">{msg}</span>}
    </>
  );
}
