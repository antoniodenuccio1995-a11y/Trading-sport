// Sessione Supabase condivisa e modulo di accesso.
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "preact/hooks";
import { getSession, hasStoredSession, supa } from "../../data/personal";
import { Card } from "./common";

/** undefined = controllo in corso, null = non hai fatto l'accesso. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(hasStoredSession() ? undefined : null);
  useEffect(() => {
    let unsub = () => {};
    getSession().then(setSession).catch(() => setSession(null));
    supa().then((sb) => { const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s)); unsub = () => data.subscription.unsubscribe(); });
    return () => unsub();
  }, []);
  return session;
}

export function Login({ title = "Accedi" }: { title?: string }) {
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const act = async (kind: "in" | "up") => {
    setBusy(true); setMsg("");
    try {
      const auth = (await supa()).auth;
      const redirect = location.origin + location.pathname + "#/personale";
      if (kind === "in") { const { error } = await auth.signInWithPassword({ email, password: pw }); if (error) throw new Error(error.message === "Invalid login credentials" ? "Email o password non corretti." : error.message); }
      else if (kind === "up") { const { error } = await auth.signUp({ email, password: pw, options: { emailRedirectTo: redirect } }); if (error) throw error; setMsg("Registrazione inviata: conferma dal link che ricevi per email, poi accedi."); }
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card title={title}>
      <form class="row" style="max-width:520px" onSubmit={(e) => { e.preventDefault(); act("in"); }}>
        <input class="input" type="email" autocomplete="email" required placeholder="Email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        <input class="input" type="password" autocomplete="current-password" placeholder="Password (min. 6 caratteri)" value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
        <button class="btn primary" disabled={busy || !email || pw.length < 6}>Accedi</button>
        <button class="btn" type="button" disabled={busy || !email || pw.length < 6} onClick={() => act("up")}>Registrati</button>
      </form>
      {msg && <p class="note" role="status">{msg}</p>}
      <p class="note"><b>Hai già un account:</b> usa la stessa email e password dell'altra app che hai su questo progetto Supabase. "Registrati" serve solo per creare un account nuovo.</p>
      <p class="note">Le statistiche delle partite sono consultabili senza accesso. L'accesso serve solo per i tuoi dati personali, salvati su Supabase e protetti da regole che li rendono leggibili solo al tuo account.</p>
    </Card>
  );
}

