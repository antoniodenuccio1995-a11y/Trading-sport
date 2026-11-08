# Audit Trading Analytics v0.3-rc4

Data: 8 novembre 2026. File analizzati: `Trading_Analytics_v0.3-rc4_6.html` (10,6 MB) e `backup_trading_analytics_2026-11-06_3.json` (29 MB, 28.383 partite).

Le misure sono state fatte in Chromium headless su una CPU server. Su un PC normale i tempi saranno più alti.

## 1. Velocità: misure

| Operazione | Tempo | Note |
|---|---|---|
| Apertura con archivio vuoto | 0,8 s | |
| Apertura con l'archivio completo (28.383 partite) | **6,7 s** | 212 MB di memoria JS |
| Simulazione import del backup | 2,9 s | |
| Conferma e salvataggio dell'import | circa 10 s | |

### Dove va il tempo all'avvio (profilo CPU)

All'avvio il programma rielabora tutte le 28.383 partite: normalizza i nomi, risolve le identità dei club, ricostruisce orari e fasi. Lo fa a ogni apertura, sul thread principale, e ricalcola ogni volta lo stesso risultato.

| Funzione (riga nell'HTML) | Tempo |
|---|---|
| `text` (normalizzazione testi, r. 1453) | 946 ms |
| `clone` (copie profonde, r. 1810) | 569 ms |
| `context` / `key` / `resolve` / `canonicalMatch` | circa 1,5 s |
| garbage collector | 310 ms |

### Cause principali

1. **Il 99% del backup è costituito da metadati ripetuti.** Su 29 MB, 28,7 MB sono il campo `o` di ogni partita (`ClubHomeSources`, `ClubHomeLegacyIds`, `FixtureTimeObservations`…). I dati utili (data, lega, squadre, risultato, HT, quote) occupano circa 2 MB.
2. **Il worker non esiste.** Il codice prova a caricare `ta-v02v-ux-worker.js`, che non è incluso. Aperto come `file://`, il browser blocca comunque i worker esterni, quindi si ripiega sempre sul calcolo sincrono (`"worker":"fallback sincrono"`).
3. **9,7 MB di manifest inline.** `TAHistoryManifest` (riga 6072) viene letto e interpretato a ogni apertura, anche quando non serve.
4. **Salvataggi costosi.** `archiveCompact` esegue `JSON.parse(JSON.stringify())` su ogni riga. `archiveStrictWrite` serializza due volte l'intero archivio per confrontarlo. `archiveQueueWrite` lo copia un'altra volta.
5. **Backup automatico pesante.** `auSave` scrive due file completi da 29 MB (ogni 10 minuti in caso di modifiche, e quando si cambia scheda) e ne conserva 14 copie giornaliere: circa 400 MB su disco.
6. **Polling continui.** Il registro trade viene ricontrollato ogni 1,2 s (`setInterval(…,1200)`). All'import di un backup, un timer interroga lo stato ogni 2 s per 80 s.

## 2. Affidabilità: problemi nel codice

- **20 script sovrapposti** (v0.2G, S, T, U, V, INT-004, rc5, v0.3), che si modificano a vicenda a runtime: ridefiniscono funzioni (`updateLeagueSourceUI=function(...args)`, `compareMatch`, `refreshDataStatus` ×2, `taRenderClubs`…), clonano pulsanti per rimuovere i vecchi handler (`cloneNode(true)`), intercettano i click in fase di cattura con `stopImmediatePropagation` e leggono variabili interne con `(0, eval)('taPending')`. Ogni nuova modifica rischia di rompere un livello precedente.
- **5 database IndexedDB** e più chiavi di `localStorage`: `TradingAnalyticsArchiveV4_TAINT004`, il journal, `TradingAnalyticsSourceCacheV02V`, `ta_v03_kv` e `ta_v03_fs`. Una parte dei dati personali sta in `localStorage`, che il browser può cancellare.
- **Il ripristino del proprio backup non è pulito.** Su un browser vuoto, il backup del 6/11 produce **242 righe "problematiche"** (alias Nancy), escluse se non si spunta a mano "usa le associazioni del backup". La v0.3 prova a spuntarla da sola con un timer: è un rimedio, non una correzione.
- **Funziona solo con file locale.** Gli aggiornamenti da Football-Data e dalle altre fonti dipendono dal CORS del browser e da `file://`.

## 3. Problemi nei dati (backup del 6/11)

| Problema | Effetto |
|---|---|
| **Squadre doppie**: `AS Nancy Lorraine` / `Nancy Lorraine`, `FC Sochaux-Montbéliard` / `Sochaux-Montbéliard` (Ligue 2 2026/27 risulta con 20 squadre invece di 18) | Classifiche, medie e serie della squadra divise in due |
| **28 partite duplicate** nella stagione 2026/27: la riga del calendario (Open Matchday) resta accanto al risultato arrivato con data diversa (es. Nizza–Rennes 30/10 e 31/10) | Partite fantasma in calendario, conteggi sbagliati |
| **156 partite passate senza risultato** e non segnate come "da giocare" (Championship 15, Ligue 2 13, Ligue 1 12…) | Buchi nelle statistiche della stagione in corso |
| **Stagioni mancanti**: Bundesliga 2024/25; League One 2021/22–2023/24; Danimarca e Romania 2024/25–2025/26 | Storico incompleto per trend e backtest |
| **2.216 partite giocate senza risultato del 1° tempo** (soprattutto Danimarca e Romania) | Mercati 1T senza dati |
| **Nessun minuto dei gol** (`goalEvents: 0`) | La sezione "Gol per fasce di 15 minuti" è vuota; mancano gol al minuto, primo gol, gol 75'+, ecc. |

## 4. Fonti gratuite per i minuti dei gol

La rete di questo ambiente blocca i siti delle API, quindi i dati sotto vengono da ricerche web e non sono ancora stati provati dal vivo.

| Fonte | Costo | Minuti gol | Leghe | Limiti |
|---|---|---|---|---|
| ESPN (JSON pubblico, non ufficiale) | gratis, senza chiave | sì (eventi partita) | tutte le 16 in archivio, storico compreso | non documentata: può cambiare senza preavviso |
| API-Football (api-sports.io) piano Free | gratis con chiave | sì (`fixtures/events`) | molte | 100 richieste al giorno; le fonti indicano solo le stagioni 2022–2024, **senza stagione in corso** |
| football-data.org Free | gratis con chiave | **no** (i gol al minuto sono nel piano "Deep Data", a pagamento) | 12 competizioni | 10 richieste al minuto |
| OpenLigaDB | gratis | sì | solo Germania | |

Fonti: [API-Football pricing](https://www.api-football.com/pricing), [issue sul limite 2022–2024](https://github.com/NoahGiesel/tauri-convex-chat-app/issues/100), [ricerca football-data.org](https://getbruin.com/docs/ingestr/soccer-sources/football-data-org.html), [confronto API gratuite 2026](https://www.thestatsapi.com/blog/free-football-api-alternatives), [guida ESPN hidden API](https://zuplo.com/blog/2024/10/01/espn-hidden-api-guide).
