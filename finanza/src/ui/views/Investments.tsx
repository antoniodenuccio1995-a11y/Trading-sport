// Investimenti: azioni, ETF e cripto. Valore, guadagni, ripartizione, posizioni, operazioni.
// I prezzi si aggiornano solo mentre questa pagina è aperta (al massimo ogni 15 minuti);
// senza rete restano gli ultimi prezzi noti con la loro data.
import { useEffect, useRef, useState } from "preact/hooks";
import type { Movement } from "../../domain/types.ts";
import { amountOf, dateOf, descOf, norm } from "../../domain/movement.ts";
import { getSnap, lines, memo } from "../../state/store.ts";
import * as I from "../../state/investActions.ts";
import { KIND_COLOR, KIND_LABEL, KINDS, type Instrument, type InstrumentKind, type Trade, type TradeSide } from "../../invest/types.ts";
import {
  allocationByInstrument, allocationByKind, dividends, isValidIsin, positions, proposeTrades, totals, tradeCash,
  unlinkedInvestMovements, valueOverTime, type Position, type TradeProposal,
} from "../../invest/portfolio.ts";
import { hasLiveSource, RateLimited, searchCrypto, type CryptoHit } from "../../invest/prices.ts";
import { Dialog, Drawer, Empty, Seg, toast } from "../components/common.tsx";
import { LineChart } from "../charts/LineChart.tsx";
import { CountUp } from "../charts/base.tsx";
import { Donut, Spark } from "../charts/Shapes.tsx";
import { Icon } from "../icons.tsx";
import { goMovements } from "../drill.ts";
import { cap, eur, eurExact, eurShort, fullDate, monthLabel, parseAmount, pct, signed, todayIso } from "../format.ts";

// ---------- formattazione ----------
const qf = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 8, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);
const qty = (v: number) => qf.format(v);
const smallEur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumSignificantDigits: 4 });
const unit = (v: number) => (Math.abs(v) >= 1 || v === 0 ? eurExact(v) : smallEur.format(v));
const signedExact = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + eurExact(Math.abs(v));
const sgnPct = (v: number | null) => (v == null ? "" : (v > 0 ? "+" : v < 0 ? "−" : "") + pct(Math.abs(v), 1));
const localDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = localDay(d), today = todayIso(), yesterday = localDay(new Date(Date.now() - 86400000));
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return day === today ? "oggi alle " + time : day === yesterday ? "ieri alle " + time : fullDate(day) + " alle " + time;
}
const SIDE: Record<TradeSide, string> = { buy: "Acquisto", sell: "Vendita" };
const KIND_ICON: Record<InstrumentKind, string> = { etf: "🧺", stock: "🏢", crypto: "🪙", bond: "📜", fund: "🗂️", other: "📦" };
const plainBtn = { background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" } as const;
const num = (s: string) => parseAmount(s);
const inputVal = (e: Event) => (e.target as HTMLInputElement).value;

/** Vero sotto la larghezza indicata (telefono): la tabella delle posizioni diventa un elenco. */
function useNarrow(px = 720): boolean {
  const q = `(max-width: ${px}px)`;
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q), h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}

type Dlg =
  | { t: "instrument"; edit?: Instrument; back?: string }
  | { t: "trade"; instrumentId?: string; trade?: Trade; back?: string }
  | { t: "price"; instrumentId: string; back?: string }
  | { t: "delete"; instrumentId: string; back?: string };

/** Vai ai movimenti dello strumento: per ISIN, nome o ticker se compaiono nei movimenti, altrimenti quelli collegati. */
function drillInstrument(p: Position) {
  const inst = p.instrument, label = "Movimenti di " + inst.name;
  const hay = getSnap().movements.filter((m) => !m.deletedAt).map((m) => norm(descOf(m) + " " + m.counterparty));
  const q = [inst.isin, inst.name, inst.symbol].find((c): c is string => !!c && c.length >= 3 && hay.some((h) => h.includes(norm(c))));
  const ids = p.trades.map((t) => t.movementId).filter((x): x is string => !!x);
  if (q) goMovements({ q, account: p.accounts.length === 1 ? p.accounts[0] : undefined, label });
  else if (ids.length) goMovements({ ids, label });
  else goMovements({ q: inst.isin || inst.name, label });
}

export function InvestmentsView() {
  const s = getSnap(), d = s.investments, today = todayIso();
  const [open, setOpen] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [range, setRange] = useState<"12" | "24" | "all">("24");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<I.RefreshReport | null>(null);
  const alive = useRef(true);
  const narrow = useNarrow();

  const pos = memo("inv.pos", () => positions(d));
  const tot = memo("inv.tot", () => totals(pos));
  const kinds = memo("inv.kinds", () => allocationByKind(pos));
  const byInst = memo("inv.byInst", () => allocationByInstrument(pos));
  const series = memo("inv.series." + today, () => valueOverTime(d, { asOf: today }));
  const proposals = memo("inv.proposals", () => proposeTrades(s.movements, d, s.accounts.map((a) => a.name)));
  const unlinked = memo("inv.unlinked", () => unlinkedInvestMovements(s.movements, d));
  const divs = memo("inv.divs", () => dividends(lines(), d?.instruments ?? []));

  async function refresh(force: boolean) {
    if (I.isRefreshing() || (!force && !I.priceRefreshDue())) return;
    setLoading(true);
    const r = await I.refreshPrices({ force });
    if (!alive.current) return;
    setLoading(false);
    setReport(r);
    if (!force) return;
    if (r.offline) toast("Sei offline: restano gli ultimi prezzi noti.");
    else if (r.unreachable) toast("Servizio prezzi non raggiungibile: riprova più tardi.");
    else if (r.rateLimited.length && !r.updated) toast("Troppe richieste ai servizi prezzi: riprovo tra qualche minuto.");
    else if (r.ran) toast(r.updated ? `Prezzi aggiornati (${r.updated})${r.errors.length ? ` · ${r.errors.length} non trovati` : ""}` : "Nessun prezzo da aggiornare");
  }

  useEffect(() => {
    alive.current = true;
    void refresh(false);
    const tick = setInterval(() => { if (document.visibilityState === "visible") void refresh(false); }, 60_000);
    const wake = () => { if (document.visibilityState === "visible") void refresh(false); };
    addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => { alive.current = false; clearInterval(tick); removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); };
  }, []);

  const show = (x: Dlg) => { if (open) { x.back = open; setOpen(null); } setDlg(x); };
  const closeDlg = () => { const back = dlg?.back; setDlg(null); if (back && getSnap().investments?.instruments.some((i) => i.id === back)) setOpen(back); };

  const dialogs = dlg && (
    dlg.t === "instrument" ? <InstrumentDialog edit={dlg.edit} onClose={closeDlg} onCreated={(id) => setDlg({ t: "trade", instrumentId: id })} />
    : dlg.t === "trade" ? <TradeDialog instrumentId={dlg.instrumentId} trade={dlg.trade} onClose={closeDlg} />
    : dlg.t === "price" ? <PriceDialog instrumentId={dlg.instrumentId} onClose={closeDlg} />
    : <DeleteDialog instrumentId={dlg.instrumentId} onClose={closeDlg} />
  );

  if (!d?.instruments.length && !proposals.length) {
    return (
      <div class="stack enter">
        <div class="card">
          <Empty icon="📈" title="Nessun investimento ancora">
            <p class="muted" style={{ margin: 0, maxWidth: "440px" }}>Aggiungi uno strumento (ETF, azione o cripto) con i tuoi acquisti e vendite.
              Se importi l'export CSV di Trade Republic, le operazioni compaiono qui da confermare.</p>
            <div class="row wrap" style={{ gap: "8px", justifyContent: "center", marginTop: "6px" }}>
              <button class="btn primary" onClick={() => setDlg({ t: "instrument" })}><Icon name="plus" />Aggiungi strumento</button>
              <a class="btn" href="#importa"><Icon name="upload" />Importa Trade Republic</a>
            </div>
            {unlinked.length > 0 && <UnlinkedNote list={unlinked} />}
          </Empty>
        </div>
        {dialogs}
      </div>
    );
  }

  const openPos = pos.filter((p) => !p.closed), closedPos = pos.filter((p) => p.closed && p.trades.length);
  const noTrades = pos.filter((p) => !p.trades.length);
  const divTotal = Object.values(divs.byInstrument).reduce((a, x) => a + x.total, 0);
  const offline = report?.offline || (typeof navigator !== "undefined" && navigator.onLine === false);
  const last = tot.lastQuoteAt ? " · ultimi prezzi " + when(tot.lastQuoteAt) : "";
  const status = loading ? "Aggiorno i prezzi…"
    : offline ? "Offline" + (last || " · nessun prezzo salvato")
    : report?.unreachable ? "Servizio prezzi non raggiungibile" + last
    : report?.rateLimited.length && !report.updated ? "Servizi prezzi occupati, riprovo più tardi" + last
    : d?.refreshedAt ? "Prezzi aggiornati " + when(d.refreshedAt) : tot.lastQuoteAt ? "Ultimo prezzo " + when(tot.lastQuoteAt) : "Prezzi non ancora scaricati";
  const priced = tot.open > tot.unpriced;
  const n = range === "all" ? series.keys.length : Math.min(series.keys.length, Number(range));
  const k0 = series.keys.length - n, keys = series.keys.slice(k0);
  const drawerPos = open ? pos.find((p) => p.instrument.id === open) : undefined;

  return (
    <div class="stack enter">
      {proposals.length > 0 && <ProposalsCard proposals={proposals} />}

      <div class="grid g-hero">
        <div class="card hero">
          <div class="row between">
            <div class="eyebrow">Valore del portafoglio</div>
            <button class="btn sm ghost" onClick={() => void refresh(true)} disabled={loading} title="Aggiorna i prezzi adesso"><Icon name="repeat" />{loading ? "Aggiorno…" : "Aggiorna prezzi"}</button>
          </div>
          <div class="big"><CountUp value={tot.marketValue} format={eur} /></div>
          <div class="row wrap" style={{ gap: "8px" }}>
            {priced ? (
              <>
                <span class={"delta " + (tot.unrealized > 0 ? "up" : tot.unrealized < 0 ? "down" : "")}>
                  {tot.unrealized > 0 ? "▲" : tot.unrealized < 0 ? "▼" : "■"} <span class="money">{signed(tot.unrealized)}</span>{tot.unrealizedPct != null ? " · " + sgnPct(tot.unrealizedPct) : ""}
                </span>
                <span class="faint" style={{ fontSize: "12.5px" }}>guadagno non realizzato</span>
              </>
            ) : <span class="faint" style={{ fontSize: "12.5px" }}>{tot.open ? "Senza prezzi: il valore è quello di acquisto." : "Nessuna posizione aperta."}</span>}
          </div>
          <div class="faint" style={{ fontSize: "12px", marginTop: "8px" }} aria-live="polite">
            {status}{tot.unpriced > 0 && !loading ? ` · ${tot.unpriced} ${tot.unpriced === 1 ? "posizione" : "posizioni"} senza prezzo, valutate al costo` : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "16px" }}>
            <div class="kpi"><span class="label">Investito</span><span class="value money" style={{ fontSize: "17px" }}>{eur(tot.invested)}</span><span class="foot">al costo</span></div>
            <div class="kpi"><span class="label">Realizzato</span><span class={"value money " + (tot.realized > 0 ? "in" : tot.realized < 0 ? "bad" : "")} style={{ fontSize: "17px" }}>{signed(tot.realized)}</span><span class="foot">dalle vendite</span></div>
            <div class="kpi"><span class="label">Dividendi</span><span class="value money" style={{ fontSize: "17px" }}>{eur(divTotal)}</span><span class="foot">{divs.years.length ? `dal ${divs.years[0]}` : "nessuno"}</span></div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <div class="row between wrap" style={{ marginBottom: "4px", gap: "8px" }}>
              <span class="faint" style={{ fontSize: "12px" }}>Valore a fine mese e capitale investito</span>
              {series.keys.length > 12 && <Seg value={range} onChange={setRange} label="Periodo" options={[["12", "12 mesi"], ["24", "24 mesi"], ["all", "Tutto"]]} />}
            </div>
            {keys.length < 2 ? <p class="faint" style={{ margin: "8px 0 0", fontSize: "12.5px" }}>Il grafico compare dal secondo mese di operazioni.</p> : (
              <LineChart xLabels={keys.map((k) => cap(monthLabel(k)))} axisLabel={(i) => monthLabel(keys[i], true)} tickEvery={Math.max(1, Math.ceil(keys.length / (narrow ? 4 : 6)))}
                yFormat={eur} yTick={eurShort} zero={false} height={narrow ? 190 : 220}
                series={[
                  { id: "val", label: "Valore", color: "var(--accent)", values: series.value.slice(k0), area: true, width: 2.5 },
                  { id: "inv", label: "Investito (al costo)", color: "var(--s2)", values: series.invested.slice(k0), dashed: true },
                ]} />
            )}
            {series.estimated.slice(k0).some(Boolean) && keys.length >= 2 && <p class="faint" style={{ fontSize: "11.5px", margin: "6px 0 0" }}>Nei mesi senza prezzi storici le posizioni valgono quanto sono costate.</p>}
          </div>
        </div>

        <div class="card">
          <h2>Ripartizione</h2>
          <p class="hint">Per tipo di strumento, al valore di oggi.</p>
          {kinds.length === 0 ? <p class="faint">Nessuna posizione aperta.</p> : (
            <div class="row wrap" style={{ gap: "18px", alignItems: "center" }}>
              <Donut segs={kinds.map((k) => ({ id: k.id, label: k.label, value: k.value, color: KIND_COLOR[k.kind] }))} size={164} thickness={18} format={eur}
                center={<div><div class="faint" style={{ fontSize: "11.5px" }}>Totale</div><div class="mid money" style={{ fontSize: "18px" }}>{eurShort(tot.marketValue)}</div></div>} />
              <div class="rank" style={{ flex: 1, minWidth: "170px" }}>
                {kinds.map((k) => (
                  <div class="rank-row" key={k.id}>
                    <div class="name"><i class="swatch" style={{ background: KIND_COLOR[k.kind] }} /><span>{k.label}</span></div>
                    <div class="v">{pct(k.pct)}</div>
                    <div class="track"><div class="fill" style={{ width: Math.max(1, k.pct * 100) + "%", background: KIND_COLOR[k.kind] }} /></div>
                    <div class="meta"><span class="money">{eur(k.value)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {byInst.length > 1 && (
            <>
              <div class="eyebrow" style={{ margin: "18px 0 4px" }}>Per strumento</div>
              <div class="list">
                {byInst.slice(0, 6).map((x, i, arr) => (
                  <button key={x.id} class="li" style={{ ...plainBtn, width: "100%", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : 0, padding: "8px 2px" }} onClick={() => setOpen(x.id)}>
                    <i class="swatch" style={{ background: KIND_COLOR[x.kind] }} />
                    <span class="t" style={{ fontWeight: 560 }}>{x.label}</span>
                    <span class="money muted">{pct(x.pct, x.pct < 0.1 ? 1 : 0)}</span>
                  </button>
                ))}
              </div>
              {byInst.length > 6 && <p class="faint" style={{ fontSize: "12px", margin: "6px 0 0" }}>e altri {byInst.length - 6} nella tabella delle posizioni</p>}
            </>
          )}
        </div>
      </div>

      <div class="card">
        <div class="card-head" style={{ flexWrap: "wrap" }}>
          <div><h2>Posizioni</h2><p class="hint">Tocca una riga per il dettaglio e le operazioni.</p></div>
          <div class="row" style={{ gap: "8px" }}>
            <button class="btn sm" onClick={() => setDlg({ t: "trade" })} disabled={!d?.instruments.length}><Icon name="plus" />Operazione</button>
            <button class="btn sm primary" onClick={() => setDlg({ t: "instrument" })}><Icon name="plus" />Strumento</button>
          </div>
        </div>
        {openPos.length === 0 ? <p class="faint" style={{ margin: 0 }}>Nessuna posizione aperta{noTrades.length ? ": aggiungi le operazioni degli strumenti qui sotto." : "."}</p> : narrow ? (
          <div class="list">{openPos.map((p, i) => <PositionItem key={p.instrument.id} p={p} last={i === openPos.length - 1} onOpen={() => setOpen(p.instrument.id)} />)}</div>
        ) : (
          <div class="scroll-x">
            <table class="tbl inv-tbl" style={{ minWidth: "700px" }}>
              <thead><tr><th>Strumento</th><th class="r">Quantità</th><th class="r">Prezzo medio</th><th class="r">Prezzo</th><th class="r">Valore</th><th class="r">Guadagno</th><th class="r">Peso</th></tr></thead>
              <tbody>{openPos.map((p) => <PositionRow key={p.instrument.id} p={p} onOpen={() => setOpen(p.instrument.id)} />)}</tbody>
            </table>
          </div>
        )}
        {noTrades.length > 0 && (
          <div class="row wrap" style={{ gap: "6px", marginTop: "12px" }}>
            <span class="faint" style={{ fontSize: "12px" }}>Senza operazioni:</span>
            {noTrades.map((p) => <button key={p.instrument.id} class="chip" onClick={() => setOpen(p.instrument.id)}>{KIND_ICON[p.instrument.kind]} {p.instrument.name}</button>)}
          </div>
        )}
        {closedPos.length > 0 && (
          <details style={{ marginTop: "12px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Posizioni chiuse ({closedPos.length}) · realizzato <span class="money">{signed(closedPos.reduce((a, p) => a + p.realized, 0))}</span></summary>
            <div class="list" style={{ marginTop: "6px" }}>
              {closedPos.map((p) => (
                <button key={p.instrument.id} class="li" style={{ ...plainBtn, width: "100%", borderBottom: "1px solid var(--line)" }} onClick={() => setOpen(p.instrument.id)}>
                  <div class="avatar">{KIND_ICON[p.instrument.kind]}</div>
                  <div><div class="t">{p.instrument.name}</div><div class="s">{p.trades.length} operazioni · ultima {fullDate(p.lastDate)}</div></div>
                  <span class={"money " + (p.realized > 0 ? "in" : p.realized < 0 ? "bad" : "")} style={{ fontWeight: 650 }}>{signed(p.realized)}</span>
                </button>
              ))}
            </div>
          </details>
        )}
        {unlinked.length > proposals.length && <UnlinkedNote list={unlinked.filter((m) => !proposals.some((p) => p.movementId === m.id))} />}
      </div>

      {(divTotal !== 0 || divs.other.total !== 0) && <DividendsCard divs={divs} instruments={d?.instruments ?? []} />}

      {drawerPos && <PositionDrawer p={drawerPos} onClose={() => setOpen(null)} onDialog={show} />}
      {dialogs}
    </div>
  );
}

// ---------- tabella posizioni ----------

function PositionRow({ p, onOpen }: { p: Position; onOpen: () => void }) {
  const i = p.instrument, up = p.unrealized > 0, down = p.unrealized < 0;
  return (
    <tr class="inv-row" onClick={onOpen} style={{ cursor: "pointer" }}>
      <td>
        <button style={{ ...plainBtn, display: "flex", alignItems: "center", gap: "10px" }} onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label={"Dettaglio " + i.name}>
          <span class="avatar" style={{ width: "30px", height: "30px", fontSize: "14px" }}>{KIND_ICON[i.kind]}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 620, maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
            <span class="faint" style={{ fontSize: "11.5px" }}>{KIND_LABEL[i.kind]}{i.isin ? " · " + i.isin : i.symbol ? " · " + i.symbol : ""}</span>
          </span>
        </button>
      </td>
      <td class="r money">{qty(p.quantity)}</td>
      <td class="r money">{unit(p.avgCost)}</td>
      <td class="r">
        {p.price != null ? <><div class="money">{unit(p.price)}</div><div class="faint" style={{ fontSize: "11px" }}>{p.quote?.source === "manuale" ? "manuale · " : ""}{when(p.quote?.at)}</div></> : <span class="tag">senza prezzo</span>}
      </td>
      <td class="r money" style={{ fontWeight: 650 }}>{eur(p.marketValue)}</td>
      <td class="r">
        {p.valuedAtCost ? <span class="faint">—</span> : (
          <span class={"delta " + (up ? "up" : down ? "down" : "")}><span class="money">{signed(p.unrealized)}</span>{p.unrealizedPct != null ? " · " + sgnPct(p.unrealizedPct) : ""}</span>
        )}
      </td>
      <td class="r">{pct(p.weight, p.weight < 0.1 ? 1 : 0)}</td>
    </tr>
  );
}

function PositionItem({ p, last, onOpen }: { p: Position; last: boolean; onOpen: () => void }) {
  const i = p.instrument;
  return (
    <button class="li" style={{ ...plainBtn, width: "100%", borderBottom: last ? 0 : "1px solid var(--line)" }} onClick={onOpen} aria-label={"Dettaglio " + i.name}>
      <span class="avatar">{KIND_ICON[i.kind]}</span>
      <span style={{ minWidth: 0 }}>
        <span class="t" style={{ display: "block" }}>{i.name}</span>
        <span class="s" style={{ display: "block" }}><span class="money">{qty(p.quantity)}</span> × {p.price != null ? <span class="money">{unit(p.price)}</span> : "senza prezzo"} · {pct(p.weight)}</span>
      </span>
      <span style={{ display: "grid", justifyItems: "end", gap: "3px" }}>
        <span class="money" style={{ fontWeight: 680 }}>{eur(p.marketValue)}</span>
        {p.valuedAtCost ? <span class="faint" style={{ fontSize: "11.5px" }}>al costo</span>
          : <span class={"delta " + (p.unrealized > 0 ? "up" : p.unrealized < 0 ? "down" : "")} style={{ fontSize: "11.5px", padding: "1px 6px" }}>{sgnPct(p.unrealizedPct)}</span>}
      </span>
    </button>
  );
}

// ---------- dettaglio posizione ----------

function PositionDrawer({ p, onClose, onDialog }: { p: Position; onClose: () => void; onDialog: (d: Dlg) => void }) {
  const i = p.instrument;
  const hist = getSnap().investments?.priceHistory?.[i.id] ?? [];
  const div = memo("inv.divs", () => dividends(lines(), getSnap().investments?.instruments ?? [])).byInstrument[i.id];
  const removeTrade = (t: Trade) => {
    const r = I.deleteTrade(t.id);
    if (r) toast("Operazione eliminata", { label: "Annulla", run: () => I.restoreTrade(r) });
  };
  return (
    <Drawer onClose={onClose} label={"Dettaglio " + i.name}>
      <div class="row between" style={{ marginBottom: "12px" }}>
        <span class="tag">{KIND_ICON[i.kind]} {KIND_LABEL[i.kind]}</span>
        <button class="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" /></button>
      </div>
      <div class="eyebrow">{[i.isin, i.symbol, p.accounts.join(", ")].filter(Boolean).join(" · ") || "Strumento"}</div>
      <h2 style={{ margin: "4px 0 2px", fontSize: "19px", letterSpacing: "-0.01em" }}>{i.name}</h2>
      <div class="big money" style={{ fontSize: "32px" }}>{eur(p.marketValue)}</div>
      {!p.closed && !p.valuedAtCost && (
        <span class={"delta " + (p.unrealized > 0 ? "up" : p.unrealized < 0 ? "down" : "")}><span class="money">{signed(p.unrealized)}</span>{p.unrealizedPct != null ? " · " + sgnPct(p.unrealizedPct) : ""} non realizzato</span>
      )}
      {p.valuedAtCost && <span class="tag warn">Senza prezzo: vale il costo</span>}

      <div class="grid g-2" style={{ gap: "14px", margin: "18px 0" }}>
        <div class="kpi"><span class="label">Quantità</span><span class="value money" style={{ fontSize: "17px" }}>{qty(p.quantity)}</span></div>
        <div class="kpi"><span class="label">Prezzo medio di carico</span><span class="value money" style={{ fontSize: "17px" }}>{p.quantity ? unit(p.avgCost) : "—"}</span><span class="foot">commissioni comprese</span></div>
        <div class="kpi"><span class="label">Investito</span><span class="value money" style={{ fontSize: "17px" }}>{eur(p.invested)}</span></div>
        <div class="kpi"><span class="label">Prezzo</span><span class="value money" style={{ fontSize: "17px" }}>{p.price != null ? unit(p.price) : "—"}</span>
          <span class="foot">{p.quote ? (p.quote.source === "manuale" ? "manuale · " : p.quote.source === "coingecko" ? "CoinGecko · " : "Yahoo · ") + when(p.quote.at) : hasLiveSource(i) ? "in attesa del primo aggiornamento" : "inseriscilo a mano"}</span></div>
        <div class="kpi"><span class="label">Realizzato</span><span class={"value money " + (p.realized > 0 ? "in" : p.realized < 0 ? "bad" : "")} style={{ fontSize: "17px" }}>{signed(p.realized)}</span></div>
        <div class="kpi"><span class="label">Dividendi e cedole</span><span class="value money" style={{ fontSize: "17px" }}>{eur(div?.total ?? 0)}</span>
          <span class="foot">{div ? Object.entries(div.byYear).sort().map(([y, v]) => `${y}: ${eur(v)}`).join(" · ") : "nessuno trovato"}</span></div>
      </div>
      {hist.length >= 2 && (
        <div style={{ marginBottom: "16px" }}>
          <div class="faint" style={{ fontSize: "11.5px", marginBottom: "4px" }}>Prezzo a fine mese · {fullDate(hist[0][0])} – {fullDate(hist.at(-1)![0])}</div>
          <Spark values={hist.map((h) => h[1])} color={KIND_COLOR[i.kind]} fluid height={56} width={400} />
        </div>
      )}
      {p.issues.includes("oversell") && <p class="warn" style={{ fontSize: "12.5px" }}>Risultano vendute più quote di quelle acquistate: manca qualche acquisto?</p>}

      <div class="row wrap" style={{ gap: "8px", marginBottom: "16px" }}>
        <button class="btn sm primary" onClick={() => onDialog({ t: "trade", instrumentId: i.id })}><Icon name="plus" />Operazione</button>
        <button class="btn sm" onClick={() => onDialog({ t: "price", instrumentId: i.id })}>Prezzo manuale</button>
        <button class="btn sm" onClick={() => { onClose(); drillInstrument(p); }}><Icon name="list" />Vedi i movimenti</button>
      </div>

      <div class="eyebrow" style={{ marginBottom: "4px" }}>Operazioni ({p.trades.length})</div>
      {p.trades.length === 0 ? <p class="faint" style={{ fontSize: "13px" }}>Nessuna operazione: aggiungi il primo acquisto.</p> : (
        <div class="list">
          {[...p.trades].reverse().map((t) => (
            <div class="li" key={t.id}>
              <div class="avatar" style={{ fontSize: "14px" }} aria-hidden="true">{t.side === "buy" ? "↗" : "↘"}</div>
              <div>
                <div class="t">{SIDE[t.side]} · <span class="money">{qty(t.quantity)}</span> × <span class="money">{unit(t.price)}</span></div>
                <div class="s">{fullDate(t.date)} · {t.account || "—"}{t.fees ? ` · commissioni ${eurExact(t.fees)}` : ""}{t.movementId ? " · collegata al movimento" : ""}</div>
              </div>
              <div class="row" style={{ gap: "2px" }}>
                <span class={"money " + (tradeCash(t) > 0 ? "in" : "")} style={{ fontWeight: 650, marginRight: "6px" }}>{signedExact(tradeCash(t))}</span>
                <button class="btn sm ghost" style={{ padding: "4px 8px" }} onClick={() => onDialog({ t: "trade", trade: t, instrumentId: i.id })} aria-label={`Modifica operazione del ${fullDate(t.date)}`}>Modifica</button>
                <button class="icon-btn" style={{ width: "30px", height: "30px" }} onClick={() => removeTrade(t)} aria-label={`Elimina operazione del ${fullDate(t.date)}`} title="Elimina"><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="row wrap" style={{ gap: "8px", marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
        <button class="btn sm ghost" onClick={() => onDialog({ t: "instrument", edit: i })}>Modifica strumento</button>
        <button class="btn sm danger" style={{ marginLeft: "auto" }} onClick={() => onDialog({ t: "delete", instrumentId: i.id })}><Icon name="trash" />Elimina</button>
      </div>
    </Drawer>
  );
}

// ---------- operazioni da confermare ----------

function ProposalsCard({ proposals }: { proposals: TradeProposal[] }) {
  const [all, setAll] = useState(false);
  const ready = proposals.filter((p) => p.quantity != null);
  const list = all ? proposals : proposals.slice(0, 6);
  return (
    <div class="card">
      <div class="card-head" style={{ flexWrap: "wrap" }}>
        <div>
          <h2>Operazioni da confermare <span class="tag warn">{proposals.length}</span></h2>
          <p class="hint">Lette dai movimenti di investimento importati. Controlla e conferma: diventano operazioni del portafoglio.</p>
        </div>
        {ready.length > 1 && <button class="btn sm primary" onClick={() => { const n = I.acceptProposals(ready.map((p) => ({ p }))); toast(`${n} operazioni registrate`); }}>Conferma tutte ({ready.length})</button>}
      </div>
      <div class="list">{list.map((p) => <ProposalRow key={p.movementId} p={p} />)}</div>
      {proposals.length > list.length && <button class="btn sm ghost" style={{ marginTop: "6px" }} onClick={() => setAll(true)}>Mostra tutte ({proposals.length})</button>}
    </div>
  );
}

function ProposalRow({ p }: { p: TradeProposal }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<InstrumentKind>(p.instrument.kind);
  const quantity = p.quantity ?? (num(q) > 0 ? num(q) : null);
  const isNew = !p.instrumentId && !p.duplicateOf;
  const accept = () => {
    const t = I.acceptProposal(p, { quantity: quantity ?? undefined, kind });
    if (t) toast(p.duplicateOf ? "Operazione collegata al movimento" : "Operazione registrata", { label: "Annulla", run: () => { if (p.duplicateOf) I.updateTrade(t.id, { movementId: undefined }); else I.deleteTrade(t.id); } });
  };
  return (
    <div class="li" style={{ alignItems: "start" }}>
      <div class="avatar" aria-hidden="true">{p.side === "buy" ? "↗" : "↘"}</div>
      <div style={{ minWidth: 0 }}>
        <div class="t">{SIDE[p.side]} · {p.instrument.name}</div>
        <div class="s" style={{ whiteSpace: "normal" }}>{fullDate(p.date)} · {p.account}{p.instrument.isin ? " · " + p.instrument.isin : ""}
          {p.quantity != null ? <> · <span class="money">{qty(p.quantity)}</span>{p.price != null ? <> × <span class="money">{unit(p.price)}</span></> : null}</> : null}
          {p.fees ? ` · commissioni ${eurExact(p.fees)}` : ""}</div>
        {p.duplicateOf && <div class="s warn" style={{ whiteSpace: "normal" }}>C'è già un'operazione uguale inserita a mano: la colleghiamo a questo movimento.</div>}
        <div class="row wrap" style={{ gap: "8px", marginTop: "8px" }}>
          {p.quantity == null && (
            <input class="input" style={{ width: "120px", padding: "5px 9px", fontSize: "12.5px" }} inputMode="decimal" placeholder="Quantità" value={q}
              onInput={(e) => setQ(inputVal(e))} aria-label="Quantità (non presente nel movimento)" />
          )}
          {isNew && (
            <select class="input" style={{ padding: "5px 9px", fontSize: "12.5px" }} value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as InstrumentKind)} aria-label="Tipo del nuovo strumento">
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          )}
          <span class="row" style={{ gap: "6px", marginLeft: "auto" }}>
            <button class="btn sm ghost" onClick={() => { I.ignoreMovement(p.movementId); toast("Movimento ignorato", { label: "Annulla", run: () => I.unignoreMovement(p.movementId) }); }}>Ignora</button>
            <button class="btn sm primary" onClick={accept} disabled={quantity == null} title={quantity == null ? "Scrivi la quantità" : undefined}>{p.duplicateOf ? "Collega" : "Conferma"}</button>
          </span>
        </div>
        {isNew && <div class="faint" style={{ fontSize: "11.5px", marginTop: "4px" }}>Nuovo strumento: verrà aggiunto al portafoglio.</div>}
      </div>
      <span class={"money " + (p.amount > 0 ? "in" : "")} style={{ fontWeight: 650 }}>{signedExact(p.amount)}</span>
    </div>
  );
}

function UnlinkedNote({ list }: { list: Movement[] }) {
  if (!list.length) return null;
  return (
    <p class="faint" style={{ fontSize: "12px", margin: "12px 0 0" }}>
      {list.length === 1 ? "1 movimento di investimento non ha" : `${list.length} movimenti di investimento non hanno`} ISIN né quantità: aggiungi le operazioni a mano.{" "}
      <button class="btn sm ghost" style={{ padding: "2px 6px" }} onClick={() => goMovements({ ids: list.map((m) => m.id), label: "Investimenti senza operazione" })}>Vedi</button>
    </p>
  );
}

// ---------- dividendi ----------

function DividendsCard({ divs, instruments }: { divs: ReturnType<typeof dividends>; instruments: Instrument[] }) {
  const years = new Set<string>(divs.years);
  for (const y of Object.keys(divs.other.byYear)) years.add(y);
  const cols = [...years].sort().slice(-3);
  const rows = instruments.filter((i) => divs.byInstrument[i.id]).map((i) => ({ i, d: divs.byInstrument[i.id] })).sort((a, b) => b.d.total - a.d.total);
  return (
    <div class="card">
      <h2>Dividendi e cedole</h2>
      <p class="hint">Entrate "rendite finanziarie" che citano ISIN, nome o ticker dello strumento.</p>
      <div class="scroll-x">
        <table class="tbl" style={{ minWidth: "460px" }}>
          <thead><tr><th>Strumento</th>{cols.map((y) => <th key={y} class="r">{y}</th>)}<th class="r">Totale</th></tr></thead>
          <tbody>
            {rows.map(({ i, d }) => (
              <tr key={i.id} class="inv-row" style={{ cursor: "pointer" }} onClick={() => goMovements({ ids: d.lineIds, label: "Dividendi di " + i.name })}>
                <td><button style={plainBtn} onClick={(e) => { e.stopPropagation(); goMovements({ ids: d.lineIds, label: "Dividendi di " + i.name }); }}>{KIND_ICON[i.kind]} {i.name}</button></td>
                {cols.map((y) => <td key={y} class="r money">{d.byYear[y] ? eur(d.byYear[y]) : "—"}</td>)}
                <td class="r money" style={{ fontWeight: 650 }}>{eur(d.total)}</td>
              </tr>
            ))}
            {divs.other.total !== 0 && (
              <tr class="inv-row" style={{ cursor: "pointer" }} onClick={() => goMovements({ ids: divs.other.lineIds, label: "Interessi e altre rendite" })}>
                <td><button style={plainBtn} class="muted" onClick={(e) => { e.stopPropagation(); goMovements({ ids: divs.other.lineIds, label: "Interessi e altre rendite" }); }}>Interessi e altre rendite</button></td>
                {cols.map((y) => <td key={y} class="r money muted">{divs.other.byYear[y] ? eur(divs.other.byYear[y]) : "—"}</td>)}
                <td class="r money muted">{eur(divs.other.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- finestre ----------

function DialogHead({ title, onClose }: { title: string; onClose: () => void }) {
  return <div class="row between"><h2 style={{ margin: 0, fontSize: "17px" }}>{title}</h2><button class="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" /></button></div>;
}

function InstrumentDialog({ edit, onClose, onCreated }: { edit?: Instrument; onClose: () => void; onCreated: (id: string) => void }) {
  const [mode, setMode] = useState<"crypto" | "security">(edit ? (edit.kind === "crypto" ? "crypto" : "security") : "security");
  const [name, setName] = useState(edit?.name ?? "");
  const [isin, setIsin] = useState(edit?.isin ?? "");
  const [symbol, setSymbol] = useState(edit?.symbol ?? "");
  const [kind, setKind] = useState<InstrumentKind>(edit && edit.kind !== "crypto" ? edit.kind : "etf");
  const [currency, setCurrency] = useState(edit?.currency ?? "EUR");
  const [cg, setCg] = useState(edit?.coingeckoId ?? "");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CryptoHit[] | null>(null);
  const [searchErr, setSearchErr] = useState("");

  useEffect(() => {
    if (mode !== "crypto" || q.trim().length < 2) { setHits(null); setSearchErr(""); return; }
    const ac = new AbortController();
    const t = setTimeout(() => {
      searchCrypto(q, ac.signal).then((h) => { setHits(h); setSearchErr(""); }).catch((e) => {
        if (ac.signal.aborted) return;
        setHits(null);
        setSearchErr(e instanceof RateLimited ? "CoinGecko è occupato: riprova tra un minuto, o scrivi nome e simbolo a mano."
          : navigator.onLine === false ? "Sei offline: scrivi nome e simbolo a mano." : "Ricerca non riuscita: scrivi nome e simbolo a mano.");
      });
    }, 350);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, mode]);

  const isinUp = isin.trim().toUpperCase();
  const isinBad = mode === "security" && !!isinUp && !isValidIsin(isinUp);
  const canSave = !isinBad && (name.trim() || (mode === "security" ? isinUp || symbol.trim() : symbol.trim()));
  const save = () => {
    if (!canSave) return;
    const base = mode === "crypto"
      ? { name: name.trim() || symbol.trim().toUpperCase(), kind: "crypto" as const, symbol: symbol.trim(), coingeckoId: cg || undefined, isin: undefined, currency: "EUR" }
      : { name: name.trim() || isinUp || symbol.trim().toUpperCase(), kind, isin: isinUp || undefined, symbol: symbol.trim() || undefined, coingeckoId: undefined, currency: currency.trim().toUpperCase() || "EUR" };
    if (edit) {
      I.updateInstrument(edit.id, base);
      toast("Strumento aggiornato");
      void I.refreshPrices({ ids: [edit.id] });
      onClose();
      return;
    }
    const before = getSnap().investments?.instruments.length ?? 0;
    const inst = I.addInstrument(base);
    const existed = (getSnap().investments?.instruments.length ?? 0) === before;
    toast(existed ? "Lo strumento c'era già: aggiungi l'operazione" : "Strumento aggiunto");
    void I.refreshPrices({ ids: [inst.id] });
    onCreated(inst.id);
  };

  return (
    <Dialog onClose={onClose} label={edit ? "Modifica strumento" : "Nuovo strumento"}>
      <DialogHead title={edit ? "Modifica strumento" : "Nuovo strumento"} onClose={onClose} />
      <div class="stack" style={{ gap: "12px", marginTop: "14px" }}>
        {!edit && <Seg value={mode} onChange={setMode} label="Tipo" options={[["security", "ETF, azioni e altro"], ["crypto", "Cripto"]]} />}
        {mode === "crypto" ? (
          <>
            <label class="field">Cerca su CoinGecko<input class="input" value={q} autoFocus placeholder="es. bitcoin, ETH, solana" onInput={(e) => setQ(inputVal(e))} /></label>
            {searchErr && <span class="warn" style={{ fontSize: "12.5px" }}>{searchErr}</span>}
            {hits && (hits.length === 0 ? <span class="faint" style={{ fontSize: "12.5px" }}>Nessun risultato.</span> : (
              <div class="list" role="listbox" aria-label="Risultati">
                {hits.map((h) => (
                  <button key={h.id} role="option" aria-selected={cg === h.id} class="li" style={{ ...plainBtn, width: "100%", padding: "7px 4px", borderBottom: "1px solid var(--line)", background: cg === h.id ? "var(--surface-3)" : "none", borderRadius: "8px" }}
                    onClick={() => { setCg(h.id); setName(h.name); setSymbol(h.symbol); }}>
                    <span class="avatar" style={{ width: "28px", height: "28px", fontSize: "13px" }}>🪙</span>
                    <span class="t">{h.name} <span class="faint" style={{ fontWeight: 500 }}>{h.symbol}</span></span>
                    <span class="faint" style={{ fontSize: "11.5px" }}>{h.rank ? "#" + h.rank : ""}{cg === h.id ? " ✓" : ""}</span>
                  </button>
                ))}
              </div>
            ))}
            <div class="row" style={{ gap: "8px" }}>
              <label class="field" style={{ flex: 2 }}>Nome<input class="input" value={name} onInput={(e) => setName(inputVal(e))} placeholder="Bitcoin" /></label>
              <label class="field" style={{ flex: 1 }}>Simbolo<input class="input" value={symbol} onInput={(e) => { setSymbol(inputVal(e)); setCg(""); }} placeholder="BTC" /></label>
            </div>
            <span class="faint" style={{ fontSize: "11.5px" }}>{cg ? `Prezzo da CoinGecko (${cg}).` : "Senza scegliere un risultato il prezzo si cerca dal simbolo, oppure lo inserisci a mano."}</span>
          </>
        ) : (
          <>
            <label class="field">Nome<input class="input" value={name} autoFocus={!edit} onInput={(e) => setName(inputVal(e))} placeholder="es. Vanguard FTSE All-World" /></label>
            <div class="row" style={{ gap: "8px" }}>
              <label class="field" style={{ flex: 2 }}>ISIN<input class="input" value={isin} onInput={(e) => setIsin(inputVal(e))} placeholder="12 caratteri, es. IE00…" style={{ textTransform: "uppercase" }} aria-invalid={isinBad} /></label>
              <label class="field" style={{ flex: 1 }}>Ticker (facoltativo)<input class="input" value={symbol} onInput={(e) => setSymbol(inputVal(e))} placeholder="VWCE" /></label>
            </div>
            {isinBad && <span class="bad" style={{ fontSize: "12.5px" }}>ISIN non valido: controlla i 12 caratteri.</span>}
            <div class="row" style={{ gap: "8px" }}>
              <label class="field" style={{ flex: 2 }}>Tipo<select class="input" value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as InstrumentKind)}>
                {KINDS.filter((k) => k !== "crypto").map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select></label>
              <label class="field" style={{ flex: 1 }}>Valuta<input class="input" value={currency} maxLength={3} onInput={(e) => setCurrency(inputVal(e))} style={{ textTransform: "uppercase" }} /></label>
            </div>
            <span class="faint" style={{ fontSize: "11.5px" }}>Con l'ISIN o il ticker il prezzo si aggiorna da solo; senza, lo inserisci a mano. Gli importi delle operazioni sono sempre in euro.</span>
          </>
        )}
        <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
          <button class="btn ghost" onClick={onClose}>Annulla</button>
          <button class="btn primary" onClick={save} disabled={!canSave}>{edit ? "Salva" : "Aggiungi"}</button>
        </div>
      </div>
    </Dialog>
  );
}

function TradeDialog({ instrumentId, trade, onClose }: { instrumentId?: string; trade?: Trade; onClose: () => void }) {
  const s = getSnap(), d = s.investments;
  const insts = d?.instruments ?? [];
  const [inst, setInst] = useState(trade?.instrumentId ?? instrumentId ?? insts[0]?.id ?? "");
  const kindOf = (id: string) => insts.find((x) => x.id === id)?.kind;
  const defaultAccount = (id: string) => {
    const names = s.accounts.filter((a) => !a.archived).map((a) => a.id);
    const pref = kindOf(id) === "crypto" ? ["Binance"] : ["Trade Republic"];
    return pref.find((x) => names.includes(x)) ?? names[0] ?? "";
  };
  const fmt = (v: number | undefined, digits = 8) => (v == null || !v ? "" : v.toLocaleString("it-IT", { maximumFractionDigits: digits, useGrouping: false }));
  const [side, setSide] = useState<TradeSide>(trade?.side ?? "buy");
  const [date, setDate] = useState(trade?.date ?? todayIso());
  const [q, setQ] = useState(fmt(trade?.quantity));
  const [price, setPrice] = useState(fmt(trade?.price, 6));
  const [fees, setFees] = useState(fmt(trade?.fees, 2));
  const [account, setAccount] = useState(trade?.account ?? defaultAccount(inst));
  const [mid, setMid] = useState(trade?.movementId ?? "");

  const quantity = num(q), unitPrice = num(price), fee = Number.isFinite(num(fees)) ? Math.abs(num(fees)) : 0;
  const linked = new Set((d?.trades ?? []).filter((t) => t.id !== trade?.id).map((t) => t.movementId).filter(Boolean));
  const cands = s.movements.filter((m) => !m.deletedAt && m.account === account && !linked.has(m.id) && (m.type === "invest_buy" || m.type === "invest_sell" || m.id === mid) && (side === "buy" ? amountOf(m) < 0 : amountOf(m) > 0))
    .sort((a, b) => Math.abs(Date.parse(dateOf(a)) - Date.parse(date)) - Math.abs(Date.parse(dateOf(b)) - Date.parse(date))).slice(0, 30);
  const mv = mid ? s.movements.find((m) => m.id === mid) : undefined;
  const ok = !!inst && quantity > 0 && unitPrice >= 0 && Number.isFinite(unitPrice) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const cash = mv ? amountOf(mv) : ok ? tradeCash({ side, quantity, price: unitPrice, fees: fee, amount: 0 }) : 0;
  const held = memo("inv.pos", () => positions(getSnap().investments)).find((p) => p.instrument.id === inst)?.quantity ?? 0;
  const tooMany = side === "sell" && ok && quantity > held + (trade?.side === "sell" ? trade.quantity : 0) + 1e-9;

  const save = () => {
    if (!ok) return;
    const t = { date, instrumentId: inst, account, side, quantity, price: unitPrice, fees: fee, amount: mv ? amountOf(mv) : 0, movementId: mid || undefined };
    if (trade) { I.updateTrade(trade.id, t); toast("Operazione aggiornata"); }
    else { I.addTrade(t); toast(`${SIDE[side]} registrato`); }
    onClose();
  };

  if (!insts.length) return null;
  return (
    <Dialog onClose={onClose} label={trade ? "Modifica operazione" : "Nuova operazione"}>
      <DialogHead title={trade ? "Modifica operazione" : "Nuova operazione"} onClose={onClose} />
      <div class="stack" style={{ gap: "12px", marginTop: "14px" }}>
        <label class="field">Strumento<select class="input" value={inst} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setInst(v); if (!trade) setAccount(defaultAccount(v)); }}>
          {insts.map((x) => <option key={x.id} value={x.id}>{x.name}{x.isin ? " · " + x.isin : x.symbol ? " · " + x.symbol : ""}</option>)}
        </select></label>
        <div class="row wrap" style={{ gap: "8px", alignItems: "flex-end" }}>
          <Seg value={side} onChange={(v) => { setSide(v); setMid(""); }} label="Tipo di operazione" options={[["buy", "Acquisto"], ["sell", "Vendita"]]} />
          <label class="field" style={{ flex: 1, minWidth: "140px" }}>Data<input class="input" type="date" value={date} max={todayIso()} onInput={(e) => setDate(inputVal(e))} /></label>
        </div>
        <div class="row wrap" style={{ gap: "8px" }}>
          <label class="field" style={{ flex: 1, minWidth: "110px" }}>Quantità<input class="input" inputMode="decimal" value={q} autoFocus={!trade} placeholder="es. 0,25" onInput={(e) => setQ(inputVal(e))} /></label>
          <label class="field" style={{ flex: 1, minWidth: "110px" }}>Prezzo unitario €<input class="input" inputMode="decimal" value={price} placeholder="es. 98,40" onInput={(e) => setPrice(inputVal(e))} /></label>
          <label class="field" style={{ flex: 1, minWidth: "110px" }}>Commissioni €<input class="input" inputMode="decimal" value={fees} placeholder="0" onInput={(e) => setFees(inputVal(e))} /></label>
        </div>
        <label class="field">Conto<select class="input" value={account} onChange={(e) => { setAccount((e.target as HTMLSelectElement).value); setMid(""); }}>
          {s.accounts.filter((a) => !a.archived || a.id === account).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
        {cands.length > 0 && (
          <label class="field">Movimento di cassa collegato (facoltativo)<select class="input" value={mid} onChange={(e) => setMid((e.target as HTMLSelectElement).value)}>
            <option value="">— nessuno —</option>
            {cands.map((m) => <option key={m.id} value={m.id}>{fullDate(dateOf(m))} · {descOf(m).slice(0, 48)} · {signedExact(amountOf(m))}</option>)}
          </select></label>
        )}
        {tooMany && <span class="warn" style={{ fontSize: "12.5px" }}>Stai vendendo più di quanto risulta in portafoglio ({qty(held)}).</span>}
        <div class="row between" style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--surface-2)" }}>
          <span class="muted" style={{ fontSize: "12.5px" }}>{mv ? "Importo dal movimento collegato" : side === "buy" ? "Uscita dal conto (commissioni comprese)" : "Entrata sul conto (al netto)"}</span>
          <b class={"money " + (cash > 0 ? "in" : "")}>{ok || mv ? signedExact(cash) : "—"}</b>
        </div>
        <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
          <button class="btn ghost" onClick={onClose}>Annulla</button>
          <button class="btn primary" onClick={save} disabled={!ok}>{trade ? "Salva" : "Registra"}</button>
        </div>
      </div>
    </Dialog>
  );
}

function PriceDialog({ instrumentId, onClose }: { instrumentId: string; onClose: () => void }) {
  const d = getSnap().investments, i = d?.instruments.find((x) => x.id === instrumentId);
  const cur = d?.prices[instrumentId];
  const [v, setV] = useState(cur ? cur.price.toLocaleString("it-IT", { maximumFractionDigits: 6, useGrouping: false }) : "");
  const [date, setDate] = useState(todayIso());
  const [lock, setLock] = useState(!!i?.manualPrice || (i ? !hasLiveSource(i) && !i.manualPrice : false));
  if (!i) return null;
  const p = num(v), ok = Number.isFinite(p) && p >= 0;
  return (
    <Dialog onClose={onClose} label="Prezzo manuale">
      <DialogHead title={"Prezzo di " + i.name} onClose={onClose} />
      <div class="stack" style={{ gap: "12px", marginTop: "14px" }}>
        <div class="row" style={{ gap: "8px" }}>
          <label class="field" style={{ flex: 1 }}>Prezzo unitario €<input class="input" inputMode="decimal" value={v} autoFocus onInput={(e) => setV(inputVal(e))} /></label>
          <label class="field" style={{ flex: 1 }}>Alla data<input class="input" type="date" value={date} max={todayIso()} onInput={(e) => setDate(inputVal(e))} /></label>
        </div>
        {cur && <span class="faint" style={{ fontSize: "12px" }}>Ultimo prezzo: {unit(cur.price)} ({cur.source}, {when(cur.at)})</span>}
        <label class="row" style={{ gap: "8px", fontSize: "13px" }}>
          <input type="checkbox" checked={lock} onChange={(e) => setLock((e.target as HTMLInputElement).checked)} />
          Usa solo il prezzo manuale (non aggiornarlo in automatico)
        </label>
        <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
          <button class="btn ghost" onClick={onClose}>Annulla</button>
          <button class="btn primary" disabled={!ok} onClick={() => { I.setManualPrice(i.id, p, { lock, date }); toast("Prezzo salvato"); onClose(); }}>Salva</button>
        </div>
      </div>
    </Dialog>
  );
}

function DeleteDialog({ instrumentId, onClose }: { instrumentId: string; onClose: () => void }) {
  const d = getSnap().investments, i = d?.instruments.find((x) => x.id === instrumentId);
  if (!i) return null;
  const n = d!.trades.filter((t) => t.instrumentId === i.id).length;
  return (
    <Dialog onClose={onClose} label="Elimina strumento">
      <h2 style={{ marginTop: 0, fontSize: "17px" }}>Eliminare {i.name}?</h2>
      <p class="muted">{n ? `Si eliminano anche ${n === 1 ? "la sua operazione" : `le sue ${n} operazioni`} e i prezzi salvati. ` : ""}I movimenti dei conti restano come sono.</p>
      <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
        <button class="btn ghost" onClick={onClose}>Annulla</button>
        <button class="btn danger" onClick={() => { const r = I.deleteInstrument(i.id); onClose(); if (r) toast("Strumento eliminato", { label: "Annulla", run: () => I.restoreInstrument(r) }); }}>Elimina</button>
      </div>
    </Dialog>
  );
}
