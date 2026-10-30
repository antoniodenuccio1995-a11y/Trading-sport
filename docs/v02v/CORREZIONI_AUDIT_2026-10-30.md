# Correzione dei tre difetti AUDIT v0.2V

Intervento autorizzato il 30/10/2026, limitato a IND-01, IND-02 e IND-03.
Nessuna nuova funzionalità, modifica grafica, merge o rilascio stabile.
La candidata esaminata è `240f747d9891e4754945be66096cbda67e1a05fd`;
il commit della correzione e i risultati conclusivi sono identificati nella
ricevuta QA esterna della PR #6, prodotta dopo il collaudo di una copia pulita.
Questo documento descrive implementazione e prove; non sostituisce quella ricevuta.

## Fonti lette e riproduzione prima della correzione

Letti integralmente [README](https://github.com/antoniodenuccio1995-a11y/Trading-sport/blob/30fddfa99b6c78acd5f38c94c41f67352fde6420/audit/2026-10-30-v02v-240f747/README.md)
e [rapporto AUDIT](https://github.com/antoniodenuccio1995-a11y/Trading-sport/blob/30fddfa99b6c78acd5f38c94c41f67352fde6420/audit/2026-10-30-v02v-240f747/RAPPORTO.md).
Verificato SHA-256 di EVIDENZE.zip:
`873846128bf55f6cbb9309fa49ebafed296455a0cca9ed2903a156fc32fe51c5`.
Il contenuto è disponibile nel ramo di audit senza autenticazione Drive.

Il riproduttore Node originale è conservato byte per byte in
`tests/v02v/audit-repro.cjs`. Eseguito prima dell'intervento sul commit esaminato,
ha riprodotto tutti e tre i FAIL (osservati 3/0/2, attesi 5/1/1, exit 1).
Anche lo script browser dell'auditor è stato eseguito prima della correzione,
configurando esclusivamente percorsi di repository/output ed eseguibile Chromium,
senza cambiare aspettative o asserzioni: stessi tre difetti riprodotti.
Gli originali dell'auditor restano nel suo ramo immutato.

## IND-01 — Ultimi N risultati H2H

Il limite veniva applicato alle osservazioni e soltanto dopo venivano esclusi
FT mancanti, calendari e risultati non validi a 90 minuti. Ora `h2h()` applica
identità, taglio temporale, perimetro e validità FT prima della finestra 5/10.
HT mancante non esclude un risultato FT valido. Risultati dichiarati dopo
supplementari/rigori non sostituiscono un FT90.

Le righe originali restano nell'archivio, nel Calendario e nel prospetto di
copertura. La diagnostica H2H distingue `quality.availableFT` (tutti i risultati
utilizzabili nel perimetro prima del limite) e `quality.excludedFT` (osservazioni
senza FT utilizzabile). `quality.observed` e gli altri denominatori della sintesi
si riferiscono alla finestra effettivamente mostrata.

Regressioni: sei FT più due osservazioni senza FT restituiscono 5/6/6 per
5/10/tutto; ulteriori casi con 12 FT, meno di cinque FT, HT mancanti, AET/rigori,
giorno corrente/futuro, conteggi diagnostici e archivio invariato.
Sul backup recuperato reale ogni coppia è controllata a 5/10/tutto con un oracolo
separato che filtra i FT prima del limite. Si pubblicano solo aggregati.

## IND-02 — Un solo giorno osservativo

Politica esplicita: **Europe/Rome**, già usata dal Calendario dell'interfaccia,
indipendentemente dal fuso del browser o del sistema operativo. `day(instant)`
usa `Intl.DateTimeFormat` e il database dei fusi; non somma un offset fisso.

Le date degli incontri sono date civili codificate a 00:00Z. Il giorno romano
viene convertito nello stesso tipo di valore: non rappresenta l'istante fisico
della mezzanotte italiana. Non vengono traslate o riscritte le date archiviate,
né modificati gli orari kickoff o la loro verifica prudenziale rc5.

`select`, `profile`, `h2h`, `interpret`, giorno del Calendario e indicazione della
stagione corrente del Comparatore usano lo stesso confine. Il giorno osservativo
e i giorni successivi rimangono esclusi; un cutoff storico più restrittivo ha
sempre precedenza. Riposo/congestione usano il cutoff effettivamente applicato al
campione, anche se la partita scelta è futura.

Regressioni: mezzanotte invernale/estiva, passaggi DST, doppia ora autunnale,
fine mese/anno e istanti con offset diversi; processi con quattro fusi di sistema.
Nel browser cinque istanti × tre fusi (Roma, New York, Tokyo), upload JSON e
clic su Comparatore, Calendario Oggi e Analisi partita/H2H/segnali. Verificati
ieri incluso, oggi/futuro esclusi e stagione corrente coerente.

## IND-03 — Tipo e ufficialità separati

La presenza di Cup/Coppa/Copa/Coupe nel nome può aiutare a descrivere il tipo;
**non dimostra ufficialità**. Un record entra nel perimetro «Tutte le competizioni
ufficiali» soltanto se la competizione è nel registro esistente `TAClubs.countries`
oppure ha il metadato booleano `o.Official === true`.
`Official === false` prevale anche sul registro. Amichevoli dichiarate o
riconoscibili restano escluse anche con flag true. Un `CompetitionType` da solo
descrive la tipologia, senza qualificare ufficialità. Stringhe `"true"` non sono
convertite implicitamente in una certificazione positiva.

Nessun nuovo registro di competizioni, modifica ai dati o migrazione automatica.
Competizioni sconosciute restano consultabili singolarmente, nel Calendario e
nell'archivio; sono escluse soltanto dal perimetro ufficiale non qualificato.
Una coppa effettivamente registrata, come Champions League, resta inclusa.

Regressioni: nomi Cup/Coppa/Copa/Coupe, flag assente/true/false/stringa,
tipo league/cup/friendly, registro e opt-out, profili e H2H. La fixture sintetica
«Coppa Italia» delle vecchie suite ora dichiara `Official:true`: i conteggi attesi
restano invariati e la sua qualificazione è esplicita. Il riproduttore AUDIT
originale, con flag assente, non è stato modificato.

## Perimetro protetto e collaudo finale

Sono modificati soltanto i due nuovi moduli motore/UI, i test pertinenti e questo
documento. HTML v0.2V, CSS, tutti i 577 file non-QA rc5, formule/voti, Scanner,
Backtest, classifiche, persistenza e diario trade restano byte per byte invariati.
Un controllo aggiuntivo confronta anche tutti i file non-QA della candidata
esaminata eccetto i due moduli e i test esplicitamente autorizzati.

Il gate completo comprende **17 gruppi esterni**, uno dei quali esegue tutti i
17 controlli consolidati rc5. Include riproduttore AUDIT invariato, 21 test del
motore, browser IND-01/02/03, 12 CMP, neutralità holdout senza ritocchi alle regole,
sei suite browser rc5 sulla nuova pagina, entrambi i backup reali con reimport x3,
proprio export/reload/Undo, conservazione dei valori e benchmark 28.300 gare.

Esecuzione dalla copia pulita del commit finale:

```sh
python tests/v02v/run-full.py \
  --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" \
  --operational-root "$OPERATIONAL_ROOT" --run-dir "$RUN_DIR" --require-clean
```

I backup e gli export completi rimangono privati; non sono nella candidata o nelle
evidenze pubbliche. Le ricevute con SHA del codice, log freschi, screenshot
sintetici e checksum sono pubblicate separatamente dopo il gate finale.

**NON ESEGUITO:** Windows nativo, file://, aggiornamenti live e diario personale
non fornito. La validazione Codex è Chromium/Linux/HTTP; non sostituisce il nuovo
AUDIT indipendente. Le precedenti richieste UX e nuove funzionalità restano fuori
da questo intervento e non vengono dichiarate risolte. Nessuna completezza
aggiuntiva degli storici, merge, deploy o approvazione stabile.
