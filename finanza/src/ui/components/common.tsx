import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../icons.tsx";
import type { Category, MovementType } from "../../domain/types.ts";
import { GROUPS, groupOf, TYPE_LABEL, TYPES } from "../../domain/categories.ts";
import { getSnap } from "../../state/store.ts";
import { signed } from "../format.ts";

// ---------- toast ----------
type T = { id: number; text: string; action?: { label: string; run: () => void } };
let push: (t: Omit<T, "id">) => void = () => {};
export const toast = (text: string, action?: T["action"]) => push({ text, action });
export function Toasts() {
  const [items, set] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    push = (t) => { const id = ++n; set((x) => [...x.slice(-2), { ...t, id }]); setTimeout(() => set((x) => x.filter((y) => y.id !== id)), t.action ? 6000 : 3200); };
  }, []);
  return (
    <div class="toast-wrap" role="status" aria-live="polite">
      {items.map((t) => (
        <div class="toast" key={t.id}>{t.text}{t.action && <button class="btn sm" onClick={() => { t.action!.run(); set((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}</div>
      ))}
    </div>
  );
}

// ---------- cassetto laterale / dialogo ----------
export function Drawer({ onClose, children, label }: { onClose: () => void; children: ComponentChildren; label: string }) {
  useEscape(onClose);
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <aside class="drawer" role="dialog" aria-modal="true" aria-label={label}>{children}</aside>
    </>
  );
}
export function Dialog({ onClose, children, label }: { onClose: () => void; children: ComponentChildren; label: string }) {
  useEscape(onClose);
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="dialog" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </>
  );
}
function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") fn(); };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [fn]);
}

// ---------- selettore categoria (popover con ricerca) ----------
export function CategoryPicker({ anchor, value, direction, onPick, onClose }: {
  anchor: DOMRect; value: string; direction?: "income" | "expense" | ""; onPick: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useEffect(() => {
    const h = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(() => addEventListener("pointerdown", h), 0);
    ref.current?.querySelector("input")?.focus();
    return () => removeEventListener("pointerdown", h);
  }, []);
  // le categorie nascoste non si offrono, salvo quella già scelta (resta visibile finché non la si cambia)
  const cats = getSnap().categories.filter((c) => (c.status !== "inactive" || c.id === value) && (!direction || c.direction === direction) && (!q || c.label.toLowerCase().includes(q.toLowerCase())));
  const top = Math.min(anchor.bottom + 6, innerHeight - 390), left = Math.min(anchor.left, innerWidth - 310);
  const groups: [string, Category[]][] = [];
  const inc = cats.filter((c) => c.direction === "income");
  if (inc.length) groups.push(["Entrate", inc]);
  for (const g of GROUPS) { const cs = cats.filter((c) => c.direction === "expense" && groupOf(c.id).id === g.id); if (cs.length) groups.push([g.label, cs]); }
  return (
    <div class="picker" ref={ref} style={{ top: Math.max(8, top) + "px", left: Math.max(8, left) + "px" }} role="listbox">
      <input class="input" placeholder="Cerca categoria…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => { if (e.key === "Enter" && cats[0]) onPick(cats[0].id); }} />
      <button onClick={() => onPick("")} class={value === "" ? "on" : ""}><span class="faint">— Nessuna categoria</span></button>
      {groups.map(([label, cs]) => (
        <div key={label}>
          <div class="grp">{label}</div>
          {cs.map((c) => (
            <button key={c.id} class={c.id === value ? "on" : ""} onClick={() => onPick(c.id)} role="option" aria-selected={c.id === value}>
              <span>{c.icon}</span><span style={{ flex: 1 }}>{c.label}</span>
              {c.id === value && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      ))}
      <a href="#categorie" onClick={onClose}
        style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", padding: "9px 9px 5px", borderTop: "1px solid var(--line)", fontSize: "12.5px", fontWeight: 600 }}>
        <Icon name="settings" size={14} />Gestisci categorie
      </a>
    </div>
  );
}

export function TypeSelect({ value, onChange }: { value: MovementType; onChange: (t: MovementType) => void }) {
  return (
    <select class="input" value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as MovementType)}>
      <option value="">{TYPE_LABEL[""]}</option>
      {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
    </select>
  );
}

export function Money({ v, sign = false, class: cls = "" }: { v: number; sign?: boolean; class?: string }) {
  return <span class={"money " + cls}>{sign ? signed(v) : signed(v).replace(/^\+/, "")}</span>;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ComponentChildren }) {
  return <div class="empty"><div class="em">{icon}</div><b>{title}</b>{children}</div>;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label?: string }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function catColor(categoryId: string): string {
  if (categoryId.startsWith("inc.")) return "var(--in)";
  return `var(--s${groupOf(categoryId).slot})`;
}
