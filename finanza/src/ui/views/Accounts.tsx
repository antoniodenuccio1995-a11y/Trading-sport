import { useState } from "preact/hooks";
import type { Account } from "../../domain/types.ts";
import { accountBalances } from "../../analytics/balances.ts";
import { openAdvances } from "../../analytics/advances.ts";
import { getSnap, lines, memo } from "../../state/store.ts";
import * as A from "../../state/actions.ts";
import { Empty, Seg, toast } from "../components/common.tsx";
import { LineChart } from "../charts/LineChart.tsx";
import { CountUp } from "../charts/base.tsx";
import { Spark } from "../charts/Shapes.tsx";
import { cap, eur, eurShort, fullDate, monthLabel, parseAmount } from "../format.ts";

const KIND: Record<Account["kind"], string> = { bank: "Conto corrente", card: "Carta / conto app", cash: "Contanti", broker: "Broker", crypto: "Cripto", wallet: "Wallet", other: "Altro" };

export function Accounts() {
  const s = getSnap();
  const [range, setRange] = useState<"12" | "24" | "all">("12");
  const [edit, setEdit] = useState<string | null>(null);
  const b = memo("balances.m", () => accountBalances(lines(), s.accounts, { granularity: "month", monthStartDay: 1 }));
  const adv = memo("advances", () => openAdvances(lines()));
  if (!s.movements.length) return <Empty icon="🏦" title="Nessun conto con movimenti"><a class="btn primary" href="#/importa">Importa un estratto conto</a></Empty>;
  const n = range === "all" ? b.keys.length : Math.min(b.keys.length, Number(range));
  const k0 = b.keys.length - n;
  const keys = b.keys.slice(k0);
  const last = (arr: number[]) => arr[arr.length - 1] ?? 0;
  const prev12 = b.netWorth[Math.max(0, b.keys.length - 13)] ?? 0;
  const lastDate = new Map<string, string>();
  for (const m of s.movements) if (!m.deletedAt && (lastDate.get(m.account) ?? "") < m.date) lastDate.set(m.account, m.date);
  const visible = b.accounts.filter((a) => !a.archived || Math.abs(a.current) > 0.005);
  const color = (id: string) => s.accounts.find((a) => a.id === id)?.color ?? "var(--s0)";

  return (
    <div class="stack enter">
      <div class="grid g-hero">
        <div class="card hero">
          <div class="eyebrow">Patrimonio netto</div>
          <div class="big"><CountUp value={b.current.netWorth} format={eur} /></div>
          <div class="row wrap" style={{ gap: "8px" }}>
            <span class={"delta " + (b.current.netWorth >= prev12 ? "up" : "down")}>{b.current.netWorth >= prev12 ? "▲" : "▼"} {eur(Math.abs(b.current.netWorth - prev12))} in 12 mesi</span>
            <span class="faint" style={{ fontSize: "12.5px" }}>Liquidità {eur(b.current.liquidity)} · Investito (al costo) {eur(b.current.investedAtCost)}</span>
          </div>
          <div style={{ marginTop: "14px" }}>
            <div class="row between" style={{ marginBottom: "4px" }}><span class="faint" style={{ fontSize: "12px" }}>Andamento</span>
              <Seg value={range} onChange={setRange} options={[["12", "12 mesi"], ["24", "24 mesi"], ["all", "Tutto"]]} /></div>
            <LineChart xLabels={keys.map((k) => cap(monthLabel(k)))} axisLabel={(i) => monthLabel(keys[i], true)} tickEvery={Math.max(1, Math.ceil(keys.length / 6))}
              yFormat={eur} yTick={eurShort} zero={false} height={230}
              series={[
                { id: "nw", label: "Patrimonio", color: "var(--accent)", values: b.netWorth.slice(k0), area: true, width: 2.5 },
                { id: "liq", label: "Liquidità", color: "var(--s1)", values: b.liquidity.slice(k0) },
                { id: "inv", label: "Investito", color: "var(--s2)", values: b.invested.slice(k0), dashed: true },
              ]} />
          </div>
        </div>
        <div class="card">
          <h2>Crediti verso altri</h2>
          <p class="hint">Anticipi pagati per altre persone e rimborsi ricevuti.</p>
          {adv.items.length === 0 ? <p class="faint">Nessun anticipo registrato.</p> : (
            <>
              <div class="mid money" style={{ marginBottom: "10px" }}>{eur(adv.totals.outstanding)} <span class="faint" style={{ fontSize: "13px", fontWeight: 500 }}>da recuperare</span></div>
              <div class="list">
                {adv.items.slice(0, 8).map((x) => (
                  <div class="li" key={x.key}>
                    <div class="avatar">🤝</div>
                    <div><div class="t">{x.counterparty || "Senza nome"}</div><div class="s">{x.count} movimenti · ultimo {fullDate(x.lastDate)}</div></div>
                    <div style={{ textAlign: "right" }}><div class={"money " + (x.outstanding > 0.005 ? "warn" : "in")} style={{ fontWeight: 650 }}>{x.outstanding > 0.005 ? eur(x.outstanding) : "Saldato"}</div><div class="faint" style={{ fontSize: "11.5px" }}>anticipati {eur(x.advanced)}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div class="grid g-3">
        {visible.map((a) => {
          const acc = s.accounts.find((x) => x.id === a.id);
          return (
            <div class="card" key={a.id}>
              <div class="row between">
                <div class="row" style={{ gap: "9px" }}><i class="swatch" style={{ background: color(a.id), width: "11px", height: "11px", borderRadius: "50%" }} /><b>{a.name}</b></div>
                <span class="faint" style={{ fontSize: "11.5px" }}>{KIND[a.kind]}</span>
              </div>
              <div class="row between" style={{ alignItems: "flex-end", marginTop: "10px" }}>
                <div>
                  <div class={"mid money " + (a.current < 0 ? "bad" : "")}>{eur(a.current)}</div>
                  <div class="faint" style={{ fontSize: "11.5px" }}>{lastDate.get(a.id) ? "ultimo movimento " + fullDate(lastDate.get(a.id)!) : "nessun movimento"}</div>
                </div>
                <Spark values={a.series.slice(-12)} color={color(a.id)} width={110} height={40} />
              </div>
              {edit === a.id && acc ? <AccountEditor a={acc} onDone={() => setEdit(null)} /> : <button class="btn sm ghost" style={{ marginTop: "8px", paddingLeft: 0 }} onClick={() => setEdit(a.id)}>Saldo iniziale e colore</button>}
            </div>
          );
        })}
      </div>
      <p class="faint" style={{ fontSize: "12px" }}>Saldo = saldo iniziale + tutti i movimenti del conto (giroconti compresi). Se un saldo non torna con la banca, controlla il saldo iniziale e la data a cui si riferisce. Ultimo aggiornamento: {last(b.liquidity) ? "ora" : "—"}.</p>
    </div>
  );
}

function AccountEditor({ a, onDone }: { a: Account; onDone: () => void }) {
  const [v, setV] = useState(String(a.initialBalance).replace(".", ","));
  const [d, setD] = useState(a.initialDate);
  const [c, setC] = useState(a.color);
  return (
    <div class="stack" style={{ gap: "8px", marginTop: "10px" }}>
      <div class="row" style={{ gap: "8px" }}>
        <label class="field" style={{ flex: 1 }}>Saldo iniziale €<input class="input" inputMode="decimal" value={v} onInput={(e) => setV((e.target as HTMLInputElement).value)} /></label>
        <label class="field" style={{ flex: 1 }}>Alla data<input class="input" type="date" value={d} onInput={(e) => setD((e.target as HTMLInputElement).value)} /></label>
        <label class="field">Colore<input type="color" value={c.startsWith("#") ? c : "#6c7988"} onInput={(e) => setC((e.target as HTMLInputElement).value)} style={{ width: "40px", height: "36px", border: 0, background: "none" }} /></label>
      </div>
      <div class="row" style={{ gap: "8px" }}>
        <button class="btn sm primary" onClick={() => { const n = parseAmount(v); A.updateAccount(a.id, { initialBalance: Number.isFinite(n) ? n : 0, initialDate: d, color: c }); toast("Conto aggiornato"); onDone(); }}>Salva</button>
        <button class="btn sm ghost" onClick={onDone}>Annulla</button>
        <label class="row" style={{ gap: "6px", marginLeft: "auto", fontSize: "12.5px" }}><input type="checkbox" checked={a.archived} onChange={(e) => A.updateAccount(a.id, { archived: (e.target as HTMLInputElement).checked })} />Archiviato</label>
      </div>
      <span class="faint" style={{ fontSize: "11.5px" }}>Senza data, il saldo iniziale vale prima del primo movimento. Con una data, i movimenti precedenti sono considerati già inclusi.</span>
    </div>
  );
}
