import { useMemo, useState } from "preact/hooks";
import type { Period } from "../../analytics/common.ts";
import { monthBounds } from "../../analytics/dates.ts";
import { getSnap, lines, memo } from "../../state/store.ts";
import * as D from "../../state/derived.ts";
import { Empty, Seg, catColor } from "../components/common.tsx";
import { FlowBars, SimpleBars } from "../charts/Bars.tsx";
import { Heatmap, Sankey, Spark } from "../charts/Shapes.tsx";
import { LineChart } from "../charts/LineChart.tsx";
import { goMovements, type MovementFilter } from "../drill.ts";
import { Icon } from "../icons.tsx";
import { addMonths, cap, eur, eurShort, fullDate, monthLabel, pct, shortDate } from "../format.ts";

type R = "1" | "3" | "6" | "12" | "ytd" | "all";
const KEY = "fp4.analysis.range";

export function Analysis() {
  const s = getSnap(), ms = D.allMonths();
  const [range, setRangeS] = useState<R>(() => { try { return (localStorage.getItem(KEY) as R) || "6"; } catch { return "6"; } });
  const setRange = (r: R) => { setRangeS(r); try { localStorage.setItem(KEY, r); } catch { /* ignora */ } };
  const [end, setEnd] = useState(D.currentMonth());
  const [cat, setCat] = useState<string | null>(null);
  if (!s.movements.length) return <Empty icon="📊" title="Nessun dato da analizzare"><a class="btn primary" href="#importa">Importa i movimenti</a></Empty>;
  const sd = s.settings.monthStartDay || 1;
  const first = ms[0] ?? end;
  const clamp = (m: string) => (m < first ? first : m);
  const startMonth = range === "all" ? first : range === "ytd" ? clamp(end.slice(0, 4) + "-01") : clamp(addMonths(end, -(Number(range) - 1)));
  const period: Period = range === "1" ? end : { from: monthBounds(startMonth, sd).start, to: monthBounds(end, sd).end };
  const label = range === "1" ? cap(monthLabel(end)) : `${cap(monthLabel(startMonth))} – ${monthLabel(end)}`;
  const pts = D.series().points.filter((p) => p.month >= (range === "1" ? clamp(addMonths(end, -11)) : startMonth) && p.month <= end);
  const inP = D.series().points.filter((p) => p.month >= startMonth && p.month <= end);
  const pf: MovementFilter = typeof period === "string" ? { month: period } : { from: period.from, to: period.to };
  const tot = inP.reduce((a, p) => ({ income: a.income + p.income, expense: a.expense + p.expense }), { income: 0, expense: 0 });

  return (
    <div class="stack enter">
      <div class="card flat row wrap between" style={{ padding: "12px 14px", position: "sticky", top: "8px", zIndex: 8, backdropFilter: "blur(12px)", background: "color-mix(in srgb, var(--surface-1) 88%, transparent)" }}>
        <Seg value={range} onChange={setRange} label="Periodo" options={[["1", "Mese"], ["3", "3 mesi"], ["6", "6 mesi"], ["12", "12 mesi"], ["ytd", "Da inizio anno"], ["all", "Tutto"]]} />
        <div class="row" style={{ gap: "8px" }}>
          <span class="faint" style={{ fontSize: "12.5px" }}>{range === "1" ? "Mese" : "Fino a"}</span>
          <select class="input" value={end} onChange={(e) => setEnd((e.target as HTMLSelectElement).value)} aria-label="Mese di fine">
            {[...ms].reverse().map((m) => <option key={m} value={m}>{cap(monthLabel(m))}</option>)}
          </select>
        </div>
      </div>

      <div class="grid g-4">
        <Stat label="Entrate" v={eur(tot.income)} dot="var(--in)" onClick={() => goMovements({ ...pf, type: "income", label: `Entrate · ${label}` })} />
        <Stat label="Uscite" v={eur(tot.expense)} dot="var(--out)" onClick={() => goMovements({ ...pf, type: "expense", label: `Uscite · ${label}` })} />
        <Stat label="Risparmio" v={eur(tot.income - tot.expense)} dot="var(--text)" onClick={() => goMovements({ ...pf, label: `Movimenti · ${label}` })} />
        <Stat label="Tasso di risparmio" v={tot.income > 0 ? ((tot.income - tot.expense) / tot.income < -1 ? "< −100%" : pct((tot.income - tot.expense) / tot.income)) : "—"} foot={label} />
      </div>

      <SankeyCard period={period} label={label} pf={pf} />

      <div class="card">
        <div class="card-head"><div><h2>Entrate e uscite per mese</h2><p class="hint">Clicca un mese per analizzarlo da solo.</p></div></div>
        <FlowBars data={pts.map((p) => ({ key: p.month, label: cap(monthLabel(p.month)), short: monthLabel(p.month, true), income: p.income, expense: p.expense }))}
          format={eur} tick={eurShort} selected={range === "1" ? end : undefined}
          onSelect={(m, part) => goMovements({ month: m, ...(part === "in" ? { type: "income" } : part === "out" ? { type: "expense" } : {}), label: `${part === "in" ? "Entrate" : part === "out" ? "Uscite" : "Movimenti"} di ${monthLabel(m)}` })} />
      </div>

      <div class="grid g-2">
        <CategoriesCard period={period} pf={pf} label={label} onTrend={setCat} selected={cat} />
        {cat ? <CategoryDetail id={cat} period={period} pf={pf} end={end} onClose={() => setCat(null)} /> : <MerchantsCard period={period} pf={pf} />}
      </div>

      <div class="grid g-2">
        <CalendarCard period={period} />
        <WeekdayCard period={period} pf={pf} label={label} />
      </div>

      {cat && <MerchantsCard period={period} pf={pf} />}
      <RecurringTable />
      <AnomaliesCard month={end} />
    </div>
  );
}

function Stat({ label, v, dot, foot, onClick }: { label: string; v: string; dot?: string; foot?: string; onClick?: () => void }) {
  return <div class={"card" + (onClick ? " clickable" : "")} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}><div class="kpi"><span class="label">{dot && <i class="swatch" style={{ background: dot, borderRadius: "50%" }} />}{label}</span><span class="value money">{v}</span>{foot && <span class="foot">{foot}</span>}</div></div>;
}

function SankeyCard({ period, label, pf }: { period: Period; label: string; pf: MovementFilter }) {
  const narrow = typeof innerWidth === "number" && innerWidth < 700;
  const sk = D.sankey(period, narrow ? 0 : 3);
  const color = (n: { kind: string; slot?: number }) =>
    n.kind === "income" ? "var(--in)" : n.kind === "hub" ? "var(--accent)" : n.kind === "saving" ? "var(--good)" : n.kind === "invest" ? "var(--s2)" :
    n.kind === "refund" || n.kind === "adjustment" ? "var(--s0)" : `var(--s${n.slot ?? 0})`;
  const nodes = sk.nodes.map((n) => ({ id: n.id, label: n.label, color: color(n) }));
  const h = Math.max(300, Math.min(520, sk.nodes.length * 26));
  return (
    <div class="card">
      <div class="card-head"><div><h2>Flusso di cassa</h2><p class="hint">Da dove arrivano i soldi e dove vanno · {label}. Passa sopra un flusso per l'importo.</p></div>
        <div class="row wrap" style={{ gap: "6px" }}>
          {sk.totals.saved > 0 && <span class="tag good">Risparmiati {eur(sk.totals.saved)}</span>}
          {sk.totals.fromSavings > 0 && <span class="tag bad">Presi dai risparmi {eur(sk.totals.fromSavings)}</span>}
          {sk.totals.invested > 0 && <span class="tag">Investiti {eur(sk.totals.invested)}</span>}
        </div></div>
      {sk.links.length ? <Sankey nodes={nodes} links={sk.links} height={h} format={eur} onPick={(id) => {
        const name = nodes.find((n) => n.id === id)?.label ?? "";
        const f: MovementFilter | null =
          id.startsWith("inc:") ? { cat: id.slice(4) || "none", type: "income" } :
          id.startsWith("grp:") ? { group: id.slice(4), type: "expense" } :
          id.startsWith("cat:altro:") ? { group: id.slice(10), type: "expense" } :
          id.startsWith("cat:") ? { cat: id.slice(4) || "none", type: "expense" } :
          id === "investito" ? { type: "invest_buy" } : id === "disinvestito" ? { type: "invest_sell" } :
          id === "entrate" ? { type: "income" } : null;
        if (f) goMovements({ ...pf, ...f, label: `${name} · ${label}` });
      }} /> : <p class="faint">Nessun movimento classificato nel periodo.</p>}
    </div>
  );
}

function CategoriesCard({ period, pf, label, onTrend, selected }: { period: Period; pf: MovementFilter; label: string; onTrend: (id: string) => void; selected: string | null }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const b = D.breakdown(period, kind);
  const rows = b.categories.filter((c) => Math.abs(c.total) > 0.005);
  const max = Math.max(1, ...rows.map((c) => Math.max(c.total, c.previous.base)));
  return (
    <div class="card">
      <div class="card-head"><div><h2>Categorie</h2><p class="hint">Totale {eur(b.total)} · il segno verticale è il periodo precedente di uguale durata. Clicca una categoria per i movimenti, 📈 per l'andamento.</p></div>
        <Seg value={kind} onChange={setKind} options={[["expense", "Uscite"], ["income", "Entrate"]]} /></div>
      {!rows.length ? <p class="faint">Nessun movimento.</p> : (
        <div class="rank">
          {rows.map((c, i) => (
            <div class="rank-row clickable pad" key={c.id} style={{ background: selected === c.id ? "var(--surface-2)" : undefined }}
              onClick={() => goMovements({ ...pf, cat: c.id || "none", type: kind, label: `${c.label} · ${label}` })}>
              <div class="name"><span>{c.icon}</span><span>{c.label}</span></div>
              <div class="v money row" style={{ gap: "6px" }}>{eur(c.total)} <span class="faint" style={{ fontWeight: 500, fontSize: "11.5px" }}>{c.share != null ? pct(c.share) : ""}</span>
                <button class="icon-btn trend-btn" title="Andamento della categoria" aria-label={"Andamento di " + c.label} onClick={(e) => { e.stopPropagation(); onTrend(c.id); }}>📈</button></div>
              <div class="track">
                <div class="fill" style={{ width: (Math.max(0, c.total) / max) * 100 + "%", background: kind === "income" ? "var(--in)" : catColor(c.id), animationDelay: Math.min(i, 12) * 30 + "ms" }} />
                {c.previous.base > 0 && <span class="mark" style={{ left: `calc(${(c.previous.base / max) * 100}% - 1px)` }} />}
              </div>
              <div class="meta">
                <span>{c.count} movimenti</span>
                {c.previous.pct != null && Math.abs(c.previous.pct) >= 0.05 && <span class={(c.previous.pct > 0) === (kind === "expense") ? "bad" : "in"}>{c.previous.pct > 0 ? "+" : ""}{pct(c.previous.pct)} sul periodo prima</span>}
                {c.avg6 && c.avg6.pct != null && Math.abs(c.avg6.pct) >= 0.1 && <span>media 6 mesi {eur(c.avg6.base)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryDetail({ id, period, pf, end, onClose }: { id: string; period: Period; pf: MovementFilter; end: string; onClose: () => void }) {
  const c = getSnap().categories.find((x) => x.id === id);
  const ser = D.series();
  const arr = (id.startsWith("inc.") ? ser.incomeByCategory[id] : ser.expenseByCategory[id]) ?? [];
  const idx = ser.months.indexOf(end);
  const from = Math.max(0, idx - 11);
  const months = ser.months.slice(from, idx + 1), vals = arr.slice(from, idx + 1);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const mer = D.merchants(period, 400).items.filter((m) => m.categoryId === id).slice(0, 8);
  return (
    <div class="card">
      <div class="card-head"><div><h2>{c?.icon} {c?.label}</h2><p class="hint">Ultimi 12 mesi · media {eur(avg)} al mese · clicca un mese per i movimenti</p></div>
        <div class="row" style={{ gap: "6px" }}><button class="btn sm" onClick={() => goMovements({ ...pf, cat: id || "none", label: `${c?.label ?? "Senza categoria"}` })}><Icon name="list" />Movimenti</button><button class="btn sm ghost" onClick={onClose}>Chiudi</button></div></div>
      <LineChart xLabels={months.map((m) => cap(monthLabel(m)))} axisLabel={(i) => monthLabel(months[i], true)} tickEvery={Math.max(1, Math.ceil(months.length / 6))}
        yFormat={eur} yTick={eurShort} height={180} series={[{ id: "c", label: c?.label ?? id, color: id.startsWith("inc.") ? "var(--in)" : catColor(id), values: vals, area: true }]}
        onPick={(i) => goMovements({ cat: id || "none", month: months[i], label: `${c?.label ?? "Senza categoria"} · ${monthLabel(months[i])}` })} />
      <div class="eyebrow" style={{ margin: "14px 0 6px" }}>Dove, nel periodo</div>
      {!mer.length ? <p class="faint">Nessun esercente nel periodo.</p> : (
        <div class="list">{mer.map((m) => (
          <div class="li clickable" key={m.merchant} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }} onClick={() => goMovements({ ...pf, merchant: m.merchant, label: `${cap(m.merchant.toLowerCase())} · ${c?.label ?? ""}` })}>
            <div><div class="t">{cap(m.merchant.toLowerCase())}</div><div class="s">{m.count} volte · scontrino medio {eur(m.average)}</div></div>
            <div class="money" style={{ fontWeight: 650 }}>{eur(m.total)}</div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function MerchantsCard({ period, pf }: { period: Period; pf: MovementFilter }) {
  const t = D.merchants(period, 10);
  const cats = new Map(getSnap().categories.map((c) => [c.id, c]));
  return (
    <div class="card">
      <h2>Dove spendi di più</h2>
      <p class="hint">Primi 10 esercenti per totale speso{t.others.merchants ? ` · altri ${t.others.merchants} per ${eur(t.others.total)}` : ""}.</p>
      {!t.items.length ? <p class="faint">Nessuna uscita nel periodo.</p> : (
        <div class="scroll-x"><table class="tbl">
          <thead><tr><th>Esercente</th><th>Categoria</th><th class="r">Volte</th><th class="r">Medio</th><th class="r">Totale</th></tr></thead>
          <tbody>{t.items.map((m) => { const c = cats.get(m.categoryId); return (
            <tr key={m.merchant} class="clickable" onClick={() => goMovements({ ...pf, merchant: m.merchant, label: cap(m.merchant.toLowerCase()) })}><td><b>{cap(m.merchant.toLowerCase())}</b><div class="faint" style={{ fontSize: "11.5px" }}>ultima {shortDate(m.last)}</div></td>
              <td>{c ? <span class="tag"><i class="swatch" style={{ background: catColor(c.id) }} />{c.label}</span> : <span class="faint">—</span>}</td>
              <td class="r num">{m.count}</td><td class="r num">{eur(m.average)}</td><td class="r num"><b>{eur(m.total)}</b></td></tr>
          ); })}</tbody>
        </table></div>
      )}
    </div>
  );
}

function CalendarCard({ period }: { period: Period }) {
  const d = D.daily(period);
  const map = useMemo(() => new Map(d.days.map((x) => [x.date, x.expense])), [d]);
  const weeks = Math.min(53, Math.max(5, Math.ceil((Date.parse(d.to) - Date.parse(d.from)) / (7 * 86400000)) + 1));
  const top = [...d.days].sort((a, b) => b.expense - a.expense).slice(0, 3).filter((x) => x.expense > 0);
  return (
    <div class="card">
      <h2>Calendario della spesa</h2>
      <p class="hint">Ogni quadrato è un giorno: più scuro, più speso. Esclusi giroconti e investimenti.</p>
      <Heatmap days={map} end={d.to} weeks={weeks} format={eur} levels={d.thresholds.length === 4 ? d.thresholds : undefined}
        onPick={(day) => goMovements({ from: day, to: day, label: `Movimenti del ${day.split("-").reverse().join("/")}` })} />
      {top.length > 0 && <p class="faint" style={{ fontSize: "12px", marginBottom: 0 }}>Giorni più cari: {top.map((x) => `${fullDate(x.date)} (${eur(x.expense)})`).join(" · ")}</p>}
    </div>
  );
}

function WeekdayCard({ period, pf, label }: { period: Period; pf: MovementFilter; label: string }) {
  const w = D.weekdays(period);
  const b = w.busiest != null ? w.days[w.busiest] : null;
  return (
    <div class="card">
      <h2>Giorni della settimana</h2>
      <p class="hint">Spesa media per giorno{b ? ` · il più caro è il ${b.label} (${eur(b.average)})` : ""}.</p>
      <SimpleBars data={w.days.map((x) => ({ label: x.short, value: x.average, note: `${x.count} movimenti in ${x.occurrences} giorni` }))} format={eur} height={190}
        onPick={(i) => goMovements({ ...pf, weekday: i, type: "expense", label: `Uscite di ${w.days[i].label} · ${label}` })} />
    </div>
  );
}

function RecurringTable() {
  const rec = D.recurring();
  const byLine = memo("lineById", () => new Map(lines().map((l) => [l.id, l])));
  const [show, setShow] = useState<"active" | "all">("active");
  const list = rec.filter((r) => show === "all" || r.status !== "ended");
  const out = list.filter((r) => r.direction === "out");
  return (
    <div class="card" id="ricorrenti">
      <div class="card-head"><div><h2>Abbonamenti e spese ricorrenti</h2>
        <p class="hint">Riconosciuti da cadenza regolare e importo stabile. {out.length} in uscita per circa {eur(out.reduce((a, r) => a + r.annualized, 0))} l'anno.</p></div>
        <Seg value={show} onChange={setShow} options={[["active", "Attivi"], ["all", "Anche conclusi"]]} /></div>
      {!list.length ? <p class="faint">Nessuna ricorrenza riconosciuta.</p> : (
        <div class="scroll-x"><table class="tbl">
          <thead><tr><th>Voce</th><th>Cadenza</th><th class="r">Importo</th><th class="r">All'anno</th><th>Prossimo</th><th>Andamento</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id} class="clickable" style={{ opacity: r.status === "ended" ? 0.55 : 1 }} onClick={() => goMovements({ ids: [...new Set(r.lineIds.map((x) => x.split("::")[0]))], label: `${r.label} · ${r.cadenceLabel}` })}>
              <td><b>{r.label}</b><div class="faint" style={{ fontSize: "11.5px" }}>{r.account} · {r.count} volte dal {shortDate(r.first)} {r.first.slice(0, 4)}</div></td>
              <td>{r.cadenceLabel}</td>
              <td class={"r num " + (r.direction === "in" ? "in" : "")}>{r.direction === "in" ? "+" : ""}{eur(r.expectedAmount)}{r.variable && <div class="faint" style={{ fontSize: "11px" }}>variabile</div>}</td>
              <td class="r num">{eur(r.annualized)}</td>
              <td>{r.status === "ended" ? <span class="tag">concluso</span> : r.status === "late" ? <span class="tag warn">in ritardo di {r.daysOverdue} g</span> : fullDate(r.nextExpected)}
                {r.priceChange && <div><span class={"tag " + (r.priceChange.pct > 0 ? "bad" : "good")}>{r.priceChange.pct > 0 ? "▲" : "▼"} {pct(Math.abs(r.priceChange.pct))} da {shortDate(r.priceChange.since)}</span></div>}</td>
              <td><Spark values={r.lineIds.map((id) => Math.abs(byLine.get(id)?.amount ?? 0)).slice(-12)} width={80} height={26} area={false} color={r.direction === "in" ? "var(--in)" : catColor(r.categoryId)} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function AnomaliesCard({ month }: { month: string }) {
  const list = D.anomalies(month);
  return (
    <div class="card">
      <h2>Fuori dal solito · {monthLabel(month)}</h2>
      <p class="hint">Spese molto più alte del normale per quell'esercente o categoria, e nuovi esercenti con importi alti.</p>
      {!list.length ? <p class="faint">Niente di insolito questo mese.</p> : (
        <div class="list">{list.slice(0, 10).map((a, i) => (
          <div class="li clickable" key={i} onClick={() => goMovements(a.lineId ? { ids: [a.lineId.split("::")[0]], label: a.reason } : { cat: a.categoryId || "none", month, label: a.reason })}>
            <div class="avatar">{a.severity === "high" ? "🔴" : a.severity === "medium" ? "🟠" : "🟡"}</div>
            <div><div class="t" style={{ whiteSpace: "normal" }}>{a.reason}</div><div class="s">{a.date ? fullDate(a.date) : ""}{a.expected != null ? ` · di solito ${eur(a.expected)}` : ""}</div></div>
            <div class="money" style={{ fontWeight: 650 }}>{eur(a.amount)}</div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

