// Installazione dell'app sul dispositivo (app web installabile).
// Chrome, Edge e Samsung Internet offrono la finestra di installazione (evento beforeinstallprompt);
// su iPhone/iPad e su Safari per Mac si installa dal menu del browser: mostriamo i passaggi.
import { useEffect, useState } from "preact/hooks";
import { usePref } from "./common";

interface PromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let deferred: PromptEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
if (typeof window !== "undefined") {
  // l'evento può arrivare prima che l'interfaccia sia pronta: lo teniamo da parte
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; notify(); });
  addEventListener("appinstalled", () => { deferred = null; installed = true; notify(); });
}

export type InstallMode = "prompt" | "ios" | "mac" | null;

const standalone = () =>
  (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function detect(): InstallMode {
  if (installed || standalone()) return null;
  if (deferred) return "prompt";
  // senza https (es. file unico aperto dal computer) non si può installare
  if (location.protocol === "file:" || !isSecureContext) return null;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  const macSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|OPR/.test(ua);
  return macSafari ? "mac" : null;
}

export function useInstall() {
  const [mode, setMode] = useState<InstallMode>(detect);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const f = () => { setMode(detect()); if (installed) setDone(true); };
    subs.add(f);
    f();
    return () => { subs.delete(f); };
  }, []);
  /** Apre la finestra del browser; restituisce false se servono i passaggi manuali. */
  const install = async () => {
    if (!deferred) return false;
    const e = deferred;
    deferred = null;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") { installed = true; setDone(true); }
    notify();
    return true;
  };
  return { mode, install, done };
}

/** Passaggi per iPhone/iPad e Safari su Mac. */
function Steps({ mode, onClose }: { mode: "ios" | "mac"; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
  return (
    <div class="inst-back" onClick={onClose}>
      <div class="inst-dlg" role="dialog" aria-modal="true" aria-labelledby="inst-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="inst-t">Installa Trading Analytics</h2>
        {mode === "ios" ? (
          <ol>
            <li>Tocca il pulsante <b>Condividi</b> <span class="inst-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" /></svg></span> (in Safari è in basso su iPhone, in alto su iPad).</li>
            <li>Scorri e tocca <b>Aggiungi alla schermata Home</b>.</li>
            <li>Tocca <b>Aggiungi</b>: l'icona compare tra le tue app.</li>
          </ol>
        ) : (
          <ol>
            <li>Nella barra dei menu di Safari apri <b>File</b>.</li>
            <li>Scegli <b>Aggiungi al Dock</b> e conferma.</li>
          </ol>
        )}
        <p class="muted">Si apre a schermo intero come un'app, si aggiorna da sola e funziona anche senza connessione con gli ultimi dati scaricati.</p>
        <button type="button" class="btn primary" onClick={onClose} autoFocus>Ho capito</button>
      </div>
    </div>
  );
}

/** Pulsante per la barra laterale (visibile solo se l'installazione è possibile). */
export function InstallButton() {
  const { mode, install, done } = useInstall();
  const [steps, setSteps] = useState(false);
  if (done) return <p class="inst-ok" role="status">App installata ✓</p>;
  if (!mode) return null;
  return (
    <>
      <button type="button" class="btn inst-btn" onClick={async () => { if (!(await install())) setSteps(true); }}>
        <span aria-hidden="true">📲</span> Installa l'app
      </button>
      {steps && (mode === "ios" || mode === "mac") && <Steps mode={mode} onClose={() => setSteps(false)} />}
    </>
  );
}

const SNOOZE_DAYS = 30;

/** Avviso nella pagina principale: si chiude con "Non ora" e torna dopo 30 giorni. */
export function InstallBanner() {
  const { mode, install } = useInstall();
  const [later, setLater] = usePref<number>("installLater", 0);
  const [steps, setSteps] = useState(false);
  if (!mode || Date.now() - later < SNOOZE_DAYS * 86400000) return null;
  return (
    <div class="inst-banner" role="region" aria-label="Installa l'app">
      <span class="inst-ico-big" aria-hidden="true">📲</span>
      <div><b>Installa Trading Analytics</b><span class="muted">Si apre come un'app, con la sua icona, e funziona anche senza connessione.</span></div>
      <div class="inst-actions">
        <button type="button" class="btn primary" onClick={async () => { if (!(await install())) setSteps(true); }}>Installa</button>
        <button type="button" class="btn" onClick={() => setLater(Date.now())}>Non ora</button>
      </div>
      {steps && (mode === "ios" || mode === "mac") && <Steps mode={mode} onClose={() => setSteps(false)} />}
    </div>
  );
}
