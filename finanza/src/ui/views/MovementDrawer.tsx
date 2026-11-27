import { useState } from "preact/hooks";
import type { MovementType, Rule, Split } from "../../domain/types.ts";
import { amountOf, dateOf, descOf, splitTotal } from "../../domain/movement.ts";
import { TYPE_LABEL, isTransfer, needsCategory } from "../../domain/categories.ts";
import { byId, catById, getSnap, statuses } from "../../state/store.ts";
import * as A from "../../state/actions.ts";
import { CategoryPicker, Drawer, Money, TypeSelect, catColor, toast } from "../components/common.tsx";
import { Icon } from "../icons.tsx";
import { eurExact, fullDate, parseAmount } from "../format.ts";
import { RuleEditor } from "./Rules.tsx";

export function MovementDrawer({ id, onClose, onNext }: { id: string; onClose: () => void; onNext: () => void }) {
  const m = byId().get(id);
  const [picker, setPicker] = useState<DOMRect | null>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const [splitting, setSplitting] = useState(false);
  if (!m) return null;
  const s = getSnap(), st = statuses().get(m.id)!, c = catById().get(m.categoryId), a = amountOf(m);
  const pair = m.matchedTo ? byId().get(m.matchedTo) : null;
  const tr = isTransfer(m.type);
  return (
    <Drawer onClose={onClose} label="Dettaglio movimento">
      <div class="row between" style={{ marginBottom: "14px" }}>
        <span class={"tag " + (st.kind === "warn" ? "warn" : st.kind === "ok" ? "good" : "")}>{st.label}</span>
        <div class="row" style={{ gap: "6px" }}>
          <button class="btn sm ghost" onClick={onNext} title="Movimento successivo">Successivo <Icon name="right" /></button>
          <button class="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" /></button>
        </div>
      </div>
      <div class="eyebrow">{m.account} · {fullDate(dateOf(m))}</div>
      <div class={"big money " + (a > 0 ? "in" : "")} style={{ fontSize: "34px" }}>{a > 0 ? "+" : "−"}{eurExact(Math.abs(a))}</div>
      <p style={{ margin: "4px 0 18px", wordBreak: "break-word" }}>{descOf(m)}</p>

      <div class="stack" style={{ gap: "12px" }}>
        <label class="field">Tipo<TypeSelect value={m.type} onChange={(t: MovementType) => A.updateMovement(m.id, { type: t, ...(needsCategory(t) ? {} : { categoryId: "" }) })} /></label>
        {needsCategory(m.type) || !m.type ? (
          <div class="field" style={{ display: "grid", gap: "5px", fontSize: "12px", color: "var(--text-2)", fontWeight: 550 }}>Categoria
            <button class="input" style={{ textAlign: "left", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={(e) => setPicker((e.currentTarget as HTMLElement).getBoundingClientRect())}>
              {c ? <><i class="swatch" style={{ background: catColor(c.id) }} />{c.icon} {c.label}</> : <span class="warn">Scegli una categoria…</span>}
              <span style={{ marginLeft: "auto" }}><Icon name="down" size={15} /></span>
            </button>
          </div>
        ) : null}
        {tr ? (
          <label class="field">{a < 0 ? "Verso il conto" : "Dal conto"}
            <select class="input" value={m.counterparty} onChange={(e) => A.updateMovement(m.id, { counterparty: (e.target as HTMLSelectElement).value })}>
              <option value="">— da riconoscere —</option>
              {s.accounts.filter((x) => x.id !== m.account).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        ) : (m.type === "advance_out" || m.type === "refund_in") && (
          <label class="field">Persona<input class="input" value={m.counterparty} placeholder="Per chi / da chi" onChange={(e) => A.updateMovement(m.id, { counterparty: (e.target as HTMLInputElement).value })} /></label>
        )}
        <label class="field">Nota<input class="input" value={m.note} placeholder="Facoltativa" onChange={(e) => A.updateMovement(m.id, { note: (e.target as HTMLInputElement).value }, false)} /></label>
        {m.type === "expense" && (
          <label class="row" style={{ gap: "8px", fontSize: "13px" }}>
            <input type="checkbox" checked={m.deferredWallet} onChange={(e) => A.updateMovement(m.id, { deferredWallet: (e.target as HTMLInputElement).checked })} />
            Deposito su wallet (scommesse/trading): non contarlo come spesa
          </label>
        )}

        {tr && (
          <div class="card flat" style={{ padding: "12px" }}>
            <div class="card-title"><Icon name="link" size={16} />Gemello del giroconto</div>
            {pair ? (
              <div class="row between" style={{ marginTop: "8px" }}>
                <span>{pair.account} · {fullDate(dateOf(pair))} · <Money v={amountOf(pair)} sign /></span>
                <button class="btn sm" onClick={() => A.unlinkTransfer(m.id)}>Scollega</button>
              </div>
            ) : (
              <TransferCandidates id={m.id} />
            )}
          </div>
        )}

        {splitting || m.splits.length ? <SplitEditor id={m.id} onDone={() => setSplitting(false)} /> : null}

        <div class="row wrap" style={{ gap: "8px", marginTop: "6px" }}>
          {!splitting && !m.splits.length && <button class="btn sm" onClick={() => setSplitting(true)}><Icon name="split" />Dividi in quote</button>}
          <button class="btn sm" onClick={() => setRule(A.ruleFromMovement(m.id))}><Icon name="bolt" />Crea regola</button>
          {m.lock && <button class="btn sm" onClick={() => { A.unlock(m.id); toast("Classificazione affidata di nuovo alle regole"); }}>Torna alle regole</button>}
          {m.deletedAt
            ? <button class="btn sm" onClick={() => A.trash(m.id, false)}>Ripristina dal cestino</button>
            : <button class="btn sm danger" onClick={() => { A.trash(m.id); toast("Spostato nel cestino", { label: "Annulla", run: () => A.trash(m.id, false) }); onClose(); }}><Icon name="trash" />Cestina</button>}
        </div>

        <details class="card flat" style={{ padding: "10px 12px" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>Correggi dati e dettagli originali</summary>
          <div class="stack" style={{ gap: "10px", marginTop: "10px" }}>
            <div class="row" style={{ gap: "8px" }}>
              <label class="field" style={{ flex: 1 }}>Data corretta<input class="input" type="date" value={m.corrected.date ?? ""} onChange={(e) => A.updateMovement(m.id, { corrected: { ...m.corrected, date: (e.target as HTMLInputElement).value || undefined } }, false)} /></label>
              <label class="field" style={{ flex: 1 }}>Importo corretto<input class="input" inputMode="decimal" placeholder={String(m.amount).replace(".", ",")} value={m.corrected.amount != null ? String(m.corrected.amount).replace(".", ",") : ""}
                onChange={(e) => { const v = parseAmount((e.target as HTMLInputElement).value); A.updateMovement(m.id, { corrected: { ...m.corrected, amount: Number.isFinite(v) ? v : undefined } }, false); }} /></label>
            </div>
            <label class="field">Descrizione corretta<input class="input" value={m.corrected.description ?? ""} placeholder={m.description} onChange={(e) => A.updateMovement(m.id, { corrected: { ...m.corrected, description: (e.target as HTMLInputElement).value || undefined } }, false)} /></label>
            <div class="faint" style={{ fontSize: "12px", display: "grid", gap: "3px" }}>
              <span>Originale: {m.date} · {eurExact(m.amount)} · {m.description}</span>
              {m.sourceType && <span>Tipo banca: {m.sourceType}</span>}
              {m.externalId && <span>Codice banca: {m.externalId}</span>}
              <span>Classificazione: {m.lock ? "manuale" : m.ruleStatus === "rule" ? "da regola" : m.ruleStatus === "import" ? "dall'importazione" : m.ruleStatus === "auto-match" ? "abbinamento automatico" : "nessuna"}</span>
              {Object.keys(m.raw ?? {}).length > 0 && <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", margin: "6px 0 0", fontFamily: "var(--mono)" }}>{JSON.stringify(m.raw, null, 1)}</pre>}
            </div>
          </div>
        </details>
      </div>
      {picker && <CategoryPicker anchor={picker} value={m.categoryId} direction={m.type === "income" ? "income" : m.type === "expense" ? "expense" : a > 0 ? "" : ""}
        onClose={() => setPicker(null)} onPick={(cid) => { A.setCategory(m.id, cid); setPicker(null); }} />}
      {rule && <RuleEditor rule={rule} onClose={() => setRule(null)} />}
    </Drawer>
  );
}

function TransferCandidates({ id }: { id: string }) {
  const cands = A.transferCandidates(id);
  if (!cands.length) return <p class="faint" style={{ margin: "8px 0 0", fontSize: "12.5px" }}>Nessun movimento di importo opposto su un altro conto entro 12 giorni.</p>;
  return (
    <div class="list" style={{ marginTop: "6px" }}>
      {cands.map((x) => (
        <div class="li" key={x.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
          <div><div class="t">{x.account} · {fullDate(dateOf(x))}</div><div class="s">{descOf(x)} · {TYPE_LABEL[x.type]}</div></div>
          <button class="btn sm" onClick={() => { A.linkTransfer(id, x.id); toast("Giroconto collegato"); }}>Collega</button>
        </div>
      ))}
    </div>
  );
}

function SplitEditor({ id, onDone }: { id: string; onDone: () => void }) {
  const m = byId().get(id)!;
  const total = amountOf(m);
  const [rows, setRows] = useState<Split[]>(() => m.splits.length ? m.splits.map((x) => ({ ...x })) : [A.newSplit(total, m.categoryId, m.type || "expense")]);
  const [picker, setPicker] = useState<{ i: number; r: DOMRect } | null>(null);
  const sum = splitTotal({ ...m, splits: rows });
  const diff = Math.round((total - sum) * 100) / 100;
  const cats = catById();
  const up = (i: number, p: Partial<Split>) => setRows((x) => x.map((y, j) => (j === i ? { ...y, ...p } : y)));
  return (
    <div class="card flat" style={{ padding: "12px" }}>
      <div class="card-title"><Icon name="split" size={16} />Quote</div>
      <p class="hint">La somma delle quote deve essere uguale all'importo ({eurExact(total)}). Le analisi usano le quote al posto del movimento.</p>
      <div class="stack" style={{ gap: "8px" }}>
        {rows.map((r, i) => (
          <div key={r.id} class="row" style={{ gap: "6px" }}>
            <input class="input" style={{ width: "96px" }} inputMode="decimal" value={String(r.amount).replace(".", ",")} onChange={(e) => { const v = parseAmount((e.target as HTMLInputElement).value); if (Number.isFinite(v)) up(i, { amount: v }); }} aria-label="Importo quota" />
            <select class="input" style={{ width: "130px" }} value={r.type} onChange={(e) => up(i, { type: (e.target as HTMLSelectElement).value as MovementType })} aria-label="Tipo quota">
              {(["expense", "income", "advance_out", "refund_in"] as MovementType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            {needsCategory(r.type)
              ? <button class="input" style={{ flex: 1, textAlign: "left", cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }} onClick={(e) => setPicker({ i, r: (e.currentTarget as HTMLElement).getBoundingClientRect() })}>{cats.get(r.categoryId)?.label ?? "Categoria…"}</button>
              : <input class="input" style={{ flex: 1 }} placeholder="Persona" value={r.counterparty} onChange={(e) => up(i, { counterparty: (e.target as HTMLInputElement).value })} />}
            <button class="icon-btn" aria-label="Elimina quota" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Icon name="x" /></button>
          </div>
        ))}
      </div>
      <div class="row between" style={{ marginTop: "10px" }}>
        <button class="btn sm" onClick={() => setRows((x) => [...x, A.newSplit(diff, "", "expense")])}><Icon name="plus" />Quota</button>
        <span class={diff === 0 ? "in" : "warn"} style={{ fontSize: "12.5px", fontWeight: 600 }}>{diff === 0 ? "Quadra ✓" : `Mancano ${eurExact(diff)}`}</span>
      </div>
      <div class="row" style={{ gap: "8px", marginTop: "10px" }}>
        <button class="btn sm primary" disabled={diff !== 0} onClick={() => { A.setSplits(id, rows); onDone(); toast("Quote salvate"); }}>Salva quote</button>
        {m.splits.length > 0 && <button class="btn sm" onClick={() => { A.setSplits(id, []); onDone(); }}>Rimuovi quote</button>}
        <button class="btn sm ghost" onClick={onDone}>Annulla</button>
      </div>
      {picker && <CategoryPicker anchor={picker.r} value={rows[picker.i].categoryId} direction={rows[picker.i].type === "income" ? "income" : "expense"} onClose={() => setPicker(null)} onPick={(cid) => { up(picker.i, { categoryId: cid }); setPicker(null); }} />}
    </div>
  );
}
