# RETEST indipendente — Trading Analytics v0.2V

**Data: 30 ottobre 2026. Auditor: nuova sessione Work indipendente.**

## Due valutazioni distinte

1. **Patch dei tre difetti: PASS CON RISERVE.** I tre FAIL precedenti sono riprodotti sulla candidata precedente e corretti sul commit verificato. Nessun nuovo FAIL applicativo nei percorsi completati. Riserve: Windows nativo, `file://`, aggiornamenti live e journal personale non collaudati; originale da 28.544 osservazioni non acquisito.
2. **Prodotto v0.2V complessivo: NON APPROVABILE allo stato attuale.** Restano aperte le dieci richieste della DIREZIONE, incluso l'ampliamento del cruscotto Confronti esistente. Questo giudizio non attribuisce tali richieste alla patch statistica.

Nessuna modifica applicativa, merge, deploy, chiusura PR o dichiarazione di versione stabile.

## Identità e fonti

- [PR #6](https://github.com/antoniodenuccio1995-a11y/Trading-sport/pull/6), verificata all'inizio e alla chiusura: OPEN, DRAFT, non merged; HEAD `43b92dfc21112a1df7f20dc6f56f6add8042219a`.
- Parent negativo: `240f747d9891e4754945be66096cbda67e1a05fd`.
- Baseline protetta rc5: `bf2f0cc8558fa30ddecf1d969c1d84fba3a2da4a`.
- Letti integralmente [handoff principale](https://docs.google.com/document/d/1nGOqXPjdrKoTAdp3GYrF3RSJF7CWdzkpkypKnR4xMWo/edit), allegato di passaggio, [rapporto FAIL](https://drive.google.com/file/d/1ZLCHr-3KAjRW5DG9BOlqZBUrG0y0A18U/view), [specifica Rev 1.1](https://drive.google.com/file/d/1nmyWT5tj6batffR0bBUGN7rlmBjubsP4/view), [mandato](https://drive.google.com/file/d/1XZekZO0YSvCrflolL-CG1kGTyIjTx_jW/view), [audit rc5](https://drive.google.com/file/d/1yQ2QuFwmdPt-BCK2X40Ozv0NBLt7206c/view), changelog e QA finale Codex. Esaminate ricevute Codex, manifest, prove temporali e commenti della DIREZIONE.
- Prove storiche originali recuperate dal commit audit `30fddfa99b6c78acd5f38c94c41f67352fde6420`; riproduttore Node confrontato byte per byte con l'originale.
- [ZIP del commit](https://github.com/antoniodenuccio1995-a11y/Trading-sport/archive/43b92dfc21112a1df7f20dc6f56f6add8042219a.zip) scaricato realmente: SHA-256 `f8ba9a8c842deadad3d86baea138084cdff17d15ecc22187da4b7673ae4bc6ac`, **701 file confrontati byte per byte** con Git. Avviata anche una copia estratta completa.
- HTML: `Trading_Analytics_v0.2V-rc1_TA-V02V-001.html`. Le correzioni sono nei JS: conservare l'intera cartella.

## Metodo e ambiente

Chromium **153.0.8010.0**, Linux, HTTP locale, Node 24.22.1, profili browser temporanei. Sorgenti acquisiti tramite clone Git e checkout esatto. Test originali eseguiti nuovamente; non vengono riciclati PASS Codex. Aggiunti nuovi oracoli autonomi e un caso browser sullo ZIP.

Adattamenti di ambiente: percorso dell'eseguibile Chromium; adattatore fornito per applicare i test rc5 all'HTML v0.2V. Nessuna asserzione funzionale eliminata nelle suite completate. Il riproduttore browser del vecchio audit conserva gli attesi negativi ed è usato sul parent. Test aggiuntivi e rapporti esterni al codice. I 597 file non-QA del commit restano identici a Git; i 577 file non-QA della baseline rc5 sono preservati.

Rete browser isolata: font opzionale sostituito con CSS vuoto; refresh live rinviato tramite timestamp di cache già previsti dall'app. Avvio senza cache testato separatamente. Nessun accesso al profilo operativo della DIREZIONE. Backup letti in copie isolate; export privati esclusi dalle evidenze pubblicabili.

## Retest dei tre difetti

Tutti i casi della tabella usano il parent e il nuovo SHA indicati sopra. P1/P2 sono le priorità del difetto storico, non nuovi blocchi della patch.

| ID | Dati e passi riproducibili | Atteso | Parent osservato | Nuovo osservato | Esito patch / evidenze |
|---|---|---|---|---|---|
| IND-01, P1 | Importare 6 FT Pescara–Cesena 1–6 ottobre, 2 senza FT 7–8 ottobre, fixture 20 ottobre. Calendario → fixture → H2H 5/10/tutto | 5/6/6 risultati; HT nulli ammessi, nessuna mutazione archivio | Ultimi 5 = 3, tutto = 6, FAIL reale Node/browser | 5/6/6, 2 FT esclusi, archivio invariato | PASS; `parent-node.json`, `parent-browser/independent-edges.json`, `audit-browser.json`, screenshot H2H |
| IND-02, P2 | Clock 30/10/2026 00:30 Roma; FT 29/10; aprire Comparatore. Ripetere con oggi/futuro in calendario, Analisi/H2H/segnali | Ieri n=1; oggi e futuro esclusi | n=0, FAIL reale Node/browser | n=1; 15 casi browser su Roma/New York/Tokyo, inverno/estate/DST/fine anno | PASS; `audit-browser.json`, screenshot mezzanotte |
| IND-03, P1 | Importare 1 FT Serie B e 1 in «Coppa QA da verificare», senza qualifica; confrontare sola lega, tutte ufficiali e singola coppa | 1 / 1 / 1 | Tutte ufficiali n=2, FAIL reale Node/browser | 1 / 1 / 1; coppa non ufficiale ma consultabile, archivio invariato | PASS; `audit-browser.json`, screenshot ufficialità |

Le prove unitarie rieseguite coprono anche Cup/Coppa/Copa/Coupe, flag booleani true/false, flag assente/stringa, tipo cup/league, amichevole con flag conflittuale, Champions League registrata, FT dopo supplementari/rigori, HT mancanti, meno di cinque FT, cutoff storico più restrittivo e fusi di sistema.

### Casi nuovi progettati da questo auditor

| ID | Caso / oracolo | Osservato | Esito |
|---|---|---|---|
| NEW-01 | H2H con ordine input invertito, sedi alternate e cutoff 7/10. Le ultime 5 valide sono 2–6 ottobre; GF squadra A=20, GA=5; invertendo squadra GF=5, GA=20 | Conteggi, date e orientamento esatti, HT n=0, input invariato | PASS |
| NEW-02 | 1/3/2028 00:01 Roma: 28 e 29 febbraio inclusi, 1 marzo escluso; filtro fino al 28/2 prevale sul cutoff futuro | n=2, oppure n=1 con limite più restrittivo; riposo 1 giorno | PASS |
| NEW-03 | Stessa coppa sconosciuta con 4 righe: Official true/false/assente/stringa. Invertire ordine input | Ufficiali n=1, singola competizione n=4; H2H ufficiali n=1 in entrambi gli ordini | PASS |
| NEW-04 browser | ZIP completo, profilo Honolulu, mezzanotte romana del 1/3/2028; upload JSON reale, clic Comparatore/Calendario/Analisi | Comparatore n=2, H2H n=2, GF=3; Calendario Oggi 1 marzo; nessuna mutazione | PASS |

Riproduzione: `node independent-new.cjs /percorso/checkout`; per il browser `zip-browser-ux.py` indica fixture, clic e oracoli. I percorsi ambiente negli script sono da adattare al proprio checkout, senza alterare gli attesi.

## Regressioni realmente eseguite

| Gruppo | Risultato indipendente |
|---|---|
| Test Node | 163/163 PASS: 21 motore nuovo e regressioni patch, 142 controlli legacy nelle quattro suite eseguite |
| Parser CSV corrente | 30/30 PASS, parser rc5; totale dei due gruppi 193/193 |
| Pacchetti pubblici | 109 non vuoti, 35.974 record; 29 senza record importabili distinti; contratto/reimport PASS |
| Preservazione | 577 file rc5 non-QA invariati; HTML/CSS parent invariati; whitelist inline e sintassi PASS |
| Comparatore | CMP01–CMP12 PASS mediante browser; stagioni indipendenti, promozioni, perimetri, neutro, HT mancanti, swap, nessun pronostico senza evento |
| Coerenza numerica | Analisi/Comparatore identici sullo stesso campione; oracolo Python su dati pubblici per V/P/S, GF/GA e HT PASS |
| Navigazione e persistenza | Dashboard quattro destinazioni, ricerca alias, calendario filtrato/paginato/CSV, stessa identità canonica, watchlist, pin/riordino e reload PASS |
| Protezione archivio | Consultazione senza scritture; writer concorrente blocca conferma obsoleta; avvio senza dati demo/richieste remote automatiche PASS |
| Sei suite browser rc5 sulla nuova pagina | Recupero/riconciliazione, dati pubblici, consultazione, contratto Backtest, oggi/domani, operatività PASS |
| Backtest/Scanner | Otto mercati, sei preset, 144 confronti pubblici, ricerca/paginazione/CSV, payout/commissioni; gare oggi/domani e kickoff verificati/non verificati PASS |
| Identità e classifiche | Gare distinte, manuali/alias non duplicati, Championship playoff e Serie A playout distinti dalle classifiche regolari, taglio storico PASS |
| Journal | Regressioni sintetiche e codice protetto PASS; journal personale NON ESEGUITO |
| Console/pageerror | Zero nei percorsi completati e nelle prove autonome; non è da solo criterio di correttezza |

Le evidenze distinguono le suite rieseguite dell'autore dai nuovi oracoli dell'auditor. Non si dichiara di aver eseguito il gate monolitico Codex da 17 gruppi, che richiede anche input non disponibili.

## Backup reale, integrità e H2H

Input verificato: `backup_trading_analytics_2026-10-27 (1).json`, SHA-256 `95bf7276566c286cbf47b6655db5bcc9c4a5e435955eb5276256a36ae11d6218`.

| Controllo | Riscontro |
|---|---:|
| Osservazioni in ingresso contabilizzate | 28.402/28.402 |
| Incontri dopo riconciliazione | 28.300 |
| Accorpamenti conservativi | 102 |
| Quote non vuote conservate | 172.964 |
| Nomi di fonte conservati | 56.804 |
| Payload manuali / campi verificati | 2/2; 14 campi |
| Errori del verificatore di conservazione | 0 |
| Coppie H2H controllate | 5.358 |
| Confronti H2H 5/10/tutto | 16.074 |
| Coppie esposte al vecchio difetto | 14 |
| Discrepanze H2H | 0 |

Il conteggio inferiore dopo deduplica non è perdita: sono verificati contenuto e lineage. Nessuna identità privata o export personale pubblicato.

**Ciclo browser reale PASS sul backup da 28.402 record e sulla fixture sintetica:** anteprima senza scritture, conferma, download export, reload, tre reimportazioni confermate e riaperte, reimport del proprio export, Undo dell’ultimo reimport, Undo del primo recupero in profilo separato. Confrontate tutte le sezioni esportate, escluso soltanto `exportedAt`; originali invariati, zero console/pageerror.

**Trasparenza sulla ricevuta aggregata:** `v02v-reimport-browser.json` conserva `outcome: FAIL` originale. La suite completa ha terminato i due cicli sopra (registrati in `datasets`), poi si è fermata sull’input passato come “original”, risultato da 13.536 record anziché quello previsto da 28.544: anteprima 13.364 anziché atteso 28.302. È un input non corrispondente alla fixture obbligatoria, non una dimostrazione di regressione. Non è stato cambiato l’atteso per ottenere un PASS. Il ciclo originale resta NON ESEGUITO; il gate aggregato non viene dichiarato PASS. Log e ricevuta grezzi sono conservati insieme alla classificazione in `cycle-assessment.json`.

**Limite dell'altro allegato:** `backup_trading_analytics_2026-10-27.json` contiene 13.536 record e zero payload manuali, non 28.544. Non costituisce l'originale previsto dalla suite Codex; il percorso 28.544 → 28.302 è **NON ESEGUITO** da questo audit. Il nome del file non è prova di equivalenza del contenuto.

## Prestazioni e UX

Misure Chromium/Linux, archivio 28.300 gare: import 20,622 s; primo reload Dashboard 9,590 s; Calendario con filtro alias 0,832 s; aggiornamento Comparatore 0,046 s. Durante questa misura erano in corso altre prove isolate: i tempi sono descrittivi dell'ambiente, non garanzia per Windows né certificazione di fluidità.

Seconda misurazione separata: primo reload 8,995 s, secondo reload warm 9,997 s, archivio invariato. “Cold” nella suite significa prima riapertura dopo import; non è svuotamento della cache OS né avvio Windows a freddo. Il secondo reload non mostra un miglioramento e non chiude la richiesta di ottimizzazione.

Resize realmente eseguito senza reload: 1920 → 360 → 768 → 1024 → 1440 → 1920. Larghezza main osservata rispettivamente **1060 / 360 / 768 / 752 / 1060 / 1060 px**. Non riprodotto un blocco irreversibile alla larghezza mobile; confermato invece il tetto CSS di 1060 px e lo spazio desktop non sfruttato. Nessun overflow orizzontale della Dashboard nelle misure. Non estendere questo dato a ogni pannello.

## Dieci osservazioni DIREZIONE — backlog distinto dalla patch

| # | Richiesta aperta | Riscontro e prossimo intervento |
|---|---|---|
| 1 | Responsive e spazio disponibile | Tetto 1060 px confermato da browser/CSS; ampliare layout e retest su tutte le viste. Specifica modalità di blocco dopo resize non riprodotta qui |
| 2 | Sidebar compatta | Layout originale invariato; screenshot conferma voci molto ampie. Ridisegno ancora da eseguire, mantenendo pin/ordine |
| 3 | Avvio rapido senza flash vecchia UI | Nessuna modifica dedicata; reload ≈9,6 s. Flash temporale non misurato con cattura frame: NON ESEGUITO, non dichiarato risolto |
| 4 | Tutte le gare odierne a tutta larghezza, poi Continua analisi | Codice conserva finestra 7 giorni e `slice(0,8)`, due card affiancate; requisito non realizzato |
| 5 | Calendario più leggibile e raggruppato | Funzioni e filtri passano; nuovo intervento grafico non presente; richiesta aperta |
| 6 | Aggiornamento campionati più veloce/incrementale | Nessuna patch dedicata; refresh live NON ESEGUITO. Profilare fetch/parsing e progettare incrementalità conservativa |
| 7 | Terminologia comprensibile | «Campioni completi del motore comune» ancora presente, verificato nel browser; rinominare indicando campione, FT/HT, periodo e copertura |
| 8 | Nuova analisi dentro Confronti | Pannello nuovo ancora separato, inserito prima dell'analisi esistente; ricollocazione non implementata |
| 9 | Ampliare il cruscotto Confronti esistente | `compactStatsRows()` conserva casa / indicatore / fuori, senza totali paralleli. P0 aperto, vedi requisito sotto |
| 10 | Scanner Oggi/Domani/3/7 giorni/date | Orizzonte fisso, nessun nuovo selettore operativo; richiesta aperta |

**Requisito #9 vincolante:** ampliare **lo stesso cruscotto** «Analisi partita → Confronti → Confronto casa / trasferta», senza nuova tabella. Colonne **A CASA | A TOTALE | INDICATORE | B TRASFERTA | B TOTALE**. Conservare micro-barre, indicatori attuali, media di lega sotto ogni valore, stagione/storico e denominatori. TOTALE = casa + trasferta nel medesimo periodo/cutoff, non ultime 10; sedi neutre gestite esplicitamente. Mobile con specifico e totale entrambi visibili. Orientare GF/GA e HT al club in ogni gara. Prima dell'accettazione verificare fixture asimmetriche 5 casa + 5 fuori per ciascuna squadra e benchmark della lega.

Smart Analysis: nuova esecuzione conferma Over 2.5 holdout **659/760 contrastanti, 19 favorevoli**; 18 selezioni mostrate, 9 eventi. Il problema di utilità resta aperto; nessuna superiorità predittiva/economica dimostrata. Non forzare segnali positivi né modificare voti protetti.

## NON ESEGUITO e confini

- Windows nativo e protocollo `file://`.
- Aggiornamenti live e certificazione di completezza di ogni stagione.
- Originale da 28.544 osservazioni; journal personale non disponibile.
- Verifica temporale frame per frame del flash iniziale e prova su dispositivo mobile fisico.
- Funzioni v0.2W (rating interlega/coppe completo, grafici/fasce classifiche, Comparatore 3–4 squadre): fuori perimetro, non bug della patch.

## Raccomandazione alla DIREZIONE

Considerare chiusi **IND-01/02/03 sullo SHA verificato**, mantenendo le riserve esplicite. Passare a un mandato consolidato per le dieci richieste UX/funzionali, con particolare priorità a Confronti #9, responsive, Dashboard e periodo Scanner. La candidata complessiva richiede un nuovo audit sullo SHA finale e collaudo Windows, prima dell'eventuale accettazione della DIREZIONE. Non serve riaprire i tre difetti già superati, salvo nuove regressioni o modifiche ai relativi moduli.

Rapporto ed evidenze pubblicabili destinati a Drive `02_AUDIT`. Le prove private restano escluse. Nessun commento o messaggio inviato a terzi e nessuna modifica al repository remoto.