// Movimenti di quota: partita (apertura → chiusura, rilevazioni) e studio storico del campionato.
import { useEffect, useMemo, useState } from "preact/hooks";
import { oddsHistory, type OddsSnap } from "../../data/odds";
import { played, type Match } from "../../data/types";
import { MOVE_LABEL, STRONG, moveStudy, movesBetween, openCloseMoves, type Move, type MoveSel } from "../../stats/moves";
import { Card, Seg, fmtOdd } from "../components/common";

const pts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(".", ",")} pt`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const roi = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(".", ",")}%`;

function MoveTable({ moves, from, to }: { moves: Move[]; from: string; to: string }) {
  return (
    <div class="tw"><table class="t">
      <thead><tr><th class="l">Esito</th><th>{from}</th><th>{to}</th><th>Quota</th><th title="Variazione della probabilità senza margine">Probabilità</th><th class="l"></th></tr></thead>
      <tbody>{moves.map((x) => (
        <tr key={x.sel} class={x.strong ? "mv-strong" : ""}>
          <td class="l">{MOVE_LABEL[x.sel]}</td><td>{fmtOdd(x.early)}</td><td>{fmtOdd(x.close)}</td>
          <td class={x.dOdd < -0.005 ? "mv-down" : x.dOdd > 0.005 ? "mv-up" : "muted"}>{x.dOdd < -0.005 ? "▼" : x.dOdd > 0.005 ? "▲" : "="} {Math.abs(x.dOdd * 100).toFixed(0)}%</td>
          <td>{pts(x.dP)}</td>
          <td class="l">{x.strong ? <span class="pill back">{x.dP > 0 ? "il mercato ci crede di più" : "il mercato ci crede di meno"}</span> : null}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

const point = (s: OddsSnap) => ({ h: s.o_h, d: s.o_d, a: s.o_a, o: s.o_o25, u: s.o_u25 });
const when = (iso: string) => new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function MatchMoves({ m }: { m: Match }) {
  const oc = openCloseMoves(m);
  const [hist, setHist] = useState<OddsSnap[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (played(m)) return;
    let alive = true;
    oddsHistory(m.id).then((h) => alive && setHist(h)).catch((e) => alive && setErr((e as Error).message));
    return () => { alive = false; };
  }, [m.id]);
  if (played(m) || oc.length) {
    if (!oc.length) return null;
    return (
      <Card title="Movimenti di quota">
        <MoveTable moves={oc} from="Apertura" to="Chiusura" />
        <p class="note">Quote medie dei bookmaker (football-data): apertura = prime quote rilevate, chiusura = prima del calcio d'inizio. Quota scesa ▼ = il mercato crede di più in quell'esito. Evidenziati i movimenti di almeno {Math.round(STRONG * 100)} punti di probabilità.</p>
      </Card>
    );
  }
  const first = hist?.[0], last = hist?.[hist.length - 1];
  const mv = first && last && hist!.length > 1 ? movesBetween(point(first), point(last)) : [];
  return (
    <Card title="Movimenti di quota">
      {err ? <p class="muted">Storico delle quote non raggiungibile ({err}).</p>
        : hist === null ? <p class="muted">Carico lo storico delle quote…</p>
        : !hist.length ? <p class="muted">Ancora nessuna quota registrata per questa partita.</p>
        : <>
          {mv.length ? <MoveTable moves={mv} from={`${when(first!.taken_at)}`} to={`${when(last!.taken_at)}`} /> : <p class="muted">Una sola rilevazione finora ({when(first!.taken_at)}): i movimenti compaiono quando la quota cambia.</p>}
          <div class="tw"><table class="t snaps">
            <thead><tr><th class="l">Rilevazione</th><th>1</th><th>X</th><th>2</th><th>Over 2,5</th><th>Under 2,5</th><th>Betfair 1 · X · 2</th></tr></thead>
            <tbody>{[...hist].reverse().slice(0, 12).map((s) => (
              <tr key={s.taken_at}><td class="l">{when(s.taken_at)}</td><td>{fmtOdd(s.o_h)}</td><td>{fmtOdd(s.o_d)}</td><td>{fmtOdd(s.o_a)}</td><td>{fmtOdd(s.o_o25)}</td><td>{fmtOdd(s.o_u25)}</td>
                <td>{s.bf_h ? `${fmtOdd(s.bf_h)} · ${fmtOdd(s.bf_d)} · ${fmtOdd(s.bf_a)}` : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </>}
      <p class="note">Ogni cambio di quota viene salvato. Oggi la fonte (football-data) aggiorna le quote un paio di volte a settimana; con il collegamento a Betfair le rilevazioni saranno ogni pochi minuti e i movimenti improvvisi verranno segnalati.</p>
    </Card>
  );
}

/** Campionato: cosa succede quando la quota scende o sale tra apertura e chiusura (tutto lo storico). */
export function LeagueMoves({ list, name }: { list: Match[]; name: string }) {
  const [sel, setSel] = useState<MoveSel>("1");
  const b = useMemo(() => moveStudy(list, sel), [list, sel]);
  const tot = b.reduce((s, x) => s + x.n, 0);
  if (!tot) return <Card><p class="empty">Per questo campionato mancano le quote di apertura e chiusura.</p></Card>;
  const top = b[0];
  return (
    <Card flush title="Quando la quota si muove" right={<Seg<MoveSel> label="Esito" value={sel} onChange={setSel} options={[["1", "1 · casa"], ["2", "2 · ospite"], ["o25", "Over 2,5"], ["u25", "Under 2,5"]]} />}>
      {top.n >= 20 && <p class="lead-line">In {name}, quando la quota di <b>{MOVE_LABEL[sel]}</b> scende di almeno 5 punti tra apertura e chiusura ({top.n} partite), l'esito esce nel <b>{pct(top.wins / top.n)}</b> dei casi: l'apertura diceva {pct(top.pEarly)}, la chiusura {pct(top.pClose)}.</p>}
      <div class="tw"><table class="t">
        <thead><tr><th class="l">Movimento (probabilità)</th><th>Partite</th><th>Esito uscito</th><th>Prob. apertura</th><th>Prob. chiusura</th><th title="Back a quota media di apertura, per 1 € puntato">Resa back apertura</th><th title="Back a quota media di chiusura, per 1 € puntato">Resa back chiusura</th></tr></thead>
        <tbody>{b.map((x, i) => (
          <tr key={x.label}>
            <td class="l">{x.label} <span class="muted">{i === 0 ? "≥ 5 pt" : i === 1 ? "2–5 pt" : i === 2 ? "± 2 pt" : i === 3 ? "2–5 pt" : "≥ 5 pt"}</span></td>
            <td>{x.n}</td>
            <td>{x.n ? pct(x.wins / x.n) : "—"}</td>
            <td>{x.n ? pct(x.pEarly) : "—"}</td><td>{x.n ? pct(x.pClose) : "—"}</td>
            <td class={x.n ? (x.roiEarly >= 0 ? "pos" : "neg") : ""}>{x.n ? roi(x.roiEarly) : "—"}</td>
            <td class={x.n ? (x.roiClose >= 0 ? "pos" : "neg") : ""}>{x.n ? roi(x.roiClose) : "—"}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <p class="note" style="padding:0 14px 12px">Tutte le stagioni in archivio, quote medie dei bookmaker (football-data). Probabilità senza margine. La resa è quella di un back a quota media: sugli exchange la quota è di solito più alta, ma c'è la commissione. La colonna "apertura" misura il vantaggio di chi entra prima che la quota si muova; a movimento avvenuto (chiusura) il vantaggio sparisce quasi sempre.</p>
    </Card>
  );
}
