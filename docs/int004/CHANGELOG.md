# TA-INT-004 — Changelog provvisorio

Stato: **lavorazione non pronta per AUDIT/rilascio**, baseline rc4 `242a15efae0ab64fd851335354c40c750d2d2e95`.

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

**Non ancora integrati:** menu Mercato, correzioni del Backtest e gestione semplificata degli alias della versione Windows indicata dalla DIREZIONE. I file operativi e il rapporto AUDIT non sono stati raggiunti su Drive a causa del blocco di rete. I relativi test di accettazione rimangono FAIL/bloccati; non vengono dichiarati superati dal funzionamento del nuovo motore d'identità.
