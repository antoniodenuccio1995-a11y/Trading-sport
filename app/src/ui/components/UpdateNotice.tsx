// Avviso "nuova versione": se l'app resta aperta (o in sottofondo) mentre ne pubblichiamo una nuova,
// lo si scopre confrontando il file principale della pagina pubblicata con quello in uso.
import { useEffect, useState } from "preact/hooks";

const SCRIPT = /assets\/index-[\w-]+\.js/;
/** Nome del file principale in uso (null nel file unico o in sviluppo: lì non si controlla). */
const current = () => document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]')?.src.match(SCRIPT)?.[0] ?? null;

/** Nome del file principale della versione pubblicata ora (null se non si riesce a leggere). */
export async function publishedScript(): Promise<string | null> {
  try {
    const res = await fetch("./index.html", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.text()).match(SCRIPT)?.[0] ?? null;
  } catch { return null; }
}

export function UpdateNotice({ every = 30 * 60000 }: { every?: number }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    const mine = current();
    if (!mine || location.protocol === "file:") return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < every / 2) return;
      last = Date.now();
      const pub = await publishedScript();
      if (pub && pub !== mine) setFresh(pub);
    };
    const first = setTimeout(check, 20000); // all'apertura la pagina può arrivare ancora dalla cache per qualche minuto
    const timer = setInterval(check, every);
    document.addEventListener("visibilitychange", check);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);
  if (!fresh || hidden === fresh) return null;
  return (
    <div class="upd-toast" role="status">
      <span><b>Nuova versione disponibile.</b> Aggiorna per usarla: i tuoi dati restano.</span>
      <div class="upd-actions">
        <button type="button" class="btn primary" onClick={async () => {
          // rinfresca la copia della pagina nel browser, così il ricaricamento prende davvero la versione nuova
          await fetch("./", { cache: "reload" }).catch(() => null);
          location.reload();
        }}>Aggiorna</button>
        <button type="button" class="btn" onClick={() => setHidden(fresh)}>Più tardi</button>
      </div>
    </div>
  );
}
