# Copertura e fonti degli storici

## Perimetro e lettura della matrice

Il controllo comprende tutti i 20 campionati del menu rc3 per le sei stagioni 2021/22–2026/27: 120 combinazioni. Sono esposte anche le tre competizioni aggiuntive già riconosciute dal parser CSV (League Two, Süper Lig, Jupiler Pro League), per altre 18 combinazioni. Il prospetto totale contiene 138 righe. Non si dichiara che le tre competizioni aggiuntive abbiano tutte le funzionalità o i modelli del menu.

Le matrici pubbliche contengono aggregati per campionato/stagione, senza incontri, quote, partite manuali o altri record del backup personale:

- `MATRICE_ARCHIVIO_ORIGINALE.csv`: situazione iniziale, comprese le copie duplicate.
- `MATRICE_ARCHIVIO_RECUPERATO.csv`: dopo migrazione e consolidamento, prima delle integrazioni pubbliche.
- `MATRICE_PROPOSTA_INTEGRATA.csv`: copia di prova dopo l'integrazione incrementale delle fonti disponibili per i campionati del menu.
- `MATRICE_FONTI.csv`: contenuto dei pacchetti pubblici, distinto dal contenuto dell'archivio personale.
- [MATRICE_SINTESI.md](MATRICE_SINTESI.md): stato delle sei stagioni di ciascun campionato nella proposta integrata.

`present` conta le identità di incontro distinte; `inputRows` include le copie. `expectedRegular` ed `expectedFull` sono separati: un campo vuoto significa atteso non verificato. `ft` conta risultati finali disponibili, `ht` la somma del primo tempo e `htExact` la coppia esatta casa/trasferta. Un HT ignoto non è trattato come 0–0. `fixtures` conta gare senza FT.

`missingResults` indica riferimenti con risultato dovuto effettivamente identificabili come assenti o presenti solo a calendario. `unreconciledReference` segnala invece differenze di nome/data non risolte: non è lecito chiamarle tutte partite mancanti. `missingFromReference` è il semplice confronto delle chiavi, che può comprendere queste differenze e calendari futuri. `unmatchedArchive` segnala incontri dell'archivio non riconciliati con il riferimento, senza eliminarli. I conflitti tra fonti e quelli dell'archivio hanno colonne distinte.

## Criterio di completezza

«Completo verificato» richiede stagione chiusa, atteso complessivo verificabile, stesso numero di FT dell'archivio e del riferimento, nessuna gara attesa assente, nessun riferimento irrisolto, nessun incontro extra non riconciliato, duplicato o risultato discordante, nessun conflitto noto tra fonti e nessun risultato futuro. Per i gironi all'italiana si controlla anche che ciascuna coppia ordinata di squadre compaia una sola volta, con il numero atteso di squadre e partite. Il solo totale non è sufficiente.

La completezza riguarda gli incontri e i FT entro lo scopo dichiarato. La copertura HT resta un indicatore indipendente e può essere inferiore. Il confronto usa aggregatori pubblici, non equivale a una certificazione federale. Ogni stagione corrente resta parziale. Una fonte incompleta può consentire recuperi puntuali senza certificare l'intera stagione.

«Non verificabile» indica assenza di un riferimento acquisito per quella combinazione; non significa archivio vuoto o inesistenza dei dati in assoluto. Tutte le altre situazioni restano «parziale».

## Fonti e affidabilità

Il catalogo include 138 pacchetti pubblici con 40.248 record di riferimento e checksum SHA-256. Le fonti sono Football-Data, OpenFootball (testo e JSON), il commit pubblico Open Matchday fissato nel codice e, per lo spareggio Serie A 2022/23, il tabellino ESPN del 11/06/2023. URL, esito del download, data di acquisizione e hash sono in `qa/stab003/public-sources.json`; i 34 file correnti Open Matchday sono identificati anche nelle righe del manifesto.

I confronti secondari non autorizzano ad aggiungere automaticamente tutte le gare con nomi o date diversi. Il builder mantiene la priorità della fonte primaria, registra i disaccordi e contrassegna gli incontri contestati: l'importatore li mette in revisione senza alterare il risultato già presente. Le note `parserWarnings` includono soprattutto riferimenti secondari non riconciliati; non sono una misura di partite mancanti o di errori di parsing.

Quattro competizioni del menu non dispongono di una fonte acquisita sufficiente per nessuna delle sei stagioni: Liga Portugal 2, 1st Division Danimarca, Prva NL Croazia, Liga II Romania. HNL Croazia ha solo la fotografia corrente comunitaria. Sono così 29 le combinazioni senza riferimento. Sono stati tentati anche endpoint secondari ESPN: errori HTTP o risposte senza eventi non giustificano una dichiarazione di completezza; gli esiti sono documentati in `qa/stab003/unavailable-source-probes.json`.

## Fasi successive e risultati particolari

- Serie A 2022/23: 380 gare regolari più lo spareggio salvezza Spezia–Hellas Verona, FT 1–3, verificato dal tabellino ESPN. Il relativo HT non è disponibile nella prova acquisita e resta ignoto.
- Championship/League One/League Two: per le stagioni chiuse l'atteso completo è 552 gare regolari più cinque playoff. Un file con 552 risultati non certifica tutta la competizione.
- Segunda División: 462 gare regolari più sei playoff, quando interamente disponibili.
- Serie B: playoff e playout dipendono dalle condizioni della stagione. Se l'atteso completo non è documentato viene lasciato vuoto; non si assume che 380 incontri siano l'intera stagione.
- Champions League: il conteggio della fase principale è distinto dalle qualificazioni. Dove il file delle qualificazioni non è acquisito, la copertura complessiva non è attestata.
- Danimarca, Romania e Belgio: i file cumulativi possono includere più fasi senza etichettarle. I record sono indicati come fase non classificata; non si inventano girone/fase o regole di classifica federali. Per le altre competizioni gli spareggi non documentati mantengono aperta la verifica complessiva.
- Supplementari e rigori non sono importati come risultato dei 90 minuti. Se il FT ai 90 minuti non è ricavabile, rimane mancante.

Le fasi esplicitamente non regolari sono conservate nell'archivio ma escluse dalla classifica regolare. La classificazione delle vecchie gare prive di fase resta un limite dichiarato. Nessuna regola statistica o di trading viene modificata per compensare una copertura incompleta.
