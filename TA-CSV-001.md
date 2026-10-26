# Trading Analytics — candidata TA-CSV-001

Questa revisione corregge l'importazione manuale degli storici CSV. **Non è una versione stabile.** La v0.2T originale resta nella radice senza modifiche.

Aprire `Trading_Analytics_v0.2U-rc1_TA-CSV-001.html` mantenendo `ta-csv-import.js` nella stessa cartella. Il ramo di revisione è `fix/ta-csv-001-import-storici`; non è stato effettuato merge su `main`.

- [Diagnosi tecnica e limiti del riscontro sulla utility](docs/TA-CSV-001_DIAGNOSI.md)
- [Changelog](docs/TA-CSV-001_CHANGELOG.md)
- [Rapporto QA](docs/TA-CSV-001_QA.md)
- [Istruzioni operative e riproduzione dei test](docs/TA-CSV-001_COLLAUDO.md)
- [Differenze HTML rispetto alla v0.2T](qa/TA-CSV-001-html.diff)
- [Risultati browser verificabili](qa/TA-CSV-001-browser.json)

I test non attestano la completezza federale delle stagioni né il funzionamento della utility esterna, di cui è stata fornita solo l'intestazione. Sono stati confrontati tutti gli incontri importabili presenti nei campioni ufficiali delle 16 combinazioni lega/stagione richieste. Per dettagli e conteggi consultare il rapporto QA.
