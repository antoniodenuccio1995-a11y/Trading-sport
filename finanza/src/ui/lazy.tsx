import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";

type Mod = Record<string, unknown>;
const loaders: (() => Promise<unknown>)[] = [];

/** Componente caricato a richiesta, con uno scheletro leggero mentre arriva. */
export function lazy<P extends object>(load: () => Promise<Mod>, name: string): ComponentType<P> {
  let C: ComponentType<P> | null = null;
  let p: Promise<void> | null = null;
  const get = () => (p ??= load().then((m) => { C = m[name] as ComponentType<P>; }));
  loaders.push(get);
  return function Lazy(props: P) {
    const [, ready] = useState(0);
    useEffect(() => { if (!C) void get().then(() => ready(1)); }, []);
    return C ? <C {...props} /> : <Skeleton />;
  };
}

export function prefetchAll() {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
  idle(() => { for (const l of loaders) void l(); }, { timeout: 2000 });
}

function Skeleton() {
  return (
    <div class="stack" aria-busy="true">
      <div class="skel" style={{ height: "64px" }} />
      <div class="grid g-2"><div class="skel" style={{ height: "260px" }} /><div class="skel" style={{ height: "260px" }} /></div>
    </div>
  );
}
