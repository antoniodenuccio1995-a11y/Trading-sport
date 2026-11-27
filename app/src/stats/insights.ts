// Punti chiave di una partita: una lettura automatica dei numeri (modello, mercato, tempi, forma, minuti dei gol).
// Sono indicazioni statistiche, non certezze: il testo lo dice sempre in modo misurato.
import type { Match } from "../data/types";
import { h2hSummary } from "./h2h";
import { halfTeam } from "./halves";
import { maxLay, minBack } from "./market";
import { minuteAgg } from "./minutes";
import { implied, type Forecast } from "./poisson";
import { teamMatches } from "./team";

export type Tone = "value" | "info" | "warn";
export interface Insight { tone: Tone; text: string }

const P = (x: number) => `${Math.round(x * 100)}%`;
const Q = (x: number) => x.toFixed(2).replace(".", ",");
const COMM = 0.05; // commissione Betfair standard, per le soglie di quota

/** Confronto modello/mercato su una selezione: differenza di almeno 5 punti percentuali. */
function compare(label: string, model: number, market: number, odd: number | null): Insight | null {
  const d = model - market;
  if (Math.abs(d) < 0.05) return null;
  if (d > 0) {
    return { tone: "value", text: `${label}: il modello dà ${P(model)}, il mercato ${P(market)}${odd ? ` (quota media ${Q(odd)})` : ""}. Back interessante solo da quota ${Q(minBack(model, COMM))} in su.` };
  }
  return { tone: "value", text: `${label}: il mercato crede più del modello (${P(market)} contro ${P(model)}). Lay da valutare solo sotto quota ${Q(maxLay(model, COMM))}.` };
}

const pointsLast = (list: Match[], team: number) =>
  list.reduce((s, m) => {
    const f = m.h === team ? m.fh! : m.fa!, a = m.h === team ? m.fa! : m.fh!;
    return s + (f > a ? 3 : f === a ? 1 : 0);
  }, 0);

export function matchInsights(m: Match, fc: Forecast | null, league: Match[], names: { h: string; a: string }, minuteLeagues?: Set<string>, meetings?: Match[]): Insight[] {
  const out: Insight[] = [];
  if (!fc) return [{ tone: "warn", text: "Dati insufficienti per il modello: servono più partite giocate delle due squadre in questo campionato." }];

  // 1) modello contro mercato (quote medie dei bookmaker)
  const imp = implied(m.oh, m.od, m.oa);
  if (imp) {
    const c = [compare(`1 (${names.h})`, fc.home, imp.home, m.oh), compare("X (pareggio)", fc.draw, imp.draw, m.od), compare(`2 (${names.a})`, fc.away, imp.away, m.oa)].filter(Boolean) as Insight[];
    out.push(...c);
    if (!c.length) out.push({ tone: "info", text: `Su 1X2 modello e mercato sono allineati (differenze sotto i 5 punti): nessun segnale di valore.` });
  }
  if (m.oo && m.ou) {
    const s = 1 / m.oo + 1 / m.ou, pOver = 1 / m.oo / s;
    const c = compare("Over 2,5", fc.o25, pOver, m.oo) ?? compare("Under 2,5", 1 - fc.o25, 1 - pOver, m.ou);
    if (c) out.push(c);
  }
  if (!imp && !(m.oo && m.ou)) out.push({ tone: "info", text: "Quote non ancora disponibili: inserisci quelle di Betfair o Betflag nella sezione mercato qui sotto per il confronto." });

  // 2) primo e secondo tempo
  const opts = { season: m.s, before: m.d };
  const hH = halfTeam(teamMatches(league, m.h, "home", opts), m.h), aA = halfTeam(teamMatches(league, m.a, "away", opts), m.a);
  if (hH.n >= 4 && aA.n >= 4) {
    const r1 = (hH.g1 / hH.n + aA.g1 / aA.n) / 2, r2 = (hH.g2 / hH.n + aA.g2 / aA.n) / 2;
    if (fc.ht05 >= 0.72 && r1 >= 0.7) out.push({ tone: "info", text: `Gol nel 1° tempo probabile: modello ${P(fc.ht05)}; c'è stato in ${hH.g1} partite su ${hH.n} di ${names.h} in casa e in ${aA.g1} su ${aA.n} di ${names.a} fuori.` });
    else if (fc.ht05 <= 0.6 && r1 <= 0.6) out.push({ tone: "info", text: `Primo tempo spesso bloccato: gol nel 1T solo nel ${P(r1)} delle partite (media casa/fuori); modello ${P(fc.ht05)}.` });
    if (r2 - r1 >= 0.15) out.push({ tone: "info", text: `Le loro partite si accendono nella ripresa: gol nel 2° tempo nel ${P(r2)} dei casi contro il ${P(r1)} del primo.` });
  }

  // 3) forma: ultime 5 partite nello stesso campionato
  const lastH = teamMatches(league, m.h, "all", { before: m.d, last: 5 }), lastA = teamMatches(league, m.a, "all", { before: m.d, last: 5 });
  if (lastH.length === 5 && lastA.length === 5) {
    const ph = pointsLast(lastH, m.h), pa = pointsLast(lastA, m.a);
    if (Math.abs(ph - pa) >= 6) {
      const [hot, cold, ptHot, ptCold] = ph > pa ? [names.h, names.a, ph, pa] : [names.a, names.h, pa, ph];
      out.push({ tone: "info", text: `Momento opposto: ${hot} ha fatto ${ptHot} punti nelle ultime 5, ${cold} solo ${ptCold}. Il modello pesa tutta la stagione: la forma recente non è inclusa.` });
    }
  }

  // 4) minuti dei gol (dove la fonte li ha)
  if (minuteLeagues && minuteLeagues.has(`${m.lg}|${m.s}`)) {
    const mh = minuteAgg(teamMatches(league, m.h, "all", opts), minuteLeagues), ma = minuteAgg(teamMatches(league, m.a, "all", opts), minuteLeagues);
    if (mh.n >= 5 && ma.n >= 5) {
      const late = (mh.after75 / mh.n + ma.after75 / ma.n) / 2, early = (mh.firstBy30 / mh.n + ma.firstBy30 / ma.n) / 2;
      if (late >= 0.6) out.push({ tone: "info", text: `Finali movimentati: almeno un gol dopo il 75' nel ${P(mh.after75 / mh.n)} delle partite di ${names.h} e nel ${P(ma.after75 / ma.n)} di ${names.a}.` });
      if (early >= 0.6) out.push({ tone: "info", text: `Partenze rapide: primo gol entro il 30' nel ${P(early)} delle loro partite (media delle due squadre).` });
      if (late <= 0.3) out.push({ tone: "info", text: `Raramente si segna nel finale: gol dopo il 75' solo nel ${P(late)} delle loro partite.` });
    }
  }

  // 5) scontri diretti: solo schemi netti e con abbastanza precedenti
  if (meetings && meetings.length >= 4) {
    const x = h2hSummary(meetings, m.h), n = x.n;
    if (n >= 5 && x.o25 / n >= 0.8) out.push({ tone: "info", text: `Precedenti ricchi di gol: Over 2,5 in ${x.o25} degli ultimi ${n} scontri diretti.` });
    else if (n >= 5 && x.o25 / n <= 0.2) out.push({ tone: "info", text: `Precedenti chiusi: Over 2,5 solo in ${x.o25} degli ultimi ${n} scontri diretti.` });
    if (n >= 4 && x.l === 0 && x.w >= 2) out.push({ tone: "info", text: `${names.h} non ha mai perso negli ultimi ${n} scontri diretti (${x.w} vittorie, ${x.d} pareggi). Sono anni diversi: contesto, non previsione.` });
    else if (n >= 4 && x.w === 0 && x.l >= 2) out.push({ tone: "info", text: `${names.a} non ha mai perso negli ultimi ${n} scontri diretti (${x.l} vittorie, ${x.d} pareggi). Sono anni diversi: contesto, non previsione.` });
  }

  // 6) affidabilità del campione
  if (fc.sample.home < 5 || fc.sample.away < 5) {
    out.push({ tone: "warn", text: `Campione piccolo (${fc.sample.home} partite in casa di ${names.h}, ${fc.sample.away} fuori di ${names.a}): prendi i numeri con prudenza.` });
  }
  return out.slice(0, 7);
}
