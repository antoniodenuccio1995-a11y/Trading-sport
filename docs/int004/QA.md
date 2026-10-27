# Rapporto QA provvisorio — TA-INT-004

**Esito complessivo: NON PRONTO PER AUDIT / ACCETTAZIONE.** Mancano l'ultima versione operativa Windows e `RISCONTRO_NUOVO_ZIP_RC4.md`. Il nuovo nucleo d'identità e recupero è verificato, ma i test del Backtest eseguiti sulla base rc4 restano FAIL. Non si presenta il prototipo come sostituto della versione operativa verificata dalla DIREZIONE.

## Prove realmente eseguite

| Requisito | Esito e perimetro | Evidenza |
|---|---|---|
| T1 — Riproduzione | FAIL riprodotto sulla rc4: due incontri/quattro club. Nuovo motore e importazione browser: un incontro/due club, denominazioni e fonti conservate | `baseline-audit-reproduction.json`, `identity-unit.txt`, `browser.json` |
| T2 — Idempotenza | PASS su caso sintetico e pacchetto pubblico I2_2025, importato due volte: sempre 380 incontri | `browser.json`, `public-browser.json` |
| T3 — Conflitti | PASS: FT, HT, tiri, quote, contesti sportivi e codici di fonte contraddittori sono verificabili e non sovrascrivono i record precedenti | `identity-unit.txt` |
| T4 — Fasi vere | PASS su casi sintetici playoff/playout/ripetizioni e sulla Championship 2024/25 pubblica: 557 gare archiviate, 552 nella classifica regolare | `identity-unit.txt`, `public-browser.json` |
| T5 — Statistiche | PASS: classifiche senza doppio conteggio; archivio grezzo duplicato mantenuto; frequenza Over 2.5 del campione I2 calcolata indipendentemente e coincidente (0,4842105263157895) | `browser.json`, `public-browser.json` |
| T6 — Backtest e Mercato | **FAIL / BLOCCANTE** sul codice rc4 ancora presente nel prototipo. Menu senza opzioni; filtro solo-casa richiede impropriamente anche lo storico ospite; campione pubblico atteso 153 selezioni, effettivo 150; ricerca manuali future non inclusa; cutoff rigoroso della qualificazione futura non rispettato su fixture indipendente | `backtest-contract.json` |
| Scanner e frequenze HT | PASS: eventi distinti non collassati, copia manuale unificata, HT mancanti esclusi dal denominatore e indisponibilità mostrata come tale | `consultation-browser.json` |
| Pacchetti ripetuti | PASS sui 109 pacchetti non vuoti (35.974 record); 29 senza record importabili dichiarati separatamente. Seconda importazione identica anche nei campi/provenienze | `packet-contract.json` |
| T7 — Persistenza e ripristino | PASS: avvio senza riscrittura delle copie grezze, anteprima senza scritture, backup e conferma, export/reload, Undo | `browser.json` |
| T8 — Backup personale originale | PASS per conservazione integrale: 28.544 input contabilizzati, due manuali, quota per quota, salvataggio, export/reload e Undo. Il nuovo conteggio conservativo è spiegato sotto | `private-backup-summary.json`, `private-integrity.json` |
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

I 138 pacchetti sono stati riscanalizzati integralmente. Le 40.248 osservazioni sono contabilizzate nei pacchetti utilizzabili, nelle copie consolidate e nei file di revisione. Gli originali non vengono sovrascritti.

La proposta privata rc4 di 35.022 righe viene riletta senza modificarla: sono rilevate 349 copie consolidabili e 46 osservazioni da conservare in revisione. La copia conservativa avrebbe 34.673 righe; la proiezione utilizzabile ne contiene 34.627. La matrice è **14 complete, 95 parziali, 29 non verificabili**, rispetto alle precedenti 17/92/29 attribuite a questa proposta. I conteggi dei pacchetti pubblici (17/92/29) riguardano un perimetro diverso.

Il backup originale senza nuove integrazioni rimane misurato separatamente: 11 complete, 98 parziali, 29 non verificabili. Nessun archivio personale è stato aggiornato automaticamente; le elaborazioni sono copie di QA autorizzate dal mandato.

## Blocchi e anomalie ancora aperte

1. **Baseline operativa non acquisita.** La cartella Drive non è raggiungibile dalla rete cloud. La bozza di rete è salvata, ma non risulta attivata/pubblicata. Occorrono lo ZIP con la versione Windows funzionante e il rapporto AUDIT; una volta disponibili vanno integrati selettivamente e ripetuti T6, menu, strategie, lista completa/export, manuali future e alias semplificati.
2. **T6 FAIL effettivo.** È una prova sulla base rc4 del prototipo, non una contestazione della versione Windows che la DIREZIONE dichiara funzionante. Quella versione non è stata letta né collaudata.
3. **Righe sportive in revisione.** Conflitti di FT/HT/statistiche, date secondarie non riconciliate, identità non documentate e contesti di fase non sufficienti restano nei rapporti. Non vengono trasformati in dati certi o in altrettante partite mancanti.
4. **Fasi e classifiche multiphase.** Senza metadati/regolamento sufficiente non si attribuisce arbitrariamente un girone. Le formule e le regole federali esistenti non sono cambiate; non si certifica una classifica federale completa.
5. **Trade personali non disponibili.** Solo codice immutato e fixture sintetiche sono verificati per il registro trade. I dati ausiliari vuoti del backup originale non costituiscono una prova su tutti i possibili archivi reali.
6. **Revisione indipendente ancora da eseguire.** La ripetizione automatica dei casi AUDIT da parte di Codex non è l'approvazione di un revisore indipendente.

Il mandato non è dichiarato concluso e il rilascio stabile non è autorizzato.
