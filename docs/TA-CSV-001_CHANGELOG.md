# TA-CSV-001 — Changelog v0.2U-rc1

Stato: **candidata per revisione**, non versione stabile. Nessun merge o rilascio automatico.

- Aggiunti HTML candidato e modulo CSV condiviso; v0.2T originale conservata.
- Unificati intestazioni/alias, separatori virgola/punto e virgola/tab, UTF-8 BOM e lettura Windows-1252 già supportata dal lettore file.
- Allineati i campionati dell'anteprima al registro v0.2T, comprese le otto leghe del mandato e gli alias già esistenti.
- Supportati CSV stagionali Football-Data, cumulativi extra, cache FootballCSV e calendari/risultati Open Matchday.
- Aggiunta selezione manuale di lega e stagione per file, con anteprima aggiornata prima del salvataggio. Il pulsante manuale prepara la stessa anteprima e richiede conferma dell'importazione.
- Resa accessibile l'importazione CSV anche senza una selezione precedente nel menu download; la preview viene aperta dopo la lettura dei file.
- Aggiunti controlli su metadati contraddittori, date inesistenti, risultati parziali/non interi, righe fuori stagione e intestazioni ambigue.
- Separati risultati mancanti, righe invalide, filtri stagionali e HT assente. Nessun HT mancante viene sostituito con 0–0.
- Persistito il metadato stagionale nel backup JSON, mantenendo compatibilità con il formato v2 originale.
- Conservati i risultati precedenti in caso di duplicati discordanti, con controllo anche sui metadati stagionali.
- Aggiunti test Node, regressioni browser, verifica delle 16 combinazioni richieste, manifest con checksum delle sorgenti e istruzioni per il collaudo indipendente.

Nessun dato personale utilizzato, nessun archivio utente cancellato, nessuna formula di valutazione cambiata. I CSV pubblici scaricati e le gare sintetiche sono stati importati esclusivamente in contesti browser temporanei.
