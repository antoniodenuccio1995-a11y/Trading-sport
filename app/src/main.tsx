import { render } from "preact";
import { startStore, watchFreshness } from "./data/store";
import { App } from "./ui/App";
import "./fonts.css";
import "./styles.css";

render(<App />, document.getElementById("app")!);
startStore();
watchFreshness();

// Service worker: rende istantanee le aperture successive (app installabile, funziona offline con i dati in cache).
if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
