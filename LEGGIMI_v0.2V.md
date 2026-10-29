# Trading Analytics v0.2V-rc1 — candidata TA-V02V-001

Aprire **Trading_Analytics_v0.2V-rc1_TA-V02V-001.html** mantenendo accanto tutti i moduli `.js`, il CSS e la cartella `histories`. Il solo HTML non costituisce il pacchetto completo.

## Avvio e collaudo Windows
1. Estrarre tutto lo ZIP in una nuova cartella, conservando le precedenti versioni e i backup originali.
2. Preferire un profilo browser separato. Con Python installato, aprire un terminale nella cartella estratta ed eseguire `py -m http.server 8000`.
3. Aprire `http://localhost:8000/Trading_Analytics_v0.2V-rc1_TA-V02V-001.html` in Chrome/Edge. Il cambio di origine o porta può mostrare un archivio distinto: utilizzare l'importazione guidata, senza cancellare i dati precedenti.
4. In Area tecnica → Backup e recupero JSON selezionare una **copia** del backup; esaminare la simulazione, confermare soltanto se corretta. Il file originale non viene riscritto.
5. La Dashboard apre Calendario generale, Centro Analisi, Scanner, Strategie. Nel Centro Analisi scegliere Analisi partita oppure Comparatore squadre.
6. Calendario: comporre Paese, competizione, stagione, fase/giornata, date, squadra/alias, stato e watchlist; aprire una riga per la stessa gara canonica. ★ salva soltanto una preferenza locale.
7. Comparatore: impostare indipendentemente i due lati, anche con stagioni diverse. «Tutto storico» e date si compongono; casa/trasferta escludono le sedi esplicitamente neutre. «Inverti» scambia anche tutti i filtri. Il perimetro «tutte le competizioni ufficiali» esclude amichevoli dichiarate e competizioni non qualificate dal registro/metadati; queste restano consultabili singolarmente e nel calendario. Nessuna gara ipotetica genera un pronostico.
8. Analisi partita: le schede rc5 sono conservate. Sopra compaiono ultime 5 del contesto reale, ultime 10 totali, H2H, riposo e letture numeriche separate. Il giorno della gara è escluso; per il futuro si usano solo risultati fino a ieri.
9. Chiudere e riaprire: verificare watchlist, ordine/pin dei Paesi, filtri e «Riprendi ultima analisi». Esportare periodicamente l'archivio e il diario trade con i rispettivi comandi rc5.
10. Copertura storici: il prospetto completo viene calcolato **quando viene aperto** in Area tecnica. La Dashboard non esegue aggiornamenti remoti o scansioni segnali all'avvio. Gli aggiornamenti manuali restano disponibili.

Il browser con `file://` e Windows nativo richiedono il collaudo indipendente: i test Codex sono su Chromium/Linux via HTTP. Nessun merge, release stabile o deploy autorizzato da questa candidata. Le ricevute finali del commit esatto sono collegate nella nuova PR dedicata all'issue #5; i file QA presenti nella baseline descrivono soltanto la rc5 precedente.
