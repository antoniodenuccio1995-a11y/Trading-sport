# Integrità e persistenza TA-DATA-002B

La rc3 conserva i file delle versioni precedenti senza modificarli. Il database delle partite è `TradingAnalyticsArchiveV3_TADATA002B`; le sue chiavi ausiliarie sono separate da rc2. Non legge automaticamente gli archivi personali delle altre versioni.

## Commit unico

Il recupero guidato e le decisioni sui club usano una sola transazione IndexedDB sullo store `snapshots`. La transazione comprende:

- righe di tutte le partite del nuovo archivio;
- riferimenti squadra/stagione, eventi gol, calendario manuale e strategie;
- regole di associazione dei club;
- rapporto dell'operazione;
- copia coerente della situazione precedente, con la revisione necessaria al ripristino.

Prima del commit si confrontano lo stato in memoria, i dati ausiliari e lo snapshot su disco con quelli simulati. Una modifica concorrente impone una nuova simulazione. I controlli di lettura successivi confrontano partite, dati ausiliari e regole con il contenuto atteso.

Un abort lascia tutti gli elementi precedenti intatti: non viene aggiornato neppure il puntatore di ripristino. I test provocano un abort dopo l'esecuzione di richieste di scrittura ma prima del commit e verificano disco, memoria, dati ausiliari e ricaricamento. Non è un collaudo di spegnimento fisico del dispositivo.

Le modifiche ausiliarie ordinarie successive sono associate alla generazione del bundle. All'avvio, vecchie copie locali appartenenti a un'altra generazione non prevalgono sul bundle appena salvato. Uno snapshot alternativo antecedente al commit non può far riapparire dati vecchi se il processo si ferma prima della pulizia del fallback.

Il recupero guidato non ripiega su più scritture localStorage quando IndexedDB manca: si blocca spiegando come riaprire l'app. Le funzioni ordinarie già esistenti conservano i propri fallback. Un rifiuto di localStorage durante il recupero non impedisce il commit atomico IndexedDB, come verificato dai test.

## Duplicati e conflitti

Le copie identiche si consolidano solo dopo aver confrontato i dati. Le integrazioni riempiono campi mancanti. FT, HT, tiri, stagioni o quote discordanti bloccano il gruppo. Le denominazioni originali rimangono in `ClubHomeRaw`, `ClubAwayRaw` e nelle provenienze. Differenze di etichette delle fonti restano in `RecoveryEvidence` senza sostituire i valori originali.

Il piano parziale preserva esattamente i record già esistenti nei gruppi esclusi; non sceglie uno dei risultati del file. Il rapporto contiene le righe escluse complete. Se l'anomalia coinvolge i record correnti o una sezione ausiliaria, non è offerto un parziale che nasconderebbe quel problema.

L'unione di due copie valide riduce intenzionalmente il conteggio delle righe. Il rapporto espone la corrispondenza tra indici sorgente e incontri consolidati: la sola uguaglianza del numero totale non è usata come prova di integrità.

## Riscontri

Il corpus pubblico da 77 CSV contiene 36.789 incontri, senza collisioni: numero iniziale e finale coincidono. Il fingerprint dei campi protetti prima/dopo è identico:

`7459a46de91488a8fd47a0b973580e48cba250b4265cc1c9ed8ad475ae60b885`

Comprende date, campionati, FT, HT, tiri, stato calendario e tutti i metadati originali non relativi all'identità, incluse le quote. L'input non viene mutato. È una simulazione Node sul corpus pubblico, non una prova di prestazioni browser su 36.789 incontri e non una verifica dell'archivio personale mancante.

I corpi delle sei funzioni statistiche protette e il codice di persistenza/gestione del registro trade sono identici alla rc2. Le fotografie sintetiche dei trade, eventi e quote restano uguali dopo il recupero. Il cambio di raggruppamento di un club può cambiare la popolazione delle sue statistiche: viene mostrato nell'anteprima, senza cambiare formule o voti congelati.

Nessuna prova distruttiva usa allegati o archivi personali. I rapporti originali e il prospetto diagnostico individuale sono fuori dal repository.
