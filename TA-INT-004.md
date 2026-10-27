# TA-INT-004 — Lavorazione provvisoria, non pronta per il nuovo AUDIT

**Stato: INCOMPLETO / BLOCCATO SULLA BASELINE OPERATIVA.** Il codice di identità, la riconciliazione e la scansione dei pacchetti sono disponibili per esame tecnico. L'ultima versione Windows con Backtest e alias semplificati e il file `RISCONTRO_NUOVO_ZIP_RC4.md` non sono ancora stati acquisiti. L'accesso alla cartella Drive indicata è respinto dalla rete cloud con `Tunnel connection failed: 403 Forbidden`. Non è stata raggiunta la cartella: non si attribuisce il problema ai permessi dei singoli file.

La bozza di configurazione aggiunge `drive.google.com` e `drive.usercontent.google.com`, preservando gli altri domini. Il salvataggio della bozza non attiva la rete nell'istanza. Servono l'attivazione nelle impostazioni dell'ambiente oppure gli allegati diretti dello ZIP operativo e del rapporto AUDIT. Nessuna credenziale viene richiesta in chat.

## Lavoro già eseguito

- Riprodotto il caso Pescara–Cesena sulla rc4: due righe, due incontri, quattro club. Con il nuovo motore: un incontro, due club, provenienze conservate.
- Identità condivisa fra recupero JSON, CSV, proiezione statistica e copertura, con competizione, stagione, data, club canonici, eventi qualificati per fonte, contesto sportivo, ripetizioni, andate/ritorni e orari quando verificabili.
- Numeri di giornata separati dalle fasi. Conflitti di risultati, statistiche, orari o identità rimangono in revisione. I risultati non sono una prova di identità.
- Avvio e consultazione non eliminano più righe salvate. La riconciliazione persistente richiede anteprima, backup, verifica del download e conferma, con Undo atomico. Le importazioni nuove non riparano silenziosamente gruppi già presenti.
- Scansione completa dei 138 pacchetti, preservando tutti gli originali. I pacchetti provvisori separano le righe in revisione e non le importano automaticamente.
- T8 eseguito sul backup personale originale: tutti i 28.544 record e 172.964 valori di quota non vuoti contabilizzati; due manuali conservate. La nuova diagnosi trova ulteriori copie rispetto alla rc4: il conteggio non viene forzato artificialmente a 28.402.

## Esiti distinti delle matrici

| Perimetro | Complete verificate | Parziali | Non verificabili |
|---|---:|---:|---:|
| Pacchetti pubblici riconciliati, 138 combinazioni | 17 | 92 | 29 |
| Proposta privata rc4 da 35.022 righe, rivalutata con nuove identità e fonti | 14 | 95 | 29 |
| Backup originale, senza nuove integrazioni | 11 | 98 | 29 |

I precedenti **17/92/29 attribuiti alla proposta privata rc4 sono quindi superati**. L'uguaglianza numerica con gli stati dei pacchetti pubblici è casuale: si tratta di perimetri diversi. I dati personali non sono stati modificati e le matrici pubbliche relative agli archivi contengono soltanto aggregati.

## File e documenti

- Prototipo per test di identità/archivi: `Trading_Analytics_v0.2U-rc5_TA-INT-004.html`. **Non sostituire con questo prototipo la versione Windows operativa.**
- [Diagnosi](docs/int004/DIAGNOSI.md)
- [Duplicazioni, copertura e limiti](docs/int004/DUPLICAZIONI.md)
- [Rapporto QA e blocchi](docs/int004/QA.md)
- [Changelog provvisorio](docs/int004/CHANGELOG.md)
- [Istruzioni di collaudo](docs/int004/COLLAUDO.md)
- [Matrice dei pacchetti](docs/int004/MATRICE_PACCHETTI.csv)
- [Rivalutazione della proposta rc4, soli aggregati](docs/int004/MATRICE_PROPOSTA_RC4_AGGREGATI.csv)
- [Archivio originale, soli aggregati](docs/int004/MATRICE_ORIGINALE_AGGREGATI.csv)

Il ramo dedicato parte da rc4 `242a15efae0ab64fd851335354c40c750d2d2e95`. Tutti i file delle versioni precedenti sono preservati; nessun merge su main o deploy stabile. Il nuovo AUDIT indipendente e l'integrazione operativa sono prerequisiti ancora aperti.
