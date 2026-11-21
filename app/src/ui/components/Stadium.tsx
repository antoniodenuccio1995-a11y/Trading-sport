// Sfondo dell'app: un campo regolamentare (105 × 68 m, 10 unità = 1 m) visto dalla tribuna,
// in prospettiva e sfocato, con i riflettori. I colori arrivano dal tema (variabili CSS).
const STRIPES = Array.from({ length: 18 }, (_, i) => i);

export function Stadium() {
  return (
    <div class="stadium" aria-hidden="true">
      <svg class="pitch" viewBox="-60 -40 1170 760" preserveAspectRatio="xMidYMid slice">
        {STRIPES.map((i) => <rect key={i} class={i % 2 ? "s2" : "s1"} x={-60 + i * 65} y={-40} width={65} height={760} />)}
        <g class="ln">
          <rect x="0" y="0" width="1050" height="680" />
          <line x1="525" y1="0" x2="525" y2="680" />
          <circle cx="525" cy="340" r="91.5" />
          <rect x="0" y="138.5" width="165" height="403" />
          <rect x="885" y="138.5" width="165" height="403" />
          <rect x="0" y="248.5" width="55" height="183" />
          <rect x="995" y="248.5" width="55" height="183" />
          <path d="M165 266.9 A91.5 91.5 0 0 1 165 413.1" />
          <path d="M885 266.9 A91.5 91.5 0 0 0 885 413.1" />
          <path d="M0 10 A10 10 0 0 0 10 0 M1040 0 A10 10 0 0 0 1050 10 M1050 670 A10 10 0 0 0 1040 680 M10 680 A10 10 0 0 0 0 670" />
        </g>
        <circle class="spot" cx="525" cy="340" r="4" />
        <circle class="spot" cx="110" cy="340" r="3.5" />
        <circle class="spot" cx="940" cy="340" r="3.5" />
      </svg>
      <div class="lights" />
      <div class="veil" />
    </div>
  );
}

/** Marchio: il cerchio di centrocampo attraversato dall'andamento di un mercato. */
export function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" opacity=".55" />
      <path d="M3.5 12h17" opacity=".55" />
      <path d="M4 17l5-5 3.5 3L20 7" />
      <path d="M15.5 7H20v4.5" />
    </svg>
  );
}
