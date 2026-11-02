# QA finale Codex — v0.2V-rc2 / TA-V02V-UX-002

**Commit definitivo: `204dc6c231f82e7bc0782eb8b1c67a794aeb97b1`.** Base esclusiva `43b92dfc21112a1df7f20dc6f56f6add8042219a`. Ramo `feature/ta-v02v-ux-002`; PR draft separata, stacked sulla PR #6. La candidata è pronta per AUDIT indipendente, **non approvata stabile**. Nessun merge/deploy/release.

- [ZIP completo verificato](https://github.com/antoniodenuccio1995-a11y/Trading-sport/archive/204dc6c231f82e7bc0782eb8b1c67a794aeb97b1.zip); SHA-256 `dd9107bd06ce7c99b7a789085cb5c5fd25453e38b903724e625e4a6911fccecf`.
- 7,634,354 byte; **724 file** confrontati byte per byte con Git. Avvio e worker verificati sulla vera estrazione.
- Entry: `Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html`. [Istruzioni Windows/HTTP](https://github.com/antoniodenuccio1995-a11y/Trading-sport/blob/204dc6c231f82e7bc0782eb8b1c67a794aeb97b1/LEGGIMI_v0.2V_rc2.md). **Estrarre tutto il pacchetto.**
- [Changelog dei dieci requisiti](https://github.com/antoniodenuccio1995-a11y/Trading-sport/blob/204dc6c231f82e7bc0782eb8b1c67a794aeb97b1/docs/v02v-ux/CHANGELOG.md), [piano/oracoli](https://github.com/antoniodenuccio1995-a11y/Trading-sport/blob/204dc6c231f82e7bc0782eb8b1c67a794aeb97b1/docs/v02v-ux/PIANO_E_ORACOLI.md), [metodo e limiti](https://github.com/antoniodenuccio1995-a11y/Trading-sport/blob/204dc6c231f82e7bc0782eb8b1c67a794aeb97b1/docs/v02v-ux/QA_METODO.md).

Gate da nuova copia pulita, 2026-11-02T16:29:09.345410+01:00 → 2026-11-02T16:51:54.617649+01:00 (Europe/Rome): **22 gruppi esterni PASS, zero FAIL bloccanti nel perimetro disponibile**. Un gruppo comprende i **17** controlli rc5 completi. I test della fonte online distinguono disponibilità tecnica e import realmente eseguito: **live NON ESEGUITO**, senza mascherare errori TLS o sostituire risposte.

## Matrice DIREZIONE

| # | Priorità | Richiesta | Esito verificato |
|---|---|---|---|
| 1 | P0 | Responsive senza reload | PASS |
| 2 | P1 | Sidebar compatta e tastiera | PASS |
| 3 | P0 | Startup e dati in background | PASS shell/reattivita; riserva tempi completi warm piu lenti |
| 4 | P0 | Tutte le gare odierne e continuità | PASS |
| 5 | P1 | Calendario raggruppato | PASS |
| 6 | P0 | Aggiornamento incrementale | PASS controllato; live NON ESEGUITO |
| 7 | P1 | Terminologia e copertura | PASS |
| 8 | P1 | Analisi dentro Confronti | PASS |
| 9 | P0 | Cruscotto esistente Casa/Totale, Trasferta/Totale | PASS |
| 10 | P0 | Scanner temporale | PASS |

### Evidenze funzionali principali

- **Stesso cruscotto esistente:** 17 indicatori nei gruppi Attacco/difesa, Rendimento e Primo/secondo tempo; quattro valori e benchmark sotto ciascuno. Oracolo Python confronta tutte le celle, denominatori e numeri visualizzati. Totale = casa+fuori, non ultime 10; neutro e AET/rigori dichiarati separatamente. Il benchmark totale distingue osservazioni squadra dalle gare uniche.
- Fixture di base e prova supplementare con distribuzioni A/B differenti: 5+5 gare per club, HT mancanti, stagione/storico e FT futuro avvelenato. Il supplemento mantiene tutte le asserzioni originali e cambia soltanto la fixture sintetica; [script riproducibile](supplement/run-supplement.py), [oracolo e attesi/osservati](supplement/browser-ux.json).
- [Cruscotto desktop](supplement/confronti-board-desktop.png) e [mobile](supplement/confronti-board-mobile.png). Tutti i valori specifico/totale restano nel viewport mobile senza scroll orizzontale della card.
- 1920→360→768→1024→1440→1920 senza reload su sei sezioni, con bounding box e screenshot; niente tetto 1060px o overflow documento. Pin/ordine/Internazionali e focus tastiera conservati, incluso focus dopo la pressione del pulsante.
- Dashboard con tutte e 14 le gare odierne della fixture, ordine competizione/kickoff qualificato, prossimi sette giorni separati e ripresa indipendente di ultima partita e Comparatore. Calendario con gruppi testuali, filtri, alias, 50 gare/pagina e CSV completo.
- Scanner default Oggi, Domani/3/7/custom, ricerca alias/Paese e minimi/mercati conservati. Intervallo invalido segnalato; oggi senza kickoff futuro verificabile escluso. Il vecchio contratto multi-giorno viene provato selezionando esplicitamente 7 giorni.
- Allineamento data canonica nei controlli e nei pannelli rc5; tutti i giudizi confrontati con/senza un FT erroneamente futuro. Le formule sono identiche, cambia soltanto l’ammissibilità temporale dei dati contestuali.
- Materiale nuovo dentro la tab Confronti; riepilogo breve sopra; sette schede originali, forma 5/10 e H2H preservati. Testo Dati utilizzati nel confronto con FT/HT, periodo osservato, cutoff e stato di copertura.
- IND-01/02/03 originali, NEW-01/02/03 e NEW-04 indipendenti, 15 casi temporali e 12 CMP: tutti passano. I valori attesi dell’auditor non sono stati modificati. NEW-04 ripetuto anche sui file realmente estratti dallo ZIP.
- Sei suite browser rc5 sulla nuova entry, otto mercati, sei preset, 144 confronti indipendenti, payout/commissioni, ricerca/CSV, alias/identità, classifiche e diario sintetico. Tutti i **597 file non-QA** del commit esaminato restano invariati, inclusi i 577 rc5; nuova entry e moduli sono aggiunte.
- Zero Console/pageerror nelle suite funzionali. Il probe live conserva separatamente gli errori di rete osservati; non sono spacciati per zero errori né per import riuscito.

## Avvio e prestazioni reali

Il primo frame/shell è separato dalla disponibilità completa. [Frame reali](ux/) e trace DOM provano che prima della Dashboard non appare un workspace rc5. Nessuna scrittura matches/cache fonti o richiesta live all’avvio. Calcoli con gli stessi motori nel worker locale, idratazione osservazioni a lotti con yield; l’indice coincide integralmente con il calcolo sincrono originale.

| Misura | rc2 | rc1 di riferimento |
|---|---:|---:|
| Prima riapertura dopo import | 9.738 s | 9.85 s |
| Warm reload 1 | 10.248 s | 8.923 s |
| Warm reload 2 | 10.538 s | 8.802 s |
| Shell rc2 | 328 ms | non misurata come shell dedicata |
| Calendario/filtro 28.300 gare | 0.936 s | test baseline nel file allegato |
| Comparatore 28.300 gare | 0.074 s | test baseline nel file allegato |

Confronto sequenziale, stesso input in profili separati, Chromium/Linux/HTTP. Cold significa prima riapertura dopo import, non cache OS svuotata o Windows a freddo. Tempi variabili: non si garantisce un miglioramento warm né la velocità sul PC della DIREZIONE. [Ricevuta confronto](ux/startup-comparison.json), [fasi/trace rc2](ux/performance-browser.json).

## Aggiornamento incrementale: risultati e limite live

Il percorso corrente acquisisce soltanto i CSV della stagione corrente; non riapre tutti gli storici. Ultimi sette giorni/sola stagione/sole nuove sono filtri locali. Cache separata con ETag o SHA evita parse/merge/persist quando il contenuto è invariato. Concorrenza limitata a due competizioni, tempi fetch/header, body, hash, parse e confronto separati; merge/anteprima e persistenza sono batch comuni dichiarati.
Prove browser con fetch e fonte controllata: 200, 304, stesso corpo, una nuova gara, FT discordante e risposta non CSV; archivio identico prima della conferma e dopo un fallimento, conflitto non sovrascritto, cache persistente separata. [Ricevuta](ux/refresh-browser.json).

**Fonte realmente tentata: NON ESEGUITO.** [Ricevuta integrale](ux/live-refresh.json). Real browser acquisition attempted but remote source inaccessible (HTTP/CORS/network). Live import/idempotence NON ESEGUITO; manual CSV path and controlled-source tests provided.
Non vengono ignorati certificati né introdotti proxy per fingere un successo. La fonte CSV statica può comunque inviare tutto il file corrente; non si promette un download remoto per soli ultimi giorni o un servizio live. Il manuale CSV resta disponibile.

## Backup personali e integrità

- Originale Codex: **28544 → 28302**; recuperato Codex **28402 → 28300**. Tutte le osservazioni contabilizzate; originali invariati.
- Ciascun input: **172964 quote**, **2 payload manuali**, zero errori. Reimport x3, proprio export, reload, Undo del reimport e ritorno al profilo vuoto completati sulla nuova entry.
- Non è stato usato il file da 13.536 record citato dall’auditor come sostituto dell’originale mancante. Gli input effettivi sono identificati dai checksum nelle ricevute. Il recuperato Codex 0fc4… è distinto dal file audit 95bf…; conteggi uguali non certificano file identici.
- [Reimportazioni reali](ux/ux-reimport-browser.json), [valori originale](ux/private-integrity.json), [valori recuperato](ux/private-recovered-integrity.json). Dettagli, export e schermate personali restano fuori da GitHub/artefatti.
- H2H reale: 5358 coppie, 16074 confronti 5/10/tutto, zero discrepanze. Nessun club/coppia personale pubblicato.
- La completezza degli storici rimane distinta dal recupero. Osservazioni irrisolte e stagioni parziali/non verificabili non vengono dichiarate sanate o complete.

## Smart Analysis: leggibilità, non vantaggio inventato

Qualità/direzione/forza sono distinte: insufficiente sotto 8/8/30, contrastante con scarti opposti di almeno 5pp per lato, debole senza concordanza forte, favorevole/contraria soltanto con i criteri originali di almeno 10pp concordi. Il motore originale e la selezione massima di tre evidenze restano identici; nessuna raccomandazione di trade è aggiunta.
Sul holdout 2025/26 (760 gare), i 659 Over 2.5 prima aggregati come contrastanti si dividono in **176 contrastanti e 483 deboli**. Restano **19 favorevoli, 18 selezioni mostrate e 9 eventi**. I 9/19 eventi nei favorevoli contro 21/35 nei contrari NON dimostrano una capacità predittiva utile o superiorità economica. Si chiarisce il significato degli stati; non si forzano positivi o probabilità calibrate. [Tutti gli otto mercati, periodi e controprove](ux/signals.json).

## Provenienza, riproduzione e limiti

- [Mandato #7](https://github.com/antoniodenuccio1995-a11y/Trading-sport/issues/7), [retest indipendente fa2c92a](https://github.com/antoniodenuccio1995-a11y/Trading-sport/tree/fa2c92a03f2edd4254a9c40b3f7abf9061d1019d/audit/2026-10-30-v02v-43b92df), [primo AUDIT 30fddfa](https://github.com/antoniodenuccio1995-a11y/Trading-sport/tree/30fddfa99b6c78acd5f38c94c41f67352fde6420/audit/2026-10-30-v02v-240f747). Rapporto/README/oracoli letti; SHA degli adattatori conservati.
- [Readiness e manifest](readiness.json), [matrice CSV](MATRICE_REQUISITI.csv), [log freschi](logs/), [riferimento rc5 completo](rc5/consolidated-run.json), [verifica ZIP](delivery/delivery.json). `SHA256SUMS` verifica tutti gli artefatti di questa cartella.
- Il primo gate interno è stato interrotto per correggere allineamento data e ammissibilità dei FT futuri; poi è stato integralmente ripetuto sullo SHA definitivo. Non si riciclano PASS parziali o ricevute di altre candidate.
- **NON ESEGUITO:** Windows nativo, file://, dispositivo mobile fisico e journal personale non fornito; live import secondo disponibilità documentata sopra. Prove desktop/tablet/mobile sono viewport reali di Chromium Linux, non dispositivi fisici.
- La PR è una dipendenza stacked della PR #6 al commit base 43b92df, a sua volta basata sulla rc5 della PR #4. Tutte restano in bozza; main, PR #4 e PR #6 non vengono modificati.

**Disponibile per un unico nuovo AUDIT indipendente. Nessun merge, deploy o rilascio stabile.**

## Riserva esplicita sui tempi completi di avvio

Nel confronto finale, cold rc2 9.738 s contro rc1 9.85 s; warm mediano rc2 10.393 s contro 8.863 s. Il cold e praticamente invariato e il warm e piu lento in questa misura. **Non si dichiara raggiunto un miglioramento del tempo completo di riapertura.** Il risultato verificato e shell immediata, assenza del flash e calcolo in background con dati identici; la regressione del tempo warm rimane una riserva prestazionale esplicita per AUDIT, distinta dai test funzionali PASS.
