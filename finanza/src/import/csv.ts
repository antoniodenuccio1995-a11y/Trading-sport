// Parser CSV della v3.10. Il separatore non è indovinato dal contenuto: lo sceglie
// il riconoscimento della banca (virgola per Revolut, Trade Republic e Hype;
// punto e virgola per Tinaba), esattamente come nella v3.10.
// Le virgolette commutano lo stato "tra virgolette" ovunque compaiano nella cella
// e "" dentro le virgolette vale una virgoletta letterale.

export function parseDelimited(txt: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i], n = txt[i + 1];
    if (c === '"' && q && n === '"') { cell += '"'; i++; continue; }
    if (c === '"') { q = !q; continue; }
    if (c === delimiter && !q) { row.push(cell); cell = ""; continue; }
    if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && n === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; continue;
    }
    cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** CSV separato da virgole (parseCsv della v3.10). */
export const parseCsv = (txt: string): string[][] => parseDelimited(txt, ",");

/** Prima riga del testo, normalizzata: è quella su cui la v3.10 riconosce la banca. */
export const firstLine = (txt: string) => txt.split(/\r?\n/, 1)[0] || "";
