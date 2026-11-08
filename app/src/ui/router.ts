import { useEffect, useState } from "preact/hooks";

export interface Route { path: string[]; q: URLSearchParams }

export function parseHash(hash = location.hash): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [p, qs = ""] = raw.split("?");
  return { path: p.split("/").filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [r, setR] = useState(parseHash());
  useEffect(() => {
    const on = () => { setR(parseHash()); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return r;
}

/** Costruisce un link interno. */
export function href(path: (string | number)[], q?: Record<string, string | number | undefined | null>) {
  const qs = q ? Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
  return `#/${path.map((x) => encodeURIComponent(String(x))).join("/")}${qs ? `?${qs}` : ""}`;
}
export const go = (path: (string | number)[], q?: Record<string, string | number | undefined | null>) => { location.hash = href(path, q); };
