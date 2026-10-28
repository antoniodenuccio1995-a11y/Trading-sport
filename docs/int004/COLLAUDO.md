# Collaudo candidata v0.2U-rc5 TA-INT-004

**Candidata per revisione indipendente, non stabile.** Integra selettivamente la versione operativa Windows e corregge l’identità degli incontri. Conservare i vecchi file e i backup; non aggiornare automaticamente un profilo personale senza simulazione.

## Avvio isolato

Estrarre tutta la cartella del ramo, mantenendo HTML, moduli JS e `histories/int004` insieme. Usare un profilo browser di prova separato. Dalla cartella avviare `python -m http.server 8000 --bind 127.0.0.1` e aprire localmente `Trading_Analytics_v0.2U-rc5_TA-INT-004.html` tramite il server.

Il database incontri rc5 è separato da rc4. Il registro trade mantiene il namespace precedente: il profilo di prova impedisce di confondere il collaudo con un registro reale. Non cancellare cache o dati del profilo operativo per eseguire una prova.

## Caso AUDIT e importazione ripetuta

Caricare da CSV le due righe seguenti, scegliendo Serie B e 2025/26 se richiesto:

```csv
Div,Season,Date,HomeTeam,AwayTeam,FTHG,FTAG,Phase
I2,2025/26,22/08/2025,Pescara,Cesena,1,3,regular
I2,2025/26,22/08/2025,Delfino Pescara,Cesena FC,1,3,1. Round
```

Attesi: un incontro, due club, FT 1–3, giornata 1, denominazioni originali nelle fonti. Reimportare lo stesso file: il conteggio non aumenta. Ricaricare ed esportare il backup: l'incontro resta unico. Modificare il risultato soltanto in un **nuovo file sintetico di prova**, non nell'archivio personale: l'importazione discordante deve produrre un conflitto, senza cambiare il risultato precedente.

## Riconciliazione di un archivio già importato

1. Conservare il backup originale. Aprire **Area tecnica → Backup e recupero JSON → Simula riconciliazione archivio**.
2. Esaminare prima/dopo e gli incontri interessati. Le righe non risolvibili rimangono conservate e segnalate; non vengono scelte arbitrariamente per alimentare le statistiche.
3. Premere **Scarica backup attuale**, controllare che il file sia stato salvato e attestare la verifica del download. Prima di questa attestazione la conferma non è abilitata.
4. Confermare la riconciliazione. Esportare il risultato e ricaricare la pagina, verificando gli stessi conteggi.
5. Provare **Ripristina situazione precedente**, ricaricare e confrontare il backup con quello precedente. L'Undo riguarda l'ultima operazione compatibile con la revisione: per più punti di recupero conservare backup distinti.

L'avvio non elimina più i doppioni salvati. Le viste possono escludere copie sicure dal conteggio e osservazioni irrisolte dal campione, mostrando un avviso, mentre il contenuto grezzo resta conservato. La riconciliazione persistente richiede la procedura esplicita.

## Backup originale della DIREZIONE

Nel profilo vuoto di collaudo selezionare il JSON originale del 26/10, senza modificarlo. La simulazione conservativa attuale contabilizza tutti i 28.544 input in 28.302 record, con due manuali recuperate e quattro osservazioni di calendario mantenute in revisione. Il precedente codice rc4 produceva 28.402: il nuovo rapporto identifica 100 copie ulteriori, da sottoporre all'AUDIT, e conserva i valori originali.

Confermare soltanto dopo aver esaminato il rapporto. Esportare, ricaricare e provare Undo. La copia personale non va caricata su GitHub o condivisa come allegato pubblico del rapporto.

## Pacchetti e matrici

In **Risultati e calendari → Copertura**, esaminare le righe di revisione della fonte prima di simulare l'integrazione. Il pacchetto JSON importabile contiene solo i record utilizzabili; il file `.review.json` affiancato conserva i dati contestati. Non importarlo come se fosse un archivio verificato.

Controllare I2_2025 (380 gare regolari), E2_2025 ed E3_2025 (conflitti aperti e playoff mancanti), e Championship 2024/25 (557 incontri, 552 nella classifica regolare). Distinguere FT in revisione, FT mancanti e soli HT assenti. Confrontare la data analizzata con risultati successivi: questi ultimi devono rimanere fuori dal campione.

## Test automatici riproducibili

```sh
node --test --test-reporter=tap tests/int004/identity.test.cjs
node -r ./tests/int004/load-rc5.cjs --test --test-reporter=tap tests/csv-import.test.cjs
python tests/int004/browser.py
python tests/int004/public-browser.py
python tests/int004/consultation-browser.py
node tests/int004/packet-contract.cjs
python tests/int004/backtest-contract.py
python tests/int004/today-backtest-browser.py
python tests/int004/operational-browser.py
python tests/int004/preservation.py
node tests/int004/check-readiness.cjs
```

L'ultimo comando registra attualmente **FAIL**, poiché manca l'integrazione operativa. Non rimuovere quelle asserzioni per rendere verde il collaudo.

Per T8, mantenere gli input e gli output fuori dal repository:

```sh
python tests/int004/private-backup.py --backup /percorso/privato/backup.json --private-output /percorso/privato/qa
node tests/int004/verify-private.cjs /percorso/privato/backup.json /percorso/privato/qa/restored-rc5.json /percorso/privato/qa
```

I conteggi attesi di T8 sono specifici del backup fornito. Il verificatore controlla ogni riga tramite la lineage e ogni valore originario; non si limita al numero finale.

## Backtest operativo e alias rapidi

Per la correzione urgente degli orari, caricare anche un calendario di prova con partite di oggi: un orario UTC verificabile futuro deve essere ammesso; orario trascorso, assente o privo di fuso verificabile deve restare escluso. Provare anche una gara di domani senza orario. Premere realmente **Esegui backtest** e **Aggiorna ricerca locale** nello Scanner. Consultare `CORREZIONE_ORARI_RC5.md` per la matrice sintetica riproducibile. Queste prove sono aggiuntive rispetto alla rc5 b379d6f.

1. Aprire **Strategie e backtesting** e scegliere **Campionato del backtest**. Verificare le otto voci di Mercato e tutti i preset. Provare condizioni solo casa, solo trasferta e su entrambi i lati.
2. Eseguire il Backtest con un campione pubblico importato. Verificare diagnostica, totale, pagine da 50, ricerca squadra ed export CSV: il file deve includere tutte le selezioni, anche quando è attiva una ricerca. Le quote sostitutive rimangono indicate come ipotetiche.
3. Aggiungere una partita manuale futura verificando lega e stagione. Deve entrare nella ricerca quando soddisfa la strategia, una sola volta se esiste già un calendario ufficiale compatibile. Nessun risultato dello stesso giorno o successivo deve qualificare la partita.
4. Aprire **Gestione squadre e alias → Correggi un nome in 3 passaggi**. Su soli nomi sintetici di prova selezionare nome errato e club corretto, attestare che siano la stessa società e simulare. Prima della conferma i dati devono restare identici. Chiudere e riaprire il pannello non deve cancellare i campi.
5. Confermare soltanto dopo aver esaminato il confronto, esportare, riaprire e provare Undo. Le associazioni fra Paesi diversi restano bloccate nel percorso rapido; le opzioni avanzate rimangono disponibili.

L’AUDIT deve esaminare anche il nuovo conteggio del backup e i conflitti degli storici, separatamente dalla regressione della UI. Il file `inputs/RISCONTRO_NUOVO_ZIP_RC4.md` riguarda la vecchia candidata: non è l’approvazione di questa consegna.
