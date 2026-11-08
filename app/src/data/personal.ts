// Dati personali su Supabase (login + RLS). Il client viene caricato solo quando serve.
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "../config";

let client: Promise<SupabaseClient> | null = null;
export function supa(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
  return client;
}
export async function getSession(): Promise<Session | null> {
  const { data } = await (await supa()).auth.getSession();
  return data.session;
}

export interface UserRow { kind: string; key: string; value: unknown }

/** Estrae i dati personali da un backup JSON della v0.3 (TradingAnalyticsBackup). */
export function extractPersonal(doc: Record<string, unknown>): UserRow[] {
  if (!doc || (doc.format !== "TradingAnalyticsBackup" && !("v3" in doc))) throw new Error("Il file non è un backup di Trading Analytics.");
  const out: UserRow[] = [];
  const v3 = (doc.v3 ?? {}) as Record<string, unknown>;
  const list = (kind: string, arr: unknown, key: (x: Record<string, unknown>, i: number) => string) => {
    if (Array.isArray(arr)) arr.forEach((x, i) => out.push({ kind, key: key(x as Record<string, unknown>, i), value: x }));
  };
  const map = (kind: string, obj: unknown) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) for (const [k, v] of Object.entries(obj)) out.push({ kind, key: k, value: v });
  };
  list("trade", v3.trades, (x, i) => String(x.id ?? x.nid ?? i));
  list("journal", v3.journal, (x, i) => String(x.id ?? i));
  map("quote", v3.quotes);
  map("forecast", v3.forecasts);
  map("context", v3.context);
  map("alias", v3.alias);
  if (v3.tradeset) out.push({ kind: "settings", key: "tradeset", value: v3.tradeset });
  if (Array.isArray(v3.distinct)) out.push({ kind: "settings", key: "distinct", value: v3.distinct });
  if (Array.isArray(v3.delnid)) out.push({ kind: "settings", key: "delnid", value: v3.delnid });
  list("manual", doc.manual, (x) => `${x.d}|${x.lg}|${x.H}|${x.A}`);
  list("manualUnassigned", doc.manualUnassigned, (x, i) => JSON.stringify(x).slice(0, 200) || String(i));
  list("strategy", doc.strategies, (x, i) => String(x.name ?? i));
  list("clubRule", doc.clubRules, (x) => `${x.alias}|${x.country}|${x.scope ?? ""}`);
  list("goalEvent", doc.goalEvents, (x, i) => `${x.d}|${x.H}|${x.A}|${i}`);
  // chiavi duplicate: tiene l'ultima occorrenza
  return [...new Map(out.map((r) => [`${r.kind}\u0000${r.key}`, r])).values()];
}

export async function uploadPersonal(rows: UserRow[], onProgress?: (done: number) => void) {
  const sb = await supa();
  const session = await getSession();
  if (!session) throw new Error("Accedi prima di importare.");
  const uid = session.user.id;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ user_id: uid, kind: r.kind, key: r.key, value: r.value, updated_at: new Date().toISOString() }));
    const { error } = await sb.from("ta_user_data").upsert(chunk, { onConflict: "user_id,kind,key" });
    if (error) throw new Error(error.message);
    onProgress?.(Math.min(rows.length, i + 500));
  }
}

export async function loadPersonal(kind?: string): Promise<UserRow[]> {
  const sb = await supa();
  const out: UserRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from("ta_user_data").select("kind,key,value").order("kind").order("key").range(from, from + 999);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data as UserRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface Trade {
  id: number; d: string; lg: string; m: string; mk: string; side: "back" | "lay"; q: number; s: number; comm: number;
  res: string; exitpl: number | null; st?: string; n?: string; sim?: number;
}
/**
 * Profitto netto di un trade chiuso, stessa formula della v0.3:
 * "won"/"lost" si riferiscono alla scommessa (per un lay, "won" = la bancata vince).
 * Commissione predefinita 5% sulle vincite. null se il trade è ancora aperto.
 */
export function tradePL(t: Trade): number | null {
  const c = (t.comm ?? 5) / 100, q = Number(t.q), s = Number(t.s);
  if (t.res === "won") return t.side === "lay" ? s * (1 - c) : s * (q - 1) * (1 - c);
  if (t.res === "lost") return t.side === "lay" ? -s * (q - 1) : -s;
  if (t.res === "void") return 0;
  if (t.res === "exit" && Number.isFinite(Number(t.exitpl))) return Number(t.exitpl);
  return null;
}
