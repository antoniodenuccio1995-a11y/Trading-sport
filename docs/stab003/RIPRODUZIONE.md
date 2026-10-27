# Riproduzione dei controlli

Requisiti: Python 3, Node.js e Chromium; per i test browser, Playwright Python e Node. In questo ambiente Chromium è `/usr/bin/chromium`. Le prove creano profili isolati e non impiegano l'archivio di un browser personale.

## Prove locali senza dati personali

```sh
node --test --test-reporter=tap tests/stab003/core.test.cjs
node -r ./tests/stab003/load-rc4.cjs --test tests/csv-import.test.cjs
python tests/stab003/parse-football.test.py
python tests/stab003/preservation.py
python tests/stab003/run-synthetic.py
python tests/stab003/csv-identity-browser.py
python tests/stab003/run-independent.py --label independent
```

Il runner di regressione CSV richiede i 16 sorgenti Football-Data già documentati in `qa/stab003/csv-regression.json`, nella cartella `/tmp/ta-csv-001-sources`. Eseguire `python tests/stab003/run-regressions.py`. I runner adattano percorsi e pannelli indipendenti; conservano le asserzioni sui dati. Il tempo di attesa della simulazione JSON è portato a 60 secondi per il dataset popolato, e viene attesa l'inizializzazione dell'Area tecnica. Le denominazioni grezze sono confrontate anche attraverso `HistOriginalHome/Away`, dove il collegamento esplicito alle identità dell'archivio le conserva.

I vecchi test AUDIT sono eseguiti dallo stesso autore della modifica: costituiscono regressioni, non una nuova approvazione indipendente. IND-07 resta ERROR per blocco amministrativo del protocollo `file://`; non viene convertito in PASS. Le prove HTTP usano il normale server locale.

## Prove con gli allegati riservati

Il repository non include il backup personale né copie dei CSV caricati dall'utente. Conservare gli originali in una directory privata esterna al repository, e usare un'altra directory privata per i risultati. Il file `csv-list.json` deve contenere un array con i percorsi dei sette CSV.

```sh
python tests/stab003/real-backup.py --backup /percorso/privato/backup.json --private-output /percorso/privato/qa --csv-list /percorso/privato/csv-list.json
node tests/stab003/verify-private.cjs /percorso/privato/backup.json /percorso/privato/qa/restored-backup.json /percorso/privato/qa
node tests/stab003/recover-private.cjs /percorso/privato/backup.json /percorso/privato/qa
node tests/stab003/verify-private.cjs /percorso/privato/backup.json /percorso/privato/qa/PROPOSTA_backup_integrato_TA-STAB-003.json /percorso/privato/qa
python tests/stab003/proposal-browser.py --proposal /percorso/privato/qa/PROPOSTA_backup_integrato_TA-STAB-003.json --private-output /percorso/privato/qa
node tests/stab003/export-matrices.cjs /percorso/privato/backup.json /percorso/privato/qa
```

Il runner reale ha asserzioni specifiche sul backup ricevuto: per altri backup occorre aggiornare i conteggi attesi e non far passare per equivalente una prova diversa. Il verificatore controlla ogni record originale, i valori non vuoti, le quote, le denominazioni e le partite manuali; ammette un incontro consolidato soltanto con la stessa identità o gli ID precedenti conservati nei metadati. I rapporti dettagliati e i JSON integrati restano nella directory privata. Nel repository entrano soltanto riepiloghi aggregati e matrici prive dei record personali.

## Ricostruzione del catalogo pubblico

I pacchetti `histories/stab003` inclusi sono la fotografia verificata, utilizzabile senza un nuovo download. `ta-history-manifest.js` ne dichiara URL e SHA-256; la UI verifica l'hash prima dell'anteprima.

Per ricostruire il catalogo, acquisire i sorgenti con `python tests/stab003/fetch-sources.py`, poi eseguire `node tests/stab003/prepare-fd.cjs`. Il builder richiede inoltre il checkout di `https://github.com/oladeeayo/open-matchday` al commit `5bab54301722564438c8070b70b446271e639637` in `/tmp/ta-stab003-matchday`. Eseguire `python tests/stab003/build-history.py`. `ta-source-evidence.js` contiene le prove pubbliche delle identità Paris e il dizionario estratto dalla stessa revisione; non contiene righe selezionate dal backup personale.

I sorgenti Football-Data e i rami master OpenFootball sono mobili: un nuovo download può produrre nuovi hash e non riproduce necessariamente la fotografia del 27/10. Non sostituire silenziosamente i pacchetti durante una revisione; confrontare gli hash, rieseguire QA e produrre una nuova candidata. Il rigeneratore non accede a input personali. I disaccordi tra fonti sono marcati `HistSourceConflict` e vengono bloccati dall'importatore.
