# Piano di verifica consolidata e limiti — v0.2V

Questo documento descrive il metodo, non certifica il proprio commit. Il PASS conclusivo deve provenire dalla ricevuta esterna del commit congelato collegata nella PR dedicata. Dopo qualsiasi modifica ripetere l'intero gate con il nuovo SHA.

## Gate riproducibile

`python tests/v02v/run-full.py --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" --operational-root "$OPERATIONAL_ROOT" --run-dir "$RUN_DIR" --require-clean`

Il runner richiede un checkout pulito, firma tutti i sorgenti/dati/test/documenti, crea un secondo checkout pulito per evitare collisioni fra ricevute rc5 e v0.2V e fallisce se cambiano file durante il run. Esegue 15 gruppi esterni: uno contiene tutti i 17 controlli consolidati rc5; gli altri comprendono motore, oracolo/holdout, preservazione, nuove interazioni, sei suite rc5 sulla nuova pagina, prestazioni, due backup reali reimportati x3 e verifica integrale dei valori. Non usa ricevute di sviluppo precedenti.

`run-rc5-on-v02v.py` esegue lo stesso corpo dei test rc5 con **unica sostituzione del nome dell'HTML**; registra SHA originale e adattato. Nessuna aspettativa, asserzione, fixture, clic o regola temporale viene rimossa. I moduli realmente caricati restano quelli del pacchetto locale.

## Matrice bloccante

| Requisito | Verifica |
|---|---|
| CMP01 | Paese → competizione → club da archivio, selettori effettivi |
| CMP02 | Italia e Spagna indipendenti |
| CMP03 | Inter 2024/25 vs Barcelona 2025/26 |
| CMP04 | Leeds Championship → Premier League, stesso ID |
| CMP05 | Stagione corrente, gara di oggi e risultato futuro esclusi |
| CMP06 | Tutto storico e intervallo personalizzato inclusivo |
| CMP07 | Solo campionato vs coppa effettivamente presente |
| CMP08 | Casa/trasferta/neutro, senza contare una sede neutra come casa |
| CMP09 | Chiavi campione, mercati e numeri identici nelle due viste |
| CMP10 | Stagione parziale, FT/HT e denominatori distinti |
| CMP11 | Inversione di squadre **e filtri**, reset |
| CMP12 | Nessun pronostico o raccomandazione per gara ipotetica |
| Dashboard | Quattro pulsanti, ricerca alias/nazione, ripresa partita e comparatore |
| Calendario | Tutti i filtri, ordine/pagine, CSV completo, identità canonica |
| Persistenza UI | Watchlist, ordine/pin Paesi, filtri dopo reload |
| Avvio | Nessun dato demo, richiesta esterna automatica, scrittura matches o audit completo copertura |
| Nuovo recupero | Chiave IDB assente accettata; scrittura concorrente ancora bloccata |
| Archivio reale | Copie di originali, tre reimportazioni + proprio export, reload/Undo, confronto di tutte le sezioni |
| Conservazione | Tutte le righe contabilizzate, 172.964 valori quote per ciascuno dei due input, due payload manuali preservati |
| Formule rc5 | Tutti i file precedenti invariati, nuova pagina con sole differenze autorizzate controllate |
| Mercati/preset | Otto mercati, sei preset, 144 confronti numerici indipendenti e payoff rc5 |
| Storico | Playoff, playout, ripetizione reale FA Cup, no leakage anche con stagione etichettata male |
| Prestazioni | Recupero reale 28.300, riavvio sotto 30s, filtro/calendario e aggiornamento comparatore sotto 10s sul sistema di test |
| Browser | Chromium reale, clic/upload/download, screenshot pubblici/sintetici, Console/pageerror zero |

Oracolo Python su I1 2024/25: conta partite/V/P/S, gol e HT direttamente dalle colonne del pacchetto pubblico, senza chiamare il motore JS. I test unitari aggiungono falsi positivi/negativi, clock UTC/senza fuso, intervalli, riposo, sede neutra, risultati dopo supplementari e campioni vuoti. Le funzioni temporali escludono tutte le gare nel giorno limite: scelta più prudente rispetto al consentire risultati precedenti con kickoff noto.

## Problemi trovati e corretti durante il preflight

1. Il blur dei filtri ricreava un pulsante watchlist prima del click: nessuna rigenerazione quando i valori sono già applicati. Verifica immediata e dopo reload.
2. Avvio senza scrivere uno snapshot vuoto: il piano rc5 normalizzava assenza come `null`, il confronto atomico IDB leggeva `undefined`. La sola assenza reale viene normalizzata prima della transazione; fingerprint e confronto della revisione restano integri. Test di scrittura concorrente prova il blocco.
3. Il callback di aggiornamento automatico rc5 era già stato catturato da un timer: eliminato nel nuovo HTML, non soltanto riassegnato il nome. Prova in profilo privo di timestamp-cache.
4. Il confronto integrale di 138 combinazioni di copertura era chiamato all'avvio: avvio differito fino al caricamento dei moduli, pannello copertura lazy; funzione e formule di confronto originali immutate.
5. Gara futura con un risultato erroneamente già presente dopo oggi: limite osservativo comune applicato anche a segnali e H2H, non soltanto ai profili. Test unitario e click browser con risultato futuro avvelenato; gate completo ripetuto sul nuovo commit.
6. Menu laterale: selezione competizione sincronizzata con contesto rc5, Scanner e Backtest; competizioni senza dati e filtri persistiti non ricadono implicitamente su tutte le leghe. Prova di navigazione effettiva e fingerprint archivio invariato.
7. Perimetro ufficiale: amichevoli dichiarate e competizioni senza qualifica ufficiale escluse da «tutte», mantenute nel calendario e nel confronto della singola competizione. Verifica numerica separata, nessuna cancellazione.
8. Calendario: fase e giornata entrambi filtrabili anche quando coesistono nella stessa gara; caso coppa knockout/giornata 7. Gate intero ripetuto dopo la correzione.
9. Il controllo conclusivo dello stato Git usava `strip()`, che eliminava lo spazio di stato della prima riga e troncava la q di `qa/`. Corretto con `rstrip("\n")`: formato porcelain preservato, nessuna modifica fuori QA autorizzata. Tutti gli hash sorgente erano già invariati; l’intero gate viene comunque ripetuto sul nuovo SHA.
10. Selezioni iniziali dei test non visibili e label canonica Leeds: corretto il percorso di clic e usato il nome effettivamente emesso dal catalogo, senza cambiare identità o risultati attesi.

## Limiti espliciti

- Windows nativo, `file://`, aggiornamento live delle fonti: **NON ESEGUITO** in ambiente Linux. Collaudo indipendente richiesto; istruzioni Windows in LEGGIMI_v0.2V.md.
- Archivio e journal personali non pubblicati; diario personale non fornito, regressione su journal sintetico con voti/quote congelati. Nessun test distruttivo sugli originali.
- La completezza degli storici resta distinta dal recupero: fonti congelate con stagioni parziali e non verificabili, quattro osservazioni originali irrisolte conservate dalla rc5, nessuna sanatoria o risultato inventato.
- Il Comparatore mostra campioni reali, non certifica completezza dal solo numero di partite. Riferimento completo per campionato/stagione in Area tecnica; HT mancante non equivale a gara mancante.
- Posizione nuova: ricostruzione descrittiva **per punti**, pari punti a pari posizione, senza pretendere spareggi regolamentari ufficiali o modificare le classifiche rc5.
- Segnali descrittivi, non probabilità calibrate o verifica di valore delle quote. Comparazioni interlega prive di coefficienti arbitrari.
- Coppe predisposte tramite dati effettivamente disponibili; un confronto coppe completo, grafici posizionali/colorazioni e confronti di 3–4 club restano fuori dal P0.
