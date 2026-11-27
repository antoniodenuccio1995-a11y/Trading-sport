// Statistiche robuste di base. Le funzioni non modificano gli array ricevuti.

/** Arrotonda al centesimo (senza "-0"). */
export function round2(x: number): number {
  const r = Math.round(x * 100) / 100;
  return r === 0 ? 0 : r;
}

/** Somma di un array di numeri. */
export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** Media aritmetica (NaN se vuoto). */
export const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : NaN);

/** Quantile con interpolazione lineare su un array GIÀ ordinato (NaN se vuoto). */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  if (n === 1) return sorted[0];
  const pos = Math.min(Math.max(q, 0), 1) * (n - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Copia ordinata in senso crescente. */
export const sortedCopy = (xs: readonly number[]): number[] => Array.from(Float64Array.from(xs).sort());

/** Quantile (NaN se vuoto). */
export const quantile = (xs: readonly number[], q: number): number => quantileSorted(Float64Array.from(xs).sort(), q);

/** Mediana (NaN se vuoto). */
export const median = (xs: readonly number[]): number => quantile(xs, 0.5);

/** Deviazione assoluta mediana (MAD, non scalata). */
export function mad(xs: readonly number[], med = median(xs)): number {
  return median(xs.map((x) => Math.abs(x - med)));
}

/** Scala robusta ≈ deviazione standard per dati normali (1.4826 × MAD). */
export const robustScale = (xs: readonly number[], med = median(xs)): number => 1.4826 * mad(xs, med);

/** Limita x all'intervallo [lo, hi]. */
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Variazione relativa (null se la base è ~0). */
export const pctChange = (value: number, base: number): number | null =>
  Math.abs(base) < 0.005 ? null : (value - base) / Math.abs(base);
