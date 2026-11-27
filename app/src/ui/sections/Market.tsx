// Confronto quote di mercato (Betfair, Betflag, bookmaker) con il modello.
import { useEffect, useState } from "preact/hooks";
import { localQuotes, remoteQuotes, saveQuotes, type MatchQuotes, type QuoteSnap } from "../../data/personal";
import type { Match } from "../../data/types";
import { agreement, evBack, evLay, marketProbs, maxLay, minBack, verdict, type Quote } from "../../stats/market";
import type { Forecast } from "../../stats/poisson";
import { Card, DecimalInput, Seg, fmtOdd, fmtPct, usePref } from "../components/common";
import { hasStoredSession } from "../../data/personal";
import { DEFAULT_SETTINGS, loadTrades, marketLabel, saveTrade, type Trade } from "../../data/trades";
import { dayToIso } from "../../data/dates";
import { leagueName, teamName } from "../../data/store";
import { TradeForm, newTrade } from "../pages/Trades";

type Ex = "betfair" | "betflag" | "book";
const EX: Record<Ex, { name: string; comm: number }> = {
  betfair: { name: "Betfair Exchange", comm: 5 }, betflag: { name: "Betflag Exchange", comm: 5 }, book: { name: "Bookmaker (quota fissa)", comm: 0 },
};
const LABELS: Record<string, string> = { mattina: "Mattina", ingresso: "Ingresso", chiusura: "Chiusura", altro: "Altro" };

interface Row { key: string; label: string; p: number | null }
function groups(fc: Forecast): { title: string; rows: Row[] }[] {
  const h = fc.halves;
  return [
    { title: "Esito finale", rows: [{ key: "1", label: "1 · Casa", p: fc.home }, { key: "X", label: "X · Pareggio", p: fc.draw }, { key: "2", label: "2 · Ospite", p: fc.away }] },
    { title: "Under / Over 2,5", rows: [{ key: "o25", label: "Over 2,5", p: fc.o25 }, { key: "u25", label: "Under 2,5", p: 1 - fc.o25 }] },
    { title: "Under / Over 1,5", rows: [{ key: "o15", label: "Over 1,5", p: fc.o15 }, { key: "u15", label: "Under 1,5", p: 1 - fc.o15 }] },
    { title: "Goal / No goal", rows: [{ key: "gg", label: "Goal (GG)", p: fc.btts }, { key: "ng", label: "No goal (NG)", p: 1 - fc.btts }] },
    { title: "1° tempo · Under / Over 0,5", rows: [{ key: "o05h1", label: "Over 0,5 1° tempo", p: fc.ht05 }, { key: "u05h1", label: "Under 0,5 1° tempo", p: 1 - fc.ht05 }] },
    { title: "1° tempo · Under / Over 1,5", rows: [{ key: "o15h1", label: "Over 1,5 1° tempo", p: fc.ht15 }, { key: "u15h1", label: "Under 1,5 1° tempo", p: 1 - fc.ht15 }] },
    { title: "2° tempo · Under / Over 0,5", rows: [{ key: "o05h2", label: "Over 0,5 2° tempo", p: h ? h.h2.goal : null }, { key: "u05h2", label: "Under 0,5 2° tempo", p: h ? 1 - h.h2.goal : null }] },
  ];
}

const num = (s: string) => { const v = Number(s.replace(",", ".")); return v > 1 ? Math.round(v * 100) / 100 : null; };
const ev = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

export function MarketCompare({ m, fc }: { m: Match; fc: Forecast }) {
  const [ex, setEx] = usePref<Ex>("mkt.ex", "betfair");
  const [comms, setComms] = usePref<Record<Ex, number>>("mkt.comm", { betfair: 5, betflag: 5, book: 0 });
  const [data, setData] = useState<MatchQuotes>(() => localQuotes(m.id));
  const [label, setLabel] = useState("mattina");
  const [msg, setMsg] = useState("");
  const [ver, setVer] = useState(0); // cambia quando le quote vengono caricate dall'esterno
  const q = data.draft ?? {};
  const c = (comms[ex] ?? EX[ex].comm) / 100;

  useEffect(() => {
    setData(localQuotes(m.id));
    setVer((v) => v + 1);
    remoteQuotes(m.id).then((snaps) => { if (snaps && snaps.length) setData((d) => ({ ...d, snaps: mergeSnaps(d.snaps, snaps) })); });
  }, [m.id]);

  const update = (next: MatchQuotes) => { setData(next); try { localStorage.setItem(`ta.quotes.${m.id}`, JSON.stringify(next)); } catch { /* memoria piena */ } };
  const setQ = (key: string, side: "b" | "l", v: string) => update({ ...data, draft: { ...q, [key]: { ...q[key], [side]: num(v) } } });
  const fill = (vals: Record<string, number | null>) => {
    const d = { ...q };
    for (const [k, v] of Object.entries(vals)) if (v) d[k] = { ...d[k], b: v };
    update({ ...data, draft: d }); setVer(ver + 1);
  };
  const save = async () => {
    if (!Object.values(q).some((x) => x?.b || x?.l)) { setMsg("Inserisci almeno una quota."); return; }
    const snap: QuoteSnap = { t: Date.now(), label, ex, comm: comms[ex] ?? EX[ex].comm, q };
    const next = { ...data, snaps: [...data.snaps, snap].slice(-10) };
    setData(next);
    const where = await saveQuotes(m.id, next);
    setMsg(where === "cloud" ? "Quote salvate nel tuo account (anche su altri dispositivi)." : "Quote salvate su questo dispositivo. Accedi nell'Area personale per averle ovunque.");
  };
  const remove = async (i: number) => { const next = { ...data, snaps: data.snaps.filter((_, k) => k !== i) }; setData(next); await saveQuotes(m.id, next); };

  const [adding, setAdding] = useState<Trade | null>(null);
  const [tradeMsg, setTradeMsg] = useState("");
  const startTrade = async (key: string, p: number | null) => {
    if (!hasStoredSession()) { setTradeMsg("login"); return; }
    const b = q[key]?.b ?? null, l = q[key]?.l ?? null;
    const side: "back" | "lay" = !b && l ? "lay" : "back";
    const set = await loadTrades().then((r) => r.settings).catch(() => DEFAULT_SETTINGS);
    setTradeMsg("");
    setAdding(newTrade(set, {
      mid: m.id, mkey: key, mk: marketLabel(key), d: dayToIso(m.d), lg: leagueName(m.lg), m: `${teamName(m.h)} – ${teamName(m.a)}`,
      side, q: (side === "lay" ? l : b) ?? (p ? Math.round((1 / p) * 100) / 100 : 2), comm: ex === "book" ? 0 : (comms[ex] ?? 5),
      st: "Da analisi partita", n: p ? `Modello ${Math.round(p * 100)}% · ${EX[ex].name}` : EX[ex].name,
    }));
  };
  const G = groups(fc);
  const diffs: number[] = [];
  return (
    <Card title="Confronta con il mercato">
      <div class="mkt-head">
        <Seg<Ex> label="Mercato" value={ex} onChange={setEx} options={[["betfair", "Betfair"], ["betflag", "Betflag"], ["book", "Bookmaker"]]} />
        <label class="row" style="gap:6px">Commissione
          <DecimalInput key={ex} class="q input" style="width:64px" aria-label="Commissione in percentuale" value={comms[ex] ?? EX[ex].comm}
            onValue={(n) => setComms({ ...comms, [ex]: Math.max(0, Math.min(20, n ?? 0)) })} /> %
        </label>
        <span class="spacer" />
        {(m.oh || m.oo) && <button type="button" class="btn" onClick={() => fill({ "1": m.oh, X: m.od, "2": m.oa, o25: m.oo, u25: m.ou })}>Usa quote medie bookmaker</button>}
        {m.bh && <button type="button" class="btn" onClick={() => fill({ "1": m.bh, X: m.bd, "2": m.ba })}>Usa Betfair (chiusura)</button>}
      </div>
      <div class="tw mkt"><table class="t">
        <thead><tr><th class="l">Mercato</th><th>Modello</th><th>Quota equa</th><th>Back</th><th>Lay</th><th>Mercato</th><th>Differenza</th><th class="l">Lettura</th><th title="Valore atteso per 1 € a rischio, al netto della commissione">EV back</th><th title="Valore atteso per 1 € a rischio, al netto della commissione">EV lay</th><th></th></tr></thead>
        <tbody>
          {G.map((g) => {
            const mp = marketProbs(g.rows.map((r) => (q[r.key] ?? {}) as Quote));
            return [
              <tr class="grp" key={g.title}><td colSpan={11}>{g.title}{mp.margin !== null ? ` · margine ${(mp.margin * 100).toFixed(1)}%` : ""}</td></tr>,
              ...g.rows.map((r, i) => {
                const b = q[r.key]?.b ?? null, l = q[r.key]?.l ?? null, mk = mp.probs[i];
                const vd = r.p !== null && mk !== null ? verdict(r.p, mk) : null;
                if (vd) diffs.push(vd.diff);
                return (
                  <tr key={r.key}>
                    <td class="l">{r.label}</td>
                    <td><b>{r.p === null ? "—" : fmtPct(r.p * 100)}</b></td>
                    <td>{r.p ? fmtOdd(1 / r.p) : "—"}</td>
                    <td><input key={`b${ver}`} class="q" inputMode="decimal" aria-label={`Quota back ${r.label}`} defaultValue={b ? String(b) : ""} placeholder="—" onInput={(e) => setQ(r.key, "b", (e.target as HTMLInputElement).value)} /></td>
                    <td><input key={`l${ver}`} class="q" inputMode="decimal" aria-label={`Quota lay ${r.label}`} defaultValue={l ? String(l) : ""} placeholder="—" disabled={ex === "book"} onInput={(e) => setQ(r.key, "l", (e.target as HTMLInputElement).value)} /></td>
                    <td>{mk === null ? "—" : fmtPct(mk * 100)}</td>
                    <td class={vd ? (vd.v === "linea" ? "" : vd.diff > 0 ? "pos" : "neg") : ""}>{vd ? `${vd.diff > 0 ? "+" : ""}${(vd.diff * 100).toFixed(1)} pt` : "—"}</td>
                    <td class="l">{vd ? <Reading v={vd.v} p={r.p!} c={c} /> : r.p !== null ? <span class="muted" title="Quota minima back / massima lay perché il modello veda valore">back da {fmtOdd(minBack(r.p, c))} · lay fino a {fmtOdd(maxLay(r.p, c))}</span> : <span class="muted">dati 1° tempo assenti</span>}</td>
                    <td class={b && r.p !== null ? (evBack(r.p, b, c) >= 0 ? "pos" : "neg") : ""}>{b && r.p !== null ? ev(evBack(r.p, b, c)) : "—"}</td>
                    <td class={l && r.p !== null ? (evLay(r.p, l, c) >= 0 ? "pos" : "neg") : ""}>{l && r.p !== null && ex !== "book" ? ev(evLay(r.p, l, c)) : "—"}</td>
                    <td><button type="button" class="mini-btn add" title="Registra questo trade" onClick={() => startTrade(r.key, r.p)}>＋ Trade</button></td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table></div>
      {tradeMsg === "login" && <div class="banner">Per registrare un trade accedi dall'<a href="#/personale"><b>Area personale</b></a>: il registro trade è riservato al tuo account.</div>}
      {tradeMsg && tradeMsg !== "login" && <div class="banner" role="status">{tradeMsg} <a href="#/registro"><b>Apri il registro trade →</b></a></div>}
      {adding && <TradeForm isNew value={adding} onCancel={() => setAdding(null)} onSave={async (t) => {
        try { await saveTrade(t); setAdding(null); setTradeMsg(`Trade registrato: ${t.mk}, ${t.side} a ${t.q}.`); }
        catch (e) { setTradeMsg(`Non salvato: ${(e as Error).message}`); }
      }} />}
      <Agreement diffs={diffs} />
      <div class="row" style="margin-top:8px">
        <label class="row" style="gap:6px">Momento
          <select class="input" value={label} onChange={(e) => setLabel((e.target as HTMLSelectElement).value)}>
            {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="button" class="btn primary" onClick={save}>Salva queste quote</button>
        <button type="button" class="btn" onClick={() => { update({ ...data, draft: {} }); setVer(ver + 1); }}>Svuota</button>
        {msg && <span class="muted" role="status">{msg}</span>}
      </div>
      {data.snaps.length > 0 && (
        <div style="margin-top:10px">
          <h3>Quote salvate</h3>
          {data.snaps.map((s, i) => (
            <div class="snap" key={s.t}>
              <b>{LABELS[s.label] ?? s.label}</b>
              <span class="muted">{new Date(s.t).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} · {EX[s.ex as Ex]?.name ?? s.ex}</span>
              <span>{Object.entries(s.q).filter(([, v]) => v?.b || v?.l).map(([k, v]) => `${k} ${v.b ?? "—"}${v.l ? `/${v.l}` : ""}`).join(" · ")}</span>
              <span class="spacer" />
              <button type="button" class="mini-btn" onClick={() => { setEx((s.ex as Ex) || "betfair"); update({ ...data, draft: s.q }); setVer(ver + 1); }}>Ricarica</button>
              <button type="button" class="mini-btn" onClick={() => remove(i)}>Elimina</button>
            </div>
          ))}
        </div>
      )}
      <p class="note">Inserisci le quote che vedi su {EX[ex].name}: back e, se c'è, lay. La probabilità del mercato usa il prezzo medio tra back e lay e, quando il gruppo è completo (es. 1, X e 2), toglie il margine. "Back da" e "lay fino a" sono le quote oltre le quali, secondo il modello, l'operazione ha valore al netto della commissione. Di solito le quote di mercato, soprattutto vicino al calcio d'inizio, sono più precise del modello: usa le differenze per capire dove guardare, non come certezza.</p>
    </Card>
  );
}

function Reading({ v, p, c }: { v: "linea" | "back" | "lay"; p: number; c: number }) {
  if (v === "linea") return <span class="pill linea">In linea col modello</span>;
  if (v === "back") return <span><span class="pill back">Il modello la vede più probabile</span> <span class="muted">valore in back da {fmtOdd(minBack(p, c))}</span></span>;
  return <span><span class="pill lay">Il mercato la vede più probabile</span> <span class="muted">valore in lay fino a {fmtOdd(maxLay(p, c))}</span></span>;
}

function Agreement({ diffs }: { diffs: number[] }) {
  const a = agreement(diffs);
  if (!a) return <div class="agree"><span class="muted">Inserisci le quote del mercato per vedere se rispecchia il modello.</span></div>;
  const txt = a.level === "alta" ? "Il mercato rispecchia il modello" : a.level === "media" ? "Il mercato rispecchia il modello solo in parte" : "Il mercato si discosta dal modello";
  return (
    <div class="agree">
      <b class={a.level === "alta" ? "pos" : a.level === "bassa" ? "neg" : ""}>{txt}</b>
      <span class="muted">differenza media {(a.avg * 100).toFixed(1)} punti su {diffs.length} esiti</span>
    </div>
  );
}

function mergeSnaps(a: QuoteSnap[], b: QuoteSnap[]) {
  const map = new Map<number, QuoteSnap>();
  for (const s of [...a, ...b]) map.set(s.t, s);
  return [...map.values()].sort((x, y) => x.t - y.t).slice(-10);
}
