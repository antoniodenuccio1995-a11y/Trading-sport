import { useEffect, useState } from "preact/hooks";
import { getSnap, getVersion, reviewCount, subscribe } from "../state/store.ts";
import { onSave } from "../storage/db.ts";
import * as A from "../state/actions.ts";
import { Icon } from "./icons.tsx";
import { Toasts } from "./components/common.tsx";
import { SyncBadge, SyncDialogHost, SyncPrompts } from "./components/Sync.tsx";
import { Dashboard } from "./views/Dashboard.tsx";
import { lazy, prefetchAll } from "./lazy.tsx";

// Solo la Panoramica è nel pacchetto iniziale; le altre pagine arrivano a richiesta
// e vengono comunque prescaricate appena il browser è libero.
const Analysis = lazy(() => import("./views/Analysis.tsx"), "Analysis");
const Movements = lazy<{ initialStatus?: "review" }>(() => import("./views/Movements.tsx"), "Movements");
const BudgetView = lazy(() => import("./views/Budget.tsx"), "BudgetView");
const Accounts = lazy(() => import("./views/Accounts.tsx"), "Accounts");
const ImportView = lazy(() => import("./views/Import.tsx"), "ImportView");
const Rules = lazy(() => import("./views/Rules.tsx"), "Rules");
const SettingsView = lazy(() => import("./views/Settings.tsx"), "SettingsView");
const InvestmentsView = lazy(() => import("./views/Investments.tsx"), "InvestmentsView");
const CategoriesView = lazy(() => import("./views/Categories.tsx"), "CategoriesView");

interface R { id: string; label: string; icon: string; title: string; sub?: string }
const ROUTES: R[] = [
  { id: "", label: "Panoramica", icon: "home", title: "Panoramica" },
  { id: "analisi", label: "Analisi", icon: "chart", title: "Analisi" },
  { id: "movimenti", label: "Movimenti", icon: "list", title: "Movimenti" },
  { id: "budget", label: "Budget", icon: "target", title: "Budget" },
  { id: "investimenti", label: "Investimenti", icon: "trend", title: "Investimenti" },
  { id: "conti", label: "Conti", icon: "wallet", title: "Conti e patrimonio" },
  { id: "importa", label: "Importa", icon: "upload", title: "Importa e backup" },
  { id: "categorie", label: "Categorie", icon: "tag", title: "Categorie" },
  { id: "regole", label: "Regole", icon: "rules", title: "Regole" },
  { id: "impostazioni", label: "Impostazioni", icon: "settings", title: "Impostazioni" },
];
const MOBILE = ["", "analisi", "movimenti", "budget"];
const MORE = ["investimenti", "conti", "importa", "categorie", "regole", "impostazioni"];

// Indirizzi semplici "#analisi" (accettati anche i vecchi "#/analisi"); "#panoramica" = pagina iniziale.
const routeOf = () => { const r = location.hash.replace(/^#\/?/, "").split("?")[0]; return r === "panoramica" ? "" : r; };
// Tema impostato da chi ospita la pagina (es. anteprima): con "automatico" lo si rispetta.
const hostTheme = document.documentElement.dataset.theme;

function go(id: string) {
  const next = "#" + (id || "panoramica");
  if (location.hash === next) return;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => { location.hash = next; });
  else location.hash = next;
}

export function App() {
  const [, force] = useState(0);
  const [route, setRoute] = useState(routeOf());
  const [more, setMore] = useState(false);
  const [save, setSave] = useState<{ state: string; message?: string; at?: Date }>({ state: "saved" });
  useEffect(() => subscribe(() => force((x) => x + 1)), []);
  useEffect(() => onSave(setSave), []);
  useEffect(() => prefetchAll(), []);
  useEffect(() => {
    const h = () => { setRoute(routeOf()); window.scrollTo({ top: 0 }); };
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  const s = getSnap(), st = s.settings;
  useEffect(() => {
    const root = document.documentElement;
    if (st.theme !== "auto") root.dataset.theme = st.theme;
    else if (hostTheme) root.dataset.theme = hostTheme;
    else delete root.dataset.theme;
    if (st.accent === "indaco") delete root.dataset.accent; else root.dataset.accent = st.accent;
    if (st.reduceMotion === "on") root.dataset.motion = "off"; else delete root.dataset.motion;
    document.body.classList.toggle("hide-amounts", st.hideAmounts);
  }, [st.theme, st.accent, st.reduceMotion, st.hideAmounts]);

  const review = reviewCount();
  const id = route === "controllo" ? "movimenti" : route;
  const r = ROUTES.find((x) => x.id === id) ?? ROUTES[0];
  const view = (() => {
    switch (id) {
      case "analisi": return <Analysis />;
      case "movimenti": return <Movements key={route} initialStatus={route === "controllo" ? "review" : undefined} />;
      case "budget": return <BudgetView />;
      case "conti": return <Accounts />;
      case "importa": return <ImportView />;
      case "regole": return <Rules />;
      case "impostazioni": return <SettingsView />;
      case "investimenti": return <InvestmentsView />;
      case "categorie": return <CategoriesView />;
      default: return <Dashboard />;
    }
  })();
  const dark = st.theme === "dark" || (st.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div class="shell">
      <nav class="side" aria-label="Sezioni">
        <div class="brand"><div class="brand-mark">€</div><div>Finanza<small>personale · v4</small></div></div>
        {ROUTES.map((x) => (
          <button key={x.id} class="nav-item" aria-current={x.id === id ? "page" : undefined} onClick={() => go(x.id)}
            onPointerEnter={x.id === "importa" ? A.prefetchXlsx : undefined}>
            <Icon name={x.icon} />{x.label}
            {x.id === "movimenti" && review > 0 && <span class="nav-badge" title="Da controllare">{review}</span>}
          </button>
        ))}
        <div class="side-foot">
          <span><i class={"save-dot " + save.state} />{save.state === "saving" ? "Salvataggio…" : save.state === "error" ? "Non salvato" : "Salvato sul dispositivo"}</span>
          {save.state === "error" && <span class="bad">{save.message}</span>}
          {s.meta.demo && <span class="warn">Dati dimostrativi</span>}
          <SyncBadge />
        </div>
      </nav>
      <main class="main" data-v={getVersion()}>
        <header class="topbar">
          <div>
            <h1>{r.title}</h1>
            {s.meta.demo && id === "" && <div class="sub">Dati dimostrativi · <a href="#importa">importa i tuoi</a></div>}
          </div>
          <span class="spacer" />
          {review > 0 && id !== "movimenti" && <button class="chip" onClick={() => go("controllo")}><Icon name="alert" size={14} />{review} da controllare</button>}
          <span class="mobile-only"><SyncBadge compact /></span>
          <button class="icon-btn" onClick={() => A.updateSettings({ hideAmounts: !st.hideAmounts })} aria-label={st.hideAmounts ? "Mostra importi" : "Nascondi importi"} title={st.hideAmounts ? "Mostra importi" : "Nascondi importi"}>
            <Icon name={st.hideAmounts ? "eyeOff" : "eye"} />
          </button>
          <button class="icon-btn" onClick={() => A.updateSettings({ theme: dark ? "light" : "dark" })} aria-label="Cambia tema" title="Cambia tema"><Icon name={dark ? "sun" : "moon"} /></button>
          <button class="icon-btn" onClick={() => go("impostazioni")} aria-label="Impostazioni" title="Impostazioni"><Icon name="settings" /></button>
        </header>
        <div key={id}>{view}</div>
      </main>
      <nav class="tabbar" aria-label="Sezioni">
        {MOBILE.map((mid) => { const x = ROUTES.find((y) => y.id === mid)!; return (
          <button key={mid} aria-current={mid === id ? "page" : undefined} onClick={() => go(mid)}>
            <Icon name={x.icon} />{x.label}
            {mid === "movimenti" && review > 0 && <span class="nav-badge">{review}</span>}
          </button>
        ); })}
        <button aria-current={MORE.includes(id) ? "page" : undefined} aria-expanded={more} onClick={() => setMore((x) => !x)}><Icon name="more" />Altro</button>
      </nav>
      {more && (
        <>
          <div class="scrim sheet-scrim" onClick={() => setMore(false)} />
          <div class="sheet" role="menu">
            {MORE.map((mid) => { const x = ROUTES.find((y) => y.id === mid)!; return (
              <button key={mid} role="menuitem" class={mid === id ? "on" : ""} onClick={() => { setMore(false); go(mid); }}><span class="sheet-ico"><Icon name={x.icon} /></span>{x.label}</button>
            ); })}
          </div>
        </>
      )}
      <Toasts />
      <SyncDialogHost />
      <SyncPrompts />
    </div>
  );
}
