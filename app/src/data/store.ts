// Archivio partite in memoria: si apre subito dalla cache locale (IndexedDB),
// poi scarica in background solo le stagioni cambiate (indicate dal manifest).
import { DATA_BASE } from "../config";
import { idbDel, idbGet, idbSet } from "./idb";
import type { League, Manifest, Match, RefSnapshot, SeasonSnapshot, Team } from "./types";

export interface Store {
  status: "loading" | "ready" | "empty" | "error";
  source: "cache" | "network" | null;
  syncing: boolean;
  error: string | null;
  generatedAt: string | null;
  leagues: League[];
  leagueByCode: Map<string, League>;
  teams: Map<number, Team>;
  matches: Match[];
  byTeam: Map<number, Match[]>;
  byLeagueSeason: Map<string, Match[]>;
  byDay: Map<number, Match[]>;
  byId: Map<number, Match>;
  seasons: string[];
  timings: Record<string, number>;
}

const COLS = ["fh", "fa", "hh", "ha", "shh", "sha", "soh", "soa", "coh", "coa", "yeh", "yea", "reh", "rea",
  "oh", "od", "oa", "oo", "ou", "ch", "cd", "ca", "co", "cu", "bh", "bd", "ba"] as const;

function emptyStore(): Store {
  return {
    status: "loading", source: null, syncing: false, error: null, generatedAt: null,
    leagues: [], leagueByCode: new Map(), teams: new Map(), matches: [],
    byTeam: new Map(), byLeagueSeason: new Map(), byDay: new Map(), byId: new Map(), seasons: [], timings: {},
  };
}

let store: Store = emptyStore();
const listeners = new Set<() => void>();
export const getStore = () => store;
export function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function emit(patch: Partial<Store>) { store = { ...store, ...patch }; listeners.forEach((f) => f()); }

/** Costruisce archivio e indici dalle istantanee. Esportata per i test. */
export function buildStore(ref: RefSnapshot, snaps: SeasonSnapshot[]): Pick<Store,
  "leagues" | "leagueByCode" | "teams" | "matches" | "byTeam" | "byLeagueSeason" | "byDay" | "byId" | "seasons"> {
  const leagues = [...ref.leagues].sort((a, b) => a.sort - b.sort);
  const teams = new Map<number, Team>(ref.teams.map(([id, country, name, status, logo]) => [id, { id, country, name, status, logo: logo ?? null }]));
  const matches: Match[] = [];
  for (const s of snaps) {
    const col = (k: string) => (s[k] as (number | null)[]) ?? [];
    const id = col("id"), lg = s.lg as string[], d = col("d"), ko = col("ko"), h = col("h"), a = col("a");
    const cols = COLS.map((k) => col(k));
    for (let i = 0; i < s.n; i++) {
      const m = { i: 0, id: id[i]!, lg: lg[i], s: s.season, d: d[i]!, ko: ko[i] ?? null, h: h[i]!, a: a[i]! } as Match;
      for (let c = 0; c < COLS.length; c++) (m as unknown as Record<string, number | null>)[COLS[c]] = cols[c][i] ?? null;
      matches.push(m);
    }
  }
  matches.sort((x, y) => x.d - y.d || (x.ko ?? 0) - (y.ko ?? 0) || x.id - y.id);
  const byTeam = new Map<number, Match[]>(), byLeagueSeason = new Map<string, Match[]>(), byDay = new Map<number, Match[]>();
  const byId = new Map<number, Match>();
  const push = <K,>(map: Map<K, Match[]>, k: K, m: Match) => { const l = map.get(k); if (l) l.push(m); else map.set(k, [m]); };
  matches.forEach((m, i) => {
    m.i = i;
    push(byTeam, m.h, m); push(byTeam, m.a, m);
    push(byLeagueSeason, `${m.lg}|${m.s}`, m);
    push(byDay, m.d, m);
    byId.set(m.id, m);
  });
  const seasons = [...new Set(snaps.map((s) => s.season))].sort();
  return { leagues, leagueByCode: new Map(leagues.map((l) => [l.code, l])), teams, matches, byTeam, byLeagueSeason, byDay, byId, seasons };
}

async function fetchJson<T>(path: string, noStore = false): Promise<T> {
  const res = await fetch(`${DATA_BASE}/${path}`, noStore ? { cache: "no-store" } : undefined);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function fromCache(): Promise<boolean> {
  const t0 = performance.now();
  const man = await idbGet<Manifest>("manifest");
  if (!man) return false;
  const [ref, ...snaps] = await Promise.all([
    idbGet<RefSnapshot>(man.ref.path),
    ...man.seasons.map((s) => idbGet<SeasonSnapshot>(s.path)),
  ]);
  if (!ref || snaps.some((s) => !s)) return false;
  const t1 = performance.now();
  const built = buildStore(ref, snaps as SeasonSnapshot[]);
  emit({ ...built, status: built.matches.length ? "ready" : "empty", source: "cache", generatedAt: man.generatedAt,
    timings: { ...store.timings, cacheRead: Math.round(t1 - t0), build: Math.round(performance.now() - t1) } });
  return true;
}

async function fromNetwork() {
  emit({ syncing: true });
  const t0 = performance.now();
  const man = await fetchJson<Manifest>("v1/manifest.json", true);
  const old = await idbGet<Manifest>("manifest");
  if (old && old.generatedAt === man.generatedAt && store.source === "cache") { emit({ syncing: false }); return; }
  const need = [man.ref.path, ...man.seasons.map((s) => s.path)];
  const docs = await Promise.all(need.map(async (p) => (await idbGet(p)) ?? fetchJson(p).then(async (doc) => { await idbSet(p, doc); return doc; })));
  const [ref, ...snaps] = docs as [RefSnapshot, ...SeasonSnapshot[]];
  const t1 = performance.now();
  const built = buildStore(ref, snaps);
  await idbSet("manifest", man);
  if (old) {
    const keep = new Set(need);
    await idbDel([old.ref.path, ...old.seasons.map((s) => s.path)].filter((p) => !keep.has(p)));
  }
  emit({ ...built, status: built.matches.length ? "ready" : "empty", source: "network", syncing: false, error: null,
    generatedAt: man.generatedAt, timings: { ...store.timings, network: Math.round(t1 - t0), build: Math.round(performance.now() - t1) } });
}

export async function startStore() {
  const t0 = performance.now();
  const cached = await fromCache().catch(() => false);
  store.timings.firstData = Math.round(performance.now() - t0);
  try { await fromNetwork(); }
  catch (e) {
    const msg = (e as Error).message;
    if (cached) emit({ syncing: false, error: `Aggiornamento non riuscito (${msg}). Uso i dati salvati.` });
    else emit({ syncing: false, status: "error", error: `Impossibile scaricare i dati: ${msg}` });
  }
}
export const refreshStore = () => fromNetwork().catch((e) => emit({ syncing: false, error: (e as Error).message }));

// --- utilità di lettura ---
export const teamName = (id: number) => store.teams.get(id)?.name ?? `#${id}`;
export const leagueName = (code: string) => store.leagueByCode.get(code)?.name ?? code;
export const currentSeasonOf = (lg: string) => {
  const s = store.seasons.filter((x) => store.byLeagueSeason.has(`${lg}|${x}`));
  return s[s.length - 1] ?? store.seasons[store.seasons.length - 1];
};
export const matchById = (id: number) => store.byId.get(id);

/**
 * Pulsante "Aggiorna": chiede al server di riscaricare subito i risultati da tutte le fonti
 * (al massimo una volta ogni 10 minuti per tutti), poi controlla la pubblicazione finché arriva.
 */
export async function requestServerRefresh(onStatus: (msg: string) => void): Promise<void> {
  const { SUPABASE_URL, SUPABASE_KEY } = await import("../config");
  const before = store.generatedAt;
  onStatus("Richiesta inviata: scarico i risultati da tutte le fonti…");
  let started = true, wait = 0;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ta_request_refresh`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, "content-type": "application/json" }, body: "{}",
    });
    const j = await res.json();
    started = !!j.ok; wait = j.wait_seconds ?? 0;
  } catch { started = false; }
  if (!started && wait) onStatus(`Aggiornamento già fatto da poco: controllo se ci sono dati nuovi (prossimo tra ${Math.ceil(wait / 60)} min).`);
  for (let i = 0; i < (started ? 12 : 1); i++) {
    if (started) await new Promise((r) => setTimeout(r, 10000));
    try {
      const man = await fetchJson<Manifest>("v1/manifest.json", true);
      if (man.generatedAt !== before) { await fromNetwork(); onStatus("Dati aggiornati."); return; }
    } catch { /* riprova */ }
    if (started) onStatus(`Aggiornamento in corso… (${(i + 1) * 10} s)`);
  }
  onStatus(started ? "Nessuna novità: i dati erano già aggiornati." : "Dati già aggiornati.");
}
