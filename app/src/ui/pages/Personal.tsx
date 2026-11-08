import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "preact/hooks";
import { extractPersonal, getSession, loadPersonal, supa, tradePL, uploadPersonal, type Trade, type UserRow } from "../../data/personal";
import { Card, fmtOdd } from "../components/common";

const eur = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")} €`;

export function Personal() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let unsub = () => {};
    getSession().then(setSession).catch(() => setSession(null));
    supa().then((sb) => { const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s)); unsub = () => data.subscription.unsubscribe(); });
    return () => unsub();
  }, []);
  if (session === undefined) return <Card><p class="empty">Controllo dell'accesso…</p></Card>;
  return (
    <>
      <div class="page-head"><h1>Area personale</h1><span class="sub">Trade, quote salvate e note: visibili solo a te.</span>
        {session && <><span class="spacer" /><span class="muted">{session.user.email}</span><button class="btn" type="button" onClick={async () => (await supa()).auth.signOut()}>Esci</button></>}
      </div>
      {session ? <Signed /> : <Login />}
    </>
  );
}

function Login() {
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const act = async (kind: "in" | "up" | "link") => {
    setBusy(true); setMsg("");
    try {
      const auth = (await supa()).auth;
      const redirect = location.origin + location.pathname + "#/personale";
      if (kind === "in") { const { error } = await auth.signInWithPassword({ email, password: pw }); if (error) throw error; }
      else if (kind === "up") { const { error } = await auth.signUp({ email, password: pw, options: { emailRedirectTo: redirect } }); if (error) throw error; setMsg("Registrazione inviata: conferma dal link che ricevi per email, poi accedi."); }
      else { const { error } = await auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }); if (error) throw error; setMsg("Ti ho inviato un link di accesso per email."); }
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card title="Accedi">
      <form class="row" style="max-width:520px" onSubmit={(e) => { e.preventDefault(); act("in"); }}>
        <input class="input" type="email" autocomplete="email" required placeholder="Email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        <input class="input" type="password" autocomplete="current-password" placeholder="Password (min. 6 caratteri)" value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
        <button class="btn primary" disabled={busy || !email || pw.length < 6}>Accedi</button>
        <button class="btn" type="button" disabled={busy || !email || pw.length < 6} onClick={() => act("up")}>Registrati</button>
        <button class="btn" type="button" disabled={busy || !email} onClick={() => act("link")}>Link via email</button>
      </form>
      {msg && <p class="note" role="status">{msg}</p>}
      <p class="note">Le statistiche delle partite sono consultabili senza accesso. L'accesso serve solo per i tuoi dati personali, salvati su Supabase e protetti da regole che li rendono leggibili solo al tuo account.</p>
    </Card>
  );
}

function Signed() {
  const [rows, setRows] = useState<UserRow[] | null>(null), [err, setErr] = useState("");
  const reload = () => loadPersonal().then(setRows).catch((e) => setErr((e as Error).message));
  useEffect(() => { reload(); }, []);
  const counts = new Map<string, number>();
  rows?.forEach((r) => counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1));
  const trades = (rows ?? []).filter((r) => r.kind === "trade").map((r) => r.value as Trade).sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id);
  return (
    <>
      {err && <div class="banner err">{err}</div>}
      <ImportBackup onDone={reload} />
      <Card title="Dati salvati">
        {rows === null ? <p class="muted">Caricamento…</p> : rows.length === 0 ? <p class="muted">Nessun dato personale ancora. Importa il backup della v0.3 qui sopra.</p> :
          <div class="tiles">{[...counts].map(([k, n]) => <div class="tile" key={k}><b>{n}</b><span>{LABELS[k] ?? k}</span></div>)}</div>}
      </Card>
      <Trades list={trades} />
    </>
  );
}

const LABELS: Record<string, string> = {
  trade: "trade", quote: "quote salvate", forecast: "previsioni registrate", context: "note di contesto", journal: "voci di diario",
  alias: "alias personali", settings: "impostazioni", manual: "partite manuali", strategy: "strategie", clubRule: "associazioni club", goalEvent: "eventi gol",
};

function ImportBackup({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<{ msg: string; busy: boolean }>({ msg: "", busy: false });
  const onFile = async (f?: File) => {
    if (!f) return;
    setState({ msg: `Lettura di ${f.name}…`, busy: true });
    try {
      const doc = JSON.parse(await f.text());
      const rows = extractPersonal(doc);
      if (!rows.length) throw new Error("Nel file non ci sono dati personali da importare.");
      await uploadPersonal(rows, (n) => setState({ msg: `Caricati ${n} di ${rows.length} elementi…`, busy: true }));
      setState({ msg: `Importazione completata: ${rows.length} elementi (trade, quote, previsioni…). Le partite non servono: arrivano già aggiornate dalle fonti.`, busy: false });
      onDone();
    } catch (e) { setState({ msg: `Importazione non riuscita: ${(e as Error).message}`, busy: false }); }
  };
  return (
    <Card title="Importa il backup della v0.3">
      <p class="muted" style="margin-top:0">Seleziona il file <code>backup_trading_analytics_….json</code>. Vengono letti solo trade, quote, previsioni, note, strategie e partite manuali; le partite dell'archivio sono già presenti e più complete. Puoi ripetere l'import: gli elementi con lo stesso identificativo vengono aggiornati, non duplicati.</p>
      <input type="file" accept=".json,application/json" disabled={state.busy} onChange={(e) => onFile((e.target as HTMLInputElement).files?.[0])} />
      {state.msg && <p class="note" role="status">{state.msg}</p>}
    </Card>
  );
}

function Trades({ list }: { list: Trade[] }) {
  if (!list.length) return null;
  const closed = list.filter((t) => tradePL(t) !== null);
  const pl = closed.reduce((s, t) => s + tradePL(t)!, 0), stake = closed.reduce((s, t) => s + (t.side === "lay" ? t.s * (t.q - 1) : t.s), 0);
  const won = closed.filter((t) => t.res === "won").length;
  return (
    <Card title="Registro trade" flush>
      <div class="tiles" style="padding:12px 14px 0">
        <div class="tile"><b>{list.length}</b><span>trade ({list.length - closed.length} aperti)</span></div>
        <div class="tile"><b class={pl >= 0 ? "pos" : "neg"}>{eur(pl)}</b><span>profitto netto</span></div>
        <div class="tile"><b>{stake ? `${((pl / stake) * 100).toFixed(1)}%` : "—"}</b><span>rendimento sul rischio</span></div>
        <div class="tile"><b>{closed.length ? `${Math.round((won / closed.length) * 100)}%` : "—"}</b><span>trade vinti</span></div>
      </div>
      <div class="tw"><table class="t">
        <thead><tr><th class="l">Data</th><th class="l">Campionato</th><th class="l">Partita</th><th class="l">Mercato</th><th class="l">Lato</th><th>Quota</th><th>Stake</th><th class="l">Esito</th><th>P/L</th><th class="l">Note</th></tr></thead>
        <tbody>{list.map((t) => { const p = tradePL(t); return (
          <tr key={t.id}><td class="l">{t.d}</td><td class="l">{t.lg}</td><td class="l">{t.m}</td><td class="l">{t.mk}</td><td class="l">{t.side}</td>
            <td>{fmtOdd(t.q)}</td><td>{t.s}</td><td class="l">{RES[t.res] ?? t.res}</td>
            <td class={p === null ? "muted" : p >= 0 ? "pos" : "neg"}>{p === null ? "aperto" : eur(p)}</td><td class="l muted">{t.st ?? ""}</td></tr>); })}
        </tbody></table></div>
      <p class="note" style="padding:0 14px 12px">Sola lettura in questa versione: inserimento e chiusura dei trade arriveranno nella prossima fase.</p>
    </Card>
  );
}
const RES: Record<string, string> = { won: "vinto", lost: "perso", void: "annullato", open: "aperto", exit: "chiuso in anticipo" };
