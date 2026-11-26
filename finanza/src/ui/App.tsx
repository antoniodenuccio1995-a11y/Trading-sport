import { useEffect, useState } from "preact/hooks";
import { getSnap, getVersion, reviewCount, subscribe } from "../state/store.ts";
import { onSave } from "../storage/db.ts";
import * as A from "../state/actions.ts";
import { Icon } from "./icons.tsx";
import { Toasts } from "./components/common.tsx";
import { Dashboard } from "./views/Dashboard.tsx";
import { Analysis } from "./views/Analysis.tsx";
import { Movements } from "./views/Movements.tsx";
import { BudgetView } from "./views/Budget.tsx";
import { Accounts } from "./views/Accounts.tsx";
import { ImportView } from "./views/Import.tsx";
import { Rules } from "./views/Rules.tsx";
import { SettingsView } from "./views/Settings.tsx";

interface R { id: string; label: string; icon: string; title: string; sub?: string }
const ROUTES: R[] = [
  { id: "", label: "Panoramica", icon: "home", title: "Panoramica" },
  { id: "analisi", label: "Analisi", icon: "chart", title: "Analisi" },
  { id: "movimenti", label: "Movimenti", icon: "list", title: "Movimenti" },
  { id: "budget", label: "Budget", icon: "target", title: "Budget" },
  { id: "conti", label: "Conti", icon: "wallet", title: "Conti e patrimonio" },
  { id: "importa", label: "Importa", icon: "upload", title: "Importa e backup" },
  { id: "regole", label: "Regole", icon: "rules", title: "Regole" },
  { id: "impostazioni", label: "Impostazioni", icon: "settings", title: "Impostazioni" },
];
const MOBILE = ["", "analisi", "movimenti", "budget", "importa"];

const routeOf = () => location.hash.replace(/^#\/?/, "").split("?")[0];

function go(id: string) {
  const next = "#/" + id;
  if (location.hash === next) return;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => { location.hash = next; });
  else location.hash = next;
}

export function App() {
  const [, force] = useState(0);
  const [route, setRoute] = useState(routeOf());
  const [save, setSave] = useState<{ state: string; message?: string; at?: Date }>({ state: "saved" });
  useEffect(() => subscribe(() => force((x) => x + 1)), []);
  useEffect(() => onSave(setSave), []);
  useEffect(() => {
    const h = () => { setRoute(routeOf()); window.scrollTo({ top: 0 }); };
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  const s = getSnap(), st = s.settings;
  useEffect(() => {
    const root = document.documentElement;
    if (st.theme === "auto") delete root.dataset.theme; else root.dataset.theme = st.theme;
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
        </div>
      </nav>
      <main class="main" data-v={getVersion()}>
        <header class="topbar">
          <div>
            <h1>{r.title}</h1>
            {s.meta.demo && id === "" && <div class="sub">Dati dimostrativi · <a href="#/importa">importa i tuoi</a></div>}
          </div>
          <span class="spacer" />
          {review > 0 && id !== "movimenti" && <button class="chip" onClick={() => go("controllo")}><Icon name="alert" size={14} />{review} da controllare</button>}
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
      </nav>
      <Toasts />
    </div>
  );
}
