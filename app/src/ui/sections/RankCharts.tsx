// Grafici della classifica: nella stagione (settimana per settimana) e storico per categoria.
import { useMemo, useState } from "preact/hooks";
import { dateShort } from "../../data/dates";
import { getStore, leagueName, teamName } from "../../data/store";
import { pyramid, type Pyramid } from "../../stats/pyramid";
import { rankTimeline } from "../../stats/timeline";
import type { Venue } from "../../stats/team";
import { ZONE_NOTE, zones } from "../../stats/zones";
import { Legend, PALETTE, RankChart, ZoneLegend } from "../components/charts";
import { Seg } from "../components/common";

/** Posizione settimana per settimana nella stagione, per le squadre indicate. */
export function SeasonRankChart({ lg, season, teams, before, venue: initialVenue = "all" }: {
  lg: string; season: string; teams: number[]; before?: number; venue?: Venue;
}) {
  const [venue, setVenue] = useState<Venue>(initialVenue);
  const list = getStore().byLeagueSeason.get(`${lg}|${season}`) ?? [];
  const tl = useMemo(() => rankTimeline(list, venue, teamName, before), [list, venue, before]);
  if (!tl.dates.length) return <p class="muted">Nessuna partita giocata in questa stagione.</p>;
  const series = teams.map((t, i) => ({
    name: teamName(t), color: PALETTE[i % PALETTE.length], values: tl.ranks.get(t) ?? [],
    info: (k: number) => `${tl.pts.get(t)?.[k]} punti in ${tl.games.get(t)?.[k]} gare`,
  }));
  const zs = venue === "all" ? zones(lg, tl.size) : [];
  return (
    <div>
      <div class="row" style="margin-bottom:6px">
        <Legend items={series} />
        <span class="spacer" />
        <Seg label="Tipo di classifica" value={venue} onChange={setVenue} options={[["all", "Generale"], ["home", "Casa"], ["away", "Trasferta"]]} />
      </div>
      <RankChart x={tl.dates.map(dateShort)} series={series} max={tl.size} zones={zs}
        label={`Posizione in classifica ${season}, ${series.map((s) => s.name).join(" e ")}`} />
      <ZoneLegend zones={zs} />
      <p class="note">Una posizione per settimana con partite; 1° posto in alto. Passa sui punti per punti e gare giocate.{zs.length ? ` ${ZONE_NOTE}` : venue !== "all" ? " Le zone valgono solo per la classifica generale." : ""}</p>
    </div>
  );
}

/** Storico stagione per stagione, con le categorie della nazione una sotto l'altra. */
export function HistoryRankChart({ teams }: { teams: number[] }) {
  const s = getStore();
  const pyr = useMemo(() => pyramid(s, teams, teamName), [teams.join(","), s.matches]);
  if (!pyr.length) return <p class="muted">Storico non disponibile per queste squadre (campionati nazionali non in archivio).</p>;
  return <>{pyr.map((p) => <PyramidChart key={p.country} p={p} colorOf={(t) => PALETTE[teams.indexOf(t) % PALETTE.length]} />)}</>;
}

function PyramidChart({ p, colorOf }: { p: Pyramid; colorOf: (team: number) => string }) {
  const W = 720, H = Math.max(220, Math.min(420, 120 + p.max * 5.2)), m = { l: 92, r: 40, t: 12, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const X = (i: number) => m.l + (p.seasons.length <= 1 ? iw / 2 : (iw * i) / (p.seasons.length - 1));
  const Y = (y: number) => m.t + ((y - 1) / Math.max(1, p.max - 1)) * ih;
  return (
    <div>
      <Legend items={p.teams.map((t) => ({ name: teamName(t.team), color: colorOf(t.team) }))} />
      <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Posizione per stagione nelle categorie nazionali">
        {p.bands.map((b, i) => {
          const half = (ih / p.max) / 2, y0 = Y(b.from) - half, y1 = Y(b.to) + half;
          const last = i === p.bands.length - 1;
          return (
            <g key={b.lg}>
              <rect x={m.l} width={iw} y={y0} height={y1 - y0} class={i % 2 ? "band-b" : "band-a"} />
              {zones(b.lg, b.size).map((z) => {
                const z0 = Y(b.from - 1 + z.from) - half, z1 = Y(b.from - 1 + z.to) + half;
                return (
                  <g key={`${b.lg}${z.from}`} class={`zone z-${z.tone}`}>
                    <rect x={m.l} width={iw} y={z0} height={z1 - z0} class="zone-band"><title>{`${b.name} · ${z.label}`}</title></rect>
                    <rect x={m.l - 3} width={3} y={z0 + 0.5} height={Math.max(1, z1 - z0 - 1)} class="zone-strip" />
                  </g>
                );
              })}
              <line x1={8} x2={W - m.r} y1={y0} y2={y0} class="band-line" />
              <text x={8} y={y0 + 15} class="band-name">{b.name}</text>
              {(last ? [1, Math.round(b.size / 2), b.size] : [1, Math.round(b.size / 2)]).map((r) => <text key={r} x={m.l - 8} y={Y(b.from - 1 + r) + 4} text-anchor="end" class="tick">{r}°</text>)}
            </g>
          );
        })}
        {p.seasons.map((s, i) => <text key={s} x={X(i)} y={H - 8} text-anchor="middle" class="tick">{s}</text>)}
        {p.teams.map((t) => {
          const pts = t.cells.map((c, i) => (c.y === null ? null : [X(i), Y(c.y)] as const));
          const segs: string[] = [];
          let cur: string[] = [];
          pts.forEach((q) => { if (q) cur.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`); else { if (cur.length > 1) segs.push(cur.join(" ")); cur = []; } });
          if (cur.length > 1) segs.push(cur.join(" "));
          return (
            <g key={t.team} style={`color:${colorOf(t.team)}`}>
              {segs.map((q, k) => <polyline key={k} points={q} class="line" />)}
              {t.cells.map((c, i) => c.y !== null && (
                <g key={i}>
                  <circle cx={X(i)} cy={Y(c.y)} r={4} class="dot"><title>{`${teamName(t.team)} · ${c.season} · ${leagueName(c.lg!)} ${c.rank}° · ${c.pts} punti in ${c.p} gare`}</title></circle>
                  <text x={X(i)} y={Y(c.y) - 8} text-anchor="middle" class="pt-label">{c.move === "up" ? "↑ " : c.move === "down" ? "↓ " : ""}{c.rank}°</text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <ZoneLegend zones={p.bands.flatMap((b) => zones(b.lg, b.size))} />
      <SeasonStrip p={p} colorOf={colorOf} />
      <p class="note">Ogni fascia è una categoria della stessa nazione: una linea che scende di fascia è una retrocessione, una che sale una promozione (↑ ↓). Stagione in corso: posizione attuale. "Non in archivio" indica una categoria che non seguiamo (es. Serie C).</p>
    </div>
  );
}

function SeasonStrip({ p, colorOf }: { p: Pyramid; colorOf: (team: number) => string }) {
  return (
    <div class="tw"><table class="t strip">
      <thead><tr><th class="l">Squadra</th>{p.seasons.map((s) => <th key={s}>{s}</th>)}</tr></thead>
      <tbody>{p.teams.map((t) => (
        <tr key={t.team}><td class="team" style={`color:${colorOf(t.team)}`}>{teamName(t.team)}</td>
          {t.cells.map((c) => (
            <td key={c.season} class="c">
              {c.lg ? <><span class={`move ${c.move ?? ""}`}>{c.move === "up" ? "↑" : c.move === "down" ? "↓" : ""}</span><b>{c.rank ?? "—"}°</b> <span class="muted">{leagueName(c.lg)}</span></>
                : <span class="muted">{c.move === "down" ? "↓ " : ""}non in archivio</span>}
            </td>
          ))}</tr>
      ))}</tbody>
    </table></div>
  );
}
