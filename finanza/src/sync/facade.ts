// Porta d'ingresso leggera alla sincronizzazione: il motore (e supabase-js) si carica solo
// se c'è già una sessione salvata o quando apri la finestra di accesso.
import { useEffect, useState } from "preact/hooks";
import type { SyncState } from "./engine.ts";

type Engine = typeof import("./engine.ts");
let engine: Promise<Engine> | null = null;
let current: SyncState = { status: "off" };
const subs = new Set<(s: SyncState) => void>();

export function loadEngine(): Promise<Engine> {
  engine ??= import("./engine.ts").then((e) => {
    e.onSync((s) => { current = s; subs.forEach((f) => f(s)); });
    current = e.getSyncState();
    return e;
  });
  return engine;
}

/** Dopo il primo disegno: riprende la sincronizzazione se c'è una sessione salvata. */
export function bootSync() {
  let stored = false;
  try { stored = Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token")); } catch { /* archivio non disponibile */ }
  if (!stored) return;
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
  idle(() => { void loadEngine().then((e) => e.init()).catch(() => {}); });
}

export function useSync(): SyncState {
  const [s, set] = useState(current);
  useEffect(() => { subs.add(set); set(current); return () => { subs.delete(set); }; }, []);
  return s;
}

// finestra di accesso: aperta da qualunque punto dell'app
let openFn: () => void = () => {};
export const openSyncDialog = () => openFn();
export const registerSyncDialog = (fn: () => void) => { openFn = fn; };
