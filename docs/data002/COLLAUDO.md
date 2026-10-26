# TA-DATA-002 — Collaudo indipendente

## Avvio e protezione degli archivi

1. Scaricare il ramo `fix/ta-data-002-identita-integrita` in una nuova cartella. Non sovrascrivere le versioni precedenti.
2. Tenere insieme HTML rc2, `ta-csv-import-v02U-rc2.js` e `ta-clubs-v1.js`.
3. Eseguire dalla cartella `python -m http.server 8000 --bind 127.0.0.1` e aprire il documento `Trading_Analytics_v0.2U-rc2_TA-DATA-002.html` sul server locale. Non è una pubblicazione web. Il percorso file:// è bloccato dalla policy del browser cloud e non viene dichiarato verificato; non aggirare il blocco.
4. Usare inizialmente un profilo browser di test. Nessun test distruttivo su archivi personali. Le vecchie versioni conservano i loro database e chiavi; la rc2 usa `TradingAnalyticsArchiveV3_TADATA002` e `TradingAnalyticsTradeJournal_v1_TADATA002`, con prefisso locale `ta_data002_` per gli archivi. Le preferenze di aggiornamento non costituiscono dati migrati.
5. Esportare separatamente backup degli incontri e registro trade dalla versione precedente e conservarli fuori dalla cartella di collaudo. L'archivio inizialmente vuoto della rc2 è intenzionale.

## Verifiche operative

- Importare i CSV nell'Area tecnica. Controllare lega e stagione per ogni scheda. Per il caso noto+sconosciuto, verificare che Importa non scriva alcuna riga prima di una risoluzione esplicita. La checkbox certifica soltanto le righe anomale indicate: usarla esclusivamente quando la loro lega è nota.
- Provare le due fixture di provenienza del pacchetto indipendente. Il filtro 2024/25 deve generare solo le due associazioni previste, anche per la gara di luglio; il CSV normalizzato deve salvare le stesse righe mostrate dalla preview.
- Importare PSG/Paris SG/Paris Saint-Germain, Lione/Lyon/Olympique Lyonnais, Inter/Internazionale Milano, Manchester United/Man Utd e Sporting CP/Sporting Lisbon su gare identiche. La reimportazione deve conservare un solo incontro, risultati e provenienze.
- Provare Paris FC contro PSG e Manchester City contro Manchester United: devono restare club distinti. Paris, Manchester o Sporting generici devono essere segnalati, non assegnati arbitrariamente.
- Aprire Classifiche, Calendario, Analisi e Scanner con dati sufficienti. Confrontare numero di gare, gol e nomi prima e dopo la reimportazione degli alias; non interpretare un voto diverso a seguito di una reale correzione del dataset come modifica della formula.
- Nella diagnostica dell'anagrafica esportare identità e anomalie. Il pannello mostra soltanto le prime 80 anomalie; il JSON è completo.

## Simulazione e backup

Il ripristino JSON produce il rapporto prima/dopo **prima della conferma**. Controllare record iniziali/finali, incontri con nomi cambiati, campi protetti e collisioni. Annullare la prima volta e verificare che l'archivio sia invariato. Il vecchio database non viene mai sostituito dalla rc2. Una collisione fra alias non viene eliminata automaticamente: il backup resta originale e l'applicazione della migrazione è bloccata.

Ripetere con conferma solo sulla copia di test. Esportare e ricaricare per verificare persistenza di ID, nomi originali, risultati, HT, tiri e quote. Il trasferimento «Importa archivio precedente» usa la stessa simulazione prima dell'unione; le discordanze con record già presenti vengono conservate e segnalate.

Il registro trade ha un backup distinto. Importare una copia: i campi congelati devono rimanere identici, anche quando le stesse squadre vengono normalizzate nell'archivio incontri. La compatibilità v2 è verificata da vecchio a nuovo; le vecchie versioni non conoscono i nuovi ID e possono scartare metadati nella nuova esportazione. Per tornare indietro usare i backup originali, non affidarsi a un roundtrip attraverso una versione precedente.

Le provenienze vecchie prive della data di evidenza sono conservate, ma non certificano appartenenze nei grafici con cutoff finito. Questo evita di utilizzare evidenze potenzialmente future; non viene inventata una data per renderle utilizzabili.

## Comandi dei test

Ambiente collaudato: Node 24, Python 3.12, Playwright Python e Node già installati, Chromium di sistema `/usr/bin/chromium`. Gli script AUDIT originali non sono modificati; il runner adatta soltanto percorsi ed eseguibile. Eseguire dalla radice del checkout Git:

```sh
# Regressione parser originale sulla rc2, più controlli specifici e formule protette
node --require ./tests/data002/load-rc2.cjs --test tests/csv-import.test.cjs
node --test tests/data002/core.test.cjs

# Fixture ufficiali usate da TA-CSV-001 e suite browser completa sulla rc2
python tests/fetch-sources.py --output /tmp/ta-csv-001-sources
python tests/data002/run-compat.py

# AUDIT originale, prima e dopo
python tests/data002/run-independent.py --label audit-baseline --expect-baseline-failures
python tests/data002/run-independent.py --label audit-rc2 --candidate Trading_Analytics_v0.2U-rc2_TA-DATA-002.html

# Nuove prove di identità, archivi separati, cutoff e trade congelati
python tests/data002/browser-identities.py

# Ricognizione e integrità: fonti pubbliche, TLS verificato
python tests/data002/fetch-inventory.py
git clone https://github.com/openfootball/champions-league.git /tmp/ta-data002-champions
git -C /tmp/ta-data002-champions checkout abfaeddc2ee3d14f99ecc163c9ddb46cb4d67cef
python tests/data002/collect-names.py
node tests/data002/inventory.cjs
node tests/data002/integrity.cjs
```

Se la cartella OpenFootball esiste già, non clonarla nuovamente né cancellarla: verificare il commit. I CSV remoti possono cambiare; confrontare i checksum con il manifest prima di affermare che si tratta dello stesso campione. Gli script usano profili temporanei, rete esterna bloccata durante il browser test e server loopback su porta libera, poi chiusi. Gli output QA locali vengono riscritti: esaminarne le differenze.

Non verificati: browser Windows/mobile reali, archivi personali, storici non forniti delle quattro competizioni indicate e completezza federale delle stagioni. La DIREZIONE decide l'eventuale approvazione stabile dopo la revisione, non questi script.
