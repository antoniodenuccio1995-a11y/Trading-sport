// Stemma della squadra: logo quando disponibile, altrimenti un cerchio con i colori della nazione e le iniziali.
import { useState } from "preact/hooks";
import { getStore } from "../../data/store";

/** Colori (bandiera) per nazione, in strisce verticali. */
const FLAGS: Record<string, string[]> = {
  ITA: ["#009246", "#f1f2f1", "#ce2b37"], ENG: ["#f4f4f4", "#cf142b", "#f4f4f4"], ESP: ["#aa151b", "#f1bf00", "#aa151b"],
  FRA: ["#0055a4", "#f4f4f4", "#ef4135"], GER: ["#1a1a1a", "#dd0000", "#ffce00"], NED: ["#ae1c28", "#f4f4f4", "#21468b"],
  POR: ["#046a38", "#da291c", "#da291c"], DNK: ["#c8102e", "#f4f4f4", "#c8102e"], ROU: ["#002b7f", "#fcd116", "#ce1126"],
  CRO: ["#ff0000", "#f4f4f4", "#171796"], GRE: ["#0d5eaf", "#f4f4f4", "#0d5eaf"], NOR: ["#ba0c2f", "#f4f4f4", "#00205b"],
  BEL: ["#1a1a1a", "#fdda24", "#ef3340"], TUR: ["#e30a17", "#f4f4f4", "#e30a17"], AUT: ["#ed2939", "#f4f4f4", "#ed2939"],
  SVK: ["#f4f4f4", "#0b4ea2", "#ee1c25"], AZE: ["#00b5e2", "#ef3340", "#509e2f"], UKR: ["#0057b7", "#0057b7", "#ffd700"],
  CZE: ["#f4f4f4", "#11457e", "#d7141a"], SCO: ["#005eb8", "#f4f4f4", "#005eb8"], UEFA: ["#1e3a8a", "#3b5bdb", "#1e3a8a"],
};
export const flagGradient = (country: string) => {
  const c = FLAGS[country] ?? ["#9aa4ae", "#c4cad1", "#9aa4ae"];
  return `linear-gradient(90deg, ${c[0]} 0 33.3%, ${c[1]} 33.3% 66.6%, ${c[2]} 66.6% 100%)`;
};

const initials = (name: string) => {
  const w = name.replace(/[^A-Za-zÀ-ÿ0-9' ]/g, " ").split(/\s+/).filter((x) => x && !/^(fc|ac|as|sc|cf|cd|afc|ssc|us|1)$/i.test(x));
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? w[0]?.[1] ?? "")).toUpperCase();
};

/** Bandiera rotonda di una nazione (menu dei campionati). */
export function Flag({ country, size = 16 }: { country: string; size?: number }) {
  return <span class="flag" style={`width:${size}px;height:${size}px;background:${flagGradient(country)}`} aria-hidden="true" />;
}

export function TeamBadge({ id, size = 22 }: { id: number; size?: number }) {
  const t = getStore().teams.get(id);
  const [failed, setFailed] = useState(false);
  if (!t) return null;
  const big = size > 40;
  if (t.logo && !failed) {
    return <img class="crest" src={`${t.logo}/${big ? "small" : "tiny"}`} width={size} height={size} alt="" loading="lazy" decoding="async"
      onError={() => setFailed(true)} />;
  }
  return (
    <span class="crest fallback" style={`width:${size}px;height:${size}px;background:${flagGradient(t.country)};font-size:${Math.round(size * 0.38)}px`} aria-hidden="true">
      <b>{initials(t.name)}</b>
    </span>
  );
}

/** Stemma + nome, usato in tabelle ed elenchi. */
export function TeamTag({ id, size = 20 }: { id: number; size?: number }) {
  const t = getStore().teams.get(id);
  return <span class="team-tag"><TeamBadge id={id} size={size} /><span>{t?.name ?? `#${id}`}</span></span>;
}
