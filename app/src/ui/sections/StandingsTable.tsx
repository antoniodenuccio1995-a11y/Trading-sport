// Tabella classifica con le zone (Champions, Europa, promozione, retrocessione…) evidenziate.
import type { Row } from "../../stats/standings";
import { avg } from "../../stats/team";
import { ZONE_NOTE, zoneOf, zones } from "../../stats/zones";
import { ZoneLegend } from "../components/charts";
import { Form, TeamLink, fmtNum } from "../components/common";

export function StandingsTable({ rows, lg, season, highlight = [], showZones = true, ppg = true }: {
  rows: Row[]; lg: string; season: string; highlight?: number[]; showZones?: boolean; ppg?: boolean;
}) {
  const size = rows.length, zs = showZones ? zones(lg, size) : [];
  return (
    <>
      <div class="tw"><table class="t">
        <thead><tr><th>#</th><th class="l">Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th>{ppg && <th>Pt/G</th>}<th class="l">Forma</th></tr></thead>
        <tbody>{rows.map((r) => {
          const z = showZones ? zoneOf(lg, size, r.pos) : undefined;
          const cls = [z ? `zr z-${z.tone}` : "", highlight.includes(r.team) ? "hl" : ""].join(" ").trim();
          return (
            <tr key={r.team} class={cls} title={z?.label}>
              <td>{r.pos}</td><td class="team"><TeamLink id={r.team} season={season} /></td>
              <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td>
              <td class={r.gf - r.ga > 0 ? "pos" : r.gf - r.ga < 0 ? "neg" : ""}>{r.gf - r.ga > 0 ? "+" : ""}{r.gf - r.ga}</td>
              <td><b>{r.pts}</b></td>{ppg && <td>{fmtNum(avg(r.pts, r.p))}</td>}<td class="l"><Form list={r.form} /></td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <div style="padding:6px 14px 12px">
        <ZoneLegend zones={zs} />
        <p class="note" style="margin-top:4px">Ordine: punti, differenza reti, gol fatti (gli scontri diretti non sono considerati).{zs.length ? ` ${ZONE_NOTE}` : showZones ? "" : " Zone mostrate solo nella classifica generale."}</p>
      </div>
    </>
  );
}
