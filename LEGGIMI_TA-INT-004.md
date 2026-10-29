# Trading Analytics v0.2U-rc5 — candidata TA-INT-004

**Candidata consolidata del 29/10/2026:** include la correzione della reimportazione JSON e quella del Backtest con gare di oggi. Estrarre **tutto il nuovo ZIP** in una cartella separata: il nuovo fix è nei moduli JavaScript, aggiornare soltanto l’HTML non basta. Il commit definitivo, lo ZIP verificato e il rapporto del collaudo completo eseguito da copia pulita sono collegati nella PR #4.

[QA consolidato e procedura completa](docs/int004/QA_CONSOLIDATO_2026-10-29.md). Le evidenze sul commit definitivo sono pubblicate separatamente dal codice affinché contengano il suo SHA esatto; il riferimento nella PR identifica una sola candidata.

**Correzione urgente dopo b379d6f:** risolto l'errore `safeKickoffFuture is not defined` del Backtest quando sono presenti gare di oggi. Estrarre il nuovo ZIP in una cartella separata per conservare la candidata precedente. L'HTML mantiene lo stesso nome; i moduli applicativi adiacenti sono invariati. Il nuovo AUDIT resta necessario. [Dettagli e test](docs/int004/CORREZIONE_ORARI_RC5.md).

Questa è una candidata per collaudo indipendente. Non è una versione stabile e non aggiorna automaticamente la copia che stai usando.

## Avvio su Windows

1. Estrai **tutto lo ZIP**, mantenendo HTML, moduli JavaScript e cartelle nella stessa struttura. Conserva le versioni precedenti e i backup originali.
2. Apri il terminale nella cartella che contiene questo file. Con Python disponibile esegui:

   ```text
   py -m http.server 8000 --bind 127.0.0.1
   ```

   Se usi il comando `python`, puoi sostituirlo a `py`.
3. In un profilo browser separato per il collaudo, apri `http://127.0.0.1:8000/Trading_Analytics_v0.2U-rc5_TA-INT-004.html`.

Non basta aprire soltanto l'HTML con doppio clic: il collaudo è stato eseguito via HTTP. Se la porta 8000 è già occupata, usa una porta libera senza interrompere il gestionale operativo. Browser, profilo e indirizzo diversi hanno archivi diversi: una schermata vuota non implica che il vecchio archivio sia stato cancellato.

## Cosa provare

- Il caso Pescara/Delfino Pescara e Cesena/Cesena FC deve produrre **una partita e due club**, anche dopo reimportazione e riapertura.
- In **Strategie e backtesting**, verifica Mercato, preset, condizioni solo casa o solo trasferta, lista completa, ricerca, pagine ed export CSV.
- In **Area tecnica → Gestione squadre e alias**, verifica il percorso rapido con consenso e simulazione prima della conferma.
- In **Backup e recupero JSON**, verifica anteprima, backup, conferma e ripristino. Non modificare manualmente il JSON originale.
- In **Risultati e calendari → Copertura**, controlla stati e revisioni: le 138 combinazioni non sono tutte complete.

I test hanno verificato integralmente i valori del backup fornito. Il nuovo recupero conserva 28.302 righe, rispetto alle 28.402 rc4, per 100 consolidamenti ulteriori documentati; quattro osservazioni irrisolte rimangono nei dati. Non applicare questa differenza al profilo personale senza il collaudo e la revisione previsti.

## Rapporti

- [Stato e risultati](TA-INT-004.md)
- [QA e limiti](docs/int004/QA.md)
- [Istruzioni dettagliate](docs/int004/COLLAUDO.md)
- [Matrice dei 138 pacchetti](docs/int004/MATRICE_PACCHETTI.csv)
- [Integrazione della versione Windows](docs/int004/INTEGRAZIONE_OPERATIVA.md)

I test dell'autore sono eseguiti su Chromium Linux; il collaudo Windows nativo e il nuovo AUDIT indipendente restano da svolgere. Nessun backup personale o archivio recuperato è incluso nel pacchetto pubblico. Nessun merge su `main` o deploy stabile.
