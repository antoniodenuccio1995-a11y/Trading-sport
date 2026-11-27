import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Movement } from "../../domain/types.ts";
import { amountOf, dateOf, descOf, merchantOf, monthKey, norm } from "../../domain/movement.ts";
import { GROUPS, TYPE_LABEL, TYPES, groupOf, isTransfer } from "../../domain/categories.ts";
import { takePendingFilter, type MovementFilter } from "../drill.ts";
import { accById, catById, getSnap, months, statuses } from "../../state/store.ts";
import { setCategory } from "../../state/actions.ts";
import { CategoryPicker, Empty, Money, catColor } from "../components/common.tsx";
import { Icon } from "../icons.tsx";
import { cap, dayLabel, eur, monthLabel, parseAmount, signed } from "../format.ts";
import { MovementDrawer } from "./MovementDrawer.tsx";

type Status = "all" | "review" | "uncat" | "transfer" | "split" | "manual" | "trash";
interface F {
  q: string; account: string; month: string; type: string; cat: string; status: Status; sign: "" | "+" | "-"; min: string; max: string;
  // filtri che arrivano da un clic su grafici ed elenchi (non ricordati tra una visita e l'altra)
  from: string; to: string; group: string; weekday: number; merchant: string; ids: string[] | null; label: string;
}
const F0: F = { q: "", account: "", month: "", type: "", cat: "", status: "all", sign: "", min: "", max: "", from: "", to: "", group: "", weekday: -1, merchant: "", ids: null, label: "" };
const DRILL0 = { from: "", to: "", group: "", weekday: -1, merchant: "", ids: null, label: "" };
const KEY = "fp4.movfilters";
const loadF = (): F => { try { return { ...F0, ...JSON.parse(localStorage.getItem(KEY) || "{}"), q: "", ...DRILL0 }; } catch { return F0; } };
const fromDrill = (d: MovementFilter): F => ({ ...F0, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)), weekday: d.weekday ?? -1, ids: d.ids ?? null, label: d.label ?? "" } as F);
const weekdayOf = (iso: string) => (new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7;

export function Movements({ initialStatus }: { initialStatus?: Status }) {
  const [f, setF] = useState<F>(() => { const d = takePendingFilter(); return d ? fromDrill(d) : { ...loadF(), ...(initialStatus ? { status: initialStatus } : {}) }; });
  useEffect(() => {
    const h = () => { const d = takePendingFilter(); if (d) setF(fromDrill(d)); };
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  const [open, setOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ id: string; rect: DOMRect; dir: "income" | "expense" | "" } | null>(null);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ ...f, q: "", ...DRILL0 })); } catch { /* archivio del browser non disponibile */ } }, [f]);
  const set = (p: Partial<F>) => setF((x) => ({ ...x, ...p }));
  const s = getSnap(), st = statuses(), cats = catById(), accs = accById();

  const base = useMemo(() => {
    const q = norm(f.q), min = parseAmount(f.min), max = parseAmount(f.max);
    const qNum = parseAmount(f.q);
    const sd = s.settings.monthStartDay || 1;
    const ids = f.ids ? new Set(f.ids) : null;
    const catsOf = (m: Movement) => (m.splits.length ? m.splits.map((x) => x.categoryId) : [m.categoryId]);
    return s.movements.filter((m) => {
      if (f.status !== "trash" && m.deletedAt) return false;
      if (ids && !ids.has(m.id)) return false;
      if (f.account && m.account !== f.account) return false;
      const d = dateOf(m);
      if (f.month && monthKey(d, sd) !== f.month) return false;
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      if (f.weekday >= 0 && weekdayOf(d) !== f.weekday) return false;
      if (f.type && m.type !== f.type && !m.splits.some((x) => x.type === f.type)) return false;
      if (f.cat === "none") { if (m.categoryId || !(m.type === "expense" || m.type === "income" || !m.type)) return false; }
      else if (f.cat && !catsOf(m).includes(f.cat)) return false;
      if (f.group && !catsOf(m).some((c) => c.startsWith("exp.") && groupOf(c).id === f.group)) return false;
      if (f.merchant && merchantOf(descOf(m)) !== f.merchant) return false;
      const a = amountOf(m);
      if (f.sign === "+" && !(a > 0)) return false;
      if (f.sign === "-" && !(a < 0)) return false;
      if (Number.isFinite(min) && Math.abs(a) < min) return false;
      if (Number.isFinite(max) && Math.abs(a) > max) return false;
      if (q) {
        const hay = norm(descOf(m) + " " + m.account + " " + (cats.get(m.categoryId)?.label ?? "") + " " + m.counterparty + " " + m.note);
        if (!hay.includes(q) && !(Number.isFinite(qNum) && Math.abs(Math.abs(a) - Math.abs(qNum)) < 0.005)) return false;
      }
      return true;
    });
  }, [s.movements, f.q, f.account, f.month, f.type, f.cat, f.sign, f.min, f.max, f.from, f.to, f.group, f.weekday, f.merchant, f.ids, f.status === "trash", st]);

  const counts = useMemo(() => {
    const c = { all: 0, review: 0, uncat: 0, transfer: 0, split: 0, manual: 0, trash: 0 };
    for (const m of base) {
      if (m.deletedAt) { c.trash++; continue; }
      c.all++;
      const x = st.get(m.id);
      if (x?.kind === "warn") c.review++;
      if (x?.code === "category" || !m.type) c.uncat++;
      if (x?.code === "transfer") c.transfer++;
      if (m.splits.length) c.split++;
      if (m.lock) c.manual++;
    }
    return c;
  }, [base, st]);

  const list = useMemo(() => base.filter((m) => {
    const x = st.get(m.id);
    switch (f.status) {
      case "trash": return !!m.deletedAt;
      case "review": return x?.kind === "warn";
      case "uncat": return x?.code === "category" || !m.type;
      case "transfer": return x?.code === "transfer";
      case "split": return m.splits.length > 0;
      case "manual": return m.lock;
      default: return !m.deletedAt;
    }
  }).sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.amount - a.amount), [base, f.status, st]);

  const total = useMemo(() => list.reduce((acc, m) => { const a = amountOf(m); if (a > 0) acc.in += a; else acc.out -= a; return acc; }, { in: 0, out: 0 }), [list]);
  const active = (["account", "month", "type", "cat", "sign", "min", "max"] as const).filter((k) => f[k]);
  const drilled = !!(f.label || f.from || f.to || f.group || f.weekday >= 0 || f.merchant || f.ids);
  const ms = months();

  const describe = () => {
    if (f.label) return f.label;
    const parts: string[] = [];
    if (f.merchant) parts.push(cap(f.merchant.toLowerCase()));
    if (f.group) parts.push(GROUPS.find((g) => g.id === f.group)?.label ?? f.group);
    if (f.from || f.to) parts.push(f.from === f.to ? f.from : `${f.from || "…"} → ${f.to || "…"}`);
    if (f.weekday >= 0) parts.push(["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"][f.weekday]);
    return parts.join(" · ") || "Selezione";
  };
  return (
    <div class="stack enter">
      {drilled && (
        <div class="card drill">
          <div class="row between wrap" style={{ gap: "10px" }}>
            <div class="row" style={{ gap: "10px", minWidth: 0 }}>
              <span class="drill-ico"><Icon name="filter" size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div class="eyebrow">Stai guardando</div>
                <b style={{ overflowWrap: "anywhere" }}>{describe()}</b>
              </div>
            </div>
            <div class="row" style={{ gap: "8px" }}>
              <span class="faint" style={{ fontSize: "12.5px" }}>{list.length} movimenti · <span class="money">{signed(total.in - total.out)}</span></span>
              <button class="btn sm" onClick={() => { history.length > 1 ? history.back() : setF({ ...F0 }); }}><Icon name="left" />Indietro</button>
              <button class="btn sm ghost" onClick={() => setF({ ...F0 })}>Mostra tutti</button>
            </div>
          </div>
        </div>
      )}
      <div class="card flat" style={{ padding: "14px" }}>
        <div class="filters">
          <div class="search" style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "11px", top: "9px", color: "var(--text-3)" }}><Icon name="search" size={17} /></span>
            <input class="input" style={{ width: "100%", paddingLeft: "36px" }} type="search" placeholder="Cerca descrizione, esercente, categoria o importo…"
              value={f.q} onInput={(e) => set({ q: (e.target as HTMLInputElement).value })} aria-label="Cerca movimenti" />
          </div>
          <select class="input" value={f.account} onChange={(e) => set({ account: (e.target as HTMLSelectElement).value })} aria-label="Conto">
            <option value="">Tutti i conti</option>
            {s.accounts.filter((a) => !a.archived || s.movements.some((m) => m.account === a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select class="input" value={f.month} onChange={(e) => set({ month: (e.target as HTMLSelectElement).value })} aria-label="Mese">
            <option value="">Tutti i mesi</option>
            {[...ms].reverse().map((m) => <option key={m} value={m}>{cap(monthLabel(m))}</option>)}
          </select>
          <select class="input" value={f.type} onChange={(e) => set({ type: (e.target as HTMLSelectElement).value })} aria-label="Tipo">
            <option value="">Tutti i tipi</option>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            <option value="">—</option>
          </select>
          <select class="input" value={f.cat} onChange={(e) => set({ cat: (e.target as HTMLSelectElement).value })} aria-label="Categoria">
            <option value="">Tutte le categorie</option>
            {s.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <details style={{ position: "relative" }}>
            <summary class="btn sm" style={{ listStyle: "none" }}><Icon name="filter" />Importo</summary>
            <div class="card" style={{ position: "absolute", right: 0, top: "40px", zIndex: 10, width: "260px", display: "grid", gap: "10px" }}>
              <label class="field">Segno<select class="input" value={f.sign} onChange={(e) => set({ sign: (e.target as HTMLSelectElement).value as F["sign"] })}><option value="">Entrate e uscite</option><option value="-">Solo uscite</option><option value="+">Solo entrate</option></select></label>
              <div class="row"><label class="field" style={{ flex: 1 }}>Minimo €<input class="input" inputMode="decimal" value={f.min} onInput={(e) => set({ min: (e.target as HTMLInputElement).value })} /></label>
                <label class="field" style={{ flex: 1 }}>Massimo €<input class="input" inputMode="decimal" value={f.max} onInput={(e) => set({ max: (e.target as HTMLInputElement).value })} /></label></div>
            </div>
          </details>
        </div>
        <div class="chips" style={{ marginTop: "10px" }}>
          {([["all", "Tutti"], ["review", "Da controllare"], ["uncat", "Senza categoria"], ["transfer", "Giroconti da abbinare"], ["split", "Divisi"], ["manual", "Modificati a mano"], ["trash", "Cestino"]] as [Status, string][]).map(([k, l]) => (
            <button key={k} class="chip" aria-pressed={f.status === k} onClick={() => set({ status: k })}>{l} <span class="n">{counts[k]}</span></button>
          ))}
          {active.length > 0 && <button class="chip" onClick={() => setF({ ...F0, q: f.q, status: f.status })}><Icon name="x" size={13} />Azzera filtri ({active.length})</button>}
        </div>
        <div class="row" style={{ marginTop: "8px", justifyContent: "flex-end" }}>
          <span class="faint" style={{ fontSize: "12px" }}>{list.length} movimenti · <span class="in money">+{eur(total.in)}</span> · <span class="money">−{eur(total.out)}</span></span>
        </div>
      </div>

      <div class="card" style={{ padding: "8px" }}>
        {list.length === 0 ? (
          <Empty icon={s.movements.length ? "🔍" : "📥"} title={s.movements.length ? "Nessun movimento con questi filtri" : "Ancora nessun movimento"}>
            {s.movements.length ? <button class="btn sm" onClick={() => setF({ ...F0 })}>Mostra tutto</button> : <a class="btn primary" href="#importa">Importa un estratto conto</a>}
          </Empty>
        ) : (
          <VirtualList items={list} selected={open} onOpen={setOpen} onCat={(id, rect, dir) => setPicker({ id, rect, dir })} accColor={(a) => accs.get(a)?.color ?? "var(--s0)"} />
        )}
      </div>
      {picker && <CategoryPicker anchor={picker.rect} direction={picker.dir} value={s.movements.find((m) => m.id === picker.id)?.categoryId ?? ""}
        onClose={() => setPicker(null)} onPick={(c) => { setCategory(picker.id, c); setPicker(null); }} />}
      {open && <MovementDrawer id={open} onClose={() => setOpen(null)} onNext={() => {
        const i = list.findIndex((m) => m.id === open); setOpen(list[i + 1]?.id ?? null);
      }} />}
    </div>
  );
}

const DAY_H = 36, ROW_H = 60;
function VirtualList({ items, selected, onOpen, onCat, accColor }: { items: Movement[]; selected: string | null; onOpen: (id: string) => void; onCat: (id: string, r: DOMRect, dir: "income" | "expense" | "") => void; accColor: (a: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [vh, setVh] = useState(700);
  const st = statuses(), cats = catById();
  const rows = useMemo(() => {
    const out: { kind: "d" | "m"; y: number; day?: string; total?: number; m?: Movement }[] = [];
    let y = 0, cur = "", dayRow: (typeof out)[number] | null = null;
    for (const m of items) {
      const d = dateOf(m);
      if (d !== cur) { cur = d; dayRow = { kind: "d", y, day: d, total: 0 }; out.push(dayRow); y += DAY_H; }
      dayRow!.total! += amountOf(m);
      out.push({ kind: "m", y, m }); y += ROW_H;
    }
    return { out, h: y };
  }, [items]);
  useEffect(() => {
    const el = ref.current!; setVh(el.clientHeight);
    const ro = new ResizeObserver(() => setVh(el.clientHeight)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); setTop(0); }, [items]);
  // ricerca binaria della prima riga visibile
  let lo = 0, hi = rows.out.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rows.out[mid].y + ROW_H < top - 200) lo = mid + 1; else hi = mid; }
  const vis: typeof rows.out = [];
  for (let i = lo; i < rows.out.length && rows.out[i].y < top + vh + 300; i++) vis.push(rows.out[i]);
  return (
    <div class="mv-scroll" ref={ref} onScroll={(e) => setTop((e.target as HTMLElement).scrollTop)} role="list">
      <div style={{ height: rows.h + "px", position: "relative" }}>
        {vis.map((r) => r.kind === "d" ? (
          <div key={"d" + r.day} class="mv-day" style={{ top: r.y + "px" }}><span>{cap(dayLabel(r.day!))}</span><Money v={r.total!} sign class="faint" /></div>
        ) : (() => {
          const m = r.m!, a = amountOf(m), x = st.get(m.id)!, c = cats.get(m.categoryId);
          const tr = isTransfer(m.type);
          const icon = c?.icon ?? (tr ? "⇄" : m.type === "invest_buy" || m.type === "invest_sell" ? "📈" : m.type === "advance_out" ? "🤝" : m.type === "refund_in" ? "↩" : "❔");
          return (
            <div key={m.id} class="mv-row" role="listitem" style={{ top: r.y + "px" }} aria-selected={selected === m.id} onClick={() => onOpen(m.id)}>
              <div class="avatar" style={{ background: c ? `color-mix(in srgb, ${catColor(c.id)} 20%, var(--surface-3))` : undefined }}>{icon}</div>
              <div class="d">
                <div class="t" title={descOf(m)}>{cap(merchantOf(descOf(m)).toLowerCase())}</div>
                <div class="s"><i class="swatch" style={{ background: accColor(m.account), borderRadius: "50%" }} />{m.account}
                  {x.kind === "warn" && <span class="tag warn">{x.label}</span>}
                  {m.splits.length > 0 && <span class="tag">Diviso</span>}
                  {tr && m.counterparty && <span class="faint">{a < 0 ? "→" : "←"} {m.counterparty}</span>}
                  <span class="faint" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{descOf(m)}</span>
                </div>
              </div>
              <div class="cat">
                {tr || m.type === "invest_buy" || m.type === "invest_sell" || m.type === "advance_out" || m.type === "refund_in" ? <span class="tag">{TYPE_LABEL[m.type]}</span> : (
                  <button class={"tag" + (c ? "" : " warn")} style={{ border: 0, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onCat(m.id, (e.currentTarget as HTMLElement).getBoundingClientRect(), m.type === "income" ? "income" : m.type === "expense" ? "expense" : ""); }}>
                    {c ? <><i class="swatch" style={{ background: catColor(c.id) }} />{c.label}</> : "Scegli categoria"}
                  </button>
                )}
              </div>
              <div class={"a money " + (a > 0 ? "in" : "")}>{a > 0 ? "+" : "−"}{eur(Math.abs(a))}</div>
            </div>
          );
        })())}
      </div>
    </div>
  );
}
