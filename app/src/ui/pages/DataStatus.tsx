import { useEffect, useState } from "preact/hooks";
import { APP_VERSION, SUPABASE_KEY, SUPABASE_URL } from "../../config";
import { leagueName, refreshStore } from "../../data/store";
import { played } from "../../data/types";
import { Card, useStore } from "../components/common";
import { href } from "../router";

interface Run { at: string; league: string | null; season: string | null; source: string; kind: string; ok: boolean; rows_in: number | null; inserted: number | null; updated: number | null; removed: number | null; message: string | null }

export function DataStatus() {
  const s = useStore();
  const [runs, setRuns] = useState<Run[] | null>(null);
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/ta_sync_runs?select=*&order=at.desc&limit=40`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => (r.ok ? r.json() : [])).then(setRuns).catch(() => setRuns([]));
  }, []);
  const review = [...s.teams.values()].filter((t) => t.status !== "ok");
  const perLeague = s.leagues.map((l) => {
    const ms = s.matches.filter((m) => m.lg === l.code);
    return { l, seasons: new Set(ms.map((m) => m.s)).size, played: ms.filter(played).length, upcoming: ms.filter((m) => !played(m)).length, ht: ms.filter((m) => played(m) && m.hh !== null).length };
  });
  return (
    <>
      <div class="page-head"><h1>Stato dei dati</h1><span class="spacer" /><button class="btn" type="button" disabled={s.syncing} onClick={() => refreshStore()}>{s.syncing ? "Controllo…" : "Controlla aggiornamenti"}</button></div>
      <div class="tiles">
        <div class="tile"><b>{s.matches.length.toLocaleString("it-IT")}</b><span>partite in archivio</span></div>
        <div class="tile"><b>{s.generatedAt ? new Date(s.generatedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—"}</b><span>ultima pubblicazione</span></div>
        <div class="tile"><b>{s.timings.firstData ?? "—"} ms</b><span>apertura dalla cache</span></div>
        <div class="tile"><b>{s.source === "cache" ? "cache locale" : s.source === "network" ? "rete" : "—"}</b><span>origine dati attuale</span></div>
      </div>
      <Card title="Copertura per campionato" flush>
        <div class="tw"><table class="t">
          <thead><tr><th class="l">Campionato</th><th>Stagioni</th><th>Giocate</th><th>Con 1° tempo</th><th>In programma</th></tr></thead>
          <tbody>{perLeague.map(({ l, seasons, played: p, upcoming, ht }) => <tr key={l.code}><td class="l"><a href={href(["lega", l.code])}>{l.name}</a></td><td>{seasons}</td><td>{p}</td><td>{p ? `${Math.round((ht / p) * 100)}%` : "—"}</td><td>{upcoming}</td></tr>)}</tbody>
        </table></div>
      </Card>
      <Card title={`Squadre da verificare (${review.length})`}>
        {review.length ? <ul>{review.map((t) => <li key={t.id}><a href={href(["squadra", t.id])}>{t.name}</a> <span class="muted">· {t.country} · {t.status === "nuova" ? "nome nuovo, non presente nello storico" : "possibile doppione o nome ambiguo"}</span></li>)}</ul>
          : <p class="muted">Nessuna: tutti i nomi delle fonti sono collegati a una squadra verificata.</p>}
        <p class="note">Una squadra "nuova" è normale per le neopromosse. Se è un doppione di una squadra esistente, va aggiunto un alias nel database (tabella ta_team_aliases).</p>
      </Card>
      <Card title="Ultime sincronizzazioni" flush>
        {runs === null ? <p class="empty">Caricamento…</p> : <div class="tw"><table class="t">
          <thead><tr><th class="l">Quando</th><th class="l">Campionato</th><th class="l">Stagione</th><th class="l">Fonte</th><th>Righe</th><th>Nuove</th><th>Aggiornate</th><th>Rimosse</th><th class="l">Esito</th></tr></thead>
          <tbody>{runs.map((r, i) => <tr key={i}><td class="l">{new Date(r.at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</td><td class="l">{r.league ? leagueName(r.league) : "—"}</td><td class="l">{r.season ?? "—"}</td>
            <td class="l">{r.source === "fd" ? "football-data" : r.source === "om" ? "Open Matchday" : r.source} · {r.kind === "results" ? "risultati" : r.kind === "fixtures" ? "calendario" : r.kind}</td>
            <td>{r.rows_in ?? "—"}</td><td>{r.inserted ?? "—"}</td><td>{r.updated ?? "—"}</td><td>{r.removed ?? "—"}</td><td class={`l ${r.ok ? "pos" : "neg"}`}>{r.ok ? "ok" : r.message}</td></tr>)}</tbody>
        </table></div>}
      </Card>
      <p class="note">Fonti: football-data.co.uk (storico, risultati e quote) e Open Matchday (stagione in corso, calendario, statistiche). Aggiornamento automatico ogni giorno tra le 7:30 e le 7:55 e tra le 18:30 e le 18:55 (ora italiana d’inverno). Versione app {APP_VERSION}.</p>
    </>
  );
}
