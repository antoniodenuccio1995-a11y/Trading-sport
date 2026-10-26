# TA-CSV-001 — Collaudo operativo indipendente

## Apertura della candidata

1. Usare il ramo `fix/ta-csv-001-import-storici`, senza sostituire la v0.2T originale. La candidata non è stabile.
2. Prima di usare archivi propri, esportare dalla versione attuale **sia il backup degli incontri sia quello del registro trade** e conservarli fuori dalla cartella del progetto.
3. Per il primo collaudo usare un profilo browser separato, privo di archivi personali. Non utilizzare i pulsanti di cancellazione o ripristino sull'archivio operativo.

   Due versioni servite con lo stesso protocollo, host e porta nello stesso profilo condividono IndexedDB: cambiare solo il nome dell'HTML o la cartella non isola gli archivi. Il profilo separato è quindi necessario per un collaudo senza dati personali.
4. Tenere `Trading_Analytics_v0.2U-rc1_TA-CSV-001.html` e `ta-csv-import.js` **nella stessa cartella**. Il percorso collaudato usa il server locale. L'apertura diretta `file://` non è stata verificata: Chromium di questo ambiente la blocca con `ERR_BLOCKED_BY_ADMINISTRATOR`. Chrome/Edge su Windows richiedono il collaudo del revisore.
5. Dalla cartella del repository eseguire `python -m http.server 8000 --bind 127.0.0.1` e aprire il documento candidato sul server locale. Non è un sito pubblico. Non aggirare i blocchi amministrativi del browser.

## Importazione manuale

1. Aprire **Dati → Area import**. Il controllo «CSV storico scaricato manualmente» accetta i file e prepara l'anteprima; il suo pulsante non salva più immediatamente.
2. Scegliere la lega e, per il mandato, la stagione **2024/25** oppure **2025/26**. Lasciare Auto solo quando si vogliono conservare tutte le stagioni indicate nel file o ricavate dalle date.
3. Premere **Importa i CSV selezionati**. In alternativa aprire **Importa CSV scaricati** e selezionare direttamente i file: ogni scheda consente di scegliere lega e stagione.
4. Controllare l'anteprima con le scelte attuali: incontri importabili, righe non valide, risultati mancanti, gare fuori stagione e dati HT mancanti. I conteggi superiori descrivono il CSV sorgente; quelli dell'anteprima riflettono il filtro scelto.
5. Se `Div`/`League` è sconosciuto o assente, selezionare esplicitamente la lega. Se un codice conosciuto indica un'altra lega, correggere la scelta o il file alla fonte: il programma blocca l'assegnazione contraddittoria.
6. Per gare di giugno/luglio assegnate a una stagione diversa dal criterio automatico luglio–giugno, controllare la stagione della competizione e spuntare la conferma richiesta. Senza conferma non vengono importate.
7. Premere **Importa file verificati** e leggere il resoconto. Le righe senza risultato completo non sono importate come risultati storici; le gare di un file dichiarato calendario restano future. HT assente non significa 0–0.
8. Reimportare lo stesso file: il totale deve restare invariato. Un risultato diverso per la stessa gara deve essere segnalato e il risultato precedente conservato.
9. In **Classifiche**, selezionare lega e stagione: confrontare il numero delle gare con il resoconto e alcuni risultati con il CSV. Nei moduli di analisi verificare che siano disponibili le squadre e i dati della stagione. Le classifiche sono ricostruite dai CSV, non certificate dalle federazioni.
10. Esportare il backup JSON, ricaricare la pagina e verificare i conteggi. Solo nel profilo di test verificare ripristino e registro trade. Un backup del registro trade è distinto dal backup degli incontri.

## Formati

- Football-Data: `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,...` (incluse le 131 colonne della utility).
- Extra: `Country,League,Season,Date,Home,Away,HG,AG,...`.
- Cache: `Date,Team 1,FT,HT,Team 2`.
- Normalizzati: alias senza distinzione di maiuscole, per esempio `league,season,match_date,home_team,away_team,home_goals,away_goals`.
- Date: ISO `YYYY-MM-DD`, europee `DD/MM/YYYY` o `DD/MM/YY`, punti equivalenti e mesi inglesi espliciti della cache. Non si indovina il formato numerico statunitense.
- Stagione: `2024/25`, `2024/2025`, `2024-2025`, `2425` oppure anno iniziale `2024`.

Gli alias squadra non sono esaustivi: controllare nomi diversi tra fonti. Se lo stesso incontro è già archiviato sotto una lega errata, la candidata segnala il caso ma non elimina le copie automaticamente.

## Riproduzione dei test

Requisiti verificati: Node 24, Python 3.12, Playwright Python 1.62.0, Chromium di sistema. Il progetto non richiede dipendenze npm. Su una macchina senza Playwright installarlo in un ambiente Python di test e installare Chromium seguendo le istruzioni ufficiali di Playwright; qui è già disponibile `/usr/bin/chromium`.

Eseguire dalla radice del checkout:

```sh
node --test tests/csv-import.test.cjs
python tests/fetch-sources.py --output /tmp/ta-csv-001-sources
python tests/browser-regression.py --sources /tmp/ta-csv-001-sources
```

Il download usa HTTPS verificato e solo sorgenti pubbliche. Il test browser avvia un server locale su porta libera, blocca le richieste esterne e usa esclusivamente contesti temporanei, poi chiude il proprio server. Non accede al profilo personale. Le risposte reali sono lette dai CSV scaricati, non simulate. I risultati cambiano se la fonte aggiorna i file: confrontare SHA-256 e conteggi con `qa/TA-CSV-001-sources.json` e `qa/TA-CSV-001-browser.json`.

Una passata del test riscrive gli artefatti QA locali: esaminare le differenze, senza considerare automaticamente la nuova sorgente identica al campione verificato. Non disabilitare TLS o CORS; i limiti del download diretto sono distinti dal collaudo dell'importazione manuale.
