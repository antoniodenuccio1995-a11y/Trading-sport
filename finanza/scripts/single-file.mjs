// Crea FinanzaPersonale.html: tutta l'app in un solo file da aprire con doppio clic, offline.
// SheetJS è incorporato come testo inerte (<script type="text/plain">): il browser non lo
// analizza all'avvio, viene eseguito solo quando importi un file Excel.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-file";
let html = readFileSync(join(dir, "index.html"), "utf8");
const assets = readdirSync(join(dir, "assets"));
const js = assets.filter((f) => f.endsWith(".js"));
const css = assets.filter((f) => f.endsWith(".css"));
if (js.length !== 1) throw new Error(`atteso un solo file JS, trovati: ${js.join(", ")}`);
const esc = (s) => s.replace(/<\/script/gi, "<\\/script");
const code = esc(readFileSync(join(dir, "assets", js[0]), "utf8"));
const style = css.map((f) => readFileSync(join(dir, "assets", f), "utf8")).join("\n");
const xlsx = esc(readFileSync("node_modules/xlsx/dist/xlsx.full.min.js", "utf8"));
const icon = "data:image/svg+xml," + encodeURIComponent(readFileSync(join(dir, "icon.svg"), "utf8"));

html = html
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, () => "")
  .replace(/<link rel="stylesheet"[^>]*>/g, () => "")
  .replace(/<link rel="manifest"[^>]*>/, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>/, "")
  .replace(/<link rel="modulepreload"[^>]*>/g, "")
  .replace(/href="\.\/icon\.svg"/, () => `href="${icon}"`)
  .replace("</head>", () => `<style>${style}</style>\n</head>`)
  .replace("</body>", () => `<script type="module">${code}</script>\n<script type="text/plain" id="xlsx-src">${xlsx}</script>\n</body>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error("riferimenti a file esterni rimasti");
writeFileSync(join(dir, "FinanzaPersonale.html"), html);
console.log(`FinanzaPersonale.html: ${(html.length / 1024).toFixed(0)} KB (di cui SheetJS ${(xlsx.length / 1024).toFixed(0)} KB, non eseguito all'avvio)`);
