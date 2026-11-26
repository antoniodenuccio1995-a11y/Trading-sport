import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

/** Larghezza del contenitore, aggiornata con ResizeObserver. */
export function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || initial);
    const ro = new ResizeObserver(([e]) => { const nw = Math.round(e.contentRect.width); if (nw > 0) setW(nw); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export const motionOff = () =>
  document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Numero che "conta" fino al valore: scrive direttamente nel DOM, nessun render per fotogramma. */
export function CountUp({ value, format, duration = 700, class: cls }: { value: number; format: (v: number) => string; duration?: number; class?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current!;
    const from = prev.current ?? (motionOff() ? value : 0);
    prev.current = value;
    if (from === value || motionOff()) { el.textContent = format(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const ease = (t: number) => 1 - Math.pow(2, -10 * t); // ease-out-expo
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      el.textContent = format(from + (value - from) * (k >= 1 ? 1 : ease(k)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref} class={"money " + (cls ?? "")}>{format(value)}</span>;
}

/** "Belle" divisioni dell'asse: 0, 250, 500… */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) { max = min + 1; }
  const span = max - min, step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= step0) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export function Tip({ x, y, children }: { x: number; y: number; children: ComponentChildren }) {
  return <div class="tip" style={{ left: x + "px", top: y + "px" }}>{children}</div>;
}

export const sv = (slot: number) => `var(--s${slot})`;

/** Ricerca binaria del punto più vicino in x (array ordinato). */
export function nearest(xs: number[], x: number): number {
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid; else hi = mid; }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}
