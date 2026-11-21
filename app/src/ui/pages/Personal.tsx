import { useEffect, useState } from "preact/hooks";
import { extractPersonal, loadPersonal, supa, uploadPersonal, type Trade, type UserRow } from "../../data/personal";
import { Card } from "../components/common";
import { Login, useSession } from "../components/session";


export function Personal() {
  const session = useSession();
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
      {trades.length > 0 && <Card title="Registro trade"><p style="margin:0">Hai {trades.length} trade salvati. <a class="btn primary" href="#/registro">Apri il registro trade →</a></p></Card>}
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

