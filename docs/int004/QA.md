# Rapporti QA di sviluppo — candidata v0.2U-rc5 TA-INT-004

**Riferimento per la consegna consolidata del 29/10:** [QA_CONSOLIDATO_2026-10-29.md](QA_CONSOLIDATO_2026-10-29.md) e rapporto finale riferito al commit esatto nella PR #4. Questo documento conserva il perimetro delle verifiche di sviluppo; i PASS precedenti non attestavano la reimportazione ripetuta e non sostituiscono il nuovo ciclo end-to-end.

**Addendum urgente successivo a b379d6f:** il collaudo Windows ha individuato un percorso non coperto dai test precedenti: Backtest con partite di oggi chiamava una funzione locale allo Scanner. Il FAIL è riprodotto, la definizione è ora condivisa e il nuovo test del pulsante copre orari futuri, passati, assenti, senza fuso e manuali. Evidenze prima/dopo, prova di sola rilocazione e limiti sono in [CORREZIONE_ORARI_RC5.md](CORREZIONE_ORARI_RC5.md). I PASS precedenti non costituivano prova di questo scenario.

**Esito: collaudo dell’autore PASS nel perimetro documentato; candidata disponibile per nuovo AUDIT indipendente.** Il pacchetto operativo e i riscontri sono stati acquisiti e verificati. Il precedente blocco di acquisizione è risolto e i cinque casi Backtest prima FAIL ora sono PASS. Nessun merge, deploy stabile o approvazione indipendente viene dichiarato.

## Prove realmente eseguite

| Requisito | Esito e perimetro | Evidenza |
|---|---|---|
| T1 — Riproduzione | FAIL riprodotto sulla rc4: due incontri/quattro club. Nuovo motore e importazione browser: un incontro/due club, denominazioni e fonti conservate | `baseline-audit-reproduction.json`, `identity-unit.txt`, `browser.json` |
| T2 — Idempotenza | PASS su caso sintetico e pacchetto pubblico I2_2025, importato due volte: sempre 380 incontri | `browser.json`, `public-browser.json` |
| T3 — Conflitti | PASS: FT, HT, tiri, quote, contesti sportivi e codici di fonte contraddittori sono verificabili e non sovrascrivono i record precedenti | `identity-unit.txt` |
| T4 — Fasi vere | PASS su casi sintetici playoff/playout/ripetizioni e sulla Championship 2024/25 pubblica: 557 gare archiviate, 552 nella classifica regolare | `identity-unit.txt`, `public-browser.json` |
| T5 — Statistiche | PASS: classifiche senza doppio conteggio; archivio grezzo duplicato mantenuto; frequenza Over 2.5 del campione I2 calcolata indipendentemente e coincidente (0,4842105263157895) | `browser.json`, `public-browser.json` |
| T6 — Backtest e Mercato | **PASS:** otto mercati e tutti i preset, condizioni solo casa/trasferta/entrambi, 153 selezioni Serie B attese ed effettive, 144 confronti indipendenti su Serie A/La Liga 2024/25 e 2025/26, manuali future e cutoff anche dello stesso giorno; sei preset verificati contro oracoli indipendenti (158 HT / 98 Over 1.5 / 51 Over 2.5) | `backtest-contract.json`, `operational-browser.json` |
| Interfaccia Backtest e alias | PASS: click reale, diagnostica, pagine da 50, ricerca, CSV completo, grafico, selezione lega, aritmetica punta/banca invariata; alias rapidi con consenso, preview, salvataggio, reload/Undo e blocco fra Paesi diversi | `operational-browser.json`, `backtest-complete.png` |
| Pacchetto operativo reale | PASS riproduzione del difetto indipendente, **non approvazione della versione precedente**: due incontri/quattro club persistenti sull’HTML fornito; 314 file rc4 originali identici alla baseline | `operational-input-reproduction.json`, `operational-port.json` |
| Scanner e frequenze HT | PASS: eventi distinti non collassati, copia manuale unificata, HT mancanti esclusi dal denominatore e indisponibilità mostrata come tale | `consultation-browser.json` |
| Pacchetti ripetuti | PASS sui 109 pacchetti non vuoti (35.974 record); 29 senza record importabili dichiarati separatamente. Seconda importazione identica anche nei campi/provenienze | `packet-contract.json` |
| T7 — Persistenza e ripristino | PASS: avvio senza riscrittura delle copie grezze, anteprima senza scritture, backup e conferma, export/reload, Undo | `browser.json` |
| T8 — Backup personale originale | PASS per conservazione integrale; **conteggio diverso dalla rc4 da verificare nell’AUDIT**: 28.544 input contabilizzati, due manuali, quota per quota, salvataggio, export/reload e Undo. Il nuovo conteggio conservativo è spiegato sotto | `private-backup-summary.json`, `private-integrity.json` |
| Registro trade | PASS su fixture sintetica con voti congelati, eventi e quote invariati attraverso riconciliazione, riapertura e Undo; nessun registro personale reale fornito | `browser.json` |
| Codice protetto | Formule protette e intero blocco del registro trade identici alla rc4; file precedenti preservati | `preservation.json` |
| Parser CSV precedente | 30 asserzioni del parser precedente eseguite contro il modulo rc5, senza sostituire i controlli sui dati | `csv-parser-unit.txt` |

Le evidenze abbreviate nella tabella sono in `qa/int004`. I test puri di `identity-unit.txt` includono anche club distinti omonimi, entità storiche chiuse, appartenenza gallese al sistema inglese, fusi/offset espliciti, codici di più provider e conservazione degli identificativi precedenti.

I file di test browser registrano gli hash dei sorgenti e invalidano un'esecuzione se cambiano durante la prova. Le asserzioni e le evidenze non dipendono da archivi reali nei profili del browser dell'utente.

## T8: confronto corretto con la rc4

Il codice rc4 congelato continua a produrre **28.402** incontri dal backup originale. Il nuovo catalogo documentato identifica altre **100** copie integrabili: il nuovo recupero conservativo produce **28.302** record, consolidando 242 copie complessive e mantenendo quattro osservazioni di calendario non risolte. Non si forza il risultato a 28.402 per far passare un test.

Le quattro osservazioni riguardano due gruppi di calendario con orari discordanti: restano nei dati, fuori dal campione automatico. I passaggi da calendario a risultato conservano invece entrambe le osservazioni dell'orario e tutti i valori originari.

La verifica percorre la lineage di ogni riga originale: **28.544 record contabilizzati, 57.088 denominazioni originali conservate, 172.964 valori di quota non vuoti verificati, due payload manuali conservati, zero errori di conservazione**. La nuova normalizzazione può aggiungere identificativi canonici e metadati di provenienza; gli identificativi precedenti restano conservati. I rapporti dettagliati e le copie recuperate sono esterni al repository.

Questa variazione di conteggio richiede il nuovo AUDIT indipendente. Non viene presentata come convalida della precedente ricostruzione numerica o come correzione automaticamente applicata al browser personale.

## Rivalutazione degli storici

I 138 pacchetti sono stati controllati integralmente. Le 40.248 osservazioni sono contabilizzate nei pacchetti utilizzabili, nelle copie consolidate e nei file di revisione. Gli originali non vengono sovrascritti.

La proposta privata rc4 di 35.022 righe viene riletta senza modificarla: sono rilevate 349 copie consolidabili e 46 osservazioni da conservare in revisione. La copia conservativa avrebbe 34.673 righe; la proiezione utilizzabile ne contiene 34.627. La matrice è **14 complete, 95 parziali, 29 non verificabili**, rispetto alle precedenti 17/92/29 attribuite a questa proposta. I conteggi dei pacchetti pubblici (17/92/29) riguardano un perimetro diverso.

Il backup originale senza nuove integrazioni rimane misurato separatamente: 11 complete, 98 parziali, 29 non verificabili. Nessun archivio personale è stato aggiornato automaticamente; le elaborazioni sono copie di QA autorizzate dal mandato.

## Anomalie residue e limiti del collaudo

1. **T8: variazione esplicita del conteggio.** La candidata conserva i dati ma consolida 100 copie in più rispetto alla rc4. Non si dichiara uguale il risultato 28.402: sono 28.302 righe conservative, comprese quattro osservazioni irrisolte. L’AUDIT deve esaminare questi raggruppamenti; nessuna migrazione è stata applicata al browser personale.
2. **Righe sportive in revisione.** Conflitti FT/HT/statistiche, date secondarie non riconciliate, identità non documentate e fasi insufficienti rimangono nei rapporti e fuori dall’importazione automatica. Non vengono presentati come dati certi o come altrettante partite mancanti.
3. **Fasi e classifiche multiphase.** Senza metadati/regolamento sufficienti non si attribuisce arbitrariamente un girone. Le formule e le regole federali esistenti non cambiano; non si certifica una classifica federale completa.
4. **Piattaforma browser.** Test eseguiti su Chromium Linux via HTTP locale, con richieste esterne bloccate nei profili di prova. Windows nativo e `file://` non collaudati. Il collaudo locale richiesto usa HTTP; non è garantito il caricamento dei moduli/fetch aprendo il solo HTML con doppio clic.
5. **Trade personali non disponibili.** Registro verificato su fixture sintetica e codice immutato. Il backup reale contiene sezioni ausiliarie vuote e non prova ogni possibile registro reale.
6. **Fonti e aggiornamento.** La scansione è sullo snapshot rc4 congelato al 27 ottobre; non è un refresh live al 28 ottobre. HT mancanti, vere partite mancanti e osservazioni in conflitto sono distinti. Le fonti pubbliche restano aggregatori con URL e checksum.
7. **Nuovo AUDIT ancora da svolgere.** Il riscontro acquisito riguarda il precedente ZIP ed è FAIL sulla duplicazione, non approvazione della rc5. Le prove Codex non sono revisione indipendente.

## Evidenze prima e dopo l’integrazione

`backtest-contract-before-integration.json` conserva i cinque FAIL sul prototipo precedente. `backtest-contract.json` registra la riesecuzione delle medesime asserzioni sulla candidata integrata. L’esito non è ottenuto disabilitando controlli. `operational-browser.json` aggiunge 144 confronti sui record e sugli esiti, oltre ai percorsi UI reali; gli oracoli usano direttamente le righe primarie Football-Data congelate, senza derivare l’atteso dal nuovo riconciliatore.

Gli hash dei sorgenti sono verificati anche dal controllo finale `check-readiness.cjs`, che fallisce se manca una prova pertinente o non corrisponde al codice consegnato. `readyForIndependentAudit` significa che il materiale è disponibile per esame, **non che l’AUDIT sia superato**. `readyForStableRelease` rimane false.
