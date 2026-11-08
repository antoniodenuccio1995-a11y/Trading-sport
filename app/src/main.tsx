import { render } from "preact";
import { startStore } from "./data/store";
import { App } from "./ui/App";
import "./styles.css";

render(<App />, document.getElementById("app")!);
startStore();

// Service worker: rende istantanee le aperture successive (app installabile, funziona offline con i dati in cache).
if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
