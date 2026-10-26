# TA-CSV-001 — Rapporto QA

Data: 26 ottobre 2026. Candidata v0.2U-rc1, ramo `fix/ta-csv-001-import-storici`.

## Esito

**PASS per il flusso di importazione manuale tramite server HTTP locale**, sulle sorgenti campionate. La candidata è disponibile per revisione indipendente, non promossa a stabile.

- 30 test Node eseguiti e superati; nessun test fallito, saltato o disabilitato.
- 16 combinazioni reali lega/stagione superate: **5.151 incontri** confrontati uno per uno per data, squadre e risultato, oltre ai conteggi e alla somma dei gol.
- 9 controlli di regressione browser superati; nessun errore JavaScript non gestito.
- 5.154 record nel solo archivio temporaneo di collaudo finale: 5.151 reali pubblici + 3 sintetici identificati QA. Nessun archivio personale aperto o modificato.
- Una verifica opzionale `file://` è **bloccata**, non superata: `ERR_BLOCKED_BY_ADMINISTRATOR` della policy Chromium. Non sono stati aggirati i controlli. Il flusso HTTP è superato.

## Matrice delle sorgenti e dei risultati importati

| Campionato | 2024/25 importati / HT assente | 2025/26 importati / HT assente | Esito |
| --- | ---: | ---: | --- |
| SuperLiga Romania | 315 / 315 | 321 / 321 | PASS |
| Superliga Danimarca | 192 / 192 | 192 / 192 | PASS |
| Primeira Liga | 306 / 0 | 306 / 0 | PASS |
| La Liga | 380 / 0 | 380 / 0 | PASS |
| Segunda División | 462 / 0 | 462 / 0 | PASS |
| Ligue 1 | 306 / 0 | 306 / 0 | PASS |
| Ligue 2 | 306 / 0 | 305 / 0 | PASS |
| Eredivisie | 306 / 0 | 306 / 0 | PASS |

I conteggi sono quelli degli incontri importabili effettivamente presenti nei CSV scaricati, **non una certificazione di completezza delle stagioni**. In particolare Romania 2024/25 ha 315 risultati e Ligue 2 2025/26 ne ha 305. Non è stato inventato o integrato il risultato di alcuna gara per raggiungere un conteggio atteso. Le fonti cumulative di Romania e Danimarca non forniscono HT: le analisi 1T restano senza evidenza per quelle gare.

I CSV stagionali sono stati scaricati da Football-Data; Romania e Danimarca dai file extra cumulativi. Sorgenti, URL finali, dimensioni e SHA-256 sono in `qa/TA-CSV-001-sources.json`; i risultati per file sono in `qa/TA-CSV-001-browser.json`. I file pubblici integrali sono stati tenuti sotto `/tmp`, non inclusi nel repository. Lo script di download consente una nuova acquisizione, i cui checksum vanno confrontati prima di dichiararla identica.

## Regressioni effettivamente eseguite

1. Avvio HTTP 200, IndexedDB disponibile e navigazione delle sette sezioni principali.
2. Reimportazione di un CSV reale: nessun aumento dei record e nessuna perdita delle altre leghe/stagioni.
3. Nomi squadra con alias preesistenti, conflitti FT conservati, data inesistente esclusa, risultato finale mancante escluso dagli storici, HT assente lasciato nullo.
4. Campionato selezionato in conflitto con un codice conosciuto: salvataggio bloccato. Correzione della scelta e reimportazione riuscite senza duplicati.
5. Intestazione della utility a 131 colonne con riga sintetica: codice sconosciuto bloccato fino alla scelta manuale, stagione e quota conservate.
6. Export JSON, ricaricamento, ripristino, persistenza di una stagione esplicita a cavallo di luglio, conferma richiesta, backup malformato rifiutato senza alterare l’archivio.
7. Registro trade sintetico: import, reimport senza duplicati, payload invalido rifiutato, chiusura 50% con P&L simulato, valutazione iniziale invariata, export e persistenza dopo ricaricamento.
8. Backup v2 nella forma compatta originale v0.2T, senza CsvSeason: ripristino e nuova esportazione senza variazioni; vecchia attribuzione stagionale conservata.
9. Nessun errore JavaScript non gestito; traffico remoto bloccato intenzionalmente durante i test browser per impedire aggiornamenti automatici e rendere deterministico l’archivio.

I test Node coprono inoltre separatori e virgolette, BOM, alias delle intestazioni, metadati contraddittori, filtri e date bisestili, punteggi non interi/negativi/incompleti, HT impossibile e HT 0–0 reale, cache e schemi Open Matchday, compatibilità dei codici esistenti, sintassi di tutti i quattro script inline. Il test di integrità verifica l’HTML originale contro il commit baseline e il blocco dei modelli/analisi/classifiche byte per byte.

## Limiti e verifiche non eseguite

- La utility esterna non è stata fornita: verificata la sua intestazione e una riga sintetica; non il suo programma o un suo file completo reale.
- Completezza federale, playoff, gare rinviate, penalizzazioni e nomenclature fra fonti diverse non certificati. Le classifiche restano ricostruzioni dei dati importati.
- Chrome/Edge Windows, profili personali, quantità superiori ai CSV campionati e avvio diretto file:// non dichiarati verificati. Su questa macchina file:// è bloccato dalla policy amministrativa.
- CORS e download automatici non sono stati modificati dal mandato: qui sono collaudati i CSV manuali. Non è stato installato un proxy applicativo o disabilitato TLS/CORS.
- La formula statistica e il registro trade sono protetti dalla baseline, non ottimizzati o rivalutati dal mandato.
- La creazione di una PR tramite GitHub API è impedita dall’accesso HTTP 403 rilevato con `gh api`. Il ramo dedicato e il collegamento di confronto permettono comunque la revisione; nessun merge, nessuna pubblicazione come stabile.

## Riproducibilità e revisione

Comandi e precauzioni in `docs/TA-CSV-001_COLLAUDO.md`. Esito Node in `qa/TA-CSV-001-unit.txt`, esito browser e manifest nella cartella `qa`. Il test browser avvia e arresta il proprio server su porta libera e usa contesti temporanei. Riferimento visivo: `qa/TA-CSV-001-candidate.png` (dati pubblici e sintetici).

La v0.2T originale mantiene SHA-256 `819491b53edd20768ce23134c271c2a99a1b80d4bdbf3b165d478dd26794f688`. Le differenze leggibili dell’HTML candidato sono in `qa/TA-CSV-001-html.diff`.
