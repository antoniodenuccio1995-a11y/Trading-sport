# TA-STAB-003 — Rapporto QA

Data: 27/10/2026. Baseline rc3 `313841c37e493b3ca3b7ba83f2799e0643c4abda`. Candidata rc4 sul ramo `fix/ta-stab-003-recupero-copertura`. Le prove su dati personali usano copie in profili browser isolati; il backup originale non viene modificato né pubblicato.

## Esiti separati

**Recupero dell'archivio personale: verificato sul backup originale fornito.** La simulazione accetta tutti i 28.544 record in ingresso e restituisce 28.402 incontri distinti, consolidando 141 copie integrabili e una identica. Zero righe escluse nella migrazione iniziale. Le due partite manuali precedenti sono assegnate con prova datata e conservate integralmente. Il controllo valore per valore rende conto di tutti i 28.544 record originali, 57.088 denominazioni di provenienza e 172.964 valori di quota non vuoti, con zero errori.

**Completezza degli storici: parziale.** Le matrici comprendono 138 combinazioni: prima delle integrazioni risultano 11 complete verificate, 98 parziali e 29 non verificabili; dopo la proposta incrementale risultano 17 complete verificate, 92 parziali e 29 non verificabili. Le 29 senza riferimento non vengono dichiarate vuote o complete. Il catalogo pubblico e l'archivio dell'utente sono misurati separatamente.

La proposta di prova privata arriva a 35.022 incontri, con 6.620 aggiunte rispetto all'archivio recuperato. Sono state simulate 91 integrazioni campionato/stagione del menu con fonti disponibili. 6.480 righe in ingresso restano in revisione: 6.453 per identità o riferimenti non riconciliati, 27 per risultati discordanti tra fonti. Non sono 6.480 partite mancanti e non sono record cancellati dall'archivio originale. Il catalogo pubblico complessivo segnala 47 chiavi contestate, comprese le competizioni CSV aggiuntive. La proposta è una copia di QA reversibile, non è stata applicata automaticamente al browser dell'utente. Il verificatore conferma la conservazione di tutti i valori originali anche nella proposta integrata.

## Prove eseguite

| Prova | Dati e risultato | Evidenza |
|---|---|---|
| Backup reale end-to-end | 12 gruppi PASS: anteprima senza scritture, cinque pannelli, conferma atomica, export, reload byte equivalente, 42 identità Paris persistenti, copertura, Undo, sette CSV e reimportazione, cutoff su dati reali, recupero pubblico e persistenza | `qa/stab003/real-backup-summary.json` |
| Integrità del recupero | 28.544 record originali contabilizzati in 28.402 incontri; dati non vuoti, quote, provenienze e manuali conservati | `integrity-restored.json` |
| Integrità dopo CSV | Tutti i valori originali conservati dopo i sette CSV; nessun doppione aggiunto dalla reimportazione | `integrity-after-csv.json` |
| Recupero di uno storico dal browser | Spareggio Serie A 2022/23 aggiunto via HTTP e checksum; archivio complessivo 28.403, stagione 381, classifica regolare 380; reload e Undo a 28.402 | `integrity-playoff.json`, riepilogo reale |
| Intera proposta nel browser | 35.022 incontri: anteprima, salvataggio completo, riapertura/export degli incontri identico, dati manuali conservati e Undo: PASS | `proposal-browser.json` |
| Identità CSV non risolte | Il percorso CSV rispetta i blocchi prodotti dal collegamento delle identità: nessuna riga ambigua o contestata aggiunta, archivio precedente invariato | `csv-identity-browser.json` |
| Proposta incrementale privata | 35.022 incontri; tutti i 28.544 record originali e i relativi valori restano contabilizzati | `incremental-summary.json`, `integrity-integrated.json` |
| CSV forniti dall'utente | Sette file: cinque stagioni I1 con 380 FT/HT/tiro ciascuna; 71 FT correnti, 70 HT/tiro, 309 calendari distinti. Zero righe invalide o duplicate nei singoli file | `uploaded-csv-summary.json` |
| Regressione CSV su fonti | 16 casi, otto campionati × 2024/25 e 2025/26, 5.151 partite importate, nove gruppi di regressione PASS, nessun errore pagina | `csv-regression.json` |
| Recupero e memoria sintetici | 22 gruppi PASS: conflitti, consenso esplicito ai recuperi parziali, quota esaurita, transazione interrotta, scheda concorrente, regole club, Undo, fallback, roundtrip e trade congelati | `synthetic-browser.json` |
| Test puri | 51 test recupero/identità/copertura, 30 asserzioni parser CSV, sei test del parser calcio testuale: PASS | `unit.txt`, `csv-unit.txt`, `football-parser.txt` |
| Regressioni dell'AUDIT precedente | IND-01…06 PASS, quattro controlli roundtrip PASS; IND-08 è una osservazione; IND-07 ERROR per policy su file:// | `independent/independent-browser.json`, `independent/independent-roundtrip.json` |
| Conservazione del codice | Dieci file precedenti immutati; sei funzioni statistiche e `standingsZoneRules` identiche; intero blocco registro trade identico; sintassi di otto moduli e tre script inline valida | `preservation.json` |

I percorsi abbreviati delle evidenze nella tabella sono relativi a `qa/stab003/`. «PASS importazione» non certifica la completezza della fonte: per esempio Ligue 2 2025/26 della regressione contiene 305 risultati e Romania/Danimarca hanno HT mancanti. Le stagioni restano valutate nella matrice.

L'analisi partita su un archivio reale popolato e lo storico delle classifiche sono stati confrontati prima/dopo l'inserimento in memoria di un risultato futuro 99–98 con etichetta di stagione precedente: contenuto invariato alla data di analisi. Le regressioni AUDIT controllano anche il grafico della classifica al cutoff. Le formule non sono state cambiate per ottenere questo risultato.

## Limiti e condizioni della revisione

- Il registro trade reale non era tra i dati forniti. Sono verificati codice immutato, namespace precedente e operazioni sintetiche con voti, eventi e quote congelati. Non si dichiara validato un registro personale assente.
- Nel backup reale memberships, goalEvents e strategies sono vuoti. La conservazione di sezioni ausiliarie popolate, i conflitti e il roundtrip sono verificati su dati sintetici, distintamente dalle due partite manuali reali.
- 29 combinazioni non hanno fonti acquisite sufficienti; per le altre restano fasi, identità, date o risultati da riconciliare. Ogni stato completo è limitato alle fonti e allo scopo dichiarati. Il calendario corrente non rende completa una stagione in corso.
- Le partite precedenti prive di fase non vengono attribuite automaticamente a playoff/playout. Le classifiche multiphase non sono certificate come equivalenti alle classifiche federali. Le formule e le regole esistenti restano immutate.
- La fotografia pubblica è fissata al 27/10/2026. Nuove disponibilità o correzioni delle fonti richiedono un nuovo confronto; non viene inventato alcun risultato.
- La prova file:// è impedita dal browser cloud (`ERR_BLOCKED_BY_ADMINISTRATOR`). I controlli HTTP passano. Non si aggira il blocco e non si dichiara quel controllo superato.
- I test automatizzati dell'AUDIT sono regressioni ripetute dall'autore. La revisione indipendente della nuova candidata resta da eseguire sulla pull request in bozza.
- Il primo tentativo di una regressione sintetica è stato invalidato dal controllo che rileva sorgenti modificati durante l'esecuzione; è stato rieseguito sui sorgenti congelati. Un'attesa di 10 secondi del vecchio runner sul roundtrip JSON popolato è scaduta: il runner attuale attende l'inizializzazione dell'Area tecnica e concede 60 secondi alla simulazione; la prova completa è passata mantenendo le asserzioni sui dati. Il primo controllo dell’intera proposta confrontava il record manuale prima della normale aggiunta dei metadati di identità: l’asserzione attuale verifica ogni campo originale e richiede uguaglianza integrale dell’esportazione successiva alla riapertura.

Il mandato non viene dichiarato interamente risolto sulla sola base dei test sintetici. Il recupero personale è verificato, la nuova candidata è revisionabile e la copertura residua è documentata come parziale.
