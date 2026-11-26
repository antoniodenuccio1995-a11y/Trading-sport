import { useState } from "preact/hooks";
import type { Settings as S } from "../../domain/types.ts";
import { getSnap } from "../../state/store.ts";
import * as A from "../../state/actions.ts";
import { Dialog, Seg, toast } from "../components/common.tsx";

const ACCENTS: [string, string, string][] = [["indaco", "Indaco", "#8b7cf6"], ["oceano", "Oceano", "#38bdf8"], ["smeraldo", "Smeraldo", "#10b981"], ["ambra", "Ambra", "#f4ad2d"], ["corallo", "Corallo", "#fb7185"]];

export function SettingsView() {
  const s = getSnap(), st = s.settings;
  const [owner, setOwner] = useState(st.ownerNames.join(", "));
  const [confirm, setConfirm] = useState(false);
  const up = (p: Partial<S>) => A.updateSettings(p);
  return (
    <div class="stack enter" style={{ maxWidth: "820px" }}>
      <div class="card">
        <h2>Aspetto</h2>
        <div class="stack" style={{ gap: "16px", marginTop: "12px" }}>
          <div class="row between wrap"><span>Tema</span><Seg value={st.theme} onChange={(theme) => up({ theme })} options={[["auto", "Automatico"], ["dark", "Scuro"], ["light", "Chiaro"]]} /></div>
          <div class="row between wrap"><span>Colore</span>
            <div class="row" style={{ gap: "8px" }}>{ACCENTS.map(([id, label, c]) => (
              <button key={id} title={label} aria-label={label} aria-pressed={st.accent === id} onClick={() => up({ accent: id })}
                style={{ width: "30px", height: "30px", borderRadius: "50%", border: st.accent === id ? "2px solid var(--text)" : "2px solid transparent", background: c, cursor: "pointer", boxShadow: "0 0 0 2px var(--surface-1) inset" }} />
            ))}</div>
          </div>
          <div class="row between wrap"><span>Animazioni</span><Seg value={st.reduceMotion} onChange={(reduceMotion) => up({ reduceMotion })} options={[["auto", "Come il sistema"], ["off", "Attive"], ["on", "Ridotte"]]} /></div>
          <label class="row between"><span>Nascondi gli importi (per mostrare lo schermo)</span><input type="checkbox" checked={st.hideAmounts} onChange={(e) => up({ hideAmounts: (e.target as HTMLInputElement).checked })} /></label>
        </div>
      </div>
      <div class="card">
        <h2>Conti e mesi</h2>
        <div class="stack" style={{ gap: "14px", marginTop: "12px" }}>
          <label class="field">Nome e cognome del titolare (anche più di uno, separati da virgola)
            <div class="row" style={{ gap: "8px" }}><input class="input" style={{ flex: 1 }} value={owner} onInput={(e) => setOwner((e.target as HTMLInputElement).value)} />
              <button class="btn sm" onClick={() => { up({ ownerNames: owner.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean) }); A.reclassifyAll(); toast("Salvato e ricalcolato"); }}>Salva</button></div>
            <span class="faint">Serve per riconoscere i giroconti verso te stesso nelle descrizioni delle banche.</span>
          </label>
          <label class="field">Il mese inizia il giorno
            <select class="input" style={{ width: "160px" }} value={st.monthStartDay} onChange={(e) => up({ monthStartDay: Number((e.target as HTMLSelectElement).value) })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d === 1 ? "1 (mese solare)" : d}</option>)}
            </select>
            <span class="faint">Utile se lo stipendio arriva a fine mese: con 27, lo stipendio del 27 apre il mese successivo.</span>
          </label>
        </div>
      </div>
      <div class="card">
        <h2>Dati</h2>
        <p class="hint">{s.movements.length} movimenti · {s.rules.length} regole · archivio locale del browser (IndexedDB){s.meta.migratedFrom ? ` · migrato da v${s.meta.migratedFrom}` : ""}</p>
        <div class="row wrap" style={{ gap: "8px" }}>
          <button class="btn" onClick={A.exportBackup}>Esporta backup JSON</button>
          <button class="btn" onClick={A.exportCsv}>Esporta movimenti CSV</button>
          <button class="btn danger" onClick={() => setConfirm(true)}>Azzera tutto</button>
        </div>
      </div>
      <p class="faint" style={{ fontSize: "12px" }}>Finanza Personale v4.0 · i dati non lasciano mai il dispositivo.</p>
      {confirm && (
        <Dialog onClose={() => setConfirm(false)} label="Azzera">
          <h2 style={{ marginTop: 0 }}>Cancellare tutti i dati?</h2>
          <p class="muted">Movimenti, regole e impostazioni di questo browser verranno eliminati. Non si può annullare.</p>
          <div class="row" style={{ gap: "8px", justifyContent: "flex-end" }}>
            <button class="btn" onClick={A.exportBackup}>Esporta prima un backup</button>
            <button class="btn danger" onClick={() => { A.resetAll(); setConfirm(false); toast("Dati cancellati"); }}>Cancella tutto</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
