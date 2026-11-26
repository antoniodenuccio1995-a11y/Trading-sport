import { useMemo, useState } from "preact/hooks";
import type { Rule } from "../../domain/types.ts";
import { TYPE_LABEL, needsCategory } from "../../domain/categories.ts";
import { catById, getSnap } from "../../state/store.ts";
import * as A from "../../state/actions.ts";
import { CategoryPicker, Dialog, Empty, TypeSelect, catColor, toast } from "../components/common.tsx";
import { Icon } from "../icons.tsx";
import { uid } from "../../domain/movement.ts";

export function Rules() {
  const s = getSnap(), cats = catById();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Rule | null>(null);
  const list = useMemo(() => s.rules.filter((r) => !q || (r.contains + " " + (cats.get(r.categoryId)?.label ?? "")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.priority - a.priority || a.contains.localeCompare(b.contains)), [s.rules, q]);
  return (
    <div class="stack enter">
      <div class="card">
        <div class="card-head">
          <div><h2>Regole di classificazione</h2><p class="hint">Se la descrizione contiene il testo, il movimento prende tipo e categoria. Priorità più alta vince; due regole diverse alla stessa priorità lasciano il movimento “da controllare”. I movimenti modificati a mano non vengono toccati.</p></div>
          <div class="row" style={{ gap: "8px" }}>
            <button class="btn" onClick={() => { A.reclassifyAll(); toast("Classificazioni ricalcolate"); }}><Icon name="repeat" />Ricalcola</button>
            <button class="btn primary" onClick={() => setEdit({ id: uid(), account: "", contains: "", sign: "-", type: "expense", categoryId: "", counterparty: "", priority: 50, active: true })}><Icon name="plus" />Nuova regola</button>
          </div>
        </div>
        <input class="input" style={{ width: "100%", marginBottom: "10px" }} placeholder="Cerca regole…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {list.length === 0 ? <Empty icon="⚙️" title="Nessuna regola" /> : (
          <div class="scroll-x">
            <table class="tbl">
              <thead><tr><th>Se contiene</th><th>Conto</th><th>Segno</th><th>Diventa</th><th class="r">Priorità</th><th class="r">Movimenti</th><th /></tr></thead>
              <tbody>
                {list.map((r) => {
                  const c = cats.get(r.categoryId);
                  return (
                    <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                      <td><b class="mono" style={{ fontSize: "12.5px" }}>{r.contains}</b></td>
                      <td class="muted">{r.account || "Tutti"}</td>
                      <td class="muted">{r.sign === "-" ? "uscita" : r.sign === "+" ? "entrata" : "—"}</td>
                      <td>{c ? <span class="tag"><i class="swatch" style={{ background: catColor(c.id) }} />{c.label}</span> : <span class="tag">{TYPE_LABEL[r.type]}{r.counterparty ? " → " + r.counterparty : ""}</span>}</td>
                      <td class="r num">{r.priority}</td>
                      <td class="r num muted">{A.rulePreview(r)}</td>
                      <td class="r"><button class="btn sm ghost" onClick={() => setEdit({ ...r })}>Modifica</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <RuleEditor rule={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function RuleEditor({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const [r, setR] = useState<Rule>(rule);
  const [picker, setPicker] = useState<DOMRect | null>(null);
  const s = getSnap(), c = catById().get(r.categoryId);
  const exists = s.rules.some((x) => x.id === r.id);
  const n = A.rulePreview(r);
  const up = (p: Partial<Rule>) => setR((x) => ({ ...x, ...p }));
  return (
    <Dialog onClose={onClose} label="Regola">
      <div class="row between"><h2 style={{ margin: 0, fontSize: "17px" }}>{exists ? "Modifica regola" : "Nuova regola"}</h2><button class="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" /></button></div>
      <div class="stack" style={{ gap: "12px", marginTop: "14px" }}>
        <label class="field">La descrizione contiene<input class="input mono" value={r.contains} onInput={(e) => up({ contains: (e.target as HTMLInputElement).value.toUpperCase() })} autoFocus /></label>
        <div class="row" style={{ gap: "8px" }}>
          <label class="field" style={{ flex: 1 }}>Conto<select class="input" value={r.account} onChange={(e) => up({ account: (e.target as HTMLSelectElement).value })}><option value="">Tutti i conti</option>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label class="field" style={{ flex: 1 }}>Segno<select class="input" value={r.sign} onChange={(e) => up({ sign: (e.target as HTMLSelectElement).value as Rule["sign"] })}><option value="">Qualsiasi</option><option value="-">Uscita</option><option value="+">Entrata</option></select></label>
        </div>
        <label class="field">Tipo<TypeSelect value={r.type} onChange={(t) => up({ type: t, ...(needsCategory(t) ? {} : { categoryId: "" }) })} /></label>
        {needsCategory(r.type) && (
          <div class="field" style={{ display: "grid", gap: "5px", fontSize: "12px", color: "var(--text-2)" }}>Categoria
            <button class="input" style={{ textAlign: "left", cursor: "pointer" }} onClick={(e) => setPicker((e.currentTarget as HTMLElement).getBoundingClientRect())}>{c ? `${c.icon} ${c.label}` : "Scegli…"}</button>
          </div>
        )}
        {(r.type === "transfer_in" || r.type === "transfer_out") && (
          <label class="field">Conto collegato<select class="input" value={r.counterparty} onChange={(e) => up({ counterparty: (e.target as HTMLSelectElement).value })}><option value="">—</option>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        )}
        <div class="row" style={{ gap: "8px" }}>
          <label class="field" style={{ flex: 1 }}>Priorità<input class="input" type="number" value={r.priority} onInput={(e) => up({ priority: Number((e.target as HTMLInputElement).value) || 0 })} /></label>
          <label class="row" style={{ gap: "8px", flex: 1, marginTop: "18px" }}><input type="checkbox" checked={r.active} onChange={(e) => up({ active: (e.target as HTMLInputElement).checked })} />Attiva</label>
        </div>
        <p class="faint" style={{ margin: 0, fontSize: "12.5px" }}>{r.contains.trim().length < 3 ? "Scrivi almeno 3 caratteri." : `Corrisponde a ${n} movimenti (quelli modificati a mano restano invariati).`}</p>
        <div class="row between">
          {exists ? <button class="btn danger sm" onClick={() => { A.deleteRule(r.id); onClose(); toast("Regola eliminata"); }}>Elimina</button> : <span />}
          <button class="btn primary" disabled={r.contains.trim().length < 3} onClick={() => { A.saveRule(r); onClose(); toast("Regola salvata e applicata"); }}>Salva e applica</button>
        </div>
      </div>
      {picker && <CategoryPicker anchor={picker} value={r.categoryId} direction={r.type === "income" ? "income" : "expense"} onClose={() => setPicker(null)} onPick={(id) => { up({ categoryId: id }); setPicker(null); }} />}
    </Dialog>
  );
}
