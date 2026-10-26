# Consegna correttiva TA-DATA-002B · v0.2U-rc3

**Candidata tecnica per revisione, non stabile. Il criterio di accettazione sul backup reale non è ancora attestabile.**

La procedura JSON e la gestione delle squadre sono state corrette e collaudate. Gli allegati ricevuti contengono rapporti diagnostici e il codice rc2, non il backup delle partite. L'ultimo rapporto documenta 28 collisioni su 8.225 righe, mentre il mandato ne cita 40. Mancano i risultati e i metadati delle coppie: non è possibile certificarne la classificazione finale senza i record originali. Non è stato ricostruito o inventato un archivio personale a partire dai rapporti.

## File da aprire

`Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html`, con questi quattro moduli nella stessa cartella:

- `ta-csv-import-v02U-rc2.js`
- `ta-clubs-v2.js`
- `ta-json-recovery.js`
- `ta-data002b-ui.js`

Estrarre l'intero ZIP del ramo mantiene i file insieme. Il percorso HTTP è collaudato; `file://` è bloccato dalla policy del browser cloud. [Istruzioni operative](docs/data002b/COLLAUDO.md).

La rc3 usa un archivio partite separato dalla rc2 e non trasferisce dati automaticamente. Il registro trade mantiene lo stesso codice, archivio e fotografie congelate della rc2; il recupero JSON non lo legge né lo modifica. Conservare sempre la vecchia versione e i backup originali.

## Consegne

- [Diagnosi, disponibilità degli allegati e limite sulle collisioni reali](docs/data002b/DIAGNOSI.md).
- [Procedura guidata, gestione alias e collaudo](docs/data002b/COLLAUDO.md).
- [Integrità, transazioni e ripristino](docs/data002b/INTEGRITA.md).
- [Rapporto QA, regressioni e limiti](docs/data002b/QA.md).
- [Changelog](docs/data002b/CHANGELOG.md).
- [Mandato originale](docs/data002b/MANDATO.md).

Il dettaglio riga per riga ricavato dal rapporto ricevuto è mantenuto **fuori dal repository**, con risultati indicati come non disponibili. Nel repository sono presenti soltanto codice, aggregati diagnostici, test sintetici e verifiche su fonti pubbliche. Nessun allegato personale viene pubblicato.

Ramo: `fix/ta-data-002-identita-integrita`, in prosecuzione di `fb0ad33`. [PR in bozza #2](https://github.com/antoniodenuccio1995-a11y/Trading-sport/pull/2), senza merge su main e senza deploy stabile. Le versioni v0.2T, rc1, rc2 e le loro evidenze restano conservate.
