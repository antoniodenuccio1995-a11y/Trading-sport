// Stato dell'app: un'istantanea mutata sul posto, un numero di versione, ascoltatori.
// I calcoli pesanti (righe effettive, analisi) sono memorizzati per versione:
// si ricalcolano solo quando i dati cambiano, mai a ogni render.
import type { Line, Movement, Snapshot } from "../domain/types.ts";
import { toLines } from "../domain/movement.ts";
import { statusOf, type Status } from "../domain/classify.ts";
import * as db from "../storage/db.ts";
import { emptySnapshot, normalize } from "./defaults.ts";

let snap: Snapshot = emptySnapshot();
let version = 0;
let persist = true;
const listeners = new Set<() => void>();

export const getSnap = () => snap;
export const getVersion = () => version;
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const notify = () => listeners.forEach((fn) => fn());

export async function boot(): Promise<{ fresh: boolean; error?: string }> {
  try {
    const s = await db.load();
    if (s) { snap = normalize(s); version++; return { fresh: false }; }
    return { fresh: true };
  } catch (e) {
    persist = false; // archivio non disponibile (es. navigazione privata): l'app funziona in memoria
    return { fresh: true, error: (e as Error).message };
  }
}

/** Modifica lo stato. `fn` muta l'istantanea; poi salvataggio accorpato e nuovo render. */
export function mutate(fn: (s: Snapshot) => void) {
  fn(snap);
  version++;
  if (persist) db.save(snap);
  notify();
}

export function replace(next: Snapshot) {
  snap = normalize(next);
  version++;
  if (persist) db.save(snap);
  notify();
}

// ---------- memo per versione ----------
const cache = new Map<string, { v: number; value: unknown }>();
export function memo<T>(key: string, compute: () => T): T {
  const hit = cache.get(key);
  if (hit && hit.v === version) return hit.value as T;
  const value = compute();
  cache.set(key, { v: version, value });
  if (cache.size > 200) for (const [k, x] of cache) if (x.v !== version) cache.delete(k);
  return value;
}

export const lines = (): Line[] => memo("lines", () => toLines(snap));
export const byId = (): Map<string, Movement> => memo("byId", () => new Map(snap.movements.map((m) => [m.id, m])));
export const statuses = (): Map<string, Status> =>
  memo("status", () => { const ids = byId(); return new Map(snap.movements.map((m) => [m.id, statusOf(m, ids)])); });
export const reviewCount = (): number => memo("review", () => { let n = 0; for (const s of statuses().values()) if (s.kind === "warn") n++; return n; });
export const months = (): string[] => memo("months", () => [...new Set(lines().map((l) => l.month).filter(Boolean))].sort());
export const latestMonth = (): string => memo("latest", () => months().at(-1) ?? new Date().toISOString().slice(0, 7));
export const catById = () => memo("cats", () => new Map(snap.categories.map((c) => [c.id, c])));
export const accById = () => memo("accs", () => new Map(snap.accounts.map((a) => [a.id, a])));
