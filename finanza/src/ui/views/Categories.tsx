import { useState } from "preact/hooks";
import type { Category, CategoryDirection } from "../../domain/types.ts";
import { GROUPS, categoryGroupId, defaultGroupId, defaultGroupLabel, findGroup, isDefaultCategory, type Group } from "../../domain/categories.ts";
import { addMonths, monthBounds } from "../../analytics/dates.ts";
import { isExpenseLine, isIncomeLine, spendOf } from "../../analytics/common.ts";
import { getSnap, lines, memo } from "../../state/store.ts";
import * as D from "../../state/derived.ts";
import * as C from "../../state/categoryActions.ts";
import { Dialog, Seg, toast } from "../components/common.tsx";
import { goMovements } from "../drill.ts";
import { Icon } from "../icons.tsx";
import { eur, fullDate, int } from "../format.ts";

const EMOJI = ["🛒", "🍽️", "🍕", "☕", "🍺", "🎉", "🎬", "🎮", "🎵", "✈️", "🏖️", "🏠", "💡", "🚗", "⛽", "🚆", "💊", "💈", "👕", "🎁", "🐶", "👶", "📚", "💻"];

interface Stat { n: number; total: number }
const NONE: Stat = { n: 0, total: 0 };

/** Movimenti e totale per categoria negli ultimi 12 mesi contabili (memorizzati per versione dei dati). */
function useStats(): { from: string; get: (id: string) => Stat } {
  const s = getSnap();
  const from = monthBounds(addMonths(D.currentMonth(), -11), s.settings.monthStartDay || 1).start;
  const by = memo("catstats:" + from, () => {
    const ids = new Map<string, Set<string>>(), tot = new Map<string, number>();
    for (const l of lines()) {
      if (!l.categoryId || l.date < from) continue;
      let set = ids.get(l.categoryId);
      if (!set) { set = new Set(); ids.set(l.categoryId, set); }
      set.add(l.parentId); // un movimento diviso in due quote della stessa categoria conta una volta
      const v = isExpenseLine(l) ? spendOf(l) : isIncomeLine(l) ? l.amount : 0;
      if (v) tot.set(l.categoryId, (tot.get(l.categoryId) ?? 0) + v);
    }
    const out = new Map<string, Stat>();
    for (const [id, set] of ids) out.set(id, { n: set.size, total: Math.round((tot.get(id) ?? 0) * 100) / 100 });
    return out;
  });
  return { from, get: (id) => by.get(id) ?? NONE };
}

const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`;
const byOrder = (a: Category, b: Category) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label);

type Target = { id: string } | { direction: CategoryDirection };

export function CategoriesView() {
  const s = getSnap();
  const st = useStats();
  const [q, setQ] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [edit, setEdit] = useState<Target | null>(null);
  const all = [...s.categories].sort(byOrder);
  const hiddenN = all.filter((c) => c.status === "inactive").length;
  const needle = q.trim().toLowerCase();
  const shown = (c: Category) => (showHidden || c.status !== "inactive") && (!needle || c.label.toLowerCase().includes(needle));
  const expense = all.filter((c) => c.direction === "expense");
  const income = all.filter((c) => c.direction === "income");
  const drill = (c: Category) => goMovements({ cat: c.id, from: st.from, label: `${c.label} · ultimi 12 mesi` });
  const row = (c: Category) => <CatRow key={c.id} c={c} stat={st.get(c.id)} onEdit={() => setEdit({ id: c.id })} onDrill={() => drill(c)} />;

  return (
    <div class="stack enter">
      <div class="card">
        <div class="card-head" style={{ flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <h2>Categorie</h2>
            <p class="hint">Cambia nome, icona e gruppo di ogni categoria. Il gruppo decide il colore e dove la spesa viene sommata in Analisi, nel flusso di cassa e nel Budget. Movimenti e totali si riferiscono agli ultimi 12 mesi (dal {fullDate(st.from)}).</p>
          </div>
          <button class="btn primary" onClick={() => setEdit({ direction: "expense" })}><Icon name="plus" />Nuova categoria</button>
        </div>
        <div class="row wrap" style={{ gap: "8px" }}>
          <input class="input" style={{ flex: "1 1 220px" }} placeholder="Cerca categoria…" aria-label="Cerca categoria" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          {hiddenN > 0 && <button class="chip" aria-pressed={showHidden} onClick={() => setShowHidden(!showHidden)}>Mostra nascoste <span class="n">{hiddenN}</span></button>}
        </div>
      </div>

      {GROUPS.map((g) => {
        const members = expense.filter((c) => categoryGroupId(c) === g.id);
        const list = members.filter(shown);
        if (needle && !list.length) return null;
        const total = members.reduce((a, c) => a + st.get(c.id).total, 0);
        return (
          <div class="card" key={g.id}>
            <div class="card-head" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <GroupTitle g={g} />
              <span class="faint" style={{ fontSize: "12px" }}>{plural(members.length, "categoria", "categorie")} · <Total v={total} /></span>
            </div>
            {list.length ? <div class="list">{list.map(row)}</div>
              : <p class="faint" style={{ margin: 0, fontSize: "12.5px" }}>{members.length ? "Solo categorie nascoste." : "Nessuna categoria: sposta qui una categoria scegliendo questo gruppo nella sua scheda."}</p>}
          </div>
        );
      })}

      {(!needle || income.some(shown)) && (
        <div class="card">
          <div class="card-head" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <h2><i class="swatch" style={{ background: "var(--in)", width: "11px", height: "11px" }} />Entrate</h2>
            <span class="faint" style={{ fontSize: "12px" }}>{plural(income.length, "categoria", "categorie")} · <Total v={income.reduce((a, c) => a + st.get(c.id).total, 0)} /></span>
          </div>
          <div class="list">{income.filter(shown).map(row)}</div>
          <div class="row" style={{ marginTop: "10px" }}>
            <button class="btn sm" onClick={() => setEdit({ direction: "income" })}><Icon name="plus" />Nuova categoria di entrata</button>
          </div>
        </div>
      )}

      {edit && <CategoryEditor key={"id" in edit ? edit.id : "new-" + edit.direction} target={edit} stat={"id" in edit ? st.get(edit.id) : NONE}
        onDrill={(c) => { setEdit(null); drill(c); }} onClose={() => setEdit(null)} />}
    </div>
  );
}

const Total = ({ v }: { v: number }) => (Math.abs(v) < 0.005 ? <>niente negli ultimi 12 mesi</> : <><span class="money">{eur(v)}</span> in 12 mesi</>);

const plainBtn = { border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "left" } as const;

function CatRow({ c, stat, onEdit, onDrill }: { c: Category; stat: Stat; onEdit: () => void; onDrill: () => void }) {
  const hidden = c.status === "inactive";
  return (
    <div class="li clickable" style={{ opacity: hidden ? 0.62 : 1 }} onClick={onEdit}>
      <div class="avatar" aria-hidden="true">{c.icon}</div>
      <div style={{ minWidth: 0 }}>
        <button class="t" style={{ ...plainBtn, display: "block", maxWidth: "100%" }} onClick={(e) => { e.stopPropagation(); onEdit(); }}>{c.label}</button>
        <div class="s" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {hidden && <span class="tag">nascosta</span>}
          {stat.n > 0
            ? <button style={{ ...plainBtn, color: "var(--accent)", fontWeight: 600 }} title="Vedi i movimenti" onClick={(e) => { e.stopPropagation(); onDrill(); }}>{plural(stat.n, "movimento", "movimenti")}</button>
            : <span>nessun movimento</span>}
          {c.direction === "expense" && <span>· {c.budgetEligible ? "nel budget" : "fuori budget"}</span>}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div class="money" style={{ fontWeight: 650 }}>{stat.n ? eur(stat.total) : "—"}</div>
      </div>
    </div>
  );
}

/** Nome del gruppo con modifica sul posto (Settings.groupLabels). */
function GroupTitle({ g }: { g: Group }) {
  const [v, setV] = useState<string | null>(null);
  const def = defaultGroupLabel(g.id);
  const custom = g.label !== def;
  const swatch = <i class="swatch" style={{ background: `var(--s${g.slot})`, width: "11px", height: "11px" }} />;
  if (v === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <div class="row" style={{ gap: "6px" }}>
          <h2 style={{ margin: 0 }}>{swatch}{g.icon} {g.label}</h2>
          <button class="btn sm ghost" onClick={() => setV(g.label)} aria-label={`Rinomina il gruppo ${g.label}`}>Rinomina</button>
        </div>
        {custom && <div class="faint" style={{ fontSize: "11.5px", marginTop: "2px" }}>Nome predefinito: {def}</div>}
      </div>
    );
  }
  const save = () => { C.renameGroup(g.id, v); setV(null); toast(v.trim() && v.trim() !== def ? "Nome del gruppo salvato" : "Nome predefinito ripristinato"); };
  return (
    <form class="row wrap" style={{ gap: "8px", flex: "1 1 320px" }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      {swatch}
      <input class="input" style={{ flex: "1 1 180px" }} value={v} maxLength={40} autoFocus aria-label="Nome del gruppo" placeholder={def}
        onInput={(e) => setV((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === "Escape") setV(null); }} />
      <button class="btn sm primary" type="submit">Salva</button>
      <button class="btn sm ghost" type="button" onClick={() => setV(null)}>Annulla</button>
      {custom && <button class="btn sm ghost" type="button" onClick={() => { C.renameGroup(g.id, ""); setV(null); toast("Nome predefinito ripristinato"); }}>Usa “{def}”</button>}
    </form>
  );
}

function CategoryEditor({ target, stat, onDrill, onClose }: { target: Target; stat: Stat; onDrill: (c: Category) => void; onClose: () => void }) {
  const s = getSnap();
  const orig = "id" in target ? s.categories.find((c) => c.id === target.id) : undefined;
  const [dir, setDir] = useState<CategoryDirection>(orig?.direction ?? ("direction" in target ? target.direction : "expense"));
  const [label, setLabel] = useState(orig?.label ?? "");
  const [icon, setIcon] = useState(orig?.icon ?? "");
  const [group, setGroup] = useState(orig ? categoryGroupId(orig) : "altro");
  const [active, setActive] = useState(orig ? orig.status !== "inactive" : true);
  const [budget, setBudget] = useState(orig ? orig.budgetEligible : true);
  const [merging, setMerging] = useState(false);
  const [mergeTo, setMergeTo] = useState("");
  if ("id" in target && !orig) return null; // eliminata nel frattempo (es. da un altro dispositivo)
  const expense = dir === "expense";
  const name = label.trim();

  const save = () => {
    if (!name) return;
    if (!orig) {
      C.create({ direction: dir, label: name, icon, group: expense ? group : undefined, budgetEligible: expense ? budget : false });
      toast(`Categoria “${name}” creata`);
      onClose();
      return;
    }
    const patch: C.CategoryPatch = {};
    if (name !== orig.label) patch.label = name;
    if (C.cleanIcon(icon) && C.cleanIcon(icon) !== orig.icon) patch.icon = icon;
    const movedTo = expense && group !== categoryGroupId(orig) ? group : "";
    if (movedTo) patch.group = movedTo;
    if (active !== (orig.status !== "inactive")) patch.active = active;
    if (expense && budget !== orig.budgetEligible) patch.budgetEligible = budget;
    if (Object.keys(patch).length) {
      C.updateCategory(orig.id, patch);
      toast(movedTo ? `“${name}” ora è in ${findGroup(movedTo)?.label ?? movedTo}` : "Categoria salvata");
    }
    onClose();
  };

  return (
    <Dialog onClose={onClose} label={orig ? "Modifica categoria" : "Nuova categoria"}>
      <div class="row between">
        <h2 style={{ margin: 0, fontSize: "17px" }}>{merging ? "Unisci categoria" : orig ? "Modifica categoria" : "Nuova categoria"}</h2>
        <button class="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" /></button>
      </div>
      {merging && orig ? <MergePanel from={orig} target={mergeTo} setTarget={setMergeTo} onBack={() => setMerging(false)} onDone={onClose} /> : (
        <div class="stack" style={{ gap: "14px", marginTop: "14px" }}>
          {!orig && <div><Seg label="Tipo di categoria" value={dir} onChange={setDir} options={[["expense", "Uscita"], ["income", "Entrata"]]} /></div>}
          <div class="row" style={{ gap: "10px", alignItems: "flex-start" }}>
            <label class="field" style={{ width: "72px" }}>Icona
              <input class="input" style={{ textAlign: "center", fontSize: "18px", lineHeight: "22px", padding: "7px 6px" }} value={icon} placeholder={C.DEFAULT_ICON} onInput={(e) => setIcon((e.target as HTMLInputElement).value)} />
            </label>
            <label class="field" style={{ flex: 1 }}>Nome
              <input class="input" value={label} maxLength={60} autoFocus placeholder="Es. Uscite a cena" onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))", gap: "6px" }} role="group" aria-label="Icone suggerite">
            {EMOJI.map((e) => {
              const on = C.cleanIcon(icon) === e;
              return (
                <button key={e} type="button" aria-pressed={on} aria-label={`Icona ${e}`} onClick={() => setIcon(e)}
                  style={{ height: "36px", borderRadius: "10px", fontSize: "17px", cursor: "pointer", background: on ? "var(--surface-3)" : "var(--surface-2)", border: on ? "1.5px solid var(--accent)" : "1px solid var(--line)" }}>{e}</button>
              );
            })}
          </div>
          {expense && (
            <label class="field">Gruppo
              <select class="input" value={group} onChange={(e) => setGroup((e.target as HTMLSelectElement).value)}>
                {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.label}{orig && isDefaultCategory(orig.id) && g.id === defaultGroupId(orig.id) ? " (predefinito)" : ""}</option>)}
              </select>
              <span class="faint">Decide il colore e dove la spesa viene sommata in Analisi, nel flusso di cassa e nel Budget.</span>
            </label>
          )}
          {orig && (
            <div class="field" style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--text-2)" }}>Stato
              <div><Seg label="Stato della categoria" value={active ? "on" : "off"} onChange={(v) => setActive(v === "on")} options={[["on", "Attiva"], ["off", "Nascosta"]]} /></div>
              <span class="faint">Una categoria nascosta non viene proposta quando classifichi un movimento ed esce dal budget. I movimenti già classificati restano com'erano.</span>
            </div>
          )}
          {expense && (
            <label class="row" style={{ gap: "10px", alignItems: "flex-start" }}>
              <input type="checkbox" checked={budget} onChange={(e) => setBudget((e.target as HTMLInputElement).checked)} style={{ marginTop: "3px" }} />
              <span>Nel budget<span class="faint" style={{ display: "block", fontSize: "12px" }}>Compare nella pagina Budget, dove puoi darle un tetto mensile.</span></span>
            </label>
          )}
          {orig && (
            <p class="faint" style={{ margin: 0, fontSize: "12.5px" }}>
              Ultimi 12 mesi: {stat.n ? <button type="button" style={{ ...plainBtn, color: "var(--accent)", fontWeight: 600 }} onClick={() => onDrill(orig)}>{plural(stat.n, "movimento", "movimenti")}</button> : "nessun movimento"}
              {stat.n > 0 && <> · <span class="money">{eur(stat.total)}</span></>}
            </p>
          )}
          <div class="row between wrap" style={{ gap: "8px" }}>
            {orig ? <button type="button" class="btn sm" onClick={() => setMerging(true)}>Unisci in…</button> : <span />}
            <div class="row" style={{ gap: "8px" }}>
              <button type="button" class="btn" onClick={onClose}>Annulla</button>
              <button type="button" class="btn primary" disabled={!name} onClick={save}>{orig ? "Salva" : "Crea categoria"}</button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function MergePanel({ from, target, setTarget, onBack, onDone }: { from: Category; target: string; setTarget: (id: string) => void; onBack: () => void; onDone: () => void }) {
  const s = getSnap();
  const options = s.categories.filter((c) => c.direction === from.direction && c.id !== from.id && c.status !== "inactive").sort(byOrder);
  const to = options.find((c) => c.id === target);
  const impact = C.mergeImpact(s, from.id);
  const keep = isDefaultCategory(from.id);
  const parts = [plural(impact.movements, "movimento", "movimenti")];
  if (impact.splits) parts.push(plural(impact.splits, "quota", "quote"));
  parts.push(plural(impact.rules, "regola", "regole"), plural(impact.budgets, "valore di budget", "valori di budget"));
  const run = () => {
    if (!to) return;
    const r = C.merge(from.id, to.id);
    if (r) toast(`“${from.label}” unita in “${to.label}”${r.removed ? "" : " · resta nascosta"}`);
    onDone();
  };
  return (
    <div class="stack" style={{ gap: "14px", marginTop: "14px" }}>
      <p class="muted" style={{ margin: 0, lineHeight: 1.55 }}>
        Movimenti, quote dei movimenti divisi, regole e budget di <b>{from.icon} {from.label}</b> passano alla categoria che scegli; i budget si sommano.
        {keep ? " È una categoria predefinita: non viene eliminata ma resta nascosta e vuota, e puoi riattivarla quando vuoi." : " Poi questa categoria viene eliminata."}
      </p>
      <label class="field">Unisci in
        <select class="input" value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)}>
          <option value="">Scegli la categoria…</option>
          {from.direction === "expense"
            ? GROUPS.map((g) => {
              const cs = options.filter((c) => categoryGroupId(c) === g.id);
              return cs.length ? <optgroup key={g.id} label={g.label}>{cs.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</optgroup> : null;
            })
            : options.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </label>
      <p class="faint" style={{ margin: 0, fontSize: "12.5px" }}>Si spostano {parts.join(", ")}. Non si può annullare.</p>
      <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
        <button class="btn" onClick={onBack}>Indietro</button>
        <button class="btn danger" disabled={!to} onClick={run}>{to ? `Unisci in “${to.label}”` : "Unisci"}</button>
      </div>
    </div>
  );
}
