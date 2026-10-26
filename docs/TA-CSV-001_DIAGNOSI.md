# TA-CSV-001 — Diagnosi tecnica

Data: 26 ottobre 2026. Baseline: commit `9dc238b309d1755541cf8390ad91c530d78a979c`, v0.2T.
Candidata: `Trading_Analytics_v0.2U-rc1_TA-CSV-001.html` con `ta-csv-import.js`.

## Difetti riprodotti nella baseline

1. **Due registri di riconoscimento non sincronizzati.** `SMART_LEAGUES` dell'importazione guidata contiene undici competizioni, mentre l'ultimo script della v0.2T estende `SUPPORTED_LEAGUES` e `LN`. Romania, Danimarca, Primeira Liga, Segunda e Ligue 2 non sono selezionabili nel menu per file. I codici aggiunti tardivamente a `LN` possono essere riconosciuti, ma la selezione manuale resta incompleta. Non è corretto attribuire il problema alla totale assenza dei codici nella v0.2T.
2. **Anteprima e parser discordanti.** `smartInspect` confronta le intestazioni senza distinzione fra maiuscole e minuscole; `parse` richiede invece `Date,HomeTeam,AwayTeam` con quelle maiuscole esatte. L'anteprima può riconoscere un file che poi non produce incontri.
3. **Normalizzazioni e formati non condivisi.** `League` e `Season` non vengono utilizzati dal parser standard per identificare la competizione. Il percorso guidato classifica `Date,Home,Away,HG,AG` come calendario, anziché interpretare il risultato finale. Il pulsante manuale v0.2T usa parser separati per extra e cache, con regole diverse dall'importazione guidata. I CSV delimitati da punto e virgola non sono letti dal tokenizer originale.
4. **Codici sconosciuti bloccati prima della selezione.** `smartInspect` solleva un errore per `Div` sconosciuto: la scheda diventa non modificabile, anche quando l'utente conosce la lega corretta. La nuova versione richiede invece una scelta esplicita; un codice conosciuto in conflitto non può essere rietichettato.
5. **Stagione solo dalla data.** `se` applica sempre il criterio luglio–giugno. Il campo `Season` dei CSV cumulativi viene perso anche nella compattazione dell'archivio, perché non è in `KO`. La conferma del nome file non corregge questo problema.
6. **Validazione temporale incoerente.** Alcuni parser usano direttamente `Date.UTC`, che normalizza date inesistenti. Inoltre risultati incompleti possono essere trattati come gare future all'interno di un import storico.

## Riscontro sul formato della utility

È stata fornita l'intestazione, non il programma della utility né un suo CSV completo con righe dati. Le **131 colonne** coincidono con il formato Football-Data stagionale 2025/26, presente anche nelle sorgenti ufficiali scaricate. La fixture `tests/fixtures/utility-header.csv` conserva questa intestazione.

Sono stati verificati il formato ufficiale reale e una riga **sintetica** costruita sotto l'intestazione fornita, inclusi codici riconosciuti (`RO1`) e sconosciuti con selezione manuale. Non è stato attribuito un valore reale a `Div` della utility senza averlo ricevuto; non si dichiara verificato il suo output integrale. I difetti sopra sono riproducibili nel codice e coperti dai test della candidata.

## Correzione e confini

`ta-csv-import.js` fornisce un unico parser per l'importazione guidata, il percorso manuale e il parser standard della candidata. Conserva i codici/alias già registrati in v0.2T, riconosce i principali schemi e usa `Country` per distinguere le due Superliga. Le colonne conosciute prevalgono sul nome file; una scelta manuale incompatibile con esse blocca il salvataggio. Metadati sconosciuti richiedono selezione esplicita, senza dedurre la lega dalla sidebar.

La stagione esplicita filtra i cumulativi e assegna le gare prive di `Season` entro una finestra plausibile giugno–luglio. Un'assegnazione a cavallo del confine automatico richiede conferma aggiuntiva. `o.CsvSeason` è conservato nel JSON compatto; i vecchi record senza metadato mantengono il criterio precedente. Non vengono inventate date o partite fuori dalla finestra.

La normalizzazione dei nomi squadra riguarda Unicode e spazi, poi riusa gli alias espliciti preesistenti. Non viene introdotto matching fuzzy. Il merge conserva risultati discordanti già presenti e non degrada i dati HT/quote. Una stagione esplicita in conflitto con un metadato già salvato viene trattata come conflitto, non sovrascritta.

Le formule statistiche, le regole di valutazione e il codice del registro trade non sono cambiati. Un test confronta byte per byte l'intero blocco da `weightedHistorical` fino al confine dell'importazione guidata: include modelli, analisi e classifiche. La variazione di `se` riguarda esclusivamente l'attribuzione della stagione, non le formule.

La v0.2T originale, `ISTRUZIONI.md`, `RAPPORTO_QA.md` e il catalogo originali restano invariati. Lo SHA-256 dell'HTML originale è `819491b53edd20768ce23134c271c2a99a1b80d4bdbf3b165d478dd26794f688`.
