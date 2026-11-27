// Anteprima con dati dimostrativi per una pagina ospitata (es. Artifact di claude.ai):
// stesso file unico, senza i tag <html>/<head>/<body> (li aggiunge chi ospita) e con
// i dati dimostrativi caricati al primo avvio.
import { readFileSync, writeFileSync } from "node:fs";
const [src = "dist-file/FinanzaPersonale.html", out = "dist-file/anteprima.html"] = process.argv.slice(2);
const html = readFileSync(src, "utf8");
const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>"));
// SheetJS non incorporato nell'anteprima (contiene caratteri che la pubblicazione rifiuta): si scarica da cdnjs se serve.
const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>")).replace(/<script type="text\/plain" id="xlsx-src">[\s\S]*?<\/script>/, "");
const keep = head
  .replace(/<meta charset[^>]*>/, "")
  .replace(/<meta name="viewport"[^>]*>/, "")
  .replace("<title>Finanza Personale</title>", '<title>Finanza Personale</title>\n<meta name="claude:viewport-fit-sides" content="cover">');
writeFileSync(out, `${keep}\n<script>window.__FP_DEMO__ = true;</script>\n${body}`);
console.log(out, (readFileSync(out).length / 1024).toFixed(0) + " KB");
