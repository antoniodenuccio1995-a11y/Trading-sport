# Collaudo provvisorio TA-INT-004

**Non sostituire la versione Windows operativa.** Questo ramo consente per ora di collaudare identità e archivi; l'integrazione del Backtest e degli alias semplificati è bloccata dall'assenza dei file operativi.

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
node --test tests/int004/identity.test.cjs
node -r ./tests/int004/load-rc5.cjs --test tests/csv-import.test.cjs
python tests/int004/browser.py
python tests/int004/public-browser.py
python tests/int004/consultation-browser.py
node tests/int004/packet-contract.cjs
python tests/int004/backtest-contract.py
```

L'ultimo comando registra attualmente **FAIL**, poiché manca l'integrazione operativa. Non rimuovere quelle asserzioni per rendere verde il collaudo.

Per T8, mantenere gli input e gli output fuori dal repository:

```sh
python tests/int004/private-backup.py --backup /percorso/privato/backup.json --private-output /percorso/privato/qa
node tests/int004/verify-private.cjs /percorso/privato/backup.json /percorso/privato/qa/restored-rc5.json /percorso/privato/qa
```

I conteggi attesi di T8 sono specifici del backup fornito. Il verificatore controlla ogni riga tramite la lineage e ogni valore originario; non si limita al numero finale.
