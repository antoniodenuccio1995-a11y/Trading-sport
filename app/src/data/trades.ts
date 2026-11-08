// Registro trade: dati nel tuo account Supabase (servono l'accesso e le regole RLS).
import { getStore, leagueName, teamName } from "./store";
import { getSession, supa, tradePL, type Trade } from "./personal";
import { played, type Match } from "./types";

export type { Trade };

export interface TradeSettings { cap: number; pct: number; dl: number }
export const DEFAULT_SETTINGS: TradeSettings = { cap: 100, pct: 2, dl: 10 };

/** Mercati gestiti (stesse chiavi del confronto con il mercato). */
export const MARKETS: { key: string; label: string }[] = [
  { key: "1", label: "1 · Vittoria casa" }, { key: "X", label: "X · Pareggio" }, { key: "2", label: "2 · Vittoria ospite" },
  { key: "o15", label: "Over 1,5" }, { key: "u15", label: "Under 1,5" }, { key: "o25", label: "Over 2,5" }, { key: "u25", label: "Under 2,5" },
  { key: "o35", label: "Over 3,5" }, { key: "u35", label: "Under 3,5" }, { key: "gg", label: "Goal (GG)" }, { key: "ng", label: "No goal (NG)" },
  { key: "o05h1", label: "Over 0,5 1° tempo" }, { key: "u05h1", label: "Under 0,5 1° tempo" }, { key: "o15h1", label: "Over 1,5 1° tempo" },
  { key: "u15h1", label: "Under 1,5 1° tempo" }, { key: "o05h2", label: "Over 0,5 2° tempo" }, { key: "u05h2", label: "Under 0,5 2° tempo" },
];
export const marketLabel = (key?: string, fallback = "") => MARKETS.find((m) => m.key === key)?.label ?? fallback;

/** La selezione è uscita? null se il risultato non basta per deciderlo. */
export function selectionWon(key: string, m: Match): boolean | null {
  if (!played(m)) return null;
  const h = m.fh!, a = m.fa!, t = h + a;
  const ht = m.hh !== null && m.ha !== null ? m.hh + m.ha : null;
  const t2 = ht === null ? null : t - ht;
  switch (key) {
    case "1": return h > a; case "X": return h === a; case "2": return a > h;
    case "o15": return t > 1.5; case "u15": return t < 1.5; case "o25": return t > 2.5; case "u25": return t < 2.5;
    case "o35": return t > 3.5; case "u35": return t < 3.5; case "gg": return h > 0 && a > 0; case "ng": return !(h > 0 && a > 0);
    case "o05h1": return ht === null ? null : ht > 0; case "u05h1": return ht === null ? null : ht === 0;
    case "o15h1": return ht === null ? null : ht > 1; case "u15h1": return ht === null ? null : ht < 2;
    case "o05h2": return t2 === null ? null : t2 > 0; case "u05h2": return t2 === null ? null : t2 === 0;
  }
  return null;
}

/** Esito suggerito per un trade aperto collegato a una partita finita. */
export function suggestedResult(t: Trade): "won" | "lost" | null {
  if (!t.mid || !t.mkey) return null;
  const m = getStore().byId.get(t.mid);
  if (!m) return null;
  const w = selectionWon(t.mkey, m);
  if (w === null) return null;
  return (t.side === "lay" ? !w : w) ? "won" : "lost";
}

/** Quota di chiusura dall'archivio (Betfair Exchange se c'è, altrimenti media bookmaker). */
export function archiveClosing(t: Trade): number | null {
  if (!t.mid || !t.mkey) return null;
  const m = getStore().byId.get(t.mid);
  if (!m) return null;
  const pick: Record<string, (number | null)[]> = { "1": [m.bh, m.ch], X: [m.bd, m.cd], "2": [m.ba, m.ca], o25: [m.co], u25: [m.cu] };
  return (pick[t.mkey] ?? []).find((x) => x) ?? null;
}

/** Collega i trade importati dalla v0.3 (solo testo) a partita e mercato. */
export function guessMarket(label: string): string | undefined {
  const s = label.toLowerCase().replace(",", ".");
  const half = /primo tempo|1t|1° tempo|1st half/.test(s) ? "h1" : /secondo tempo|2t|2° tempo|2nd half/.test(s) ? "h2" : "";
  const ou = /(over|under)\s*([0-9.]+)/.exec(s);
  if (ou) {
    const k = `${ou[1] === "over" ? "o" : "u"}${ou[2].replace(".", "")}${half}`;
    return MARKETS.some((m) => m.key === k) ? k : undefined;
  }
  if (/no ?go(a)?l|\bng\b/.test(s)) return "ng";
  if (/entrambe|\bgg\b|\bgoal\b|\bgol\b/.test(s)) return "gg";
  if (/vittoria casa|^1\b|casa/.test(s)) return "1";
  if (/pareggio|^x\b/.test(s)) return "X";
  if (/vittoria (ospite|trasferta)|^2\b|ospite|trasferta/.test(s)) return "2";
  return undefined;
}
const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function guessMatch(t: Trade): Match | undefined {
  const s = getStore();
  const day = Date.UTC(+t.d.slice(0, 4), +t.d.slice(5, 7) - 1, +t.d.slice(8, 10)) / 86400000;
  const [hn, an] = t.m.split(/\s+[–-]\s+/).map(norm);
  if (!hn || !an) return undefined;
  const near = [day, day - 1, day + 1].flatMap((d) => s.byDay.get(d) ?? []);
  const like = (id: number, n: string) => { const x = norm(teamName(id)); return x === n || x.includes(n) || n.includes(x); };
  return near.find((m) => (!t.lg || norm(leagueName(m.lg)) === norm(t.lg)) && like(m.h, hn) && like(m.a, an))
    ?? near.find((m) => like(m.h, hn) && like(m.a, an));
}
export function enrich(t: Trade): Trade {
  if (t.mid && t.mkey) return t;
  const m = t.mid ? getStore().byId.get(t.mid) : guessMatch(t);
  return { ...t, mid: t.mid ?? m?.id, mkey: t.mkey ?? guessMarket(t.mk) };
}

export const risk = (t: Trade) => (t.side === "lay" ? Number(t.s) * (Number(t.q) - 1) : Number(t.s));
/** CLV: quanto la quota presa è migliore di quella di chiusura (positivo = buono). */
export function clv(t: Trade): number | null {
  const cl = Number(t.cl), q = Number(t.q);
  if (!(cl > 1) || !(q > 1)) return null;
  return t.side === "lay" ? cl / q - 1 : q / cl - 1;
}

export interface Summary { n: number; open: number; closed: number; pl: number; risk: number; won: number; clvAvg: number | null; clvN: number }
export function summarize(list: Trade[]): Summary {
  const closed = list.filter((t) => tradePL(t) !== null);
  const clvs = list.map(clv).filter((x): x is number => x !== null);
  return {
    n: list.length, open: list.length - closed.length, closed: closed.length,
    pl: closed.reduce((s, t) => s + tradePL(t)!, 0), risk: closed.reduce((s, t) => s + risk(t), 0),
    won: closed.filter((t) => t.res === "won").length,
    clvAvg: clvs.length ? clvs.reduce((a, b) => a + b, 0) / clvs.length : null, clvN: clvs.length,
  };
}

// --- persistenza (solo account) ---
async function uid() {
  const s = await getSession();
  if (!s) throw new Error("Accedi per usare il registro trade.");
  return s.user.id;
}
export async function loadTrades(): Promise<{ trades: Trade[]; settings: TradeSettings }> {
  const sb = await supa();
  await uid();
  const { data, error } = await sb.from("ta_user_data").select("kind,key,value").in("kind", ["trade", "settings"]);
  if (error) throw new Error(error.message);
  const trades = (data ?? []).filter((r) => r.kind === "trade").map((r) => r.value as Trade);
  const set = (data ?? []).find((r) => r.kind === "settings" && r.key === "tradeset")?.value as Partial<TradeSettings> | undefined;
  return { trades, settings: { ...DEFAULT_SETTINGS, ...(set ?? {}) } };
}
export async function saveTrade(t: Trade) {
  const sb = await supa(), user = await uid();
  const v = { ...t, upd: Date.now() };
  const { error } = await sb.from("ta_user_data").upsert({ user_id: user, kind: "trade", key: String(t.id), value: v, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
  if (error) throw new Error(error.message);
  return v;
}
export async function deleteTrade(id: number) {
  const sb = await supa();
  await uid();
  const { error } = await sb.from("ta_user_data").delete().eq("kind", "trade").eq("key", String(id));
  if (error) throw new Error(error.message);
}
export async function saveSettings(v: TradeSettings) {
  const sb = await supa(), user = await uid();
  const { error } = await sb.from("ta_user_data").upsert({ user_id: user, kind: "settings", key: "tradeset", value: v, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
  if (error) throw new Error(error.message);
}

export function tradesCsv(list: Trade[]): string {
  const head = ["data", "campionato", "partita", "mercato", "lato", "quota", "stake", "commissione_pct", "esito", "pl_netto", "quota_chiusura", "clv_pct", "simulato", "note"];
  const q = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const rows = list.map((t) => [t.d, t.lg, t.m, t.mk, t.side, t.q, t.s, t.comm, t.res, tradePL(t)?.toFixed(2) ?? "", t.cl ?? "", clv(t) === null ? "" : (clv(t)! * 100).toFixed(1), t.sim ? "sì" : "", t.n || t.st || ""]);
  return [head, ...rows].map((r) => r.map(q).join(";")).join("\r\n");
}
