# TA-INT-004 — collaudo consolidato del 29 ottobre 2026

Il [commento della DIREZIONE](https://github.com/antoniodenuccio1995-a11y/Trading-sport/pull/4#issuecomment-6491569703) è il riferimento operativo. Una sola candidata viene consegnata dopo il superamento del ciclo completo. Nessun merge su `main`, deploy o approvazione stabile.

## Commit e ricevuta finale

Il rapporto finale collegato nella PR #4 contiene **SHA esatto della candidata, SHA-256 dello ZIP, manifest dei sorgenti, comandi, tempi, codici di uscita e risultati**. È generato dopo il commit da una nuova copia pulita, confrontata con lo ZIP: non viene attribuito a quel commit un test svolto soltanto sul working tree.

Le prove finali sono pubblicate come evidenze separate, immutabili, riferite al commit della candidata. Non sono un'altra versione del gestionale. Questa separazione consente di registrare lo SHA della versione già committata senza modificarla dopo il collaudo. I file di preparazione QA presenti nel codice sono marcati come preflight; soltanto il ciclo finale `exact-commit` con zero FAIL bloccanti consente la consegna.

## Diagnosi del nuovo FAIL

Il riscontro citato dalla DIREZIONE riguarda **b379d6f**. Il difetto è riprodotto anche su **c6d9aa4**, che contiene già il fix `safeKickoffFuture` ma non quello della reimportazione.

Con calendario `Time=15:30` e risultato `SourceTime=14:30`, senza fuso confrontabile, il primo passaggio integra il passaggio calendario→risultato e conserva entrambe le osservazioni. Il secondo passaggio privilegiava il campo piatto `Time=15:30`, confrontandolo con `SourceTime=14:30`: il medesimo dato diventava un conflitto nuovo. Sul backup rc4 recuperato disponibile privatamente, 28.402 righe diventavano 28.300; la reimportazione produceva cinque gruppi `kickoff-disagreement`.

Il nuovo confronto usa gli orari delle osservazioni originali. La copertura completa di una storia da parte dell'altra riconosce un dato già acquisito. Quando si integra un archivio già esistente, ciascun orario incoming deve essere già rappresentato; una storia incoming più ricca non può introdurre di nascosto un orario discordante conservando quello vecchio. Rimangono le transizioni esplicite calendario→risultato e gli eventi affidabili già previsti dal motore. Una sola sovrapposizione, un orario nuovo incompatibile, fusi espliciti discordanti, risultati, quote o identità diverse non autorizzano fusioni. Tutte le osservazioni restano conservate. I campi piatti aggregati non creano abbinamenti artificiali fra l'orario di una fonte e il fuso di un'altra.

Il backup originale conserva anche quattro osservazioni già irrisolte. Ripresentare **esattamente** quelle righe è ammesso come no-op, lasciandole in revisione e mantenendo l'archivio grezzo identico. Una modifica o un'aggiunta al gruppo resta bloccata. L'importazione non diventa una riconciliazione implicita.

## Matrice obbligatoria

| Caso | Atteso verificato dal runner |
|---|---|
| Riproduttore sintetico della DIREZIONE | Primo import sicuro; cinque reimportazioni pure e tre cicli browser sicuri, stesso record |
| Backup recuperato rc4 | 28.402 input → 28.300; tre reimportazioni del sorgente e una del nuovo export, nessun conflitto nuovo o valore perso |
| Backup originale | 28.544 input → 28.302; quattro osservazioni irrisolte conservate; riimportazioni esatte senza riparazione silenziosa |
| Preview JSON | Nessuna scrittura a incontri, dati ausiliari o regole |
| Export/reload | Tutti i record e tutte le sezioni del backup identici, escluso il timestamp dell'export |
| Undo | Ripristino completo dell'archivio precedente; prova separata di ritorno al profilo inizialmente vuoto |
| Nuovi conflitti | Orari, UTC/fusi, FT/HT, quote e statistiche discordanti bloccati, archivio precedente invariato |
| Identità sportive | Provider qualificati, eventi distinti, replay, leg, playoff/playout e club omonimi verificati |
| Backtest odierno | Click reale con orari futuri, passati, assenti, offset, domani e manuali; criterio prudenziale conservato |
| Mercati/preset/filtri | Otto mercati, sei preset, 144 confronti indipendenti su due stagioni di due leghe, ricerca/pagine/CSV completo |
| Scanner | Click reale, stessa selezione prudenziale delle gare future |
| Import CSV e storici | Parser nuovo contro suite precedente; 109 pacchetti non vuoti reimportati, 29 senza record utilizzabili dichiarati |
| Classifiche/analisi/HT | No doppio conteggio, fasi vere, cutoff cronologico, HT assente distinto da zero |
| Registro trade | Fixture sintetica con valori congelati attraverso salvataggio, reload e Undo; codice invariato |
| Dati personali | Verifica tramite lineage di tutti i valori originali; nessun input modificato o dato privato pubblicato |
| Errori browser | Zero `pageerror` e zero errori di console nei profili isolati |
| File protetti | 314 file rc4 preservati; HTML c6d9aa4 invariato, incluso il fix Backtest e il registro trade |

Il rapporto finale riporta gli esiti osservati e la marcatura PASS/FAIL/NON ESEGUITO. La tabella da sola descrive gli attesi, non attesta l'esecuzione.

## Comando completo

```sh
python tests/int004/run-consolidated-qa.py \
  --real-backup "$REAL_BACKUP" \
  --original-backup "$ORIGINAL_BACKUP" \
  --operational-root "$OPERATIONAL_ROOT" \
  --run-dir "$PRIVATE_RUN_DIR" \
  --require-clean
```

`REAL_BACKUP` è la copia recuperata rc4 da 28.402 righe, `ORIGINAL_BACKUP` l'originale da 28.544, `OPERATIONAL_ROOT` la cartella dello ZIP operativo fornito e conservato separatamente. Gli output dettagliati restano fuori dal checkout. I percorsi privati non sono necessari per confrontare i risultati pubblici: gli input sono identificati tramite checksum e conteggi, senza pubblicarne le righe.

Il runner richiede un checkout Git completo, Python Playwright e Chromium. Il normale uso locale del gestionale richiede solo il server HTTP; non richiede questi strumenti di test. Il gate termina in errore al primo FAIL bloccante e la build corretta deve ripetere l'intero ciclo.

## Ambiente e limiti espliciti

- **Eseguito:** Chromium Linux via HTTP locale, profili nuovi e isolati, moduli reali e input pubblici congelati o copie private fornite.
- **Rete dei test:** CSS dei font remoti sostituito da foglio vuoto e aggiornamento live automatico posticipato mediante i timestamp di cache già previsti dall'app, soltanto nei profili di prova. Nessuna funzione applicativa viene sostituita e nessun risultato sportivo viene inventato. Gli aggiornamenti live non devono cambiare il campione durante una migrazione controllata; richieste esterne impreviste restano bloccate e gli errori di console non vengono filtrati.
- **NON ESEGUITO:** Windows nativo e `file://`, aggiornamento live delle fonti, uso di un registro trade personale non fornito. Il collaudo Windows e l'AUDIT indipendente spettano alla DIREZIONE.
- Il markdown completo `RETEST_BACKUP_REALE_RC5_FAIL_2026-10-29.md` non è stato fornito in questa sessione: il caso descritto nel commento è stato riprodotto sull'ultimo HEAD e sulle copie private disponibili, non si dichiara lettura di un allegato assente.
- La correzione non completa le stagioni parziali. Matrici e anomalie sportive pregresse restano distinte dal funzionamento dell'importazione. I 100 consolidamenti aggiuntivi rispetto al vecchio conteggio rc4 e le quattro osservazioni originali irrisolte rimangono espliciti e da esaminare nell'AUDIT.

Il superamento del gate di sviluppo consente una sola nuova richiesta di AUDIT, non autorizza un rilascio stabile.

## Revisione critica prima della build definitiva

- Verificata la direzione del confronto: un record incoming non può eludere il controllo aggiungendo una nuova osservazione a una storia che contiene anche il vecchio orario. È aggiunta un'asserzione specifica.
- Controllati gli ID qualificati per provider: lo stesso codice testuale su provider diversi non certifica lo stesso evento; istanti diversi rimangono conflitti, offset equivalenti rimangono compatibili.
- Provata la vera ripetizione FA Cup Crystal Palace–Everton del 4/1/2024 e il replay Everton–Crystal Palace del 17/1/2024, da fonte pubblica fissata tramite commit e checksum. È una fixture di regressione del riconoscimento, non una nuova competizione aggiunta al gestionale.
- Verificato anche il vero playout Serie A Spezia–Verona del 2022/23: 381 incontri archiviati, 380 nella classifica regolare.
- Il primo preflight completo ha intercettato un errore nel verificatore delle manuali già recuperate: pretendeva che l'intero record rc4 con metadati derivati fosse nuovamente annidato in `LegacyManualOriginal`. La foglia originale era invece conservata esattamente. Il verificatore ora controlla quella foglia, tutti i campi di dominio, i nomi sorgente e gli ID precedenti, anziché richiedere un secondo annidamento artificiale. Le sole differenze sono normalizzazione dei nomi, ID conservati come legacy, stato e versione del registro. Non sono rimossi i controlli sui dati e non è modificato il backup per far passare il test.
- Dopo queste correzioni il gate richiede nuovamente l'intero ciclo sulla build definitiva: il precedente preflight FAIL è archiviato, non riclassificato come PASS.
