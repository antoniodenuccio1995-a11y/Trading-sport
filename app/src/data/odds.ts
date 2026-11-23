// Storico delle quote di una partita (tabella pubblica ta_odds_hist, lettura con la chiave pubblica).
import { SUPABASE_KEY, SUPABASE_URL } from "../config";

export interface OddsSnap {
  taken_at: string; src: string;
  o_h: number | null; o_d: number | null; o_a: number | null; o_o25: number | null; o_u25: number | null;
  bf_h: number | null; bf_d: number | null; bf_a: number | null;
}

const COLS = "taken_at,src,o_h,o_d,o_a,o_o25,o_u25,bf_h,bf_d,bf_a";
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function oddsHistory(matchId: number): Promise<OddsSnap[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ta_odds_hist?match_id=eq.${matchId}&select=${COLS}&order=taken_at.asc&limit=500`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (!res.ok) throw new Error(`storico quote: HTTP ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    taken_at: String(r.taken_at), src: String(r.src),
    o_h: num(r.o_h), o_d: num(r.o_d), o_a: num(r.o_a), o_o25: num(r.o_o25), o_u25: num(r.o_u25),
    bf_h: num(r.bf_h), bf_d: num(r.bf_d), bf_a: num(r.bf_a),
  }));
}
