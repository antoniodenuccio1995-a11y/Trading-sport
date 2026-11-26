// Archivio locale IndexedDB: un'unica istantanea con numero di revisione.
// Come nella v3.10, se un'altra finestra ha salvato nel frattempo il salvataggio
// viene rifiutato (nessuna sovrascrittura silenziosa). Scritture accorpate.
import type { Snapshot } from "../domain/types.ts";

const DB_NAME = "finanza_personale_v4";
const STORE = "snapshots";
const KEY = "current";

interface Rec { snapshot: Snapshot; revision: number; savedAt: string; writer: string }

let db: IDBDatabase | null = null;
let revision = 0;
const writer = globalThis.crypto?.randomUUID?.() ?? String(Math.random());

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onerror = () => reject(req.error ?? new Error("Archivio non disponibile"));
    req.onblocked = () => reject(new Error("Archivio bloccato: chiudi le altre finestre dell'app e riprova."));
    req.onsuccess = () => { const d = req.result; d.onversionchange = () => { d.close(); db = null; }; resolve(d); };
  });
}

export async function load(): Promise<Snapshot | null> {
  db = await open();
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    tx.oncomplete = () => { const r = req.result as Rec | undefined; revision = r?.revision ?? 0; resolve(r?.snapshot ?? null); };
    tx.onabort = () => reject(tx.error ?? new Error("Lettura interrotta"));
  });
}

export class ConflictError extends Error {
  constructor() { super("Un'altra finestra ha salvato dati più recenti. Esporta un backup di questa sessione, poi ricarica."); this.name = "ConflictError"; }
}

function write(snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error("Archivio chiuso")); return; }
    let tx: IDBTransaction;
    try { tx = db.transaction(STORE, "readwrite", { durability: "strict" }); } catch { tx = db.transaction(STORE, "readwrite"); }
    const store = tx.objectStore(STORE);
    let err: Error | null = null;
    const get = store.get(KEY);
    get.onsuccess = () => {
      const actual = (get.result as Rec | undefined)?.revision ?? 0;
      if (actual !== revision) { err = new ConflictError(); tx.abort(); return; }
      store.put({ snapshot, revision: revision + 1, savedAt: new Date().toISOString(), writer } satisfies Rec, KEY);
    };
    tx.oncomplete = () => { revision++; resolve(); };
    tx.onabort = () => reject(err ?? tx.error ?? new Error("Salvataggio interrotto"));
  });
}

// --- coda di salvataggio: l'ultima istantanea vince, una scrittura alla volta ---
type Listener = (s: { state: "saving" | "saved" | "error"; message?: string; at?: Date }) => void;
let pending: Snapshot | null = null, running: Promise<void> | null = null, timer = 0;
const listeners = new Set<Listener>();
export const onSave = (l: Listener) => { listeners.add(l); return () => listeners.delete(l); };
const emit: Listener = (s) => listeners.forEach((l) => l(s));

export function save(snapshot: Snapshot) {
  pending = snapshot;
  emit({ state: "saving" });
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), 250) as unknown as number;
}

export function flush(): Promise<void> {
  if (running) return running.then(() => (pending ? flush() : undefined));
  if (!pending) return Promise.resolve();
  running = (async () => {
    try {
      while (pending) { const s = pending; pending = null; await write(s); }
      emit({ state: "saved", at: new Date() });
    } catch (e) {
      emit({ state: "error", message: (e as Error).message });
      throw e;
    } finally { running = null; }
  })();
  return running;
}

export const hasPending = () => !!pending || !!running;

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => { if (hasPending()) { void flush(); e.preventDefault(); } });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush().catch(() => {}); });
}
