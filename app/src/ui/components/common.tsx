import type { ComponentChildren, JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getStore, leagueName, subscribe, teamName } from "../../data/store";
import { href } from "../router";
import { TeamBadge } from "./badge";

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((x) => x + 1)), []);
  return getStore();
}

/** Valore memorizzato nel browser (preferenze dell'utente). */
export function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const read = () => { try { const v = localStorage.getItem(`ta.${key}`); return v === null ? initial : (JSON.parse(v) as T); } catch { return initial; } };
  const [v, setV] = useState<T>(read);
  return [v, (nv: T) => { setV(nv); try { localStorage.setItem(`ta.${key}`, JSON.stringify(nv)); } catch { /* memoria non disponibile */ } }];
}

export const fmtPct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
export const fmtNum = (v: number | null, d = 2) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));
export const fmtOdd = (v: number | null | undefined) => (v ? v.toFixed(2) : "—");

/** Classe colore "mappa di calore" per una percentuale (alto = verde). */
export function heat(v: number | null, invert = false): string {
  if (v === null) return "";
  const x = invert ? 100 - v : v;
  return x >= 70 ? "h5" : x >= 58 ? "h4" : x <= 30 ? "h1" : x <= 42 ? "h2" : "";
}

export function PctTd({ v, invert, n }: { v: number | null; invert?: boolean; n?: number }) {
  return <td class={`num ${heat(v, invert)}`} title={n !== undefined ? `${n} partite` : undefined}>{fmtPct(v)}</td>;
}

export function Form({ list, n = 5 }: { list: ("V" | "N" | "P")[]; n?: number }) {
  const l = list.slice(-n);
  return <span class="form" aria-label={`Forma: ${l.join(" ")}`}>{l.map((x, i) => <i key={i} class={x}>{x}</i>)}</span>;
}

export const TeamLink = ({ id, season, badge = true }: { id: number; season?: string; badge?: boolean }) =>
  <a class="team-link" href={href(["squadra", id], { s: season })}>{badge && <TeamBadge id={id} size={18} />}<span>{teamName(id)}</span></a>;
export const LeagueLink = ({ code }: { code: string }) => <a href={href(["lega", code])}>{leagueName(code)}</a>;

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map(([k, t]) => <button type="button" key={k} class={k === value ? "on" : ""} aria-pressed={k === value} onClick={() => onChange(k)}>{t}</button>)}
    </div>
  );
}

export function Tabs({ tabs, active, link }: { tabs: [string, string][]; active: string; link: (k: string) => string }) {
  return <nav class="tabs" role="tablist">{tabs.map(([k, t]) => <a key={k} role="tab" aria-selected={k === active} class={k === active ? "on" : ""} href={link(k)}>{t}</a>)}</nav>;
}

export function Card({ title, children, flush, right }: { title?: ComponentChildren; children: ComponentChildren; flush?: boolean; right?: ComponentChildren }) {
  return (
    <section class={`card${flush ? " flush" : ""}`}>
      {title && (flush ? <div class="card-h">{title}<span class="spacer" />{right}</div> : <div class="row" style="margin-bottom:10px"><h2 style="margin:0">{title}</h2><span class="spacer" />{right}</div>)}
      {children}
    </section>
  );
}

export function Loading() {
  return <div aria-busy="true" aria-label="Caricamento">{[1, 2, 3, 4, 5].map((i) => <div key={i} class="skel" style={`width:${90 - i * 9}%`} />)}</div>;
}

/** Tabella ordinabile cliccando l'intestazione. */
export function useSort<K extends string>(initial: K, desc = true): [K, boolean, (k: K) => void] {
  const [key, setKey] = useState<K>(initial);
  const [d, setD] = useState(desc);
  return [key, d, (k: K) => { if (k === key) setD(!d); else { setKey(k); setD(true); } }];
}

/** "2,5" o "2.5" → 2.5; testo vuoto o non numerico → null. */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "." || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const showDecimal = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "" : String(n).replace(".", ","));

/**
 * Campo per numeri con la virgola (quote, importi, percentuali). Lascia il testo com'è mentre si scrive
 * ("1," a metà resta "1,") e passa il numero; accetta virgola o punto. Tastiera numerica con il separatore sul telefono.
 */
export function DecimalInput({ value, onValue, ...rest }: { value: number | null | undefined; onValue: (n: number | null) => void }
  & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "value" | "onInput" | "type" | "inputMode">) {
  const [text, setText] = useState(() => showDecimal(value));
  // se il valore cambia da fuori (es. modulo riempito da una partita) il testo si allinea
  useEffect(() => {
    const p = parseDecimal(text);
    if (p === value || (p === null && !value)) return;
    setText(showDecimal(value));
  }, [value]);
  return (
    <input {...rest} type="text" inputMode="decimal" autoComplete="off" value={text}
      onInput={(e) => {
        const v = (e.target as HTMLInputElement).value.replace(/[^0-9.,\-\s]/g, "");
        setText(v);
        onValue(parseDecimal(v));
      }} />
  );
}
