// Conversione istantanea <-> righe di fp_records e calcolo delle differenze.
// Funzioni pure: niente rete, niente DOM (testate in tests/sync.test.ts).
import type { Snapshot } from "../domain/types.ts";
import { fnv } from "../domain/movement.ts";
import { emptyInvest, type InvestData } from "../invest/types.ts";

export type Kind = "movement" | "rule" | "account" | "category" | "budget" | "setting" | "import" | "instrument" | "trade" | "invest";
export interface Rec { kind: Kind; key: string; value: unknown }
export interface RemoteRow { kind: Kind; key: string; value: unknown; deleted: boolean; updated_at: string }

/** Preferenze del singolo dispositivo: non viaggiano tra dispositivi. */
const DEVICE_ONLY = new Set(["theme", "reduceMotion", "hideAmounts"]);
export const rid = (kind: string, key: string) => kind + ":" + key;

export function toRecords(s: Snapshot): Rec[] {
  const out: Rec[] = [];
  for (const m of s.movements) out.push({ kind: "movement", key: m.id, value: m });
  for (const r of s.rules) out.push({ kind: "rule", key: r.id, value: r });
  for (const a of s.accounts) out.push({ kind: "account", key: a.id, value: a });
  for (const c of s.categories) out.push({ kind: "category", key: c.id, value: c });
  for (const i of s.imports) out.push({ kind: "import", key: i.id, value: i });
  out.push({ kind: "budget", key: "default", value: s.budgets.default });
  for (const [month, v] of Object.entries(s.budgets.months)) out.push({ kind: "budget", key: month, value: v });
  const shared: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s.settings)) if (!DEVICE_ONLY.has(k)) shared[k] = v;
  out.push({ kind: "setting", key: "settings", value: shared });
  // investimenti: strumenti e operazioni una riga ciascuno; prezzi e storico in una riga sola
  const inv = s.investments;
  if (inv) {
    for (const i of inv.instruments) out.push({ kind: "instrument", key: i.id, value: i });
    for (const t of inv.trades) out.push({ kind: "trade", key: t.id, value: t });
    const { instruments: _i, trades: _t, ...rest } = inv;
    out.push({ kind: "invest", key: "state", value: rest });
  }
  return out;
}

/** JSON con chiavi ordinate: la stessa impronta su ogni dispositivo e dopo il passaggio dal database (jsonb riordina le chiavi). */
export function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return v === undefined ? "null" : JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => (x === undefined ? "null" : stable(x))).join(",") + "]";
  const o = v as Record<string, unknown>;
  let s = "{";
  let first = true;
  for (const k of Object.keys(o).sort()) {
    const x = o[k];
    if (x === undefined || typeof x === "function") continue;
    s += (first ? "" : ",") + JSON.stringify(k) + ":" + stable(x);
    first = false;
  }
  return s + "}";
}
export const hashOf = (v: unknown) => { const t = stable(v); return fnv(t) + ":" + t.length.toString(36); };

export interface Diff { upserts: Rec[]; deletes: { kind: Kind; key: string }[]; hashes: Map<string, string> }

/** Righe da inviare: nuove o cambiate rispetto all'ultima sincronizzazione, e quelle sparite (cancellate). */
export function diff(s: Snapshot, synced: ReadonlyMap<string, string>): Diff {
  const recs = toRecords(s);
  const hashes = new Map<string, string>();
  const upserts: Rec[] = [];
  for (const r of recs) {
    const id = rid(r.kind, r.key), h = hashOf(r.value);
    hashes.set(id, h);
    if (synced.get(id) !== h) upserts.push(r);
  }
  const deletes: Diff["deletes"] = [];
  for (const id of synced.keys()) if (!hashes.has(id)) {
    const i = id.indexOf(":");
    deletes.push({ kind: id.slice(0, i) as Kind, key: id.slice(i + 1) });
  }
  return { upserts, deletes, hashes };
}

/**
 * Applica righe remote all'istantanea (sul posto). Salta quelle che questo dispositivo ha
 * cambiato e non ha ancora inviato (vince la modifica locale, che verrà inviata subito dopo).
 * Restituisce quante righe sono state applicate e aggiorna `synced`.
 */
export function applyRemote(s: Snapshot, rows: readonly RemoteRow[], synced: Map<string, string>, localHashes?: ReadonlyMap<string, string>): number {
  let applied = 0;
  const idx = {
    movement: new Map(s.movements.map((x, i) => [x.id, i])),
    rule: new Map(s.rules.map((x, i) => [x.id, i])),
    account: new Map(s.accounts.map((x, i) => [x.id, i])),
    category: new Map(s.categories.map((x, i) => [x.id, i])),
    import: new Map(s.imports.map((x, i) => [x.id, i])),
  };
  const removed = { movement: new Set<string>(), rule: new Set<string>(), account: new Set<string>(), category: new Set<string>(), import: new Set<string>() };
  for (const row of rows) {
    const id = rid(row.kind, row.key);
    const local = localHashes?.get(id);
    // modificato qui e non ancora inviato: anche "cancellato qui" (era sincronizzato, ora non c'è più)
    const dirtyLocally = !!localHashes && local !== synced.get(id) && (local !== undefined || synced.has(id));
    if (dirtyLocally) continue;
    if (row.deleted) {
      if (!synced.has(id) && local === undefined) continue;
      synced.delete(id);
    } else {
      const h = hashOf(row.value);
      if (synced.get(id) === h && local === h) continue;
      synced.set(id, h);
    }
    applied++;
    switch (row.kind) {
      case "budget":
        if (row.key === "default") s.budgets.default = row.deleted ? {} : (row.value as Record<string, number>);
        else if (row.deleted) delete s.budgets.months[row.key];
        else s.budgets.months[row.key] = row.value as Record<string, number>;
        break;
      case "setting":
        if (!row.deleted) Object.assign(s.settings, row.value as object);
        break;
      case "invest": {
        const inv = (s.investments ??= emptyInvest());
        if (!row.deleted) Object.assign(inv, row.value as Partial<InvestData>);
        break;
      }
      case "instrument": case "trade": {
        const inv = (s.investments ??= emptyInvest());
        const list = (row.kind === "instrument" ? inv.instruments : inv.trades) as { id: string }[];
        const i = list.findIndex((x) => x.id === row.key);
        if (row.deleted) { if (i >= 0) list.splice(i, 1); }
        else if (i >= 0) list[i] = row.value as { id: string };
        else list.push(row.value as { id: string });
        break;
      }
      default: {
        const kind = row.kind;
        const list = (kind === "movement" ? s.movements : kind === "rule" ? s.rules : kind === "account" ? s.accounts : kind === "category" ? s.categories : s.imports) as { id: string }[];
        const i = idx[kind].get(row.key);
        if (row.deleted) { if (i !== undefined) removed[kind].add(row.key); }
        else if (i !== undefined) list[i] = row.value as { id: string };
        else { idx[kind].set(row.key, list.length); list.push(row.value as { id: string }); }
      }
    }
  }
  if (removed.movement.size) s.movements = s.movements.filter((x) => !removed.movement.has(x.id));
  if (removed.rule.size) s.rules = s.rules.filter((x) => !removed.rule.has(x.id));
  if (removed.account.size) s.accounts = s.accounts.filter((x) => !removed.account.has(x.id));
  if (removed.category.size) s.categories = s.categories.filter((x) => !removed.category.has(x.id));
  if (removed.import.size) s.imports = s.imports.filter((x) => !removed.import.has(x.id));
  return applied;
}

/** Quante righe ha l'istantanea (per decidere se un invio cancellerebbe gran parte del cloud). */
export const recordCount = (s: Snapshot) => toRecords(s).length;
