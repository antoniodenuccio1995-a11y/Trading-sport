// Sincronizzazione con Supabase (tabella fp_records, una riga per record, RLS per account).
// L'app resta locale: legge e scrive sempre IndexedDB; qui si inviano solo le righe cambiate
// e si scaricano quelle aggiornate dagli altri dispositivi. supabase-js si carica solo se serve.
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "../domain/types.ts";
import { getSnap, mutate, replace, subscribe } from "../state/store.ts";
import { emptySnapshot } from "../state/defaults.ts";
import { loadMeta, saveMeta } from "../storage/db.ts";
import { applyRemote, diff, rid, type Kind, type RemoteRow } from "./records.ts";

export const SUPABASE_URL = "https://cqfxjvrpspvycocvxghv.supabase.co";
export const SUPABASE_KEY = "sb_publishable_VQS48ywRaUafRirZIyo5EQ_8KMjSDfm";
const TABLE = "fp_records";
const BATCH = 400;
const EPOCH = "1970-01-01T00:00:00Z";

export type Status = "off" | "connecting" | "syncing" | "ok" | "offline" | "error" | "paused" | "link-choice" | "confirm-delete";
export interface SyncState { status: Status; email?: string; lastSync?: Date; message?: string; pendingDeletes?: number; counts?: { local: number; remote: number } }
interface Meta { userId: string; email: string; cursor: string; hashes: [string, string][]; device: string }

let state: SyncState = { status: "off" };
const listeners = new Set<(s: SyncState) => void>();
export const getSyncState = () => state;
export const onSync = (fn: (s: SyncState) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const set = (p: Partial<SyncState>) => { state = { ...state, ...p }; listeners.forEach((f) => f(state)); };

let client: Promise<SupabaseClient> | null = null;
function supa(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
  return client;
}

/** Token dell'accesso in corso (per le funzioni Supabase riservate al titolare), o null se non hai fatto l'accesso. */
export async function accessToken(): Promise<string | null> {
  if (!hasStoredSession()) return null;
  const { data } = await (await supa()).auth.getSession();
  return data.session?.access_token ?? null;
}

/** C'è una sessione salvata? (senza caricare supabase-js) */
export function hasStoredSession(): boolean {
  try { return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token")); } catch { return false; }
}

let meta: Meta | null = null;
let synced = new Map<string, string>();
let session: Session | null = null;
let applyingRemote = false;
let running: Promise<void> | null = null;
let again = false;
let timer = 0;
let decide: ((v: boolean | "merge" | "cloud" | "device") => void) | null = null;

const deviceId = () => {
  try { let d = localStorage.getItem("fp4.device"); if (!d) { d = (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 8); localStorage.setItem("fp4.device", d); } return d; } catch { return "dispositivo"; }
};
const persist = async () => { if (meta) { meta.hashes = [...synced]; await saveMeta("sync", meta).catch(() => {}); } };
const isOffline = (e: unknown) => !navigator.onLine || /fetch|network|Failed to fetch|Load failed/i.test(String((e as Error)?.message ?? e));

function italian(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e);
  if (/Signups not allowed|User not found/i.test(m)) return "Questa email non ha un account sul progetto. Usa la stessa email di Trading Analytics.";
  if (/only request this after (\d+) seconds/i.test(m)) return `Per sicurezza puoi chiedere un nuovo codice tra ${m.match(/after (\d+) seconds/i)![1]} secondi.`;
  if (/rate limit/i.test(m)) return "Troppe richieste di codice in poco tempo: riprova tra qualche minuto.";
  if (/expired|invalid/i.test(m) && /token|otp/i.test(m)) return "Codice non valido o scaduto.";
  if (/Invalid login credentials/i.test(m)) return "Email o password non corretti.";
  if (isOffline(e)) return "Nessuna connessione: i dati restano su questo dispositivo e si sincronizzano appena torna la rete.";
  return m;
}

// ---------- accesso ----------
export async function sendCode(email: string) {
  const { error } = await (await supa()).auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
  if (error) throw new Error(italian(error));
}
export async function verifyCode(email: string, code: string) {
  const { data, error } = await (await supa()).auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
  if (error || !data.session) throw new Error(italian(error ?? "Codice non valido o scaduto."));
  void start(data.session); // il collegamento prosegue in sottofondo: lo stato si vede nella barra laterale
}
export async function signInPassword(email: string, password: string) {
  const { data, error } = await (await supa()).auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.session) throw new Error(italian(error ?? "Accesso non riuscito"));
  void start(data.session);
}
export async function signOut() {
  await (await supa()).auth.signOut().catch(() => {});
  session = null;
  set({ status: "off", email: undefined, message: undefined });
}

/** All'avvio: se c'è una sessione salvata, riprende la sincronizzazione dopo il primo disegno. */
export async function init() {
  const sb = await supa();
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === "SIGNED_OUT") { session = null; set({ status: "off", email: undefined }); }
    else if (s && (!session || s.user.id !== session.user.id)) void start(s);
    else if (s) session = s;
  });
  const { data } = await sb.auth.getSession();
  if (data.session) await start(data.session);
}

let wired = false;
function wire() {
  if (wired) return; wired = true;
  subscribe(() => { if (!applyingRemote && session) schedule(2000); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedule(300); });
  addEventListener("online", () => schedule(300));
  setInterval(() => { if (document.visibilityState === "visible") schedule(0); }, 60_000);
}
const schedule = (ms: number) => { clearTimeout(timer); timer = setTimeout(() => void syncNow(), ms) as unknown as number; };

async function start(s: Session) {
  session = s;
  set({ status: "connecting", email: s.user.email ?? "" });
  wire();
  const m = await loadMeta<Meta>("sync").catch(() => null);
  if (m && m.userId === s.user.id) {
    meta = m; synced = new Map(m.hashes);
    await syncNow();
  } else {
    meta = { userId: s.user.id, email: s.user.email ?? "", cursor: EPOCH, hashes: [], device: deviceId() };
    synced = new Map();
    await link();
  }
}

// ---------- rete ----------
async function fetchSince(since: string): Promise<RemoteRow[]> {
  const sb = await supa();
  const out: RemoteRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(TABLE).select("kind,key,value,deleted,updated_at").gt("updated_at", since)
      .order("updated_at").order("kind").order("key").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as RemoteRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function remoteCount(): Promise<number> {
  const { count, error } = await (await supa()).from(TABLE).select("key", { count: "exact", head: true }).eq("deleted", false);
  if (error) throw error;
  return count ?? 0;
}
async function upload(rows: { kind: Kind; key: string; value: unknown; deleted: boolean }[], hashes: Map<string, string>) {
  const sb = await supa();
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => ({ ...r, user_id: session!.user.id, device: meta!.device }));
    const { error } = await sb.from(TABLE).upsert(chunk, { onConflict: "user_id,kind,key" });
    if (error) throw error;
    for (const r of chunk) { const id = rid(r.kind, r.key); if (r.deleted) synced.delete(id); else synced.set(id, hashes.get(id)!); }
    if (rows.length > BATCH) set({ message: `Invio ${Math.min(rows.length, i + BATCH)} di ${rows.length}…` });
  }
}

const maxTime = (rows: RemoteRow[], cur: string) => rows.reduce((t, r) => (r.updated_at > t ? r.updated_at : t), cur);
const back = (iso: string) => (iso === EPOCH ? EPOCH : new Date(Date.parse(iso) - 120_000).toISOString());

async function pull() {
  const rows = await fetchSince(back(meta!.cursor));
  if (!rows.length) return;
  const snap = getSnap();
  if (snap.meta.demo) return;
  const local = diff(snap, synced).hashes;
  let n = 0;
  applyingRemote = true;
  try { mutate((s) => { n = applyRemote(s, rows, synced, local); }); } finally { applyingRemote = false; }
  meta!.cursor = maxTime(rows, meta!.cursor);
  if (n) set({ message: `${n} aggiornamenti ricevuti` });
}

async function push() {
  const snap = getSnap();
  if (snap.meta.demo) return;
  const d = diff(snap, synced);
  if (d.deletes.length > 50 && d.deletes.length > synced.size * 0.3) {
    set({ status: "confirm-delete", pendingDeletes: d.deletes.length });
    const ok = await new Promise<boolean | string>((r) => { decide = r as never; });
    decide = null;
    if (!ok) { await restoreFromCloud(); return; }
  }
  const rows = [
    ...d.upserts.map((r) => ({ kind: r.kind, key: r.key, value: r.value, deleted: false })),
    ...d.deletes.map((r) => ({ kind: r.kind, key: r.key, value: null, deleted: true })),
  ];
  if (rows.length) await upload(rows, d.hashes);
}

/** Pull poi push; una sola esecuzione alla volta (le richieste nel frattempo si accodano). */
export function syncNow(): Promise<void> {
  if (!session || !meta) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      if (getSnap().meta.demo) { set({ status: "paused", message: "Sincronizzazione in pausa: stai guardando dati dimostrativi." }); return; }
      set({ status: "syncing", message: undefined });
      await pull();
      await push();
      await persist();
      set({ status: "ok", lastSync: new Date(), message: undefined, pendingDeletes: undefined });
    } catch (e) {
      set({ status: isOffline(e) ? "offline" : "error", message: italian(e) });
    } finally {
      running = null;
      if (again) { again = false; schedule(500); }
    }
  })();
  return running;
}

// ---------- primo collegamento di questo dispositivo ----------
async function link() {
  set({ status: "syncing", message: "Collegamento al cloud…" });
  try {
    const local = getSnap();
    const localEmpty = !local.movements.length || !!local.meta.demo;
    const n = await remoteCount();
    if (n === 0) {
      if (!localEmpty) await push();
    } else if (localEmpty) {
      await takeCloud();
    } else {
      set({ status: "link-choice", counts: { local: local.movements.length, remote: n } });
      const choice = await new Promise<string>((r) => { decide = r as never; });
      decide = null;
      set({ status: "syncing", message: "Unione dei dati…" });
      if (choice === "cloud") await takeCloud();
      else if (choice === "device") await keepDevice();
      else await merge();
    }
    await persist();
    set({ status: "ok", lastSync: new Date(), message: undefined, counts: undefined });
  } catch (e) {
    set({ status: isOffline(e) ? "offline" : "error", message: italian(e) });
  }
}
/** Risposta dell'utente alle domande del motore (scelta al primo collegamento o conferma di cancellazione). */
export const answer = (v: boolean | "merge" | "cloud" | "device") => decide?.(v);

async function takeCloud() {
  const rows = await fetchSince(EPOCH);
  const fresh: Snapshot = emptySnapshot();
  fresh.categories = []; fresh.accounts = []; fresh.rules = [];
  synced = new Map();
  applyRemote(fresh, rows, synced);
  const keep = getSnap().settings;
  fresh.settings = { ...fresh.settings, theme: keep.theme, reduceMotion: keep.reduceMotion, hideAmounts: keep.hideAmounts };
  applyingRemote = true;
  try { replace(fresh); } finally { applyingRemote = false; }
  meta!.cursor = maxTime(rows, EPOCH);
}
async function merge() {
  const rows = await fetchSince(EPOCH);
  applyingRemote = true;
  try { mutate((s) => { applyRemote(s, rows, synced); }); } finally { applyingRemote = false; }
  meta!.cursor = maxTime(rows, EPOCH);
  await push();
}
async function keepDevice() {
  const rows = await fetchSince(EPOCH);
  synced = new Map(rows.filter((r) => !r.deleted).map((r) => [rid(r.kind, r.key), "remoto"]));
  meta!.cursor = maxTime(rows, EPOCH);
  const d = diff(getSnap(), synced);
  const out = [
    ...d.upserts.map((r) => ({ kind: r.kind, key: r.key, value: r.value, deleted: false })),
    ...d.deletes.map((r) => ({ kind: r.kind, key: r.key, value: null, deleted: true })),
  ];
  await upload(out, d.hashes);
}
async function restoreFromCloud() {
  meta!.cursor = EPOCH;
  await takeCloud();
}
