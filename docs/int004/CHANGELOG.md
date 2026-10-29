# TA-INT-004 — Changelog candidata v0.2U-rc5

## Consolidamento 29/10 — reimportazione e collaudo integrale

- Orari confrontati come osservazioni originali di fonte, senza reinterpretare `Time` e `SourceTime` aggregati come un nuovo conflitto. Una storia di orari deve coprire interamente l’altra; una sola intersezione non basta.
- Conservati gli abbinamenti orario/fuso di ciascuna fonte; non si costruisce un istante UTC prendendo l’orario da una fonte e il fuso da un’altra. Le indicazioni UTC esplicite rimangono autorevoli nella propria osservazione.
- La ripetizione esatta di righe già mantenute in revisione non riscrive né riconcilia l’archivio: resta un no-op con avviso. Osservazioni nuove o valori discordanti continuano a bloccare l’integrazione.
- Aggiunti test per riordino delle fonti, serializzazione, reimportazioni ripetute, nuovi conflitti, copertura parziale degli orari e metadati malformati.
- Nuovo ciclo browser con upload, anteprima, conferma, export, reload, tre reimportazioni del sorgente, reimport dell’export e Undo; dati sintetici, backup rc4 recuperato e originale, senza scrivere negli input.
- Runner unico del collaudo completo: log, comandi, manifest dei sorgenti, console e pageerror, codici di uscita, confronto su tutti i valori e verifica dalla stessa versione/commit in copia pulita. Nessuna suite vecchia è considerata una ricevuta nuova.
- Correzione Backtest di oggi conservata. HTML, modelli, classifiche e registro trade invariati rispetto a c6d9aa4. Nessun merge o deploy.

## Correzione urgente degli orari dopo b379d6f

- Risolto il riferimento non visibile a `safeKickoffFuture` dal Backtest; una sola funzione, invariata, ora condivisa con lo Scanner.
- Conservata l'esclusione prudenziale delle partite di oggi con orari assenti, non verificabili, già trascorsi o uguali all'istante corrente.
- Riprodotto il FAIL precedente e aggiunta prova browser del pulsante con gare di oggi/domani, manuali, tutti i preset, Scanner, ricerca ed export; operazioni storiche confrontate campo per campo.
- Ogni altro byte dell'HTML rispetto a b379d6f rimane invariato; nessuna modifica a JSON personali originali, classifiche, formule o registro trade. Nuovo AUDIT richiesto.

## Integrazione precedente

Stato: **candidata collaudata per revisione indipendente, non stabile**, baseline rc4 `242a15efae0ab64fd851335354c40c750d2d2e95`.

- Motore condiviso di identità di club e incontri; competizione, stagione, giorno, fonte qualificata, contesto sportivo, ripetizioni e osservazioni dell'orario.
- Alias documentati per Pescara/Delfino Pescara, Cesena/Cesena FC e altri club, con Paese e associazioni sportive esplicite. Entità storiche chiuse e label ambigue non vengono unite automaticamente.
- Identificativi e provenienze originali conservati; compatibilità distinta dai conflitti su risultati e statistiche.
- Giornate separate dalle fasi. Nessuna nuova gara fittizia perché una fonte usa `1. Round`.
- Importazioni ripetute idempotenti; nuove importazioni non riparano silenziosamente i gruppi già presenti.
- Consultazioni future condivise fra calendario e scanner, incluse le manuali; eventi distinti con codici qualificati non vengono collassati.
- Frequenze HT calcolate sulle osservazioni note; assenza di HT mostrata come indisponibilità.
- Archivio grezzo preservato all'avvio; proiezione distinta per classifiche, grafici, frequenze, scanner e Analisi partita. Le osservazioni irrisolte non alimentano arbitrariamente i campioni.
- Riconciliazione esistente separata dall'importazione, con anteprima, backup, attestazione del download, conferma e Undo atomico.
- Pacchetti e matrici rigenerati mantenendo gli originali e separando i record in revisione.
- Controllo sul backup personale, sui valori di quota e sulla precedente proposta di integrazione, tutti conservati in copie private.
- Formule protette, voti, regole e codice del registro trade invariati.

- Integrati selettivamente Mercato, preset, strategie obsolete, diagnostica e Backtest dalla versione operativa, verificata contro l’hash dell’AUDIT.
- Conservati lista completa paginata, ricerca, grafico ed export CSV dell’intero risultato.
- Backtest su identità condivise, condizioni solo casa/trasferta, manuali future, filtri lega/stagione e cutoff anche per risultati dello stesso giorno.
- Procedura rapida alias con consenso, anteprima, conferma atomica e Undo, conferma legata alla specifica simulazione e controlli dei Paesi preservati.
- Superati il contratto Backtest precedentemente FAIL e 144 confronti indipendenti su due stagioni di Serie A e La Liga; rieseguite le prove su sintetici, pacchetti pubblici e backup reale.

**Aperti:** AUDIT indipendente, collaudo locale Windows, revisione delle osservazioni in conflitto e dei consolidamenti aggiuntivi del backup. Nessun merge, deploy stabile o completamento dichiarato delle stagioni parziali.
