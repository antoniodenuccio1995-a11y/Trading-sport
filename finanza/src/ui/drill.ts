// Navigazione "clicca e vai ai movimenti": ogni grafico o elenco chiama goMovements con il
// filtro corrispondente a ciò che è stato cliccato. La pagina Movimenti lo legge all'apertura.
export interface MovementFilter {
  q?: string; // testo libero (descrizione, esercente, categoria, importo)
  merchant?: string; // esercente esatto (come merchantOf)
  account?: string;
  month?: string; // "YYYY-MM" (mese contabile)
  from?: string; // "YYYY-MM-DD"
  to?: string;
  type?: string; // MovementType
  cat?: string; // categoryId ("none" = senza categoria)
  group?: string; // id del gruppo di spesa
  weekday?: number; // 0 = lunedì … 6 = domenica
  status?: "all" | "review" | "uncat" | "transfer" | "split" | "manual" | "trash";
  sign?: "" | "+" | "-";
  ids?: string[]; // movimenti precisi (es. le righe di una ricorrenza)
  label?: string; // descrizione leggibile del filtro, mostrata in cima all'elenco
}

let pending: MovementFilter | null = null;
export const takePendingFilter = () => { const p = pending; pending = null; return p; };

export function goMovements(f: MovementFilter) {
  pending = f;
  const go = () => {
    if (location.hash === "#movimenti") dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = "#movimenti";
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(go); else go();
}
