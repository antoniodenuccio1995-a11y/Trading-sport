# Audit indipendente — Trading Analytics v0.2V-rc1

**Data:** 30 ottobre 2026. **Esito: FAIL.** Tre difetti funzionali sono riprodotti nei nuovi moduli. Le prove di recupero/persistenza sul backup disponibile e le regressioni eseguite passano; ciò non chiude i difetti dei campioni statistici. Nessun rilascio stabile, merge o deploy approvato.

## Identificazione e metodo

Repository: [antoniodenuccio1995-a11y/Trading-sport](https://github.com/antoniodenuccio1995-a11y/Trading-sport). Candidata: [PR #6](https://github.com/antoniodenuccio1995-a11y/Trading-sport/pull/6), commit **`240f747d9891e4754945be66096cbda67e1a05fd`**, HTML `Trading_Analytics_v0.2V-rc1_TA-V02V-001.html`. Baseline rc5: `bf2f0cc8558fa30ddecf1d969c1d84fba3a2da4a`.

Letti mandato esecutivo [issue #5](https://github.com/antoniodenuccio1995-a11y/Trading-sport/issues/5), piano/oracoli, metodo/limiti, codice del motore e interfaccia, test consegnati e QA finale dell’autore. Sorgenti acquisiti con clone Git e checkout del commit esatto; non si dichiara un confronto autonomo dello ZIP GitHub, non scaricato separatamente.

Le suite di Codex sono state rieseguite e affiancate da prove aggiuntive progettate dall’auditor, con upload JSON, clic e controlli numerici nel browser. I tre FAIL sotto descritti sono nuovi casi indipendenti, non semplici deduzioni dal codice. La riproduzione usa dati sintetici; un controllo aggiuntivo aggregato misura il primo meccanismo anche sulla copia del backup reale.

Ambiente: Chromium **153.0.8010.0**, Linux, HTTP locale, profili temporanei e fuso `Europe/Rome`. Per le suite consegnate è stato configurato a runtime solo il percorso dell’eseguibile browser; l’adattatore già fornito dall’autore applica il corpo dei test rc5 alla pagina v0.2V cambiando il nome dell’HTML. Nessuna asserzione funzionale rimossa. I **593 file non-QA** del commit sono stati confrontati con Git e restano invariati; il controllo di preservazione attesta anche i **577 file non-QA della rc5**.

Nessun codice applicativo modificato. Nessun accesso al profilo operativo, nessuna riscrittura dell’originale. Richieste browser esterne bloccate; font facoltativo soddisfatto localmente con CSS vuoto. Nelle suite isolate il refresh live è rinviato mediante i timestamp di cache già previsti dall’app. La prova di avvio senza cache verifica separatamente assenza di richieste remote automatiche e di scritture `matches`.

## Difetti riprodotti

| ID | Priorità | Funzione | Atteso | Osservato |
|---|---|---|---|---|
| V02V-IND-01 | P1 | H2H «Ultimi 5» | Cinque risultati utilizzabili, quando ne esistono almeno cinque | Solo tre risultati, pur essendocene sei disponibili |
| V02V-IND-02 | P2 | Limite temporale del Comparatore | Giorno coerente con il calendario italiano dell’interfaccia | Alle 00:30 italiane viene escluso anche il giorno precedente |
| V02V-IND-03 | P1 | Perimetro «Tutte le competizioni ufficiali» | Esclusione di una competizione non qualificata come ufficiale | Un nome contenente «Coppa» basta a farla entrare nel campione |

P1 indica una correzione necessaria prima dell’accettazione della candidata: il difetto altera il campione o il perimetro numerico di una funzione richiesta. Non è stata dimostrata una cancellazione dei dati o un crash.

### V02V-IND-01 — H2H: il limite precede il filtro dei risultati

**Riproduzione nel browser:** importare sei incontri sintetici Pescara–Cesena giocati dall’1 al 6 ottobre 2026, aggiungere due osservazioni della stessa coppia del 7 e 8 ottobre ancora senza FT (`up=true`) e una partita da analizzare del 20 ottobre. Aprire quest’ultima dal Calendario generale.

- Selettore H2H «Ultimi 5»: **3 risultati disponibili**.
- Selettore «Tutto lo storico»: **6 risultati disponibili**.
- Le ultime cinque gare effettivamente giocate sono quelle dal 2 al 6 ottobre: atteso **5**, non 3.

**Causa:** `ta-v02v-engine.js`, `h2h()`, ordina le osservazioni e applica `slice(-limit)` prima di chiamare `summarize()`. Quest’ultima elimina soltanto dopo le righe per cui `ftKnown()` è falso. Calendari passati o FT non utilizzabili occupano quindi posti nella finestra «ultimi N» e fanno saltare risultati validi più vecchi. Le nuove liste di forma usano invece un filtro dei giocati prima del taglio: la discrepanza è visibile anche nello stesso pannello.

**Impatto misurato sul backup:** alla data limite 30 ottobre 2026, un controllo diagnostico su tutte le coppie nelle competizioni considerate ufficiali trova **14 coppie** con almeno cinque risultati FT utilizzabili ma una finestra delle ultime cinque osservazioni contenente una riga senza FT utilizzabile. È un conteggio di configurazioni esposte al meccanismo, non di partite perse, e non attesta ogni combinazione di filtri dell’interfaccia. Le coppie personali non sono pubblicate.

**Correzione richiesta:** definire prima il campione di risultati utilizzabili per identità, data, perimetro e scopo FT; applicare poi il limite H2H. Conservare le righe senza FT nell’archivio e nella diagnostica di copertura, senza usarle per consumare i posti delle ultime cinque/dieci gare giocate. Provare anche supplementari/rigori esclusi, meno di cinque risultati effettivi e HT mancanti.

### V02V-IND-02 — Disallineamento fra giorno italiano e UTC

**Riproduzione nel browser:** fuso del profilo `Europe/Rome`, istante fissato a **30/10/2026 00:30 +01:00**, equivalente a **29/10/2026 23:30Z**. Importare un risultato FT del 29 ottobre e selezionare il club nel Comparatore, stagione 2026/27.

- Il giorno locale dell’interfaccia è `2026-10-30`.
- Il testo dichiara «Dati fino a ieri; gare del giorno escluse».
- Atteso: il risultato del 29 ottobre entra nel campione, **n=1**.
- Osservato: **n=0**.

**Causa:** `ta-v02v-ui.js` calcola il giorno del calendario con `Europe/Rome`; `ta-v02v-engine.js`, `day()`, usa `Math.floor(t / DAY) * DAY`, cioè il giorno UTC. `select()`, `h2h()` e `interpret()` riutilizzano quel limite. Nell’intervallo fra mezzanotte italiana e mezzanotte UTC la politica dichiarata e il campione non coincidono. Il caso riprodotto esclude dati validi: non dimostra inclusione di risultati futuri.

**Correzione richiesta:** stabilire un’unica politica esplicita del giorno osservativo, coerente con l’interfaccia e con la rappresentazione delle date dei record. Evitare correzioni basate su offset fissi: testare anche ora legale, profili con fusi diversi, fine mese/anno e gare di oggi/future.

### V02V-IND-03 — Ufficialità dedotta dal nome della competizione

**Riproduzione nel browser:** importare un risultato di Serie B e un risultato della medesima squadra in `Coppa QA da verificare`. Quest’ultima non è nel registro delle competizioni note e non dichiara `Official` né `CompetitionType`; sono dichiarati soltanto Paese e contesto delle squadre, per consentire l’identità dei club.

- «Sola competizione» Serie B: **n=1**.
- «Tutte le competizioni ufficiali disponibili»: **n=2**.
- Classificazione derivata della competizione non qualificata: `kind="cup"`, `official=true`.

Non è un caso con `Official=false`: il flag **è assente**. Il nome costituisce l’unico elemento che la promuove a competizione ufficiale.

**Causa:** `ta-v02v-engine.js`, `competition()`, ricava `cup` da una regex sul nome e poi lo usa come condizione sufficiente nell’espressione di `official`. Ciò contraddice la distinzione dichiarata fra competizioni ufficiali qualificate e competizioni non qualificate. La tipologia presunta di una coppa non dimostra la sua ufficialità.

**Correzione richiesta:** separare classificazione del tipo e qualificazione ufficiale; usare registro e metadati espliciti/documentati. Mantenere consultabile la competizione non qualificata nella sua vista e nel Calendario, escludendola dal campione «ufficiali» finché non qualificata. Aggiungere prove con nomi contenenti Cup/Coppa/Copa, flag assente/vero/falso, amichevoli e coppe effettivamente registrate.

## Test superati e regressioni

Le nuove esecuzioni delle suite fornite dall’autore passano. Questo non contraddice i tre FAIL indipendenti: sono casi diversi, non coperti dalle asserzioni esistenti.

| Gruppo realmente rieseguito | Esito |
|---|---|
| Motore v0.2V | 15/15 PASS |
| Cinque suite rc5 precedenti | 172/172 PASS |
| Parser CSV precedente sul modulo rc5 corrente | 30/30 PASS |
| Preservazione baseline e nuova pagina | PASS: 577 file precedenti non-QA invariati; modifiche HTML nella whitelist del controllo |
| Contratto pacchetti pubblici | PASS: 109 non vuoti, 35.974 record; 29 vuoti distinti; reimportazione invariata |
| Dashboard, ricerca e navigazione | PASS nei percorsi della suite: quattro destinazioni, alias, Paesi, ripresa analisi, watchlist e preferenze |
| Calendario generale | PASS: filtri composti, fase/giornata, ordinamento, pagine da 50, CSV completo, apertura della stessa identità canonica |
| Dodici casi CMP della suite fornita | PASS su quei campioni; CMP05 e CMP07 richiedono le correzioni aggiuntive IND-02 e IND-03 |
| Confronto numerico delle due viste | PASS su campione equivalente della suite e oracolo Python sulle colonne pubbliche Serie A 2024/25 |
| Gare future / HT / sede neutra | PASS sui casi della suite: FT futuri non contaminano i nuovi profili; HT assente distinto da zero; sede neutra separata |
| Avvio e concorrenza | PASS: nessun demo o write `matches` all’avvio, copertura calcolata su apertura esplicita, writer concorrente blocca conferma obsoleta |
| Sei suite browser rc5 sulla pagina v0.2V | PASS: recupero/Undo, identità/fasi, classifiche/analisi, Scanner, Backtest, alias e journal sintetico |
| Mercati/preset e operazioni | PASS: otto mercati, sei preset, 144 confronti pubblici; ricerca, paginazione ed export; nessuna modifica dei calcoli protetti rilevata |
| Diagnosi neutralità e confronto cronologico | Eseguiti: risultati descrittivi, nessuna superiorità economica certificata |
| Console/pageerror | Nessun errore rilevato nei percorsi browser eseguiti, inclusi i tre riproduttori indipendenti |

### Prestazioni osservate sulla copia reale

| Operazione | Tempo nell’ambiente di audit |
|---|---:|
| Importazione esplicita | 17,211 s |
| Riapertura Dashboard con 28.300 record | 8,401 s |
| Calendario e filtro alias | 0,686 s |
| Aggiornamento Comparatore | 0,058 s |

I tempi rispettano i budget della suite in questo ambiente; non sono una garanzia sui tempi del PC dell’utente.

## Recupero e integrità del backup reale

Input acquisito: `backup_trading_analytics_2026-10-27 (1).json`, SHA-256 **`95bf7276566c286cbf47b6655db5bcc9c4a5e435955eb5276256a36ae11d6218`**, 28.402 record e due incontri manuali. Gli export completi rimangono privati nell’ambiente di lavoro e non sono negli allegati pubblicabili.

Il ciclo browser indipendente sulla nuova pagina ha superato:

1. Anteprima senza scritture, conferma e download dell’export da **28.300 record**.
2. Riapertura e confronto di tutte le sezioni esportate, escluso soltanto `exportedAt`.
3. Tre reimportazioni dello stesso input, ognuna confermata, esportata e riaperta: contenuto invariato.
4. Reimportazione del nuovo export, conferma, export e riapertura: operazione invariata.
5. Undo del reimport con ripristino dell’archivio completo precedente.
6. Prova separata in un nuovo profilo: primo recupero, Undo e riapertura, con ritorno all’archivio vuoto.

Il verificatore di conservazione rieseguito sul download reale contabilizza **28.402/28.402 osservazioni**, **172.964 valori di quota**, **56.804 nomi di fonte**, **2/2 payload manuali** e **14 campi manuali di dominio**, con **0 errori rilevati**. Originale invariato. Il precedente difetto di reimportazione della vecchia rc5 non è riemerso.

## Limiti e NON ESEGUITO

- **Windows della v0.2V:** non eseguito. Il precedente «funziona tutto» dell’utente riguardava la rc5; non viene esteso automaticamente alla nuova interfaccia.
- **Originale da 28.544 osservazioni:** non disponibile all’auditor; il percorso 28.544 → 28.302 resta una prova dichiarata dal produttore. Qui è stato verificato l’allegato da 28.402 record.
- **Registro trade personale:** non disponibile; prove su journal sintetico e preservazione del codice.
- **Aggiornamenti live, `file://` e completezza di ogni stagione:** non certificati. Le fonti congelate e i record in revisione restano distinti dai dati verificati; nessuna stagione viene dichiarata completa per il solo conteggio.
- **Grafici posizionali, confronto completo coppe e altre funzioni P1/v0.2W:** fuori dal perimetro di accettazione di questa candidata.

## Consegna e criterio per il prossimo retest

Restituire i tre casi a Codex con questo rapporto e gli script sintetici inclusi nelle evidenze. Correggere su un nuovo commit senza alterare gli originali; aggiungere le tre regressioni e rieseguire i gate pertinenti e il ciclo completo sulla build finale. I test nuovi devono verificare i valori attesi corretti, non soltanto l’assenza di eccezioni.

L’auditor non ha modificato il codice, non ha pubblicato commenti su GitHub e non ha autorizzato un rilascio. **La candidata v0.2V-rc1 esaminata non supera l’audit; la rc5 precedente non viene sostituita da questo esito.**
