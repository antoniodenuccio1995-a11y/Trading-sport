# Integrazione selettiva della versione operativa

Materiali acquisiti dagli allegati il 28 ottobre 2026, conservati senza modificarli fuori dal repository. `qa/int004/operational-port.json` riporta hash e perimetro; `docs/int004/inputs` conserva mandato e riscontri pubblici. I documenti sono materiale di riferimento del mandato, non autorizzazione a pubblicare dati personali o a effettuare merge/deploy.

## Catena dei sorgenti

- ZIP operativo: SHA-256 `559e6504d5fe3d45ce4378ca91c47865f036c4ab6c3c09d708ec5960e53cb1ca`, identico al pacchetto indicato dall'AUDIT e alla copia annidata nel pacchetto complessivo.
- `RISCONTRO_NUOVO_ZIP_RC4.md`: SHA-256 `cc403b4ba681745973469ef884dddf38753ab0e91c889447a14340c4825a85b3`, identico nelle due copie fornite.
- Tutti i 314 file rc4 conservati nello ZIP operativo coincidono byte per byte con la baseline Git. Il nuovo HTML operativo e `ta-stab003-ui-FIX.js` sono aggiunte, non una diversa ricostruzione della rc4.

Le differenze originali ispezionate prima del port sono in `qa/int004/operational-html.diff` e `operational-alias-ui.diff`. Non sono state applicate indiscriminatamente all'intera candidata.

## Funzioni preservate e adattamenti

| Parte operativa | Integrazione rc5 | Evidenza |
|---|---|---|
| Mercato e preset | Le stesse otto opzioni, collegamenti ai preset e gestione leggibile delle strategie obsolete | `operational-browser.json` |
| Condizioni solo casa/trasferta | N precedenti soltanto per i lati richiesti; formule degli indicatori invariate | 144 confronti indipendenti e contratto Serie B |
| Risultati completi | Pagine da 50, ricerca, grafico, diagnostica e CSV di tutte le selezioni anche con ricerca attiva | Click e download reali nel browser |
| Calcoli delle operazioni | Aritmetica punta/banca, quota, stake e commissione preservata | Confronto indipendente di profitto e rischio |
| Campionato Backtest | Menu mantenuto e sincronizzato dopo importazione/cambio lega | Prova del controllo reale |
| Manuali future | Map locale sostituita dalla riconciliazione condivisa, coerente con calendario/scanner | Contratti sintetici e browser |
| Cutoff | Manuali valutate prima di inserire qualsiasi risultato dello stesso giorno; filtro stagione applicato anche al futuro | Osservazioni dello stesso giorno e successive |
| Alias rapidi | Passaggi, conferma atomica, controlli Paese e opzioni avanzate conservati; conferma vincolata alla propria simulazione | Preview senza scritture, salvataggio, reload e Undo |

Il Backtest legge la proiezione riconciliata. Una copia compatibile non è un secondo campione, mentre il record grezzo rimane conservato. I conflitti non alimentano arbitrariamente le statistiche.

## Riproduzione e regressione

`operational-input-reproduction.py` serve l'HTML originale dello ZIP in un profilo temporaneo, riproduce due incontri/quattro club, verifica la persistenza e la presenza del menu Mercato e degli alias rapidi. Non cambia i file forniti. `qa/int004/operational-input-reproduction.json` conserva l'esito.

`backtest-contract.py` mantiene le cinque asserzioni inizialmente fallite: ora sono PASS senza rimuoverle o trasformarle in fallimenti attesi. `operational-browser.py` amplia le prove con sorgenti pubblici indipendenti, filtri, export, aritmetica operativa e flusso alias. I sei preset sono confrontati con oracoli pubblici separati e conservano i conteggi 158 HT, 98 Over 1.5 e 51 Over 2.5 documentati dal precedente riscontro. Gli hash identificano la candidata collaudata.

Il nuovo AUDIT indipendente è ancora da svolgere. Le prove dell'autore non sostituiscono l'approvazione della DIREZIONE.
