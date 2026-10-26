# Uso e collaudo della candidata rc3

## Apertura

1. Scaricare lo ZIP del ramo della PR #2 ed estrarlo completamente.
2. Aprire `Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html` tramite il server HTTP già usato per il progetto. Per un collaudatore con Python: dalla cartella estratta, `python -m http.server 8000 --bind 127.0.0.1`; aprire `http://127.0.0.1:8000/Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html`.
3. Entrare in **Area tecnica → Backup e recupero JSON**. Attendere **Memoria estesa · IndexedDB**.

La rc3 ha un archivio partite separato. Vedere zero incontri all'apertura non significa perdita delle versioni precedenti. Il file HTML e i quattro moduli elencati nel dossier devono stare insieme. L'apertura `file://` non è certificata: il browser cloud la blocca per policy.

## Recupero senza modificare il JSON

1. Nella vecchia versione che contiene ancora le partite usare **Scarica backup JSON**. Conservare il file originale. Un file `anagrafica` o `integrita` è un rapporto: non sostituisce questo backup.
2. Nella rc3 premere **1. Scegli backup JSON**. Anche i due precedenti selettori JSON aprono questa procedura.
3. Controllare formato, partite, campionati, stagioni e numero di righe importabili/problematiche. Esaminare le righe evidenziate e i dettagli delle due copie. Le segnalazioni sono paginabili; **Scarica rapporto completo** le esporta tutte.
4. Aprire **Nomi prima e dopo** e **Conseguenze sui raggruppamenti statistici**. Questi conteggi sono descrittivi di tutto l'archivio; le analisi operative mantengono i propri filtri e modelli.
5. Se non ci sono conflitti, premere **3. Conferma e salva** e confermare il riepilogo. Le partite già presenti vengono conservate e unite ai dati sicuri.
6. Se il rapporto consente un recupero parziale, leggere l'elenco degli esclusi e selezionare la relativa casella esplicita. Vengono esclusi solo i record problematici del file; gli incontri correnti non sono cancellati. Tutte le righe escluse rimangono nel rapporto e nel file originale.
7. Un conflitto nei dati ausiliari o nell'archivio corrente blocca il recupero intero. Non occorre intervenire a mano sul JSON: usare la gestione identità per i casi risolvibili; per risultati/quote discordanti serve verificare la fonte e produrre un backup corretto dalla versione che conserva i dati.
8. Attendere **Salvataggio verificato**, ricaricare e scaricare un nuovo backup. Per tornare alla situazione immediatamente precedente usare **Ripristina situazione precedente**. Il pulsante protegge da ripristini che cancellerebbero modifiche successive.

Se una transazione viene interrotta o rifiutata prima del commit, la situazione precedente resta intera. Se il messaggio chiede una ricarica dopo una verifica o un aggiornamento delle viste, non ripetere subito l'importazione: ricaricare, controllare il rapporto e usare il ripristino se necessario.

## Gestione squadre

- Cercare nome o alias e premere il nome della squadra. I dettagli mostrano Paese, fonti, tutti gli alias noti e, nella sezione espandibile, ID e provider.
- Per confermare un alias o correggere una destinazione, scrivere la denominazione originale, verificare il Paese, scegliere il club corretto e annotare fonte/motivazione.
- L'ambito predefinito riguarda soltanto quella denominazione nel Paese. **Intera identità selezionata** richiede un controllo più ampio delle conseguenze.
- Per separare una denominazione associata erroneamente, scegliere **Mantieni come club distinto**, indicare un nome e simulare. Viene attribuito un ID persistente distinto. Una selezione per ID della fonte mantiene anche il provider: ID uguali di provider diversi non provano equivalenza.
- Premere **Simula conseguenze**, controllare partite e raggruppamenti prima/dopo e infine **Conferma e salva** nel recupero guidato. Le associazioni discordanti o che unirebbero avversari bloccano la conferma.
- Si può caricare un precedente rapporto anagrafico per esaminarne i nomi. Questo non importa partite e non conferma associazioni. Le proposte con destinazione unica possono essere confermate insieme soltanto selezionando la verifica esplicita e controllando la simulazione.
- Un club distinto senza alias alternativi non è un'anomalia bloccante. `UNSPECIFIED` non viene trasformato in un Paese per una semplice somiglianza.

Le decisioni vengono salvate nella stessa transazione delle partite e incluse nel backup JSON. Nel nuovo profilo browser, l'uso delle decisioni presenti nel backup richiede una casella esplicita e una nuova simulazione.

## Rapporti e limiti di recupero

Il rapporto sopravvive al ricaricamento finché l'utente non lo elimina o avvia una nuova simulazione. Dopo il ricaricamento, per confermare occorre selezionare nuovamente il file: evita di applicare un'anteprima vecchia a un archivio cambiato. In assenza di IndexedDB viene dichiarata la mancata conservazione tra sessioni; il rapporto corrente resta scaricabile e il recupero transazionale è bloccato.

Gli allegati disponibili per questo mandato non contengono il backup delle partite. Il rapporto ricevuto permette di censire 28 collisioni, ma non di verificarne FT o quote. Non è quindi dimostrato il recupero completo dell'archivio personale.

## Riproduzione tecnica

```sh
node --test tests/data002b/recovery.test.cjs
node --require ./tests/data002/load-rc2.cjs --test tests/csv-import.test.cjs
python tests/data002b/preservation.py
python tests/data002b/browser.py
```

La suite browser richiede Playwright Python e Chromium in `/usr/bin/chromium`, disponibili nell'ambiente cloud. `tests/data002b/run-regressions.py` richiede il campione pubblico in `/tmp/ta-csv-001-sources`; `node tests/data002b/integrity.cjs` richiede l'inventario pubblico in `/tmp/ta-data002-sources`. Sono ricostruibili con gli script e le istruzioni della consegna TA-CSV-001 / TA-DATA-002; controllare i checksum perché le fonti possono cambiare. Gli allegati personali non servono ai test automatici pubblicati.
