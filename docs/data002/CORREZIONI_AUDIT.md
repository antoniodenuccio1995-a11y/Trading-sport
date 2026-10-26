# TA-DATA-002 — Correzioni AUDIT

Baseline: `b80ff664ff1ffe05045662ad43d22d5c2e9dd3fc`, applicativo `73fc0e2`. I checksum della rc1 coincidono con quelli del rapporto indipendente. La precedente rc1 e la v0.2T non sono modificate.

## Riproduzione prima della correzione

Sono stati acquisiti e verificati tutti i checksum di `REVISIONE_TA_CSV_001_v02U_rc1_2026-10-26.zip`. La copia integrale è in `tests/data002/independent/`: rapporti, fixture, script e log originali restano intatti. Le istruzioni dell'allegato sull'evoluzione futura delle classifiche sono contesto, non attività implementate.

`tests/data002/run-independent.py` adatta soltanto percorsi del checkout, nome dell'HTML candidato, eseguibile Chromium e cartella di output. Non cambia gli assert o le fixture dei due script forniti. I risultati della baseline sono in `qa/data002/audit-baseline/`; quelli della rc2 in `qa/data002/audit-rc2/`. La prima ricostruzione autonoma, eseguita prima dell'arrivo del pacchetto, è distinta in `baseline-reproductions.json`.

| Rilievo | Test originale | Prima | Dopo | Correzione |
| --- | --- | --- | --- | --- |
| F-01, campionati misti | IND-01 | FAIL, 2 righe tutte Ligue 1 | PASS, 0 scritture senza risoluzione | Metadati validati per riga; quarantena delle righe non risolte; conferma separata e tracciata |
| F-02, stagione provenienza | IND-02 | FAIL, 4 riferimenti tutti 2025 | PASS, solo 2 riferimenti 2024 | I riferimenti derivano dai record già validati e filtrati dalla stessa anteprima |
| F-03, formato provenienza | IND-03 | FAIL, zero riferimenti | PASS, 2 riferimenti | Stesso parser per schema, separatore, date e filtri; preparazione prima del commit |
| F-04, storico e cutoff | IND-05 | FAIL, una gara futura nel passato | PASS, zero gare future | Il cutoff si applica anche alle annate precedenti, senza Infinity implicito |

## Dettagli

**F-01.** Un codice noto in un'altra riga non certifica una riga sconosciuta o priva di metadati. La preview segnala le righe in quarantena e il salvataggio si arresta. La sola lega già selezionata non è una risoluzione. L'utente può confermare esplicitamente che quelle righe appartengono alla lega scelta; il JSON conserva `CsvLeagueResolution`, numero di riga, codici originari, destinazione e metodo `explicit-user-confirmation`. Due codici conosciuti di leghe diverse continuano a bloccare il file, anche con la conferma.

**F-02/F-03.** `smartDataFromEntry` esegue la stessa lettura anche in modalità provenienza e prepara le associazioni prima della scrittura. `pathImportReferenceCsv` usa il medesimo parser anche per il controllo ausiliario. Stagione dichiarata, filtro, intestazioni normalizzate e separatori sono comuni. I riferimenti conservano `clubId`, fonte originale, stato e data della gara che costituisce l'evidenza. La memoria viene aggiornata soltanto dopo il salvataggio; un errore di provenienza non viene presentato come successo integrale.

**F-04.** `standingsHistoryBySeason` passa il cutoff a ogni annata; anche l'elenco delle annate e le evidenze di appartenenza lo rispettano. I riferimenti importati senza data di evidenza non vengono usati per certificare appartenenze a un cutoff finito. Le vecchie fonti ufficiali hardcoded non vengono mostrate prima della loro data documentata. La tabella completa senza cutoff mantiene il suo significato di vista dell'archivio. Nessuna nuova interfaccia delle classifiche, fase dedotta o banda sportiva è stata introdotta.

## Altri esiti indipendenti

IND-04 (tabella/traiettoria) e IND-06 (fallimento DB/quota) passano anche nella rc2. Le quattro prove di `roundtrip.cjs` passano. IND-07 è registrato come **ERROR ambientale**, non PASS: file:// è bloccato da `ERR_BLOCKED_BY_ADMINISTRATOR`. IND-08 è una semplice osservazione sulla copertura delle regole e resta tale. Le regole sportive non sono state ampliate.

La riesecuzione degli script ricevuti non costituisce da sola una nuova approvazione della revisione indipendente o della DIREZIONE: la candidata è consegnata per tale valutazione.
