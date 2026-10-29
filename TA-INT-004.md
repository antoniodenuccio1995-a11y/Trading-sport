# TA-INT-004 — v0.2U-rc5, candidata per revisione indipendente

**Ripresa e consolidamento del 29/10:** corretto il FAIL di reimportazione del backup reale descritto nel [commento vincolante della DIREZIONE](https://github.com/antoniodenuccio1995-a11y/Trading-sport/pull/4#issuecomment-6491569703). Il codice conserva la correzione del Backtest c6d9aa4. Il collaudo completo viene eseguito di nuovo da copia pulita dell’esatto commit consegnato: fa fede il rapporto finale collegato nella PR #4, non i precedenti rapporti PASS. [Diagnosi e matrice del nuovo ciclo](docs/int004/QA_CONSOLIDATO_2026-10-29.md).

**Correzione urgente successiva a `b379d6f`:** risolto `safeKickoffFuture is not defined` nel Backtest con partite di oggi. La funzione degli orari è condivisa con lo Scanner, senza duplicazioni. [Diagnosi, prove prima/dopo e limiti](docs/int004/CORREZIONE_ORARI_RC5.md). Il precedente collaudo non copriva questo percorso: è aggiunto un test del pulsante effettivo con gare di oggi e domani.

**Stato: sviluppo integrato e collaudato; approvazione indipendente e rilascio stabile ancora aperti.** Backtest, Mercato e alias operativi sono integrati con il nuovo motore di identità. Nessun merge su `main`, deploy o aggiornamento automatico dell'archivio personale.

Il pacchetto operativo è stato acquisito dagli allegati del 28 ottobre 2026. Il suo SHA-256 `559e6504d5fe3d45ce4378ca91c47865f036c4ab6c3c09d708ec5960e53cb1ca` coincide con quello del rapporto indipendente. I 314 file rc4 conservati nel pacchetto coincidono con la baseline Git. Il precedente impedimento di acquisizione è risolto; le modifiche sono state integrate selettivamente senza sostituire i file precedenti.

## Risultati verificati

- Riprodotto il caso Pescara–Cesena sulla rc4: due righe, due incontri, quattro club. Con il nuovo motore: un incontro, due club, provenienze conservate.
- Identità condivisa fra recupero JSON, CSV, proiezione statistica e copertura, con competizione, stagione, data, club canonici, eventi qualificati per fonte, contesto sportivo, ripetizioni, andate/ritorni e orari quando verificabili.
- Numeri di giornata separati dalle fasi. Conflitti di risultati, statistiche, orari o identità rimangono in revisione. I risultati non sono una prova di identità.
- Avvio e consultazione non eliminano più righe salvate. La riconciliazione persistente richiede anteprima, backup, verifica del download e conferma, con Undo atomico. Le importazioni nuove non riparano silenziosamente gruppi già presenti.
- Scansione completa dei 138 pacchetti, preservando tutti gli originali. I pacchetti della candidata separano le righe in revisione e non le importano automaticamente.
- T8 eseguito sul backup personale originale: tutti i 28.544 record e 172.964 valori di quota non vuoti contabilizzati; due manuali conservate. La nuova diagnosi trova ulteriori copie rispetto alla rc4: il conteggio non viene forzato artificialmente a 28.402.

- Backtest operativo integrato: otto mercati, preset, condizioni su un solo lato, diagnostica, lista completa paginata, ricerca ed export CSV. Verificati 144 confronti indipendenti su due stagioni di Serie A e La Liga, più il campione Serie B (153 selezioni attese ed effettive). I sei preset coincidono con gli oracoli pubblici, conservando i conteggi 158 HT / 98 Over 1.5 / 51 Over 2.5 dell’AUDIT precedente. Le manuali future usano l’identità condivisa e soltanto risultati anteriori al giorno analizzato.
- Alias rapidi conservati e provati nel browser: consenso, simulazione senza scritture, conferma atomica, persistenza e Undo; i controlli dei Paesi e le opzioni avanzate restano disponibili.
- Backup originale: nuovo conteggio conservativo **28.302**, rispetto ai 28.402 rc4, per 100 consolidamenti ulteriori documentati. Quattro osservazioni irrisolte rimangono conservate. La variazione richiede esame indipendente.

## Esiti distinti delle matrici

| Perimetro | Complete verificate | Parziali | Non verificabili |
|---|---:|---:|---:|
| Pacchetti pubblici riconciliati, 138 combinazioni | 17 | 92 | 29 |
| Proposta privata rc4 da 35.022 righe, rivalutata con nuove identità e fonti | 14 | 95 | 29 |
| Backup originale, senza nuove integrazioni | 11 | 98 | 29 |

I precedenti **17/92/29 attribuiti alla proposta privata rc4 sono quindi superati**. L'uguaglianza numerica con gli stati dei pacchetti pubblici è casuale: si tratta di perimetri diversi. I dati personali non sono stati modificati e le matrici pubbliche relative agli archivi contengono soltanto aggregati.

## File e documenti

- Candidata: `Trading_Analytics_v0.2U-rc5_TA-INT-004.html`, da aprire via HTTP locale in un profilo browser di prova, estraendo tutto il pacchetto. Non è un aggiornamento automatico del browser personale.
- [Integrazione operativa e sorgenti acquisiti](docs/int004/INTEGRAZIONE_OPERATIVA.md)
- [Diagnosi](docs/int004/DIAGNOSI.md)
- [Duplicazioni, copertura e limiti](docs/int004/DUPLICAZIONI.md)
- [Rapporto QA e blocchi](docs/int004/QA.md)
- [Changelog provvisorio](docs/int004/CHANGELOG.md)
- [Istruzioni di collaudo](docs/int004/COLLAUDO.md)
- [Matrice dei pacchetti](docs/int004/MATRICE_PACCHETTI.csv)
- [Rivalutazione della proposta rc4, soli aggregati](docs/int004/MATRICE_PROPOSTA_RC4_AGGREGATI.csv)
- [Archivio originale, soli aggregati](docs/int004/MATRICE_ORIGINALE_AGGREGATI.csv)

Il ramo dedicato parte da rc4 `242a15efae0ab64fd851335354c40c750d2d2e95`. Tutti i file delle versioni precedenti sono preservati; nessun merge su main o deploy stabile. Il nuovo AUDIT indipendente è ancora da svolgere. I test sono eseguiti su Chromium Linux via HTTP, non su Windows o `file://`. La consegna non equivale al recupero completo di tutte le stagioni o all’approvazione stabile.
