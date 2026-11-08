// Configurazione pubblica: la chiave "publishable" è pensata per stare nel browser.
// La sicurezza dei dati personali è garantita dalle regole RLS del database.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://cqfxjvrpspvycocvxghv.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_VQS48ywRaUafRirZIyo5EQ_8KMjSDfm";
/** Cartella con manifest e istantanee delle stagioni (sovrascrivibile per i test). */
export const DATA_BASE = import.meta.env.VITE_DATA_BASE ?? `${SUPABASE_URL}/storage/v1/object/public/ta-data`;
export const APP_VERSION = "1.0.0";
