import { useRef, useState } from "preact/hooks";
import type { MovementType, Snapshot } from "../../domain/types.ts";
import { TYPE_LABEL } from "../../domain/categories.ts";
import { getSnap } from "../../state/store.ts";
import * as A from "../../state/actions.ts";
import { CategoryPicker, Dialog, toast } from "../components/common.tsx";
import { Icon } from "../icons.tsx";
import { fullDate, parseAmount, todayIso } from "../format.ts";

const BANKS = "Banca Sella (.xls/.xlsx), Revolut (.csv), Tinaba (.csv), Poste Italiane (.xlsx), Hype (.csv/.xls), Trade Republic (.csv), Easy Bank (.xlsx)";

export function ImportView() {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<A.FileReport[] | null>(null);
  const [backup, setBackup] = useState<{ snapshot: Snapshot; source: string; report: string[]; file: string } | null>(null);
  const [manual, setManual] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null), backupIn = useRef<HTMLInputElement>(null);
  const s = getSnap();

  const run = async (files: File[]) => {
    const json = files.filter((f) => /\.json$/i.test(f.name)), bank = files.filter((f) => !/\.json$/i.test(f.name));
    if (json[0]) await openBackup(json[0]);
    if (!bank.length) return;
    setBusy(true);
    try { const r = await A.importBankFiles(bank); setReports(r); const added = r.reduce((n, x) => n + x.added, 0); toast(added ? `${added} movimenti nuovi importati` : "Nessun movimento nuovo"); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  const openBackup = async (f: File) => {
    try { const r = await A.readBackup(f); setBackup({ ...r, file: f.name }); }
    catch (e) { toast((e as Error).message); }
  };

  return (
    <div class="stack enter">
      {s.meta.demo && (
        <div class="card" style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)" }}>
          <div class="row between wrap"><div><b>Stai guardando dati dimostrativi.</b><div class="faint" style={{ fontSize: "12.5px" }}>Al primo estratto conto o backup importato vengono sostituiti dai tuoi dati.</div></div>
            <button class="btn sm" onClick={() => { A.resetAll(); toast("Dati dimostrativi rimossi"); }}>Rimuovi dati dimostrativi</button></div>
        </div>
      )}
      <div class="grid g-2">
        <div class="card">
          <h2><Icon name="upload" size={17} />Estratti conto</h2>
          <p class="hint">Trascina i file così come li scarichi dalla banca: il formato viene riconosciuto da solo e i movimenti già presenti vengono saltati.</p>
          <div class={"drop" + (over ? " over" : "")} role="button" tabIndex={0}
            onClick={() => fileIn.current?.click()} onKeyDown={(e) => { if (e.key === "Enter") fileIn.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void run([...(e.dataTransfer?.files ?? [])]); }}
            onPointerEnter={A.prefetchXlsx}>
            <div class="em">{busy ? "⏳" : "📥"}</div>
            <b>{busy ? "Importazione in corso…" : "Trascina qui i file o clicca per sceglierli"}</b>
            <span class="faint" style={{ fontSize: "12px", maxWidth: "440px" }}>{BANKS}. Anche un backup .json.</span>
            <input ref={fileIn} type="file" multiple accept=".xls,.xlsx,.csv,.json" hidden onChange={(e) => { const t = e.target as HTMLInputElement; void run([...(t.files ?? [])]); t.value = ""; }} />
          </div>
          <div class="row wrap" style={{ gap: "8px", marginTop: "12px" }}>
            <button class="btn" onClick={() => setManual(true)}><Icon name="cash" />Aggiungi a mano (contanti)</button>
          </div>
          {s.settings.ownerNames.length === 0 && <OwnerPrompt />}
        </div>

        <div class="card">
          <h2>💾 Backup e migrazione</h2>
          <p class="hint">Dalla v3.10: apri la vecchia app, vai su <b>Backup → Esporta JSON</b> e carica qui il file. Categorie, regole, giroconti, quote, cestino e piano budget vengono convertiti; i dati originali restano nel backup.</p>
          <div class="row wrap" style={{ gap: "8px" }}>
            <button class="btn primary" onClick={() => backupIn.current?.click()}><Icon name="upload" />Carica backup JSON</button>
            <button class="btn" onClick={A.exportBackup}><Icon name="download" />Esporta backup</button>
            <button class="btn" onClick={A.exportCsv}><Icon name="download" />Esporta CSV</button>
            <input ref={backupIn} type="file" accept=".json" hidden onChange={(e) => { const t = e.target as HTMLInputElement; if (t.files?.[0]) void openBackup(t.files[0]); t.value = ""; }} />
          </div>
          <p class="faint" style={{ fontSize: "12px", marginTop: "12px" }}>I dati restano solo in questo browser (IndexedDB). Esporta un backup ogni tanto e conservalo fuori dal computer.</p>
          {!s.movements.length && <button class="btn sm" style={{ marginTop: "6px" }} onClick={() => { void A.loadDemo().then(() => { toast("Dati dimostrativi caricati"); location.hash = "#/"; }); }}><Icon name="sparkles" />Prova con dati dimostrativi</button>}
        </div>
      </div>

      {reports && (
        <div class="card">
          <h2>Esito importazione</h2>
          <div class="list">
            {reports.map((r) => (
              <div class="li" key={r.file} style={{ gridTemplateColumns: "auto minmax(0,1fr)" }}>
                <div class="avatar">{r.error ? "⚠️" : "✅"}</div>
                <div>
                  <div class="t">{r.file}{r.account && <span class="faint"> · {r.account}</span>}</div>
                  {r.error ? <div class="bad" style={{ fontSize: "12.5px" }}>{r.error}</div> : <div class="s">{r.added} nuovi · {r.dups} già presenti · {r.skipped} ignorati</div>}
                  {r.notes.map((n, i) => <div key={i} class="faint" style={{ fontSize: "12px" }}>• {n}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.imports.length > 0 && (
        <div class="card">
          <h2>Storico importazioni</h2>
          <div class="scroll-x"><table class="tbl"><thead><tr><th>Data</th><th>File</th><th>Conto</th><th class="r">Nuovi</th><th class="r">Doppi</th></tr></thead>
            <tbody>{[...s.imports].reverse().slice(0, 30).map((x) => <tr key={x.id}><td class="muted">{fullDate(x.at.slice(0, 10))}</td><td>{x.file}</td><td class="muted">{x.account}</td><td class="r num">{x.added}</td><td class="r num muted">{x.dups}</td></tr>)}</tbody></table></div>
        </div>
      )}

      {backup && (
        <Dialog onClose={() => setBackup(null)} label="Conferma backup">
          <h2 style={{ marginTop: 0, fontSize: "17px" }}>Sostituire i dati con il backup?</h2>
          <p class="muted">{backup.file} · formato {backup.source}</p>
          <ul style={{ margin: "0 0 14px", paddingLeft: "18px", lineHeight: 1.7 }}>{backup.report.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {s.movements.length > 0 && !s.meta.demo && <p class="warn" style={{ fontSize: "13px" }}>I {s.movements.length} movimenti attuali verranno sostituiti. Esporta prima un backup se ti servono.</p>}
          <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
            {s.movements.length > 0 && !s.meta.demo && <button class="btn" onClick={A.exportBackup}>Esporta prima i dati attuali</button>}
            <button class="btn primary" onClick={() => { const keepOwner = s.settings.ownerNames; A.applyBackup(backup.snapshot); if (keepOwner.length && !backup.snapshot.settings.ownerNames.length) A.updateSettings({ ownerNames: keepOwner }); setBackup(null); toast("Backup caricato"); location.hash = "#/"; }}>Carica</button>
          </div>
        </Dialog>
      )}
      {manual && <ManualEntry onClose={() => setManual(false)} />}
    </div>
  );
}

function OwnerPrompt() {
  const [v, setV] = useState("");
  return (
    <div class="card flat" style={{ marginTop: "14px", padding: "12px" }}>
      <b style={{ fontSize: "13px" }}>Il tuo nome e cognome</b>
      <p class="faint" style={{ margin: "2px 0 8px", fontSize: "12px" }}>Serve a riconoscere i giroconti verso te stesso (es. “ricarica da …”). Resta solo in questo browser.</p>
      <div class="row" style={{ gap: "8px" }}>
        <input class="input" style={{ flex: 1 }} placeholder="Nome Cognome" value={v} onInput={(e) => setV((e.target as HTMLInputElement).value)} />
        <button class="btn sm" disabled={v.trim().length < 3} onClick={() => { A.updateSettings({ ownerNames: [v.trim().toUpperCase()] }); A.reclassifyAll(); toast("Salvato: giroconti ricalcolati"); }}>Salva</button>
      </div>
    </div>
  );
}

function ManualEntry({ onClose }: { onClose: () => void }) {
  const s = getSnap();
  const [p, setP] = useState({ account: "Cassa", date: todayIso(), description: "", amount: "", sign: "-" as "-" | "+", type: "expense" as MovementType, categoryId: "", counterparty: "" });
  const [picker, setPicker] = useState<DOMRect | null>(null);
  const cat = s.categories.find((c) => c.id === p.categoryId);
  const v = parseAmount(p.amount);
  const ok = p.description.trim() && Number.isFinite(v) && v > 0;
  const save = (again: boolean) => {
    A.addManual({ account: p.account, date: p.date, description: p.description.trim().toUpperCase(), amount: p.sign === "-" ? -v : v, type: p.type, categoryId: p.categoryId, counterparty: p.counterparty });
    toast("Movimento aggiunto");
    if (again) setP({ ...p, description: "", amount: "", categoryId: "" }); else onClose();
  };
  return (
    <Dialog onClose={onClose} label="Nuovo movimento">
      <div class="row between"><h2 style={{ margin: 0, fontSize: "17px" }}>Nuovo movimento</h2><button class="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" /></button></div>
      <div class="stack" style={{ gap: "12px", marginTop: "14px" }}>
        <div class="row" style={{ gap: "8px" }}>
          <label class="field" style={{ flex: 1 }}>Conto<select class="input" value={p.account} onChange={(e) => setP({ ...p, account: (e.target as HTMLSelectElement).value })}>{s.accounts.map((a) => <option key={a.id}>{a.id}</option>)}</select></label>
          <label class="field" style={{ flex: 1 }}>Data<input class="input" type="date" value={p.date} onChange={(e) => setP({ ...p, date: (e.target as HTMLInputElement).value })} /></label>
        </div>
        <label class="field">Descrizione<input class="input" value={p.description} autoFocus placeholder="es. Mercato, caffè, regalo…" onInput={(e) => setP({ ...p, description: (e.target as HTMLInputElement).value })} /></label>
        <div class="row" style={{ gap: "8px" }}>
          <div class="seg"><button aria-pressed={p.sign === "-"} onClick={() => setP({ ...p, sign: "-", type: "expense", categoryId: "" })}>Uscita</button><button aria-pressed={p.sign === "+"} onClick={() => setP({ ...p, sign: "+", type: "income", categoryId: "" })}>Entrata</button></div>
          <input class="input" style={{ flex: 1 }} inputMode="decimal" placeholder="Importo €" value={p.amount} onInput={(e) => setP({ ...p, amount: (e.target as HTMLInputElement).value })} />
        </div>
        <label class="field">Tipo<select class="input" value={p.type} onChange={(e) => setP({ ...p, type: (e.target as HTMLSelectElement).value as MovementType })}>
          {(p.sign === "-" ? ["expense", "transfer_out", "advance_out", "invest_buy"] : ["income", "transfer_in", "refund_in", "invest_sell"]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t as MovementType]}</option>)}
        </select></label>
        {(p.type === "expense" || p.type === "income") && <button class="input" style={{ textAlign: "left", cursor: "pointer" }} onClick={(e) => setPicker((e.currentTarget as HTMLElement).getBoundingClientRect())}>{cat ? `${cat.icon} ${cat.label}` : "Categoria…"}</button>}
        {(p.type === "advance_out" || p.type === "refund_in") && <input class="input" placeholder="Persona" value={p.counterparty} onInput={(e) => setP({ ...p, counterparty: (e.target as HTMLInputElement).value })} />}
        {(p.type === "transfer_out" || p.type === "transfer_in") && <select class="input" value={p.counterparty} onChange={(e) => setP({ ...p, counterparty: (e.target as HTMLSelectElement).value })}><option value="">Altro conto…</option>{s.accounts.filter((a) => a.id !== p.account).map((a) => <option key={a.id}>{a.id}</option>)}</select>}
        <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
          <button class="btn" disabled={!ok} onClick={() => save(true)}>Salva e aggiungi un altro</button>
          <button class="btn primary" disabled={!ok} onClick={() => save(false)}>Salva</button>
        </div>
      </div>
      {picker && <CategoryPicker anchor={picker} value={p.categoryId} direction={p.sign === "-" ? "expense" : "income"} onClose={() => setPicker(null)} onPick={(id) => { setP({ ...p, categoryId: id }); setPicker(null); }} />}
    </Dialog>
  );
}
