# Diagnosi TA-INT-004

## Riproduzione del FAIL

Sulla rc4 originale le due rappresentazioni del 22/08/2025, Serie B 2025/26, Pescara–Cesena 1–3 e Delfino Pescara–Cesena FC 1–3, vengono accettate come due incontri e quattro club. Il test riproducibile è in `qa/int004/baseline-audit-reproduction.json`. È un difetto confermato della rc4, non un problema di utilizzo del file da parte della DIREZIONE.

Due cause si combinano:

1. Il registro non comprendeva queste equivalenze esplicite. Il ponte tra nomi del confronto di copertura dipendeva dall'archivio esistente e non costituiva un'identità comune per importazione in archivio vuoto, calendario e statistiche.
2. Il parser dei pacchetti conservava `1. Round`, `2. Round` come valori di fase. Il builder considerava secondarie soltanto le gare con fase esattamente `regular`: le righe con un numero di giornata superavano il controllo e venivano aggiunte come presunte gare ulteriori.

Una terza criticità riguardava gli archivi esistenti: l'avvio usava un indice `Map` e poteva riscrivere il database dopo il consolidamento. La candidata mantiene le righe salvate inalterate finché non viene confermata una riconciliazione.

## Nuovo contratto d'identità

`ta-fixture-identity.js` definisce competizione canonica, stagione, giorno, club, fase, giornata, girone, numero di andata/ritorno, eventuale ripetizione, stato e identificativi qualificati della fonte. La ricerca dei candidati parte dalla stessa competizione/stagione/data e dai due club canonici; la compatibilità sportiva e gli identificativi affidabili decidono poi se si tratta della stessa gara, di gare distinte o di un conflitto.

Due codici diversi di un medesimo provider identificano eventi distinti. Codici uguali usati con date o contesti incompatibili producono un conflitto. Gli identificativi dei diversi provider sono conservati come coppie provider/codice, non come codici anonimi intercambiabili. Le copie prive di codice non vengono assegnate arbitrariamente quando esistono più eventi compatibili.

Il risultato non compare fra le prove di identità. Una divergenza FT, HT, tiri o quote impedisce la fusione automatica; vengono conservate le osservazioni originali. Gli orari con UTC o offset esplicito possono essere confrontati come istanti. Gli orari non riconciliabili rimangono in revisione; non si deduce un fuso orario soltanto dal Paese. Il passaggio da calendario non disputato a risultato può aggiornare l'osservazione dell'orario, preservando entrambe le fonti.

Un numero di giornata è un attributo, non una fase aggiuntiva. Le fasi finali vengono normalizzate solo per competizioni/contesti documentati. Per i tornei a più fasi un semplice `1. Round` non basta per attribuire la gara a stagione regolare o girone successivo. Le vere gare di playoff/playout e le ripetizioni esplicite restano distinte.

## Club e denominazioni

Il catalogo usa record pubblici espliciti di OpenFootball Clubs, fissati al commit `ae3800227c449447b3a337fc0aac79a8f02f4c8b`, più equivalenze già documentate e la distinzione del club moderno Cesena FC. Le fonti, hash, alias ambigui e omissioni sono in `qa/int004/club-catalog.json`. Non si usano distanze fra stringhe o rimozioni generiche di `FC`, `United`, `City` per fondere club.

Le entità storiche chiuse sono escluse dalle nuove associazioni automatiche: AC Cesena 1940–2018 e VfB Leipzig non vengono confusi con Cesena FC e RB Leipzig. I club gallesi del sistema inglese hanno associazioni documentate; non vengono confusi Paese del club e competizione nazionale.

I vecchi identificativi generati dal nome possono essere collegati a un alias documentato soltanto in un contesto univoco e vengono mantenuti in `ClubHomeLegacyIds`/`ClubAwayLegacyIds`. Gli identificativi forti o le decisioni esplicite dell'utente non vengono sostituiti per la sola somiglianza del nome. Una contraddizione fra un codice del provider e un club già documentato resta verificabile.

Le denominazioni originali, fasi, orari e provenienze sono conservati nei metadati e nelle osservazioni di fonte. La serializzazione è idempotente; non si inventano nuove provenienze a ogni riapertura.

## Archivi salvati e statistiche

La memoria conserva i record grezzi. Le viste analitiche usano una proiezione canonica con un solo incontro per gruppo sicuro; i gruppi irrisolti sono segnalati ed esclusi dal campione, senza cancellarli dall'archivio. Importare altri dati non autorizza a riparare automaticamente le copie già presenti.

La procedura di riconciliazione mostra prima/dopo e gli incontri interessati, mantiene integralmente le righe non risolvibili, richiede backup e conferma e usa la transazione atomica con Undo. I risultati annullati o abbandonati esplicitamente etichettati non alimentano le statistiche.

Le formule di valutazione, i voti 0–100 e le regole del registro trade restano invariati. Correggere il campione può cambiare i valori osservati; non equivale a modificare il modello. Backtest e alias rapidi sono integrati selettivamente dal pacchetto acquisito il 28 ottobre. Confronto e prove sono in `INTEGRAZIONE_OPERATIVA.md`.

## Casi rappresentativi, riga per riga

| Osservazione sorgente | Contesto letto | Trattamento verificato |
|---|---|---|
| 22/08/2025, Pescara–Cesena 1–3, `regular` | Serie B 2025/26, club documentati, stagione regolare | Incontro canonico unico |
| 22/08/2025, Delfino Pescara–Cesena FC 1–3, `1. Round` | Gli stessi club; giornata 1, stagione regolare | Integrata nello stesso incontro; denominazioni e fonti conservate |
| Stessa fixture sintetica, FT discordante | Identità compatibile, risultato incompatibile | Conflitto, senza sovrascrittura |
| Due fixture sintetiche, codici diversi dello stesso provider | Eventi distinti affidabili | Due incontri anche in calendario/scanner |
| Vera gara Championship 2024/25, `Finals, Final` | Playoff della competizione | Fra le 557 gare archiviate, fuori dalle 552 regolari |

I primi due casi sono riprodotti sia sull’HTML operativo originale sia sul nuovo importatore browser. `packet-lineage.json` riporta ciascun indice dei pacchetti pubblici; nessuna riga personale viene pubblicata.
