import { render } from "preact";
import "./styles.css";
import { App } from "./ui/App.tsx";
import { boot, replace } from "./state/store.ts";
import { demoSnapshot } from "./state/demo.ts";

// Avvio: legge l'archivio locale e disegna subito. Con ?demo (o archivio vuoto e #demo) carica i dati dimostrativi.
(async () => {
  const t0 = performance.now();
  const r = await boot();
  if (r.fresh && (location.search.includes("demo") || location.hash.includes("demo") || __FILE_MODE__ === false && import.meta.env.DEV)) replace(demoSnapshot());
  render(<App />, document.getElementById("app")!);
  document.getElementById("boot")?.remove();
  (window as unknown as { __fpBoot: number }).__fpBoot = performance.now() - t0;
  if (r.error) console.warn("Archivio locale non disponibile:", r.error);
  if (!__FILE_MODE__ && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
