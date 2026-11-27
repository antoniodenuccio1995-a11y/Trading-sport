import { useEffect, useRef, useState } from "preact/hooks";
import { loadEngine, openSyncDialog, registerSyncDialog, useSync } from "../../sync/facade.ts";
import type { SyncState } from "../../sync/engine.ts";
import { Dialog, toast } from "./common.tsx";
import { Icon } from "../icons.tsx";

const EMAIL_KEY = "fp4.email";
const lastEmail = () => { try { return localStorage.getItem(EMAIL_KEY) ?? ""; } catch { return ""; } };
const time = (d?: Date) => (d ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "");

/** Stato della sincronizzazione in una riga (barra laterale) o come icona (barra in alto). */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const s = useSync();
  const tone = s.status === "ok" ? "ok" : s.status === "syncing" || s.status === "connecting" ? "busy" : s.status === "error" ? "err" : s.status === "offline" || s.status === "paused" ? "warn" : "off";
  const text = s.status === "off" ? "Sincronizza i dispositivi" : s.status === "ok" ? `Cloud aggiornato ${time(s.lastSync)}` : s.status === "syncing" || s.status === "connecting" ? (s.message ?? "Sincronizzazione…")
    : s.status === "offline" ? "Offline: sincronizzo al ritorno della rete" : s.status === "paused" ? "Sincronizzazione in pausa" : s.status === "error" ? "Errore di sincronizzazione" : "Serve una tua scelta";
  if (compact) return (
    <button class={"icon-btn cloud " + tone} onClick={openSyncDialog} aria-label={text} title={text}><CloudIcon tone={tone} /></button>
  );
  return (
    <button class={"cloud-line " + tone} onClick={openSyncDialog} title={s.message ?? text}>
      <CloudIcon tone={tone} /><span>{text}</span>
    </button>
  );
}

function CloudIcon({ tone }: { tone: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={"cloud-ico " + tone}>
      <path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.4 9.1 4.5 4.5 0 0 0 7 18z" />
      {tone === "ok" && <path d="M9.5 13.5l2 2 3.5-3.5" class="ck" />}
      {tone === "busy" && <path d="M12 10v5M9.8 12.8 12 15l2.2-2.2" class="ar" />}
      {tone === "err" && <path d="M12 11v2.5M12 15.5h.01" />}
    </svg>
  );
}

/** Finestra di accesso e di stato: email → codice a 6 cifre (o password) → collegato. */
export function SyncDialogHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => registerSyncDialog(() => { setOpen(true); void loadEngine(); }), []);
  return open ? <SyncDialog onClose={() => setOpen(false)} /> : null;
}

function SyncDialog({ onClose }: { onClose: () => void }) {
  const s = useSync();
  const [flow, setFlow] = useState<"login" | "account">(s.status === "off" ? "login" : "account");
  useEffect(() => { if (s.status === "off") setFlow("login"); }, [s.status]);
  const loggedIn = flow === "account";
  return (
    <Dialog onClose={onClose} label="Sincronizzazione">
      <div class="row between" style={{ marginBottom: "6px" }}>
        <h2 style={{ margin: 0, fontSize: "17px" }}>{loggedIn ? "Sincronizzazione" : "Accedi per sincronizzare"}</h2>
        <button class="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" /></button>
      </div>
      {loggedIn ? <Account s={s} onClose={onClose} /> : <Login onDone={() => setFlow("account")} />}
    </Dialog>
  );
}

function Account({ s, onClose }: { s: SyncState; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div class="stack" style={{ gap: "14px" }}>
      <div class="sync-hero">
        <CloudIcon tone={s.status === "ok" ? "ok" : s.status === "error" ? "err" : "busy"} />
        <div>
          <b>{s.email}</b>
          <div class="faint" style={{ fontSize: "12.5px" }}>{s.status === "ok" ? `Tutto aggiornato alle ${time(s.lastSync)}` : s.message ?? "Sincronizzazione in corso…"}</div>
        </div>
      </div>
      <p class="muted" style={{ margin: 0, fontSize: "13px", lineHeight: 1.55 }}>
        I dati restano su questo dispositivo e vengono copiati sul tuo spazio Supabase: si aggiornano da soli quando modifichi qualcosa, quando torni sull'app e ogni minuto mentre è aperta. Senza rete continui a lavorare e la copia riparte al ritorno della connessione.
      </p>
      <div class="row wrap" style={{ gap: "8px", justifyContent: "flex-end" }}>
        <button class="btn" disabled={busy} onClick={async () => { setBusy(true); try { await (await loadEngine()).syncNow(); toast("Sincronizzato"); } finally { setBusy(false); } }}><Icon name="repeat" />Sincronizza ora</button>
        <button class="btn ghost" onClick={async () => { await (await loadEngine()).signOut(); toast("Disconnesso: i dati restano su questo dispositivo"); onClose(); }}>Esci</button>
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(lastEmail());
  const [step, setStep] = useState<"email" | "code" | "password" | "done">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState("");
  const [wait, setWait] = useState(0);
  useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const send = async () => {
    setBusy(true); setErr("");
    try { await (await loadEngine()).sendCode(email); try { localStorage.setItem(EMAIL_KEY, email.trim()); } catch { /* ignora */ } setStep("code"); setWait(60); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (step !== "done") return; const t = setTimeout(onDone, 1700); return () => clearTimeout(t); }, [step]);
  if (step === "done") return <Success />;
  if (step === "code") return (
    <div class="stack" style={{ gap: "14px" }}>
      <div class="mail-anim" aria-hidden="true"><span class="env">✉️</span></div>
      <p style={{ margin: 0, textAlign: "center" }}>Ti ho mandato un codice a <b>{email}</b>.<br /><span class="faint" style={{ fontSize: "12.5px" }}>Aprilo dal telefono e scrivilo qui sotto.</span></p>
      <Otp onComplete={async (code) => { await (await loadEngine()).verifyCode(email, code); setStep("done"); }} />
      <div class="row between" style={{ fontSize: "12.5px" }}>
        <button class="btn sm ghost" onClick={() => { setStep("email"); setErr(""); }}>Cambia email</button>
        <button class="btn sm ghost" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Nuovo codice tra ${wait} s` : "Mandami un nuovo codice"}</button>
      </div>
      {err && <p class="bad" style={{ margin: 0, fontSize: "13px" }}>{err}</p>}
    </div>
  );
  if (step === "password") return (
    <form class="stack" style={{ gap: "12px" }} onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try { await (await loadEngine()).signInPassword(email, pw); try { localStorage.setItem(EMAIL_KEY, email.trim()); } catch { /* ignora */ } setStep("done"); }
      catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
    }}>
      <label class="field">Email<input id="sync-email" class="input" type="email" autocomplete="email" required value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></label>
      <label class="field">Password<input id="sync-pw" class="input" type="password" autocomplete="current-password" required value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} /></label>
      {err && <p class="bad" style={{ margin: 0, fontSize: "13px" }}>{err}</p>}
      <div class="row between"><button type="button" class="btn sm ghost" onClick={() => setStep("email")}>Usa il codice via email</button>
        <button class="btn primary" disabled={busy || !email || pw.length < 6}>{busy ? "Accesso…" : "Accedi"}</button></div>
    </form>
  );
  return (
    <form class="stack" style={{ gap: "12px" }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <p class="muted" style={{ margin: 0, fontSize: "13px", lineHeight: 1.55 }}>Usa lo stesso account di Trading Analytics. Ti arriva un codice di 6 cifre per email: niente password da ricordare.</p>
      <label class="field">Email<input id="sync-email" class="input" type="email" autocomplete="email" required placeholder="nome@esempio.it" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></label>
      {err && <p class="bad" style={{ margin: 0, fontSize: "13px" }}>{err}</p>}
      <div class="row between wrap" style={{ gap: "8px" }}>
        <button type="button" class="btn sm ghost" onClick={() => setStep("password")}>Accedi con la password</button>
        <button class="btn primary" disabled={busy || !/\S+@\S+\.\S+/.test(email)}>{busy ? <span class="spin" /> : <Icon name="bolt" />}Mandami il codice</button>
      </div>
    </form>
  );
}

/** Sei caselle per il codice: avanzano da sole, accettano l'incolla e il riempimento automatico, vibrano se il codice è sbagliato. */
function Otp({ onComplete }: { onComplete: (code: string) => Promise<void> }) {
  const [d, setD] = useState<string[]>(["", "", "", "", "", ""]);
  const [state, setState] = useState<"" | "busy" | "bad" | "ok">("");
  const [err, setErr] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const submit = async (code: string) => {
    setState("busy"); setErr("");
    try { await onComplete(code); setState("ok"); }
    catch (e) {
      setErr((e as Error).message); setState("bad");
      setTimeout(() => { setState(""); setD(["", "", "", "", "", ""]); refs.current[0]?.focus(); }, 650);
    }
  };
  const fill = (start: number, text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6 - start).split("");
    if (!digits.length) return;
    const next = [...d];
    digits.forEach((x, k) => { next[start + k] = x; });
    setD(next);
    const filled = next.join("");
    if (filled.length === 6 && !next.includes("")) void submit(filled);
    else refs.current[Math.min(5, start + digits.length)]?.focus();
  };
  return (
    <div>
      <div class={"otp " + state} role="group" aria-label="Codice di accesso">
        {d.map((v, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} class={v ? "filled" : ""} style={{ ["--i" as string]: i }}
            inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={i === 0 ? 6 : 1} value={v} disabled={state === "busy" || state === "ok"}
            aria-label={`Cifra ${i + 1}`}
            onInput={(e) => { const t = (e.target as HTMLInputElement).value; if (t.length > 1) fill(i, t); else if (/\d/.test(t)) fill(i, t); else { const n = [...d]; n[i] = ""; setD(n); } }}
            onPaste={(e) => { e.preventDefault(); fill(i, e.clipboardData?.getData("text") ?? ""); }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !d[i] && i > 0) { const n = [...d]; n[i - 1] = ""; setD(n); refs.current[i - 1]?.focus(); }
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
            }} />
        ))}
      </div>
      <p class="otp-msg" aria-live="polite">{state === "busy" ? "Verifico…" : err}</p>
    </div>
  );
}

function Success() {
  return (
    <div class="success" role="status">
      <svg viewBox="0 0 64 64" width="84" height="84" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="none" stroke="var(--good)" stroke-width="4" pathLength={1} class="draw" />
        <path d="M20 33l8 8 16-17" fill="none" stroke="var(--good)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength={1} class="draw d2" />
      </svg>
      <b>Accesso eseguito</b>
      <span class="faint">Collego i tuoi dati al cloud…</span>
    </div>
  );
}

/** Domande del motore: primo collegamento con dati da entrambe le parti, o molte cancellazioni da inviare. */
export function SyncPrompts() {
  const s = useSync();
  const answer = async (v: boolean | "merge" | "cloud" | "device") => (await loadEngine()).answer(v);
  if (s.status === "link-choice" && s.counts) return (
    <Dialog onClose={() => void answer("merge")} label="Primo collegamento">
      <h2 style={{ marginTop: 0, fontSize: "17px" }}>Ci sono dati sia qui che nel cloud</h2>
      <p class="muted" style={{ fontSize: "13.5px", lineHeight: 1.55 }}>Su questo dispositivo ci sono <b>{s.counts.local}</b> movimenti, nel cloud <b>{s.counts.remote}</b> righe. Come vuoi procedere?</p>
      <div class="stack" style={{ gap: "8px" }}>
        <button class="btn primary" onClick={() => void answer("merge")}>Unisci (consigliato): tiene tutto, a parità di movimento vince il cloud</button>
        <button class="btn" onClick={() => void answer("cloud")}>Usa solo i dati del cloud</button>
        <button class="btn" onClick={() => void answer("device")}>Usa solo i dati di questo dispositivo</button>
      </div>
    </Dialog>
  );
  if (s.status === "confirm-delete") return (
    <Dialog onClose={() => void answer(false)} label="Conferma cancellazione">
      <h2 style={{ marginTop: 0, fontSize: "17px" }}>Cancellare {s.pendingDeletes} elementi anche dal cloud?</h2>
      <p class="muted" style={{ fontSize: "13.5px", lineHeight: 1.55 }}>Su questo dispositivo mancano molti dati che il cloud ha ancora (ad esempio dopo «Azzera tutto» o un backup caricato). Se confermi spariscono anche dagli altri dispositivi.</p>
      <div class="row wrap" style={{ gap: "8px", justifyContent: "flex-end" }}>
        <button class="btn" onClick={() => void answer(false)}>No, recupera i dati dal cloud</button>
        <button class="btn danger" onClick={() => void answer(true)}>Sì, cancella anche nel cloud</button>
      </div>
    </Dialog>
  );
  return null;
}
