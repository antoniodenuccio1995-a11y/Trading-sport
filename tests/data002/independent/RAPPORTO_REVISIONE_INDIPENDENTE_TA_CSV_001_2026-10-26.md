# Revisione indipendente TA-CSV-001 e preparazione evoluzione Classifiche

**Data:** 26/10/2026 · **Candidata:** v0.2U-rc1 · **Esito complessivo: FAIL**

Il flusso ordinario di importazione è confermato sui campioni reali; la candidata non supera però i controlli indipendenti di integrità. Non si propone una nuova versione stabile. Questa revisione non modifica il codice e non autorizza merge, deploy o rilasci.

## 1. Identità della versione e perimetro

Repository: [antoniodenuccio1995-a11y/Trading-sport](https://github.com/antoniodenuccio1995-a11y/Trading-sport).
Commit di `main` verificato all’inizio e al termine: [b80ff66](https://github.com/antoniodenuccio1995-a11y/Trading-sport/commit/b80ff664ff1ffe05045662ad43d22d5c2e9dd3fc), merge della PR #1; commit applicativo 73fc0e23712af598b88b95b23abf764f24c186ad.

| Artefatto | SHA-256 |
|---|---|
| Trading_Analytics_v0.2U-rc1_TA-CSV-001.html | 3b1c0bdb7ff4caf28ca96f21c99fbb49107eaea1186a8f4fa700182ad4d0ec9b |
| ta-csv-import.js | fb215d6bf283fd2d5286dfc687c4f351caa1be18c4bd178453325eb12b005f20 |
| Baseline v0.2T | 819491b53edd20768ce23134c271c2a99a1b80d4bdbf3b165d478dd26794f688 |

Checkout locale fissato al commit, senza modifiche tracciate (`git status --porcelain` vuoto). Nessuna scrittura verso GitHub, nessuna modifica all’archivio operativo, nessun dato personale usato. I test creano soltanto profili temporanei e fixture sintetiche/publiche. Non è stato verificato un URL cloud pubblicato: il giudizio riguarda i file del commit indicato, non un’eventuale diversa build già ospitata.

Letti mandato TA-CSV-001, istruzioni, diagnosi, changelog, rapporto e procedura di collaudo, parser, percorsi HTML e test esistenti. Le affermazioni di test del precedente sviluppatore sono state rieseguite, non accettate come prova autonoma.

## 2. Prove effettivamente eseguite

Ambiente: Linux, Node 24, Playwright Python 1.64.1 e Playwright Node disponibile nel runtime; Chromium headless 153.0.8010.0. Test via HTTP locale e controllo separato file:// con modulo JS adiacente. Richieste esterne bloccate durante i test browser; download dei CSV pubblici separato, con TLS verificato. Chrome/Edge Windows e dispositivo mobile reale non collaudati in questa revisione.

| Gruppo | Esito | Evidenza |
|---|---|---|
| 30 test Node esistenti | PASS | reproduced-unit.txt |
| 16 combinazioni lega/stagione reali, 5.151 incontri | PASS | reproduced-browser.json |
| 10 controlli browser esistenti | PASS | reproduced-browser.json |
| Checksum delle 14 sorgenti pubbliche | PASS: tutti identici al manifest Codex | source-verification.json |
| 7 verifiche indipendenti avversariali | 3 PASS, 4 FAIL | independent-browser.json, IND-01…07 |
| Ricognizione regole classifiche | Osservazione, non test di correttezza federale | independent-browser.json, IND-08 |
| 4 verifiche indipendenti aggiuntive su backup e regressione | PASS | independent-roundtrip.json |

I controlli esistenti comprendono navigazione, idempotenza, conflitti di risultato, HT assente, backup/ripristino JSON, metadato CsvSeason persistente, compatibilità backup v2 vecchio e registro trade sintetico con chiusura parziale. Il roundtrip aggiuntivo verifica anche HT realmente 0–0, tiri [10,8,3,2], quota B365H 2.25 e metadato stagione: i campi controllati sono invariati dopo ricaricamento. Rende ancora 14 mercati e le sette sezioni restano apribili. Il guasto DB/quota iniettato su archivio popolato lascia memoria e snapshot precedenti invariati (IND-06).

I 5.151 incontri sono quelli importabili nei CSV campionati; non rappresentano una certificazione federale di completezza delle stagioni. Romania e Danimarca nei file extra non forniscono HT: tale assenza resta null. Il file completo prodotto dall’utility esterna non è disponibile: resta verificata solo l’intestazione fornita con riga sintetica, oltre alle sorgenti pubbliche. Nessun errore JavaScript non gestito nelle suite che lo raccolgono; i difetti sotto sono errori semantici che non producono necessariamente eccezioni.

## 3. Rilievi che motivano il FAIL

### F-01 — P1, integrità: righe con lega sconosciuta assegnate automaticamente alla lega nota

**Riproduzione:** importare `fixtures/mixed_known_unknown.csv` con il normale caricatore guidato. Non cambiare la selezione proposta. Il CSV contiene una riga F1 e una OTHER_UNKNOWN.
**Atteso:** fermare l’importazione o esigere una risoluzione esplicita delle righe non riconosciute. Una riga di un’altra lega non può essere classificata solo perché nello stesso file esiste un codice noto.
**Osservato:** il menu è già impostato su Ligue 1. Compare un avviso sui metadati sconosciuti, ma premendo Importa vengono salvati entrambi gli incontri come Ligue 1; dopo ricaricamento restano due. Nessun conflitto segnalato.

**Causa:** `ta-csv-import.js` righe 98–109 raccoglie i codici per l’intero file e assegna `explicit || fromColumns || …`; riga 134 applica quella singola lega a ogni record. Il ramo `unknown` blocca solo la deduzione dal nome file, non il caso misto known+unknown. Il menu riporta alla successiva lettura la selezione automatica come `options.league`, senza distinguere una scelta realmente effettuata dall’utente.
**Impatto:** partite persistite nel campionato errato, contaminazione di classifiche e analisi, backup già contenente l’assegnazione errata.
**Rimedio proposto, non applicato:** validazione per riga, blocco/quarantena delle identità irrisolte e conferma esplicita tracciata dei codici sconosciuti. Il solo testo di avviso non basta. Aggiungere il caso misto alla suite.
**Evidenza:** IND-01, include stato prima/dopo e persistenza. Questo rilievo da solo impedisce un PASS complessivo.

### F-02 — P2, provenienza: stagione e filtro dichiarati nella preview ignorati

**Riproduzione:** importare `fixtures/reference_season.csv`, selezionare stagione 2024/25 e destinazione Solo provenienza/categoria.
**Preview:** 1 incontro importabile, 1 fuori stagione.
**Osservato:** create quattro associazioni squadra-stagione, tutte sotto 2025/26; incluse le due squadre della riga che la preview aveva escluso. La riga di luglio con Season 2024/25 viene inoltre riassegnata dal criterio automatico luglio–giugno.
**Atteso:** soltanto le due squadre della stagione 2024/25.

**Causa:** `smartDataFromEntry()` righe 3664–3667 esce subito per `mode==='reference'`. Dopo il commit delle partite, riga 3734 richiama `pathImportReferenceCsv()` (1253–1273), che ignora selezione stagione e colonna Season, usa un parser separato e chiama `se({d})` senza CsvSeason.
**Impatto:** dati di provenienza non coerenti con ciò che l’utente ha controllato; possibili valutazioni errate di cambi categoria e rappresentatività dello storico.
**Rimedio:** derivare la provenienza dalla stessa validazione e dagli stessi filtri dell’anteprima, conservando la stagione esplicita. Il ramo legacy è preesistente; il rilievo descrive un’incoerenza della candidata, senza attribuire arbitrariamente tutta l’origine al nuovo commit.
**Evidenza:** IND-02.

### F-03 — P2, provenienza: formato accettato dalla preview non accettato dal salvataggio

**Riproduzione:** importare `fixtures/reference_normalized.csv` e scegliere Solo provenienza/categoria.
**Preview:** una partita valida, intestazioni normalizzate e separatore punto e virgola riconosciuti.
**Osservato:** zero associazioni salvate. Il resoconto inizia con «Importazione completata», ma in fondo segnala «provenienza non importata (mancano le colonne Date, HomeTeam o AwayTeam)». L’avviso esiste: non viene descritto come errore completamente silenzioso.
**Causa:** stessa biforcazione di F-02: il parser di provenienza richiede le vecchie intestazioni letterali, mentre TACsv le normalizza.
**Rimedio:** unificare il percorso o bloccare chiaramente il formato prima del commit; niente conferma di completamento della provenienza quando non è stata salvata.
**Evidenza:** IND-03.

### F-04 — P2, cutoff: storico pluriennale non sicuro da riutilizzare senza adeguamento

**Caso sintetico valido per la finestra stagionale supportata:** partita del 10/07/2025 con CsvSeason=2024; cutoff analisi 01/07/2025, stagione selezionata 2025/26.
`standingsHistoryBySeason('Eredivisie','A',[2024],2025,cutoff)` restituisce una partita, tre punti e primo posto benché l’unica partita sia successiva al cutoff.
**Causa:** riga 2665 usa `Infinity` per le stagioni diverse da quella selezionata. Con CsvSeason esplicito, l’assunzione «stagione precedente implica date precedenti alla partita» non è sempre vera nella finestra giugno/luglio ammessa dal parser.
**Ambito:** difetto dell’helper esistente e rischio concreto per il suo futuro riutilizzo; non implica che la tabella attuale della stagione analizzata perda il cutoff. Quella tabella e la traiettoria selezionata passano IND-04.
**Rimedio:** applicare il cutoff a tutte le stagioni rappresentate e a ogni punto del grafico, anche in presenza di metadati stagionali. Non importare semplicemente il rendering del menu principale affidandosi ai suoi filtri globali.
**Evidenza:** IND-05. Il corpo dell’helper è preesistente; la nuova stagione esplicita rende necessario verificare le sue assunzioni temporali.

## 4. Altri riscontri, senza trasformarli in FAIL aggiuntivi

- La candidata è composta da HTML **e** `ta-csv-import.js` adiacente. Il test file:// passa nel presente ambiente con entrambi. Non è un HTML autonomo come le vecchie versioni: il pacchetto/cloud deve distribuire entrambi, oppure un futuro processo di build dovrà incorporarli. Nessuna modifica al packaging eseguita.
- TA-CSV-001.md e alcuni rapporti dicono ancora «non è stato effettuato merge su main» / PR non creata, mentre il merge è verificato. Aggiornare la tracciabilità documentale senza confondere merge e approvazione stabile.
- Nel registro runtime di 20 campionati supportati soltanto 5 hanno regole di fascia correnti. L’oggetto contiene anche League Two, fuori da quel registro: evitare registri che divergono.
- La configurazione attuale di Serie A/Premier League usa un’unica fascia `europe`, non tre qualificazioni UEFA distinte. La tabella Analisi evidenzia le squadre, ma non riusa le bande né il grafico posizionale. Sono requisiti dell’evoluzione futura, non correzioni implementate da questa revisione.

## 5. Decisione e prossimi passi

**FAIL della revisione indipendente della candidata nel perimetro richiesto**, con flusso ordinario confermato e difetti riproducibili di integrità/coerenza. Non si revoca o annulla automaticamente il merge già esistente. Nessuna nuova build stabile autorizzata.

Prossimi interventi proposti per chi sviluppa: correggere F-01, riallineare i percorsi di provenienza F-02/F-03 e aggiungere i test negativi; trattare F-04 come prerequisito per il riuso dei grafici storici. Rieseguire i casi falliti e la matrice ordinaria sulla nuova candidata identificata da commit e checksum. L’approvazione di un rilascio resta alla DIREZIONE.
L’evoluzione Classifiche è preparata nel documento allegato `EVOLUZIONE_CLASSIFICHE_RISCHI_E_ACCETTAZIONE.md`; non è stata implementata.
