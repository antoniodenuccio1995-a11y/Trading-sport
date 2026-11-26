// Copia SheetJS in public/vendor: viene scaricato solo quando si importa un file Excel.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/xlsx/dist/xlsx.full.min.js", "public/vendor/xlsx.full.min.js");
