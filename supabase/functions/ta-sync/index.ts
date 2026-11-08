// Trading Analytics · sincronizzazione dati partite.
// Modalità (POST JSON, header x-ta-token):
//   {mode:'league', league:'I1', scope:'current'|'all'}  risultati + calendario di una lega
//   {mode:'fixtures'}                                     quote pre-partita da football-data (fixtures.csv)
//   {mode:'publish'}                                      pubblica le istantanee per l'app nello storage
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { decode, fdExtraSeason, fdRow, MatchRow, omRow, parseCsv, seasonCode, seasonOf } from "./parse.ts";

const FD = "https://www.football-data.co.uk";
const OM = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data";
const FIRST_SEASON = 2021;
const BUCKET = "ta-data";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type League = {
  code: string; name: string; country: string; fd_kind: "main" | "extra" | null;
  fd_code: string | null; om_folder: string | null; active: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);
const currentSeason = () => seasonOf(today());
function seasonsFrom(first: number): string[] {
  const cur = Number(currentSeason().slice(0, 4)), out: string[] = [];
  for (let y = first; y <= cur; y++) out.push(`${y}/${String((y + 1) % 100).padStart(2, "0")}`);
  return out;
}

async function fetchCsv(url: string) {
  const res = await fetch(url, { headers: { "user-agent": "TradingAnalytics/1.0 (sync dati personali)" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return parseCsv(decode(await res.arrayBuffer()));
}

async function ingest(league: string, season: string, source: string, kind: "results" | "fixtures", rows: MatchRow[], replace = false) {
  if (!rows.length && !replace) return { rows: 0 };
  const { data, error } = await db.rpc("ta_ingest", {
    p_league: league, p_season: season, p_source: source, p_kind: kind, p_rows: rows, p_replace: replace,
  });
  if (error) throw new Error(`ingest ${league} ${season} ${source}/${kind}: ${error.message}`);
  return data;
}

async function logError(league: string | null, season: string | null, source: string, kind: string, message: string) {
  await db.from("ta_sync_runs").insert({ league, season, source, kind, ok: false, message: message.slice(0, 500) });
}

async function syncLeague(lg: League, scope: "current" | "all") {
  const out: Record<string, unknown>[] = [];
  const cur = currentSeason();
  const seasons = scope === "all" ? seasonsFrom(FIRST_SEASON) : [cur];
  const step = async (label: string, season: string | null, source: string, kind: string, fn: () => Promise<unknown>) => {
    try { out.push({ step: label, ...(await fn() as object) }); }
    catch (e) { const msg = (e as Error).message; out.push({ step: label, error: msg }); await logError(lg.code, season, source, kind, msg); }
  };

  if (lg.fd_kind === "main" && lg.fd_code) {
    for (const s of seasons) {
      await step(`fd ${s}`, s, "fd", "results", async () => {
        const csv = await fetchCsv(`${FD}/mmz4281/${seasonCode(s)}/${lg.fd_code}.csv`);
        if (!csv) return { missing: true };
        return await ingest(lg.code, s, "fd", "results", csv.map(fdRow).filter((r): r is MatchRow => !!r && r.fthg !== undefined));
      });
    }
  } else if (lg.fd_kind === "extra" && lg.fd_code) {
    await step(`fd-extra`, null, "fd", "results", async () => {
      const csv = await fetchCsv(`${FD}/new/${lg.fd_code}.csv`);
      if (!csv) return { missing: true };
      const res: Record<string, unknown> = {};
      for (const s of seasons) {
        const rows = csv.filter((r) => fdExtraSeason(r.Season) === s).map(fdRow).filter((r): r is MatchRow => !!r && r.fthg !== undefined);
        res[s] = await ingest(lg.code, s, "fd", "results", rows);
      }
      return res;
    });
  }

  if (lg.om_folder && seasons.includes(cur)) {
    const code = seasonCode(cur);
    await step(`om results ${cur}`, cur, "om", "results", async () => {
      const csv = await fetchCsv(`${OM}/${lg.om_folder}/results_${code}.csv`);
      if (!csv) return { missing: true };
      return await ingest(lg.code, cur, "om", "results", csv.map(omRow).filter((r): r is MatchRow => !!r && r.fthg !== undefined));
    });
    await step(`om fixtures ${cur}`, cur, "om", "fixtures", async () => {
      const csv = await fetchCsv(`${OM}/${lg.om_folder}/fixtures_${code}.csv`);
      if (!csv) return { missing: true };
      const rows = csv.map(omRow).filter((r): r is MatchRow => !!r);
      // un file vuoto o troncato non deve cancellare il calendario esistente
      return await ingest(lg.code, cur, "om", "fixtures", rows, rows.length > 0);
    });
  }
  return out;
}

async function syncFixturesOdds(leagues: League[]) {
  const out: Record<string, unknown> = {};
  const byFd = new Map(leagues.filter((l) => l.fd_code).map((l) => [l.fd_code!, l]));
  const countries: Record<string, string> = { Denmark: "DNK", Romania: "ROU" };
  for (const [file, key] of [["fixtures.csv", "Div"], ["new_league_fixtures.csv", "Country"]] as const) {
    try {
      const csv = await fetchCsv(`${FD}/${file}`);
      if (!csv) { out[file] = { missing: true }; continue; }
      const groups = new Map<string, MatchRow[]>();
      for (const r of csv) {
        const code = key === "Div" ? r.Div : countries[r.Country];
        const lg = code ? byFd.get(code) : undefined;
        const row = fdRow(r);
        if (!lg || !row) continue;
        const k = `${lg.code}|${seasonOf(row.match_date)}`;
        delete row.fthg; delete row.ftag; delete row.hthg; delete row.htag;
        (groups.get(k) ?? groups.set(k, []).get(k)!).push(row);
      }
      for (const [k, rows] of groups) {
        const [lg, s] = k.split("|");
        out[`${file} ${k}`] = await ingest(lg, s, "fd", "fixtures", rows);
      }
    } catch (e) {
      out[file] = { error: (e as Error).message };
      await logError(null, null, "fd", "fixtures", (e as Error).message);
    }
  }
  return out;
}

async function sha(text: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(h)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function upload(path: string, text: string, cache: string) {
  const { error } = await db.storage.from(BUCKET).upload(path, new Blob([text], { type: "application/json" }), {
    upsert: true, contentType: "application/json", cacheControl: cache,
  });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function publish(force = false) {
  const { data: meta } = await db.from("ta_meta").select("value").eq("key", "published").maybeSingle();
  const pub = (meta?.value ?? { seasons: {} }) as {
    seasons: Record<string, { path: string; n: number; updatedAt: string }>;
    ref?: { path: string };
  };
  const { data: state, error } = await db.rpc("ta_seasons_state");
  if (error) throw new Error(error.message);
  const changed: string[] = [], stale: string[] = [];
  for (const s of state as { season: string; n: number; updated_at: string }[]) {
    const prev = pub.seasons[s.season];
    if (!force && prev && new Date(prev.updatedAt) >= new Date(s.updated_at) && prev.n === Number(s.n)) continue;
    const { data: snap, error: e2 } = await db.rpc("ta_snapshot", { p_season: s.season });
    if (e2) throw new Error(e2.message);
    const text = JSON.stringify(snap);
    const path = `v1/m-${seasonCode(s.season)}-${await sha(text)}.json`;
    if (prev?.path !== path) {
      await upload(path, text, "31536000");
      if (prev?.path) stale.push(prev.path);
    }
    pub.seasons[s.season] = { path, n: Number(s.n), updatedAt: new Date(s.updated_at).toISOString() };
    changed.push(s.season);
  }
  const { data: ref, error: e3 } = await db.rpc("ta_reference_snapshot");
  if (e3) throw new Error(e3.message);
  const refText = JSON.stringify(ref);
  const refPath = `v1/ref-${await sha(refText)}.json`;
  if (pub.ref?.path !== refPath) {
    await upload(refPath, refText, "31536000");
    if (pub.ref?.path) stale.push(pub.ref.path);
    pub.ref = { path: refPath };
  }
  const manifest = {
    v: 1, generatedAt: new Date().toISOString(), ref: pub.ref,
    seasons: Object.entries(pub.seasons).sort(([a], [b]) => a.localeCompare(b)).map(([season, v]) => ({ season, ...v })),
  };
  await upload("v1/manifest.json", JSON.stringify(manifest), "60");
  await db.from("ta_meta").upsert({ key: "published", value: pub, updated_at: new Date().toISOString() });
  if (stale.length) await db.storage.from(BUCKET).remove(stale);
  return { changed, removed: stale.length, manifest: manifest.seasons.length };
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);
  const token = req.headers.get("x-ta-token") ?? "";
  const { data: ok } = await db.rpc("ta_check_sync_token", { p_token: token });
  if (!ok) return json({ error: "non autorizzato" }, 401);

  let body: { mode?: string; league?: string; scope?: "current" | "all"; force?: boolean } = {};
  try { body = await req.json(); } catch { /* corpo vuoto */ }
  const t0 = Date.now();
  try {
    const { data: leagues, error } = await db.from("ta_leagues").select("*").eq("active", true);
    if (error) throw new Error(error.message);
    if (body.mode === "league") {
      const lg = (leagues as League[]).find((l) => l.code === body.league);
      if (!lg) return json({ error: `campionato ${body.league} non attivo` }, 400);
      return json({ league: lg.code, steps: await syncLeague(lg, body.scope ?? "current"), ms: Date.now() - t0 });
    }
    if (body.mode === "fixtures") return json({ fixtures: await syncFixturesOdds(leagues as League[]), ms: Date.now() - t0 });
    if (body.mode === "publish") return json({ publish: await publish(!!body.force), ms: Date.now() - t0 });
    return json({ error: "mode sconosciuto" }, 400);
  } catch (e) {
    await logError(body.league ?? null, null, "sync", body.mode ?? "?", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
