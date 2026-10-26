# TA-DATA-002 — Risultati QA

Candidata v0.2U-rc2, baseline b80ff66, 26 ottobre 2026. Pronta per nuova revisione indipendente, non stabile.

## Verifiche eseguite

| Gruppo | Esito | Evidenza in qa/data002 |
| --- | --- | --- |
| 30 test parser TA-CSV-001 sulla rc2 | PASS, 0 saltati | csv-unit-rc2.txt |
| 18 test identità, integrità e formule | PASS, 0 saltati | core-unit.txt |
| 30 test originali sulla baseline conservata | PASS | csv-unit-baseline.txt |
| Matrice reale 8 leghe × 2 stagioni, 5.151 incontri | PASS | csv-regression.json |
| 9 controlli browser della suite precedente | PASS | csv-regression.json |
| Quattro FAIL originali AUDIT | FAIL riprodotti → PASS | audit-baseline e audit-rc2 |
| IND-04 cutoff tabella/traiettoria, IND-06 guasto DB/quota | PASS | audit-rc2/independent-browser.json |
| Quattro controlli AUDIT roundtrip/analisi | PASS | audit-rc2/independent-roundtrip.json |
| 13 prove browser identità/migrazioni | PASS | identity-browser.json |
| Simulazione 36.789 incontri da 77 CSV | PASS, stessi conteggi e fingerprint protetti | integrity-corpus.json |
| IND-07 / avvio file:// | ERROR ambientale, non PASS | ERR_BLOCKED_BY_ADMINISTRATOR |
| IND-08 regole sportive | OBSERVATION | Nessuna nuova regola implementata |

Non rimangono FAIL o ERROR applicativi nei controlli obbligatori. Il blocco amministrativo file:// è distinto dal percorso HTTP superato. Non sono stati collaudati Chrome/Edge Windows o dispositivi mobili reali. Nessun archivio operativo o profilo personale è stato utilizzato.

## Trasparenza sugli adattamenti

Gli script indipendenti sono conservati integralmente, con checksum verificati. Il loro runner cambia solo percorsi, nome candidato, eseguibile e output; nessun assert avversariale è cambiato. Il rapporto originale resta FAIL come documento storico: i nuovi PASS sono la riesecuzione locale degli script ricevuti, non una nuova firma indipendente.

Per ripetere gli assert Node originali sulla rc2, load-rc2.cjs cambia esclusivamente il require del parser. Il controllo originario del blocco rc1 resta un controllo della baseline conservata; core.test.cjs verifica separatamente sintassi rc2 e corpi delle formule protette. Sono 48 test unitari sulla candidata, oltre ai 30 di conservazione della baseline.

La suite browser originale è adattata con run-compat.py: percorso e nome HTML, confronto dei nomi sorgente attraverso ClubHomeRaw/ClubAwayRaw (il nome visualizzato cambia intenzionalmente), e confronto del vecchio JSON che ammette i metadati identità aggiuntivi mantenendo tutti i campi originali. Gli adattamenti sono registrati in compat-adaptations.json. Nessun controllo su conteggi, date, risultati, HT, tiri, quote o trade è disabilitato.

Il commento sulla fase nello script roundtrip ricevuto resta quello storico, ma il suo output ora mostra inBackup=regular: la rc2 conserva il metadato Phase già presente. Non sono introdotte regole o UI di classifica per fase.

## Matrice reale ripetuta

| Campionato | 2024/25 | 2025/26 | HT assente |
| --- | ---: | ---: | --- |
| SuperLiga Romania | 315 | 321 | Tutte le gare |
| Superliga Danimarca | 192 | 192 | Tutte le gare |
| Primeira Liga | 306 | 306 | 0 |
| La Liga | 380 | 380 | 0 |
| Segunda División | 462 | 462 | 0 |
| Ligue 1 | 306 | 306 | 0 |
| Ligue 2 | 306 | 305 | 0 |
| Eredivisie | 306 | 306 | 0 |

I conteggi descrivono i CSV scaricati, non una certificazione federale di completezza. Nessuna gara o HT mancante è inventata. Il file completo della utility non è disponibile: resta verificata l'intestazione fornita con riga sintetica e le fonti ufficiali reali.

## Identità e limiti residui

Inventario: 83 sorgenti, 2.136 osservazioni, 500 identità; 58 verificate e 442 da verificare. Nessuna etichetta ambigua configurata compare nel corpus reale: le regole di ambiguità sono esercitate con fixture sintetiche. I 32 gruppi di token condivisi sono segnalazioni da revisionare, mai decisioni di fusione.

Copertura storica non verificata per Liga Portugal 2, 1st Division Danimarca, Prva NL Croazia e Liga II Romania; HNL Croazia limitata alla fonte corrente. La copertura è censita per tutte le 20 competizioni runtime; sono inventariati anche i tre codici import aggiuntivi. Non sono inventate fonti o anagrafiche per coprire i buchi.

Un archivio personale può contenere ulteriori omonimi o varianti non osservati: usare la simulazione e sottoporre i casi alla revisione. Collisioni di identità o dati invalidi bloccano la migrazione, senza correggerli arbitrariamente. Tempi e limiti su archivi personali superiori ai campioni non sono dichiarati verificati.

Le prove browser bloccano le richieste esterne e usano profili temporanei. I download di sorgente sono separati, pubblici e con verifica TLS attiva. Le formule 0–100 non cambiano; il registro trade è provato con fotografie sintetiche congelate.

Comandi e precauzioni in COLLAUDO.md. Conservare commit e checksum e confrontare gli aggiornamenti dei CSV prima di considerarli lo stesso campione. Le evidenze sono in qa/data002, gli originali AUDIT in tests/data002/independent.
