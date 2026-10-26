# TA-DATA-002 — Identità unica dei club

## Regole dell'identità

`ta-clubs-v1.js` è il registro condiviso. Gli ID sono opachi e permanenti: non vanno ricavati dai nomi visualizzati o modificati quando cambia una denominazione.

Per gli alias verificati esiste un ID esplicito versionato, per esempio `club:fra-psg`. L'elenco contiene i casi del mandato (PSG, Lyon, Inter, Manchester United, Sporting CP), gli alias già presenti nella baseline e ulteriori coppie esaminate esplicitamente nelle sorgenti. La loro evidenza è nel registro esportato. Monaco prevede esplicitamente i contesti FRA e MCO; non è una regola generica di equivalenza fra paesi.

Un nome non riconosciuto riceve un ID conservativo nel contesto nazionale e stato `da_verificare`. Se sono forniti **Provider e identificativo squadra**, il namespace del provider distingue gli omonimi e consente il confronto per codice esatto. Un codice senza provider resta non verificato e mantiene anche il nome nel namespace. Non viene inventato alcun codice della fonte. I club privi di identificativi affidabili possono richiedere ulteriori dati per distinguere omonimi esatti: il loro stato non viene elevato automaticamente a verificato.

Un'etichetta ambigua, come Manchester, Paris o Sporting, rimane separata dai possibili club. Lo stesso nome in contesti nazionali diversi non viene automaticamente unificato. FCSB e CSA Steaua, le due denominazioni di Craiova, Manchester City e United, PSG e Paris FC restano distinti nelle prove negative. Nessun join usa distanza testuale, rimozione generica di FC/AC o somiglianza dei token.

Per club non verificati omonimi con codici distinti, il nome mostrato include l'ID della fonte; nelle competizioni multinazionali può includere il paese dichiarato. Questo impedisce che i moduli preesistenti basati sui nomi li riaccorpino dopo aver distinto gli ID. Le denominazioni originali sono conservate separatamente.

Se un ID già salvato non coincide con la risoluzione di una versione successiva del registro, viene conservato e segnalato come ambiguo: non avviene una riassegnazione silenziosa. Una futura curation richiede revisione versionata e simulazione delle collisioni.

## Dati conservati

| Campo | Contenuto |
| --- | --- |
| `ClubHomeId` / `ClubAwayId` | ID permanente |
| `H` / `A` | Nome principale usato dai moduli |
| `ClubHomeRaw` / `ClubAwayRaw` | Nome originale della fonte, anche prima della normalizzazione degli spazi |
| `ClubHomeStatus` / `ClubAwayStatus` | verificata, da_verificare, ambigua |
| `ClubHomeSourceId` / `ClubAwaySourceId` | Codice della fonte, se presente; altrimenti null |
| `ClubHomeProvider` / `ClubAwayProvider` | Namespace del provider, se dichiarato |
| `ClubHomeSources` / `ClubAwaySources` | Provenienze e denominazioni accumulate senza eliminare quelle precedenti |
| `ClubHomeIdentityName` / `ClubAwayIdentityName` | Denominazione usata per mantenere la risoluzione stabile anche da etichette disambiguate |
| `ClubRegistryVersion` | Versione del registro |

I campi sono nell'oggetto `o` per conservare il formato compatto dei backup v2. Il compattatore della rc2 conserva **tutti i metadati JSON originali**, non soltanto un sottoinsieme di quote. Mantiene anche un eventuale Phase già dichiarato; non inventa fasi e non implementa nuove classifiche per fase.

## Integrazione

Il parser CSV e `canonicalMatch` attribuiscono le identità; `resultIdentity` usa ID, lega e data. Importazioni, aggiornamenti, calendario, statistiche, classifiche e scanner ricevono nomi principali coerenti e non formule nuove. La provenienza confronta gli stessi ID nel contesto nazionale. Le quote esistenti possono essere confrontate attraverso gli alias senza riscrivere gli originali. Il registro trade importa e conserva integralmente le fotografie già congelate: nomi, voti, eventi e importi non vengono normalizzati retroattivamente.

Il confronto tra alias è un cambiamento dell'identificazione dei dati di ingresso, non della formula del voto. I corpi di `gradeMarket`, `scoreFromPrice`, `fraction`, `emptyScore`, `weightedHistorical` e `blendedRelative` sono verificati identici alla baseline.

## Ricognizione delle fonti

Sono stati letti 77 CSV Football-Data (15 codici nazionali per 2021/22–2025/26, più i cumulativi Romania/Danimarca), cinque archivi Champions League OpenFootball e la fonte corrente HNL Croazia: 83 file, 2.136 osservazioni fonte/stagione, 500 identità osservate. I manifest includono URL, checksum e commit immutabile di OpenFootball. L'inventario dei file extra comprende tutte le annate presenti nel cumulativo; ciò non equivale a certificare ogni stagione come completa.

Il registro ha **58 identità osservate verificate e 442 da verificare**. Nessuna delle etichette ambigue configurate compare nei campioni reali; esse sono esercitate con fixture sintetiche. Ci sono 32 gruppi di nomi con token condivisi da sottoporre a revisione: sono possibili omonimi o club differenti, mai decisioni di accorpamento. Questi suggerimenti vengono calcolati solo dal programma di ricognizione, non dal motore applicativo.

Sono coperte da osservazioni 16 delle 20 competizioni runtime. HNL Croazia è limitata al 2026/27 corrente. Liga Portugal 2, 1st Division Danimarca, Prva NL Croazia e Liga II Romania non hanno una fonte storica configurata o CSV forniti e restano non verificate. Sono stati inventariati anche League Two, Süper Lig e Jupiler Pro League, già riconosciuti dai codici CSV ma fuori dal menu runtime delle 20 competizioni. Non è stato creato un ulteriore elenco divergente di campionati nell'interfaccia.

Consultare `qa/data002/club-aliases.csv` per tutte le denominazioni e `club-registry.json` per identità, fonti e copertura. `unresolved-clubs.json` contiene tutte le anomalie residue e `reviewed-aliases.json` documenta le equivalenze effettivamente osservate e revisionate.
