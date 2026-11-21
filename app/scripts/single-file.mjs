// Crea TradingAnalytics.html: tutta l'app in un solo file da aprire con doppio clic
// (come la v0.3). I dati arrivano comunque da Supabase e restano in cache nel browser.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-file";
let html = readFileSync(join(dir, "index.html"), "utf8");
const assets = readdirSync(join(dir, "assets"));
const js = assets.filter((f) => f.endsWith(".js"));
const css = assets.filter((f) => f.endsWith(".css"));
if (js.length !== 1) throw new Error(`atteso un solo file JS, trovati: ${js.join(", ")}`);

const code = readFileSync(join(dir, "assets", js[0]), "utf8").replace(/<\/script/gi, "<\\/script");
const style = css.map((f) => readFileSync(join(dir, "assets", f), "utf8")).join("\n");
const icon = "data:image/svg+xml," + encodeURIComponent(readFileSync(join(dir, "icon.svg"), "utf8"));

html = html
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, () => "")
  .replace(/<link rel="stylesheet"[^>]*href="[^"]+"[^>]*>/g, () => "")
  .replace(/<link rel="manifest"[^>]*>/, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>/, "")
  .replace(/<link rel="modulepreload"[^>]*>/g, "")
  .replace(/href="\.\/icon\.svg"/, () => `href="${icon}"`)
  .replace("</head>", () => `<style>${style}</style>\n</head>`)
  .replace("</body>", () => `<script type="module">${code}</script>\n</body>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error("riferimenti a file esterni rimasti");
writeFileSync(join(dir, "TradingAnalytics.html"), html);
console.log(`TradingAnalytics.html: ${(html.length / 1024).toFixed(0)} KB`);
