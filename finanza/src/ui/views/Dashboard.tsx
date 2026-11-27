import { useState } from "preact/hooks";
import { accountBalances } from "../../analytics/balances.ts";
import { getSnap, lines, memo } from "../../state/store.ts";
import * as D from "../../state/derived.ts";
import * as A from "../../state/actions.ts";
import { catColor } from "../components/common.tsx";
import { Icon } from "../icons.tsx";
import { goMovements } from "../drill.ts";
import { monthBounds, addDays } from "../../analytics/dates.ts";
import { CountUp } from "../charts/base.tsx";
import { LineChart } from "../charts/LineChart.tsx";
import { Donut, Ring, Spark } from "../charts/Shapes.tsx";
import { addMonths, cap, eur, eurShort, monthLabel, pct, shortDate } from "../format.ts";

export function Dashboard() {
  const s = getSnap();
  const ms = D.allMonths();
  const [month, setMonth] = useState(D.currentMonth());
  if (!s.movements.length) return <Welcome />;
  const k = D.kpis();
  const nw = D.netWorth();
  const pt = D.series().points.find((p) => p.month === month) ?? { income: 0, expense: 0, net: 0, savingsRate: null };
  const prevPt = D.series().points.find((p) => p.month === addMonths(month, -1));
  const isCurrent = month === D.currentMonth();
  const fc = isCurrent ? D.forecast(month) : null;
  const nw12 = nw.netWorth.length > 12 ? nw.netWorth[nw.netWorth.length - 13] : nw.netWorth[0] ?? 0;
  const pfo = D.portfolio();
  const hasPf = pfo.totals.open > 0;
  // con un portafoglio registrato il patrimonio usa il valore di mercato degli investimenti, non il solo capitale versato
  const netNow = hasPf ? k.liquidity + pfo.totals.marketValue : k.netWorth;
  const first = ms[0] ?? month, last = ms[ms.length - 1] ?? month;

  return (
    <div class="stack enter">
      <div class="grid g-hero">
        <div class="card hero">
          <div class="row between"><span class="eyebrow">Patrimonio netto</span><a class="faint" href="#conti" style={{ fontSize: "12px" }}>Conti →</a></div>
          <div class="big"><CountUp value={netNow} format={eur} /></div>
          <div class="row wrap" style={{ gap: "8px", marginBottom: "6px" }}>
            <span class={"delta " + (k.netWorth >= nw12 ? "up" : "down")}>{k.netWorth >= nw12 ? "▲" : "▼"} {eur(Math.abs(k.netWorth - nw12))} in 12 mesi</span>
            {k.emergencyFundMonths != null && <span class="delta" title="Liquidità divisa per la spesa media mensile degli ultimi 6 mesi">🛟 {k.emergencyFundMonths.toFixed(1).replace(".", ",")} mesi di spese coperti</span>}
          </div>
          <Spark values={nw.netWorth.slice(-18)} width={560} height={78} fluid />
          <div class="grid g-3" style={{ marginTop: "12px", gap: "10px" }}>
            <div class="kpi"><span class="label">Liquidità</span><span class="value money" style={{ fontSize: "18px" }}>{eur(k.liquidity)}</span></div>
            {hasPf ? (
              <a class="kpi clickable kpi-click" href="#investimenti" style={{ color: "inherit" }}><span class="label">Investimenti</span><span class="value money" style={{ fontSize: "18px" }}>{eur(pfo.totals.marketValue)}</span>
                <span class="foot"><span class={pfo.totals.unrealized >= 0 ? "in" : "bad"}>{pfo.totals.unrealized >= 0 ? "+" : "−"}{eur(Math.abs(pfo.totals.unrealized))}{pfo.totals.unrealizedPct != null ? ` (${pct(pfo.totals.unrealizedPct)})` : ""}</span> sul versato</span></a>
            ) : <div class="kpi"><span class="label">Investito (al costo)</span><span class="value money" style={{ fontSize: "18px" }}>{eur(k.investedNet)}</span></div>}
            <div class="kpi"><span class="label">Risparmio 12 mesi</span><span class="value money" style={{ fontSize: "18px" }}>{eur(k.last12.net)}</span><span class="foot">{k.last12.savingsRate != null ? pct(k.last12.savingsRate) + " delle entrate" : ""}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="row between">
            <button class="icon-btn" disabled={month <= first} onClick={() => setMonth(addMonths(month, -1))} aria-label="Mese precedente"><Icon name="left" /></button>
            <div style={{ textAlign: "center" }}><div class="eyebrow">{isCurrent ? "Questo mese" : "Mese"}</div><b style={{ fontSize: "16px" }}>{cap(monthLabel(month))}</b></div>
            <button class="icon-btn" disabled={month >= last} onClick={() => setMonth(addMonths(month, 1))} aria-label="Mese successivo"><Icon name="right" /></button>
          </div>
          <div class="grid g-2" style={{ gap: "14px", marginTop: "16px" }}>
            <Kpi label="Entrate" dot="var(--in)" v={pt.income} prev={prevPt?.income} good="up" onClick={() => goMovements({ month, type: "income", label: `Entrate di ${monthLabel(month)}` })} />
            <Kpi label="Uscite" dot="var(--out)" v={pt.expense} prev={prevPt?.expense} good="down" onClick={() => goMovements({ month, type: "expense", label: `Uscite di ${monthLabel(month)}` })} />
            <Kpi label="Risparmio" dot="var(--text)" v={pt.net} prev={prevPt?.net} good="up" onClick={() => goMovements({ month, label: `Tutti i movimenti di ${monthLabel(month)}` })} />
            <div class="kpi"><span class="label">Tasso di risparmio</span><span class="value">{rateText(pt.income, pt.savingsRate)}</span><span class="foot">{pt.income > 0 && pt.savingsRate != null && pt.savingsRate < -1 ? "uscite molto oltre le entrate" : prevPt?.savingsRate != null && prevPt.income > 0 ? "mese prima " + rateText(prevPt.income, prevPt.savingsRate) : ""}</span></div>
          </div>
          {fc && (
            <div class="card flat" style={{ marginTop: "16px", padding: "12px", background: "var(--surface-2)" }}>
              <div class="row between"><span class="eyebrow">Previsione a fine mese</span><span class="faint" style={{ fontSize: "11.5px" }}>{fc.daysRemaining} giorni rimasti</span></div>
              <div class="row between" style={{ marginTop: "6px", alignItems: "baseline" }}>
                <span>Uscite <b class="money">{eur(fc.projected.expense)}</b> <span class="faint money" style={{ fontSize: "12px" }}>({eur(fc.low.expense)}–{eur(fc.high.expense)})</span></span>
                <span>Risparmio <b class={"money " + (fc.projected.net < 0 ? "bad" : "in")}>{eur(fc.projected.net)}</b></span>
              </div>
              {fc.pending.length > 0 && (() => {
                const pin = fc.pending.filter((p) => p.direction === "in"), pout = fc.pending.filter((p) => p.direction === "out");
                const sum = (a: typeof pin) => a.reduce((t, p) => t + Math.abs(p.amount), 0);
                return <div class="faint" style={{ fontSize: "12px", marginTop: "6px" }}>Attesi ancora: {[pin.length ? `${pin.map((p) => p.label).slice(0, 2).join(", ")} +${eur(sum(pin))}` : "", pout.length ? `${pout.length} addebiti ricorrenti −${eur(sum(pout))}` : ""].filter(Boolean).join(" · ")}.</div>;
              })()}
            </div>
          )}
        </div>
      </div>

      <div class="grid g-2">
        <PaceCard month={month} />
        <WhereCard month={month} />
      </div>

      <div class="grid g-3">
        <BudgetCard month={month} />
        <RecurringCard />
        <InsightsCard />
      </div>

      <AccountsStrip />
    </div>
  );
}

function Kpi({ label, dot, v, prev, good, onClick }: { label: string; dot: string; v: number; prev?: number; good: "up" | "down"; onClick?: () => void }) {
  const d = prev != null ? v - prev : null;
  const better = d != null && (good === "up" ? d >= 0 : d <= 0);
  return (
    <div class={"kpi" + (onClick ? " clickable kpi-click" : "")} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && e.key === "Enter") onClick(); }}>
      <span class="label"><i class="swatch" style={{ background: dot, borderRadius: "50%" }} />{label}</span>
      <span class="value"><CountUp value={v} format={eur} duration={600} /></span>
      {d != null && Math.abs(d) >= 1 && <span class="foot"><span class={better ? "in" : "bad"}>{d > 0 ? "+" : "−"}{eur(Math.abs(d))}</span> sul mese prima</span>}
    </div>
  );
}

/** Tasso di risparmio leggibile: oltre ±100% (entrate minime) non è un numero utile. */
function rateText(income: number, rate: number | null): string {
  if (rate == null || income <= 0) return "—";
  if (rate < -1) return "< −100%";
  return pct(rate);
}

function PaceCard({ month }: { month: string }) {
  const p = D.pace(month);
  const n = p.days;
  const labels = Array.from({ length: n }, (_, i) => `Giorno ${i + 1}`);
  const v = p.vsPrevious ?? p.vsAverage;
  const ref = p.vsPrevious ? "a " + monthLabel(p.previousMonth).split(" ")[0] : "alla media";
  return (
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Ritmo di spesa</h2>
          <p class="hint">Uscite cumulate giorno per giorno, a confronto con il mese prima e con la media di {p.averageMonths} mesi.</p>
        </div>
      </div>
      {v && (
        <div style={{ marginBottom: "8px" }}>
          <span class="mid money">{eur(v.current)}</span>
          <span class={"delta " + (v.status === "behind" ? "up" : v.status === "ahead" ? "down" : "")} style={{ marginLeft: "10px" }}>
            {v.status === "inline" ? "in linea" : (v.diff > 0 ? "+" : "−") + eur(Math.abs(v.diff))} rispetto {ref} al giorno {v.day}
          </span>
        </div>
      )}
      <LineChart xLabels={labels} axisLabel={(i) => String(i + 1)} tickEvery={7} yFormat={eur} yTick={eurShort} height={262}
        pickHint="Clicca per le uscite di quel giorno"
        onPick={(i) => { const d = addDays(monthBounds(month).start, i); goMovements({ from: d, to: d, type: "expense", label: `Uscite del ${d.split("-").reverse().join("/")}` }); }}
        markers={p.day && p.day < n ? [{ x: p.day - 1, label: "oggi" }] : []}
        series={[
          ...(p.average ? [{ id: "avg", label: `Media ${p.averageMonths} mesi`, color: "var(--s1)", values: p.average, width: 1.5 }] : []),
          ...(p.previous ? [{ id: "prev", label: cap(monthLabel(p.previousMonth)), color: "var(--text-3)", values: p.previous, dashed: true }] : []),
          { id: "cur", label: cap(monthLabel(month)), color: "var(--accent)", values: p.current, area: true, width: 2.5 },
        ]} />
      <PaceStats month={month} />
    </div>
  );
}

function PaceStats({ month }: { month: string }) {
  const p = D.pace(month);
  const spent = p.current.filter((v) => v != null).at(-1) ?? 0;
  const days = Math.max(1, p.day || p.days);
  const fc = month === D.currentMonth() ? D.forecast(month) : null;
  const avgEnd = p.average?.at(-1) ?? null;
  const proj = fc ? fc.projected.expense : spent;
  return (
    <div class="mini-stats">
      <div><span>Media al giorno</span><b class="money"><CountUp value={spent / days} format={eur} duration={600} /></b></div>
      <div><span>{fc ? "Previsione a fine mese" : "Totale del mese"}</span><b class="money"><CountUp value={proj} format={eur} duration={600} /></b></div>
      <div><span>Media 6 mesi, mese intero</span><b class="money">{avgEnd != null ? eur(avgEnd) : "—"}</b>
        {avgEnd != null && avgEnd > 0 && <small class={proj > avgEnd ? "bad" : "in"}>{proj > avgEnd ? "+" : "−"}{eur(Math.abs(proj - avgEnd))}</small>}</div>
    </div>
  );
}

function WhereCard({ month }: { month: string }) {
  const b = D.breakdown(month);
  const segs = b.groups.filter((g) => g.total > 0).map((g) => ({ id: g.id, label: g.label, value: g.total, color: `var(--s${g.slot})` }));
  const top = b.categories.filter((c) => c.total > 0).slice(0, 6);
  const max = Math.max(1, ...top.map((c) => Math.max(c.total, c.avg6?.base ?? 0)));
  return (
    <div class="card">
      <div class="card-head"><div><h2>Dove vanno i soldi</h2><p class="hint">Uscite di {monthLabel(month)} per gruppo e prime categorie. Il segno verticale è la media degli ultimi 6 mesi.</p></div>
        <a class="faint" href="#analisi" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>Analisi →</a></div>
      {b.total <= 0 ? <UncatHint month={month} /> : (
        <div class="row wrap" style={{ gap: "20px", alignItems: "flex-start" }}>
          <Donut segs={segs} format={eur} size={176} onPick={(g) => goMovements({ group: g, month, type: "expense", label: `${segs.find((x) => x.id === g)?.label} · ${monthLabel(month)}` })} center={<div><div class="faint" style={{ fontSize: "11.5px" }}>Uscite</div><div class="mid money" style={{ fontSize: "19px" }}>{eur(b.total)}</div></div>} />
          <div class="rank" style={{ flex: "1 1 220px", minWidth: 0 }}>
            {top.map((c, i) => (
              <div class="rank-row clickable pad" key={c.id} onClick={() => goMovements({ cat: c.id || "none", month, label: `${c.label} · ${monthLabel(month)}` })}>
                <div class="name"><span>{c.icon}</span><span>{c.label}</span></div>
                <div class="v money">{eur(c.total)}</div>
                <div class="track">
                  <div class="fill" style={{ width: (c.total / max) * 100 + "%", background: catColor(c.id), animationDelay: i * 40 + "ms" }} />
                  {c.avg6 && c.avg6.base > 0 && <span class="mark" style={{ left: `calc(${(c.avg6.base / max) * 100}% - 1px)` }} title={"Media 6 mesi " + eur(c.avg6.base)} />}
                </div>
                {c.avg6 && c.avg6.pct != null && Math.abs(c.avg6.pct) >= 0.1 && <div class="meta"><span class={c.avg6.pct > 0 ? "bad" : "in"}>{c.avg6.pct > 0 ? "+" : ""}{pct(c.avg6.pct)} sulla media</span></div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {segs.length > 1 && <div class="legend">{segs.map((x) => <span key={x.id}><i style={{ background: x.color }} />{x.label}</span>)}</div>}
    </div>
  );
}

function UncatHint({ month }: { month: string }) {
  const n = memo("uncat" + month, () => lines().filter((l) => l.month === month && l.amount < 0 && (!l.type || (l.type === "expense" && !l.categoryId))).length);
  return (
    <div class="empty" style={{ padding: "26px 10px" }}>
      <div class="em">🧾</div>
      <b>Nessuna uscita classificata in {monthLabel(month)}</b>
      {n > 0 ? <button class="btn sm primary" onClick={() => goMovements({ month, status: "uncat", label: `Da classificare · ${monthLabel(month)}` })}>Classifica {n} uscite</button>
        : <span class="faint">Importa gli estratti conto del mese per vederle qui.</span>}
    </div>
  );
}

function BudgetCard({ month }: { month: string }) {
  const b = D.budget(month);
  const color = (st: string) => (st === "sforato" ? "var(--bad)" : st === "attenzione" ? "var(--warn)" : "var(--good)");
  const items = [...b.items].sort((x, y) => y.pct - x.pct).slice(0, 5);
  return (
    <div class="card">
      <div class="card-head"><div><h2>Budget</h2><p class="hint">{b.daysElapsed} giorni su {b.daysTotal}</p></div><a class="faint" href="#budget" style={{ fontSize: "12px" }}>Gestisci →</a></div>
      {!b.items.length ? <p class="faint">Nessun budget impostato per questo mese. <a href="#budget">Imposta</a></p> : (
        <>
          <div class="row" style={{ gap: "14px", marginBottom: "14px" }}>
            <Ring pct={b.totals.pct ?? 0} size={58} stroke={7} color={color(b.totals.status)} />
            <div><div class="mid money">{eur(b.totals.spent)} <span class="faint" style={{ fontSize: "13px", fontWeight: 500 }}>di {eur(b.totals.budget)}</span></div>
              <div class="faint" style={{ fontSize: "12px" }}>A fine mese circa {eur(b.totals.projected)} · {b.totals.status === "ok" ? "nei limiti" : b.totals.status}</div></div>
          </div>
          <div class="stack" style={{ gap: "10px" }}>
            {items.map((x, i) => (
              <div key={x.categoryId} class="clickable pad" onClick={() => goMovements({ cat: x.categoryId, month, label: `${x.label} · budget ${monthLabel(month)}` })}>
                <div class="row between" style={{ fontSize: "12.5px", marginBottom: "4px" }}><span>{x.icon} {x.label}</span><span class="money faint">{eur(x.spent)} / {eur(x.budget)}</span></div>
                <div class="bar" style={{ position: "relative" }}>
                  <span style={{ width: Math.min(100, x.pct * 100) + "%", background: color(x.status), animationDelay: i * 40 + "ms" }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RecurringCard() {
  const rec = D.recurring().filter((r) => r.status !== "ended" && r.direction === "out");
  const monthly = rec.reduce((a, r) => a + r.monthly, 0);
  const next = [...rec].sort((a, b) => a.nextExpected.localeCompare(b.nextExpected)).slice(0, 6);
  return (
    <div class="card">
      <div class="card-head"><div><h2>Ricorrenti</h2><p class="hint">{rec.length} addebiti periodici · circa {eur(monthly)} al mese</p></div><a class="faint" href="#analisi" style={{ fontSize: "12px" }}>Tutti →</a></div>
      {!next.length ? <p class="faint">Nessun addebito periodico riconosciuto (servono almeno 3 ripetizioni regolari).</p> : (
        <div class="list">
          {next.map((r) => (
            <div class="li clickable" key={r.id} onClick={() => goMovements({ ids: [...new Set(r.lineIds.map((x) => x.split("::")[0]))], label: `${r.label} · ${r.cadenceLabel}` })}>
              <div class="avatar" style={{ background: `color-mix(in srgb, ${catColor(r.categoryId)} 20%, var(--surface-3))` }}>{r.kind === "subscription" ? "🔁" : "🧾"}</div>
              <div><div class="t">{r.label}</div><div class="s">{r.cadenceLabel} · {r.status === "late" ? <span class="warn">in ritardo</span> : "prossimo " + shortDate(r.nextExpected)}{r.priceChange && <span class="bad"> · {r.priceChange.pct > 0 ? "+" : ""}{pct(r.priceChange.pct)}</span>}</div></div>
              <div class="money" style={{ fontWeight: 650 }}>{eur(r.expectedAmount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightsCard() {
  const list = D.insights();
  const icon = { good: "✅", warn: "⚠️", info: "💡" } as const;
  return (
    <div class="card">
      <h2><Icon name="sparkles" size={16} />Da sapere</h2>
      <p class="hint">Calcolato sui tuoi dati, aggiornato a ogni importazione.</p>
      {!list.length ? <p class="faint">Servono più mesi di dati per i confronti.</p> : (
        <div class="list">
          {list.slice(0, 6).map((x) => (
            <div class="li" key={x.id} style={{ gridTemplateColumns: "auto minmax(0,1fr)", alignItems: "start" }}>
              <span style={{ fontSize: "15px", lineHeight: "20px" }}>{icon[x.kind]}</span>
              <span style={{ fontSize: "13px", lineHeight: 1.45 }}>{x.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountsStrip() {
  const s = getSnap();
  const b = memo("balances.m", () => accountBalances(lines(), s.accounts, { granularity: "month", monthStartDay: 1 }));
  const acc = b.accounts.filter((a) => !a.archived || Math.abs(a.current) > 0.005).sort((x, y) => y.current - x.current);
  const color = (id: string) => s.accounts.find((a) => a.id === id)?.color ?? "var(--s0)";
  return (
    <div class="card">
      <div class="card-head"><h2>Conti</h2><a class="faint" href="#conti" style={{ fontSize: "12px" }}>Dettagli →</a></div>
      <div class="grid g-4" style={{ gap: "10px" }}>
        {acc.map((a) => (
          <div key={a.id} class="row between clickable" style={{ padding: "10px 12px", borderRadius: "14px", background: "var(--surface-2)" }} onClick={() => goMovements({ account: a.id, label: `Conto ${a.name}` })}>
            <div style={{ minWidth: 0 }}>
              <div class="row" style={{ gap: "7px", fontSize: "12.5px", fontWeight: 600, whiteSpace: "nowrap" }}><i class="swatch" style={{ background: color(a.id), borderRadius: "50%" }} />{a.name}</div>
              <div class={"money " + (a.current < 0 ? "bad" : "")} style={{ fontWeight: 700, fontSize: "16px", marginTop: "2px" }}>{eur(a.current)}</div>
            </div>
            <Spark values={a.series.slice(-8)} color={color(a.id)} width={64} height={30} area={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div class="card hero enter" style={{ padding: "34px 26px" }}>
      <div class="eyebrow">Benvenuto</div>
      <div class="big" style={{ maxWidth: "680px" }}>Tutti i tuoi conti, in un colpo d'occhio.</div>
      <p class="muted" style={{ maxWidth: "620px", lineHeight: 1.6 }}>Importa gli estratti conto delle tue banche o il backup della versione precedente. I dati restano su questo dispositivo: nessun server, nessun account.</p>
      <div class="row wrap" style={{ gap: "10px", marginTop: "18px" }}>
        <a class="btn primary" href="#importa"><Icon name="upload" />Importa i tuoi dati</a>
        <button class="btn" onClick={() => void A.loadDemo()}><Icon name="sparkles" />Esplora con dati dimostrativi</button>
      </div>
    </div>
  );
}
