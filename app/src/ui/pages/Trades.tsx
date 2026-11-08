// Registro trade: riservato a chi ha fatto l'accesso (dati nel proprio account Supabase).
import { useEffect, useMemo, useState } from "preact/hooks";
import { dateShort, dayToIso, todayDay } from "../../data/dates";
import { tradePL } from "../../data/personal";
import { getStore, leagueName, teamName } from "../../data/store";
import {
  DEFAULT_SETTINGS, MARKETS, archiveClosing, clv, deleteTrade, enrich, loadTrades, marketLabel, risk, saveSettings, saveTrade,
  suggestedResult, summarize, tradesCsv, type Trade, type TradeSettings,
} from "../../data/trades";
import { played } from "../../data/types";
import { TeamBadge } from "../components/badge";
import { useChartWidth } from "../components/charts";
import { Card, Seg, fmtOdd, usePref } from "../components/common";
import { Login, useSession } from "../components/session";
import { href } from "../router";

/** Percentuale con la virgola (0.123 → "12,3%"). */
const pc = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
export const eur = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")} €`;
const RES: Record<string, string> = { open: "Aperto", won: "Vinto", lost: "Perso", void: "Annullato", exit: "Chiuso in anticipo" };

export function TradesPage() {
  const session = useSession();
  return (
    <>
      <div class="page-head"><h1>Registro trade</h1><span class="sub">Le tue operazioni, salvate nel tuo account.</span></div>
      {session === undefined ? <Card><p class="empty">Controllo dell'accesso…</p></Card>
        : session === null ? <Login title="Accedi per aprire il registro trade" /> : <Register />}
    </>
  );
}

type Filter = "all" | "open" | "closed";

function Register() {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [set, setSet] = useState<TradeSettings>(DEFAULT_SETTINGS);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<Trade | null>(null);
  const [showSet, setShowSet] = useState(false);
  const [filter, setFilter] = usePref<Filter>("trades.filter", "all");
  const [lg, setLg] = useState(""), [mk, setMk] = useState(""), [q, setQ] = useState("");
  const store = getStore();

  const reload = () => loadTrades().then((r) => { setTrades(r.trades.map(enrich)); setSet(r.settings); }).catch((e) => setErr((e as Error).message));
  useEffect(() => { reload(); }, []);
  const persist = async (t: Trade) => {
    try { const v = await saveTrade(t); setTrades((l) => [...(l ?? []).filter((x) => x.id !== v.id), v]); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  };
  const remove = async (t: Trade) => {
    if (!confirm(`Eliminare il trade ${t.m} · ${t.mk}?`)) return;
    try { await deleteTrade(t.id); setTrades((l) => (l ?? []).filter((x) => x.id !== t.id)); } catch (e) { setErr((e as Error).message); }
  };

  const all = useMemo(() => [...(trades ?? [])].sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id), [trades]);
  const shown = all.filter((t) => (filter === "all" || (filter === "open" ? tradePL(t) === null : tradePL(t) !== null))
    && (!lg || t.lg === lg) && (!mk || (t.mkey ?? t.mk) === mk) && (!q || `${t.m} ${t.mk} ${t.n ?? ""} ${t.st ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const sum = summarize(shown.filter((t) => !t.sim)), sim = summarize(shown.filter((t) => t.sim));
  const toClose = all.filter((t) => tradePL(t) === null && suggestedResult(t));
  const today = dayToIso(todayDay());
  const todayPL = all.filter((t) => t.d === today && !t.sim).reduce((s, t) => s + (tradePL(t) ?? 0), 0);
  const stop = todayPL <= -(set.cap * set.dl) / 100;
  const leagues = [...new Set(all.map((t) => t.lg))].sort();
  const download = () => {
    const blob = new Blob(["﻿" + tradesCsv(shown)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `registro_trade_${today}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (trades === null) return <Card><p class="empty">{err || "Caricamento del registro…"}</p></Card>;
  return (
    <>
      {err && <div class="banner err">{err}</div>}
      <div class="row" style="margin-bottom:12px">
        <button class="btn primary" type="button" onClick={() => setEdit(newTrade(set))}>＋ Nuovo trade</button>
        <button class="btn" type="button" onClick={() => setShowSet(!showSet)}>Capitale e limiti</button>
        <button class="btn" type="button" disabled={!shown.length} onClick={download}>Esporta CSV</button>
        <span class="spacer" />
        <span class="muted">Aggiungi un trade anche dall'analisi partita, scheda "Panoramica e mercato".</span>
      </div>
      {showSet && <Settings value={set} onSave={async (v) => { try { await saveSettings(v); setSet(v); setShowSet(false); } catch (e) { setErr((e as Error).message); } }} />}
      {edit && <TradeForm value={edit} onCancel={() => setEdit(null)} onSave={async (t) => { await persist(t); setEdit(null); }} />}
      {stop && <div class="banner err"><b>Limite di perdita giornaliero raggiunto:</b> oggi {eur(todayPL)} su un limite del {set.dl}% del capitale ({eur(-(set.cap * set.dl) / 100)}). Fermati per oggi.</div>}

      <div class="tiles">
        <div class="tile accent"><b>{(set.cap + summarize(all.filter((t) => !t.sim)).pl).toFixed(2).replace(".", ",")} €</b><span>capitale attuale (iniziale {set.cap} €)</span></div>
        <div class="tile"><b class={sum.pl >= 0 ? "pos" : "neg"}>{eur(sum.pl)}</b><span>profitto netto{shown.length !== all.length ? " (filtrati)" : ""}</span></div>
        <div class="tile"><b>{sum.risk ? pc(sum.pl / sum.risk) : "—"}</b><span>rendimento sul rischio</span></div>
        <div class="tile"><b>{sum.closed ? `${Math.round((sum.won / sum.closed) * 100)}%` : "—"}</b><span>trade vinti ({sum.won} su {sum.closed})</span></div>
        <div class="tile"><b class={sum.clvAvg === null ? "" : sum.clvAvg >= 0 ? "pos" : "neg"}>{sum.clvAvg === null ? "—" : `${sum.clvAvg >= 0 ? "+" : ""}${pc(sum.clvAvg)}`}</b><span>CLV medio ({sum.clvN} trade)</span></div>
        <div class="tile"><b>{((set.cap * set.pct) / 100).toFixed(2).replace(".", ",")} €</b><span>stake consigliato ({set.pct}% del capitale)</span></div>
      </div>
      {sim.n > 0 && <p class="muted" style="margin-top:-6px">Simulati (esclusi dai totali): {sim.n} trade, {eur(sim.pl)}.</p>}

      {toClose.length > 0 && (
        <Card title={`Da chiudere: ${toClose.length} partite finite`}>
          {toClose.map((t) => {
            const r = suggestedResult(t)!, m = store.byId.get(t.mid!)!;
            return (
              <div class="snap" key={t.id}>
                <b>{t.m}</b><span class="muted">{marketLabel(t.mkey, t.mk)} · {t.side} {fmtOdd(t.q)} · finale {m.fh}–{m.fa}{m.hh !== null ? ` (1T ${m.hh}–${m.ha})` : ""}</span>
                <span class="spacer" />
                <button type="button" class={`btn ${r === "won" ? "primary" : ""}`} onClick={() => persist({ ...t, res: r, cl: t.cl ?? archiveClosing(t) })}>Chiudi come {r === "won" ? "vinto" : "perso"} ({eur(tradePL({ ...t, res: r })!)})</button>
              </div>
            );
          })}
          <p class="note">Esito calcolato dal risultato in archivio; la quota di chiusura, se manca, viene presa dall'archivio (Betfair Exchange o media bookmaker).</p>
        </Card>
      )}

      <Card title="Profitto cumulato"><PLChart list={all.filter((t) => !t.sim)} /></Card>

      <Card flush title={`Operazioni (${shown.length})`} right={<Seg<Filter> label="Stato" value={filter} onChange={setFilter} options={[["all", "Tutti"], ["open", "Aperti"], ["closed", "Chiusi"]]} />}>
        <div class="row" style="padding:10px 14px 0">
          <select class="input" value={lg} onChange={(e) => setLg((e.target as HTMLSelectElement).value)} aria-label="Campionato"><option value="">Tutti i campionati</option>{leagues.map((x) => <option key={x}>{x}</option>)}</select>
          <select class="input" value={mk} onChange={(e) => setMk((e.target as HTMLSelectElement).value)} aria-label="Mercato"><option value="">Tutti i mercati</option>{MARKETS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
          <input class="input" style="max-width:240px" placeholder="Cerca squadra o nota" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        </div>
        {shown.length ? <div class="tw"><table class="t">
          <thead><tr><th class="l">Data</th><th class="l">Partita</th><th class="l">Mercato</th><th class="l">Lato</th><th>Quota</th><th>Stake</th><th>Chiusura</th><th>CLV</th><th class="l">Esito</th><th>P/L</th><th></th></tr></thead>
          <tbody>{shown.map((t) => {
            const p = tradePL(t), c = clv(t), m = t.mid ? store.byId.get(t.mid) : undefined;
            return (
              <tr key={t.id} class={t.sim ? "sim" : ""}>
                <td class="l">{t.d.split("-").reverse().join("/")}</td>
                <td class="l">{m ? <a class="team-link" href={href(["partita", m.id])}><TeamBadge id={m.h} size={16} /><TeamBadge id={m.a} size={16} /><span>{teamName(m.h)} – {teamName(m.a)}</span></a> : t.m}
                  <div class="muted" style="font-size:11px">{m ? leagueName(m.lg) : t.lg}{t.sim ? " · simulato" : ""}{t.n || t.st ? ` · ${t.n || t.st}` : ""}</div></td>
                <td class="l">{marketLabel(t.mkey, t.mk)}</td>
                <td class="l"><span class={`pill ${t.side === "lay" ? "lay" : "back"}`}>{t.side}</span></td>
                <td>{fmtOdd(t.q)}</td><td>{Number(t.s).toFixed(2).replace(".", ",")}</td><td>{fmtOdd(t.cl ?? null)}</td>
                <td class={c === null ? "" : c >= 0 ? "pos" : "neg"}>{c === null ? "—" : `${c >= 0 ? "+" : ""}${pc(c)}`}</td>
                <td class="l">
                  <select class="input slim" value={t.res} onChange={(e) => persist({ ...t, res: (e.target as HTMLSelectElement).value, exitpl: (e.target as HTMLSelectElement).value === "exit" ? (t.exitpl ?? 0) : t.exitpl })} aria-label="Esito">
                    {Object.entries(RES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td class={p === null ? "muted" : p >= 0 ? "pos" : "neg"}><b>{p === null ? "aperto" : eur(p)}</b></td>
                <td class="nowrap"><button class="mini-btn" type="button" onClick={() => setEdit(t)} aria-label="Modifica">✎</button> <button class="mini-btn" type="button" onClick={() => remove(t)} aria-label="Elimina">🗑</button></td>
              </tr>
            );
          })}</tbody>
        </table></div> : <p class="empty">Nessun trade{all.length ? " con questi filtri" : ": aggiungine uno con “Nuovo trade” o dall'analisi di una partita"}.</p>}
      </Card>
      {all.length > 0 && <Breakdown list={all.filter((t) => !t.sim)} />}
    </>
  );
}

export function newTrade(set: TradeSettings, base: Partial<Trade> = {}): Trade {
  return { id: Date.now(), d: dayToIso(todayDay()), lg: "", m: "", mk: "", side: "back", q: 2, s: Math.round(set.cap * set.pct) / 100, comm: 5, res: "open", exitpl: null, cl: null, ...base };
}

/** Modulo nuovo trade / modifica. Si può collegare una partita dell'archivio. */
export function TradeForm({ value, onSave, onCancel, isNew }: { value: Trade; onSave: (t: Trade) => void | Promise<void>; onCancel: () => void; isNew?: boolean }) {
  const [t, setT] = useState<Trade>(value);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const store = getStore();
  const m = t.mid ? store.byId.get(t.mid) : undefined;
  const upd = (p: Partial<Trade>) => setT({ ...t, ...p });
  const hits = useMemo(() => {
    const n = search.trim().toLowerCase();
    if (n.length < 3) return [];
    const from = todayDay() - 21, to = todayDay() + 21;
    return store.matches.filter((x) => x.d >= from && x.d <= to && `${teamName(x.h)} ${teamName(x.a)}`.toLowerCase().includes(n)).slice(0, 8);
  }, [search]);
  const link = (id: number) => {
    const x = store.byId.get(id)!;
    upd({ mid: x.id, d: dayToIso(x.d), lg: leagueName(x.lg), m: `${teamName(x.h)} – ${teamName(x.a)}` });
    setSearch("");
  };
  const num = (s: string) => Number(s.replace(",", "."));
  const pl = tradePL(t);
  return (
    <Card title={isNew ?? !value.m ? "Nuovo trade" : "Modifica trade"}>
      <div class="form-grid">
        <label class="span2">Partita
          {m ? <div class="row"><span class="team-link"><TeamBadge id={m.h} /><TeamBadge id={m.a} /><b>{teamName(m.h)} – {teamName(m.a)}</b></span><span class="muted">{dateShort(m.d)} · {leagueName(m.lg)}{played(m) ? ` · ${m.fh}–${m.fa}` : ""}</span><button type="button" class="mini-btn" onClick={() => upd({ mid: undefined })}>cambia</button></div>
            : <div class="search" style="max-width:none">
              <input class="input" placeholder="Cerca la partita (es. Inter) oppure scrivi il nome qui sotto" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
              {hits.length > 0 && <ul>{hits.map((x) => <li key={x.id}><a href="javascript:void 0" onClick={() => link(x.id)}><span>{teamName(x.h)} – {teamName(x.a)}</span><span class="muted">{dateShort(x.d)} · {leagueName(x.lg)}</span></a></li>)}</ul>}
              <input class="input" style="margin-top:6px" placeholder="Partita (testo libero)" value={t.m} onInput={(e) => upd({ m: (e.target as HTMLInputElement).value })} />
            </div>}
        </label>
        <label>Data<input class="input" type="date" value={t.d} onInput={(e) => upd({ d: (e.target as HTMLInputElement).value })} /></label>
        <label>Campionato<input class="input" value={t.lg} onInput={(e) => upd({ lg: (e.target as HTMLInputElement).value })} /></label>
        <label>Mercato
          <select class="input" value={t.mkey ?? ""} onChange={(e) => { const k = (e.target as HTMLSelectElement).value; upd({ mkey: k || undefined, mk: k ? marketLabel(k) : t.mk }); }}>
            <option value="">Altro (scrivi sotto)</option>{MARKETS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          {!t.mkey && <input class="input" style="margin-top:6px" placeholder="Descrizione mercato" value={t.mk} onInput={(e) => upd({ mk: (e.target as HTMLInputElement).value })} />}
        </label>
        <label>Lato<Seg<"back" | "lay"> label="Lato" value={t.side} onChange={(v) => upd({ side: v })} options={[["back", "Back (punta)"], ["lay", "Lay (banca)"]]} /></label>
        <label>Quota<input class="input" inputMode="decimal" value={String(t.q)} onInput={(e) => upd({ q: num((e.target as HTMLInputElement).value) })} /></label>
        <label>Stake (€){t.side === "lay" && <small class="muted"> · rischio {(risk(t) || 0).toFixed(2).replace(".", ",")} €</small>}<input class="input" inputMode="decimal" value={String(t.s)} onInput={(e) => upd({ s: num((e.target as HTMLInputElement).value) })} /></label>
        <label>Commissione %<input class="input" inputMode="decimal" value={String(t.comm)} onInput={(e) => upd({ comm: num((e.target as HTMLInputElement).value) })} /></label>
        <label>Esito<select class="input" value={t.res} onChange={(e) => upd({ res: (e.target as HTMLSelectElement).value })}>{Object.entries(RES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {t.res === "exit" && <label>P/L chiusura anticipata (€)<input class="input" inputMode="decimal" value={String(t.exitpl ?? 0)} onInput={(e) => upd({ exitpl: num((e.target as HTMLInputElement).value) })} /></label>}
        <label>Quota di chiusura<input class="input" inputMode="decimal" placeholder="per il CLV" value={t.cl ? String(t.cl) : ""} onInput={(e) => upd({ cl: num((e.target as HTMLInputElement).value) || null })} /></label>
        <label class="span2">Note / strategia<input class="input" value={t.n ?? ""} onInput={(e) => upd({ n: (e.target as HTMLInputElement).value })} /></label>
        <label class="check"><input type="checkbox" checked={!!t.sim} onChange={(e) => upd({ sim: (e.target as HTMLInputElement).checked ? 1 : 0 })} /> Trade simulato (prova, escluso dai totali)</label>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" type="button" disabled={busy || !t.m || !(t.q > 1) || !(t.s > 0)} onClick={async () => { setBusy(true); await onSave({ ...t, mk: t.mk || marketLabel(t.mkey) }); setBusy(false); }}>Salva</button>
        <button class="btn" type="button" onClick={onCancel}>Annulla</button>
        {pl !== null && <span class={pl >= 0 ? "pos" : "neg"}>Risultato: {eur(pl)}</span>}
      </div>
    </Card>
  );
}

function Settings({ value, onSave }: { value: TradeSettings; onSave: (v: TradeSettings) => void }) {
  const [v, setV] = useState(value);
  const n = (s: string) => Math.max(0, Number(s.replace(",", ".")) || 0);
  return (
    <Card title="Capitale e limiti">
      <div class="form-grid">
        <label>Capitale iniziale (€)<input class="input" inputMode="decimal" value={String(v.cap)} onInput={(e) => setV({ ...v, cap: n((e.target as HTMLInputElement).value) })} /></label>
        <label>Stake per trade (% del capitale)<input class="input" inputMode="decimal" value={String(v.pct)} onInput={(e) => setV({ ...v, pct: n((e.target as HTMLInputElement).value) })} /></label>
        <label>Limite di perdita giornaliero (% del capitale)<input class="input" inputMode="decimal" value={String(v.dl)} onInput={(e) => setV({ ...v, dl: n((e.target as HTMLInputElement).value) })} /></label>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn primary" type="button" onClick={() => onSave(v)}>Salva impostazioni</button></div>
    </Card>
  );
}

function PLChart({ list }: { list: Trade[] }) {
  const [box, W] = useChartWidth(1200);
  const closed = list.filter((t) => tradePL(t) !== null).sort((a, b) => a.d.localeCompare(b.d) || a.id - b.id);
  if (closed.length < 2) return <p class="muted">Il grafico compare dopo almeno due trade chiusi.</p>;
  let acc = 0;
  const pts = closed.map((t) => (acc += tradePL(t)!));
  const H = 200, m = { l: 58, r: 12, t: 10, b: 24 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
  const X = (i: number) => m.l + (iw * i) / (pts.length - 1), Y = (v: number) => m.t + ((hi - v) / span) * ih;
  const line = pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = `${X(0)},${Y(0)} ${line} ${X(pts.length - 1)},${Y(0)}`;
  const last = pts[pts.length - 1];
  return (
    <div ref={box} class="chart-box">
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Profitto cumulato ${eur(last)}`}>
      {[hi, (hi + lo) / 2, lo].map((v, i) => <g key={i}><line x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} class="grid" /><text x={m.l - 6} y={Y(v) + 4} text-anchor="end" class="tick">{(Math.abs(v) < 0.005 ? 0 : v).toFixed(span < 20 ? 2 : 0).replace(".", ",")} €</text></g>)}
      <line x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} class="axis" />
      <polygon points={area} class={`pl-area ${last >= 0 ? "up" : "down"}`} />
      <polyline points={line} class={`line pl-line ${last >= 0 ? "up" : "down"}`} />
      <text x={X(0)} y={H - 6} class="tick">{closed[0].d.split("-").reverse().join("/")}</text>
      <text x={X(pts.length - 1)} y={H - 6} text-anchor="end" class="tick">{closed[closed.length - 1].d.split("-").reverse().join("/")}</text>
    </svg>
    </div>
  );
}

function Breakdown({ list }: { list: Trade[] }) {
  const group = (key: (t: Trade) => string) => {
    const g = new Map<string, Trade[]>();
    for (const t of list) { const k = key(t) || "—"; (g.get(k) ?? g.set(k, []).get(k)!).push(t); }
    return [...g.entries()].map(([k, l]) => ({ k, s: summarize(l) })).sort((a, b) => b.s.pl - a.s.pl);
  };
  const T = ({ title, rows }: { title: string; rows: { k: string; s: ReturnType<typeof summarize> }[] }) => (
    <Card flush title={title}><div class="tw"><table class="t">
      <thead><tr><th class="l">{title === "Per mercato" ? "Mercato" : "Campionato"}</th><th>Trade</th><th>Vinti</th><th>P/L</th><th>Rendimento</th></tr></thead>
      <tbody>{rows.map(({ k, s }) => <tr key={k}><td class="l">{k}</td><td>{s.n}</td><td>{s.closed ? `${Math.round((s.won / s.closed) * 100)}%` : "—"}</td><td class={s.pl >= 0 ? "pos" : "neg"}>{eur(s.pl)}</td><td>{s.risk ? pc(s.pl / s.risk) : "—"}</td></tr>)}</tbody>
    </table></div></Card>
  );
  return <div class="grid2"><T title="Per mercato" rows={group((t) => marketLabel(t.mkey, t.mk))} /><T title="Per campionato" rows={group((t) => t.lg)} /></div>;
}
