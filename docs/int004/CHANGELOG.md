# TA-INT-004 — Changelog candidata v0.2U-rc5

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
