## DIREZIONE — OBBLIGO DI COLLAUDO PRIMA DI OGNI CONSEGNA (29/10/2026)

**Nuova regola operativa vincolante per Codex:** non presentare più una versione come "conclusa", "pronta per AUDIT" o "funzionante" senza aver **eseguito personalmente almeno un ciclo end-to-end reale, completo e documentato sulla stessa identica versione/commit che viene consegnata**. I test unitari da soli, i vecchi rapporti PASS e i controlli statici non bastano. L'AUDIT indipendente serve a controllare una candidata già collaudata dallo sviluppatore, non a fare da primo tester. È necessario interrompere il continuo ping-pong tra rilascio, errore banale, nuova correzione, nuovo errore.

### Nuovo FAIL indipendente da risolvere
L'AUDIT del 29/10 ha consegnato `RETEST_BACKUP_REALE_RC5_FAIL_2026-10-29.md`. Sulla candidata **b379d6f**, il backup reale già recuperato da 28.402 osservazioni diventa 28.300 incontri al primo import; export, persistenza e Undo passano, **ma reimportare lo stesso JSON nello stesso archivio produce cinque gruppi di conflitti `kickoff-disagreement`** e anteprima `safe=false`. Il difetto è stato riprodotto con due sole righe sintetiche. La riconciliazione calendario/risultato conserva sia `Time` (15:30) sia `SourceTime` (14:30) di fonti senza fuso confrontabile: al secondo passaggio `context()` privilegia `Time` e `relation()` vede un conflitto prima non presente. Riferimenti: `ta-fixture-identity.js`, `ta-json-recovery-rc5.js`.

Riproduttore sintetico minimo (testare su **ultimo HEAD**, non su una copia precedente):
```js
const R = require('./ta-json-recovery-rc5');
const calendar = {
  d: Date.UTC(2025, 7, 22), lg:'Serie B', H:'Pescara', A:'Cesena', up:true,
  h:null,a:null,ht:null,hth:null,hta:null,shots:null,
  o:{CsvSeason:2025,Time:'15:30',Source:'Synthetic schedule'}
};
const result = {...calendar,up:false,h:1,a:3,
  o:{CsvSeason:2025,SourceTime:'14:30',Source:'Synthetic result'}};
const first=R.plan([calendar,result]);
const again=R.plan([calendar,result],first.records);
console.log(first.report.safe,again.report.safe); // FAIL osservato: true,false; richiesto: true,true
```
Non rimuovere indiscriminatamente i controlli sugli orari, non cancellare le osservazioni originali e non forzare fusioni. Conservare provenienze, fusi espliciti, quote, FT/HT, eventi distinti e conflitti realmente nuovi. Le righe private e il backup dell'utente non devono essere pubblicati.

**Distinguere i commit:** l'AUDIT del backup ha verificato b379d6f; la correzione `safeKickoffFuture` è in **c6d9aa4** e non è ancora coperta da quell'AUDIT. La prossima consegna deve includere entrambi i fix sulla stessa candidata.

### Gate QA obbligatorio prima della nuova consegna
1. **Ricostruzione pulita**: partire dall'esatto ZIP/commit candidato in nuova directory, con moduli e dipendenze reali, browser/profilo puliti e server HTTP; verificare caricamento e assenza di `pageerror`/errori di console.
2. **Percorso utente completo con click reali**: apertura, anteprima JSON, conferma, esportazione, riapertura, **reimportazione dello stesso backup (anche più volte)**, nuova riapertura, confronto di tutti i dati e Undo. Testare sia dataset sintetico, sia copia isolata del backup reale disponibile privatamente, senza scrivere negli originali.
3. **Backtest e Scanner realmente usati**: cliccare `Esegui Backtest` con gare di oggi (orario futuro, passato, assente, offset esplicito), domani e manuali; cliccare Scanner; verificare sei preset, otto mercati, filtri, risultati numerici, ricerca e CSV completo. Evitare che un `||` mascheri un ramo non percorso.
4. **Regressioni integrali**: alias, dedup, vere fasi sportive, import CSV e pacchetti storici, HT/quote, classifiche/analisi, integrità trade, transazioni/Undo; controlli di differenze sui file protetti. Verificare anche conflitti di orari veramente discordanti, provider diversi, playoff e ripetizioni reali.
5. **Evidenze fresche e verificabili**: matrice dei casi attesi/osservati, comando esatto di ogni prova, SHA/commit/ZIP testato, ambiente, log, screenshot o risultati browser e confronto prima/dopo, con marcatura distinta `PASS`, `FAIL`, `NON ESEGUITO`. Una suite non eseguita non è PASS; non riciclare ricevute dei commit precedenti.
6. **Criterio di stop**: se anche **un solo test bloccante** fallisce, correggere e rifare **l'intero smoke test sulla nuova build**, senza consegnare la candidata alla DIREZIONE o all'AUDIT. Eseguire una revisione critica del codice oltre ai test. La DIREZIONE riceve un solo pacchetto consolidato e stabile nel perimetro, non micro-aggiornamenti.
7. **Trasparenza sull'ambiente**: Chromium/Linux/HTTP non va dichiarato collaudo Windows. Il test Windows nativo spetta alla DIREZIONE, ma le regressioni riproducibili nell'ambiente di sviluppo devono essere intercettate da Codex prima della consegna.

### Vincoli
- PR #4 resta **draft**; nessun merge su `main`, nessun deploy.
- Non modificare i backup personali o gli archivi operativi.
- Non iniziare nuove funzionalità delle classifiche/Analisi partita prima della chiusura dei difetti P0.

**Consegna accettabile solo dopo:** correzione e test end-to-end ripetibile del FAIL di reimportazione, regressione Backtest odierno risolta, report QA finale riferito allo SHA esatto dell'ultimo commit, anomalie residue esplicitate e assenza di FAIL bloccanti. Solo allora richiedere un unico nuovo AUDIT indipendente.
