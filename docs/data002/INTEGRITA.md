# TA-DATA-002 — Integrità prima/dopo

Simulazione senza scritture su database, su 77 CSV nazionali pubblici. Gli archivi Champions e la fonte corrente croata sono usati per la ricognizione dei nomi, non aggiunti arbitrariamente al corpus delle partite.

- Record iniziali: **36.789**.
- Record finali: **36.789**.
- Incontri con almeno un nome principale cambiato: **170**.
- Collisioni: **0**.
- Errori: **0**.
- Input originario non mutato. Nessun incontro eliminato o aggiunto dalla simulazione.

L'impronta SHA-256 dei campi protetti è identica prima e dopo:

```text
7459a46de91488a8fd47a0b973580e48cba250b4265cc1c9ed8ad475ae60b885
```

Comprende, record per record e nello stesso ordine: data, lega, FT, HT totale e parziali, tiri, stato futuro/concluso e tutti i metadati originali non Club, comprese le quote. Le sole aggiunte sono metadati Club e i soli cambi ammessi nei campi primari sono H/A. I file sorgente sono verificati contro il manifest prima della simulazione.

Questa prova non equivale al caricamento di 36.789 partite nel browser o a un test prestazionale. Il corpus è elaborato in Node; persistenza e roundtrip effettivi sono verificati nei browser test con dati sintetici e nella matrice reale da 5.151 incontri.

## Protezioni delle migrazioni

- La rc2 apre un archivio separato e non migra automaticamente incontri o journal precedenti.
- Ripristino e trasferimento JSON calcolano un piano prima della conferma. Il piano non muta input o registro osservazioni ed è esportabile.
- L'annullamento non scrive incontri. Collisioni di identità e dati invalidi bloccano l'applicazione, anziché perdere record per deduplicazione.
- Nei CSV e aggiornamenti, una reimportazione per alias esplicito riusa l'ID. Le denominazioni e provenienze si accumulano. I risultati discordanti già presenti sono conservati.
- Metadati originali, HT realmente 0–0, tiri e quote sono confrontati dopo persistenza e backup. Un eventuale Phase dichiarato è conservato, senza deduzione o nuove regole.
- I trade importati mantengono nomi, score, operationScore ed eventi. Il vecchio archivio e il vecchio journal nello stesso profilo/origine restano byte-equivalenti dopo l'uso della rc2.

Le prove delle conferme/collisioni e dei due ultimi punti sono in identity-browser.json; la simulazione del corpus è in integrity-corpus.json. I rapporti contengono dati pubblici o sintetici, nessun archivio personale.

## Compatibilità e limiti

Il contenitore resta TradingAnalyticsBackup v2, con i dodici slot compatti originali e metadati aggiuntivi in o. Sono gestiti i trasferimenti records/rows/array previsti dal prodotto. Le versioni precedenti possono ignorare o perdere metadati nuovi riesportandoli: per tornare indietro conservare i backup originali. Nessun formato tecnico locale non documentato viene convertito per supposizione.

Gli archivi con alias diversi sulla stessa gara possono produrre collisioni: il piano le segnala e si arresta. La loro risoluzione non è automatica. I riferimenti vecchi senza evidenceDate non sono usati come prova storica a cutoff finito: non si inventano date per renderli utilizzabili.
