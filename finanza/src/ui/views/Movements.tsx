import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Movement } from "../../domain/types.ts";
import { amountOf, dateOf, descOf, merchantOf, norm } from "../../domain/movement.ts";
import { TYPE_LABEL, TYPES, isTransfer } from "../../domain/categories.ts";
import { accById, catById, getSnap, months, statuses } from "../../state/store.ts";
import { setCategory } from "../../state/actions.ts";
import { CategoryPicker, Empty, Money, catColor } from "../components/common.tsx";
import { Icon } from "../icons.tsx";
import { cap, dayLabel, eur, monthLabel, parseAmount } from "../format.ts";
import { MovementDrawer } from "./MovementDrawer.tsx";

type Status = "all" | "review" | "uncat" | "transfer" | "split" | "manual" | "trash";
interface F { q: string; account: string; month: string; type: string; cat: string; status: Status; sign: "" | "+" | "-"; min: string; max: string }
const F0: F = { q: "", account: "", month: "", type: "", cat: "", status: "all", sign: "", min: "", max: "" };
const KEY = "fp4.movfilters";
const loadF = (): F => { try { return { ...F0, ...JSON.parse(localStorage.getItem(KEY) || "{}"), q: "" }; } catch { return F0; } };

export function Movements({ initialStatus }: { initialStatus?: Status }) {
  const [f, setF] = useState<F>(() => ({ ...loadF(), ...(initialStatus ? { status: initialStatus } : {}) }));
  const [open, setOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ id: string; rect: DOMRect; dir: "income" | "expense" | "" } | null>(null);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ ...f, q: "" })); } catch { /* archivio del browser non disponibile */ } }, [f]);
  const set = (p: Partial<F>) => setF((x) => ({ ...x, ...p }));
  const s = getSnap(), st = statuses(), cats = catById(), accs = accById();

  const base = useMemo(() => {
    const q = norm(f.q), min = parseAmount(f.min), max = parseAmount(f.max);
    const qNum = parseAmount(f.q);
    return s.movements.filter((m) => {
      if (f.status !== "trash" && m.deletedAt) return false;
      if (f.account && m.account !== f.account) return false;
      const d = dateOf(m);
      if (f.month && !d.startsWith(f.month)) return false;
      if (f.type && m.type !== f.type) return false;
      if (f.cat && m.categoryId !== f.cat) return false;
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
  }, [s.movements, f.q, f.account, f.month, f.type, f.cat, f.sign, f.min, f.max, f.status === "trash", st]);

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
  const ms = months();

  return (
    <div class="stack enter">
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
