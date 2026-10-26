# Rapporto QA · TA-DATA-002B · 26 ottobre 2026

Versione candidata v0.2U-rc3, basata su rc2 `fb0ad33`. Verifiche locali riproducibili, pronte per nuova revisione indipendente. Nessuna approvazione stabile.

| Verifica | Esito | Evidenza |
| --- | --- | --- |
| Recupero, duplicati, conflitti, alias, Paesi e formati | 31 test unitari PASS | `qa/data002b/unit.txt` |
| Parser CSV effettivamente riutilizzato dalla rc3 | 30 test unitari PASS | `qa/data002b/csv-unit.txt` |
| Procedura guidata, persistenza, rollback e identità operative | 20 gruppi browser PASS, nessun pageerror | `qa/data002b/browser.json` |
| Matrice reale 8 campionati × 2 stagioni | 16 casi PASS, 5.151 incontri | `qa/data002b/csv-regression.json` |
| Regressioni della suite TA-CSV-001 | 9 gruppi PASS | stesso rapporto |
| AUDIT originale IND-01…IND-06 | PASS | `qa/data002b/audit-rc3/independent-browser.json` |
| Quattro controlli roundtrip/analisi AUDIT | PASS | `qa/data002b/audit-rc3/independent-roundtrip.json` |
| Corpus pubblico, 77 CSV | 36.789 incontri, input/output e fingerprint protetti invariati | `qa/data002b/integrity-corpus.json` |
| Sorgenti precedenti, sei formule, codice registro trade | Identici; sintassi rc3 valida | `qa/data002b/preservation.json` |
| Avvio file:// / IND-07 | ERROR ambientale, non PASS | `ERR_BLOCKED_BY_ADMINISTRATOR` |
| IND-08 / regole sportive | OBSERVATION | Nessuna nuova regola introdotta |
| Backup personale e 40 collisioni citate | NON VERIFICABILE con gli allegati disponibili | Vedi diagnosi |

Sono 61 test unitari sulla nuova procedura e sul parser riutilizzato. I file rc2 e precedenti rimangono immutati; i test originali dell'AUDIT sono conservati con i loro checksum. La loro riesecuzione locale non costituisce una nuova firma indipendente.

## Copertura browser mirata

Le 20 prove comprendono simulazione senza scritture, rapporto esportabile anche dopo errore, conservazione dopo ricaricamento, consenso al parziale, salvataggio coerente delle sezioni ausiliarie e ripristino. Un abort provocato dopo richieste di scrittura e prima del commit lascia invariati snapshot e puntatore di ripristino. Una revisione cambiata impedisce l'applicazione di una vecchia anteprima.

È provato il rifiuto delle scritture localStorage durante il commit IndexedDB, il recupero con metadati ausiliari discordanti bloccato prima delle scritture, il roundtrip completo su un profilo nuovo con consenso alle regole, la stabilità degli ID dopo reload e reimportazione, la correzione di un singolo alias e la separazione senza modificare gli altri incontri. La conferma multipla richiede verifica esplicita. Sono provati eventi gol, chiavi precedenti e contesto del campionato.

Il registro trade è seminato soltanto con fotografie sintetiche: voti congelati, eventi e quote rimangono uguali. Un archivio rc2 nello stesso browser/origine resta byte per byte invariato dopo il recupero rc3.

## Adattamenti dichiarati

La suite precedente mantiene gli assert su conteggi, stagioni, date, risultati, tiri, quote e trade. Cambiano il nome del candidato e i percorsi di output. Come in rc2, i nomi sorgente si confrontano attraverso `ClubHomeRaw`/`ClubAwayRaw`; il compact JSON può contenere metadati identità aggiuntivi, mantenendo tutti i campi originali.

L'importazione JSON ora richiede un'anteprima e un pulsante di conferma, quindi l'adattatore attende il rapporto e preme esplicitamente il nuovo pulsante. Il JSON non valido si verifica attraverso lo stato bloccato del rapporto, anziché il vecchio messaggio di ripristino. Gli assert sostanziali rimangono. Registro degli adattamenti in `qa/data002b/compat-adaptations.json`.

Gli script AUDIT ricevuti non cambiano: il runner adatta solo percorsi, candidato, eseguibile Chromium e destinazione dei log. I controlli sulle formule confrontano il codice con rc2. I checksum delle sorgenti esatte usate dalla prova mirata sono registrati in `browser.json`; la prova fallisce se i file cambiano durante l'esecuzione.

## Limiti e accettazione

- Il rapporto personale ricevuto censisce **28 collisioni su 8.225 righe**, non 40; non contiene risultati o quote delle coppie. Nessuna delle 28 è certificata come copia identica o conflitto FT senza il backup.
- Le 242 coincidenze contestuali nei rapporti anagrafici sono proposte da verificare. Non sono state automaticamente fuse le identità dell'utente. Le tre ambiguità del rapporto rimangono da risolvere sui dati originali.
- Restano i limiti delle fonti storiche dichiarati in TA-DATA-002: non vengono certificate stagioni complete o nuovi storici mancanti.
- La verifica da 36.789 incontri è una simulazione Node; il collaudo browser reale è quello da 5.151 incontri, oltre alle fixture sintetiche. Non è una certificazione di prestazioni su ogni archivio personale.
- Non sono stati verificati browser fisici Windows/macOS, dispositivi mobili o interruzioni elettriche. Nessuna policy amministrativa è stata aggirata.

Il lavoro tecnico è consegnato per revisione. **Il criterio di accettazione relativo al recupero integrale del backup personale rimane aperto**, perché il backup non è disponibile. Nessun merge su main o deploy stabile.
