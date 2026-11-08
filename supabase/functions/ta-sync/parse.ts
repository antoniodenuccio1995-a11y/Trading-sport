// Parser delle fonti CSV (senza dipendenze: usato dalla Edge Function e dai test).

export type Row = Record<string, string>;
export type MatchRow = {
  home: string; away: string; match_date: string; kickoff?: string;
  [k: string]: string | number | undefined;
};

/** CSV RFC 4180: virgolette, virgole e a-capo nei campi, BOM iniziale. */
export function parseCsv(text: string): Row[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let field = "", row: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o: Row = {};
    head.forEach((h, i) => { if (h) o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

/** Decodifica UTF-8, con ripiego su Windows-1252 per i file più vecchi. */
export function decode(buf: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}

const int = (v?: string) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < 100 ? n : undefined;
};
const odd = (v?: string) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 1 && n < 1000 ? Math.round(n * 100) / 100 : undefined;
};
const first = (r: Row, keys: string[], f: (v?: string) => number | undefined) => {
  for (const k of keys) { const v = f(r[k]); if (v !== undefined) return v; }
  return undefined;
};

/** 'dd/mm/yyyy' o 'dd/mm/yy' → 'yyyy-mm-dd'. */
export function fdDate(s: string): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s?.trim() ?? "");
  if (!m) return undefined;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Minuti di scarto tra l'ora locale di un fuso e UTC in un istante. */
export function tzOffsetMinutes(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(ts));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - Math.floor(ts / 60000) * 60000) / 60000;
}

/** Data e ora locali di un fuso → ISO UTC. */
export function zonedToUtc(date: string, time: string, tz: string): string | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), t = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!d || !t) return undefined;
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let utc = guess - tzOffsetMinutes(guess, tz) * 60000;
  const off2 = tzOffsetMinutes(utc, tz);
  utc = guess - off2 * 60000;
  return new Date(utc).toISOString();
}

/** Open Matchday: ora con convenzione fissa UTC+1. */
export function omKickoff(date: string, time: string): string | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), t = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!d || !t) return undefined;
  return new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - 60 * 60000).toISOString();
}

function clean<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

/** Riga football-data.co.uk (file principali, file "new" e fixtures). Orari in ora inglese. */
export function fdRow(r: Row): MatchRow | undefined {
  const home = r.HomeTeam ?? r.Home, away = r.AwayTeam ?? r.Away;
  const match_date = fdDate(r.Date);
  if (!home || !away || !match_date) return undefined;
  return clean({
    home, away, match_date,
    kickoff: r.Time ? zonedToUtc(match_date, r.Time, "Europe/London") : undefined,
    fthg: int(r.FTHG ?? r.HG), ftag: int(r.FTAG ?? r.AG),
    hthg: int(r.HTHG), htag: int(r.HTAG),
    sh_h: int(r.HS), sh_a: int(r.AS), sot_h: int(r.HST), sot_a: int(r.AST),
    fo_h: int(r.HF), fo_a: int(r.AF), co_h: int(r.HC), co_a: int(r.AC),
    ye_h: int(r.HY), ye_a: int(r.AY), re_h: int(r.HR), re_a: int(r.AR),
    o_h: first(r, ["AvgH", "BbAvH", "B365H", "PSH"], odd),
    o_d: first(r, ["AvgD", "BbAvD", "B365D", "PSD"], odd),
    o_a: first(r, ["AvgA", "BbAvA", "B365A", "PSA"], odd),
    o_o25: first(r, ["Avg>2.5", "BbAv>2.5", "B365>2.5", "P>2.5"], odd),
    o_u25: first(r, ["Avg<2.5", "BbAv<2.5", "B365<2.5", "P<2.5"], odd),
    c_h: first(r, ["AvgCH", "PSCH", "B365CH"], odd),
    c_d: first(r, ["AvgCD", "PSCD", "B365CD"], odd),
    c_a: first(r, ["AvgCA", "PSCA", "B365CA"], odd),
    c_o25: first(r, ["AvgC>2.5", "PC>2.5", "B365C>2.5"], odd),
    c_u25: first(r, ["AvgC<2.5", "PC<2.5", "B365C<2.5"], odd),
    bf_h: first(r, ["BFECH", "BFEH"], odd),
    bf_d: first(r, ["BFECD", "BFED"], odd),
    bf_a: first(r, ["BFECA", "BFEA"], odd),
  } as MatchRow);
}

/** Riga Open Matchday (results_*.csv o fixtures_*.csv). */
export function omRow(r: Row): MatchRow | undefined {
  const { home, away } = r, match_date = r.date;
  if (!home || !away || !/^\d{4}-\d{2}-\d{2}$/.test(match_date ?? "")) return undefined;
  return clean({
    home, away, match_date,
    kickoff: r.time ? omKickoff(match_date, r.time) : undefined,
    fthg: int(r.ft_home), ftag: int(r.ft_away), hthg: int(r.ht_home), htag: int(r.ht_away),
    sh_h: int(r.home_shots), sh_a: int(r.away_shots), sot_h: int(r.home_target), sot_a: int(r.away_target),
    fo_h: int(r.home_fouls), fo_a: int(r.away_fouls), co_h: int(r.home_corners), co_a: int(r.away_corners),
    ye_h: int(r.home_yellow), ye_a: int(r.away_yellow), re_h: int(r.home_red), re_a: int(r.away_red),
  } as MatchRow);
}

/** Stagione '2026/27' per una data, per campionati agosto–maggio. */
export function seasonOf(date: string): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const s = m >= 7 ? y : y - 1;
  return `${s}/${String((s + 1) % 100).padStart(2, "0")}`;
}
/** '2026/27' → '2627' (codice cartelle football-data / Open Matchday). */
export const seasonCode = (s: string) => s.slice(2, 4) + s.slice(5, 7);
/** '2025/2026' (file "new" di football-data) → '2025/26'. */
export function fdExtraSeason(s: string): string | undefined {
  const m = /^(\d{4})\/(\d{4})$/.exec(s?.trim() ?? "");
  return m ? `${m[1]}/${m[2].slice(2)}` : undefined;
}
