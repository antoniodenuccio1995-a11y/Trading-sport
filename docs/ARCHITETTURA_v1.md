# Trading Analytics v1 · Architettura

## In breve

| Parte | Dove | Cosa fa |
|---|---|---|
| Fonti | football-data.co.uk, Open Matchday | storico dal 2021/22 con quote e statistiche; stagione in corso, calendario, primo tempo |
| Sincronizzazione | Supabase Edge Function `ta-sync` + `pg_cron` | scarica i CSV, riconosce le squadre, aggiorna `ta_matches` |
| Pubblicazione | Supabase Storage, bucket pubblico `ta-data` | un file JSON compatto per stagione + manifest |
| App | `app/` (Vite + Preact + TypeScript), GitHub Pages (ramo `gh-pages`) | legge i file, li tiene in cache nel browser, calcola le statistiche |
| Dati personali | tabella `ta_user_data` (login + RLS) | trade, quote, previsioni, note importati dal backup v0.3 |

## Perché è veloce

La v0.3 ricalcolava a ogni apertura le identità dei club di 28.000 partite (6,7 s, 212 MB). Nella v1:

1. il riconoscimento delle squadre avviene **una sola volta, sul server**, quando arriva il dato;
2. l'app scarica file colonnari già pronti, solo per le stagioni cambiate (il nome del file contiene l'impronta del contenuto, quindi le stagioni concluse restano in cache per sempre);
3. all'apertura legge dalla cache IndexedDB e mostra subito i dati, poi controlla gli aggiornamenti in background;
4. le statistiche si calcolano solo per la pagina aperta.

Misure (Chromium, archivio di 28.383 partite dal backup del 6/11):

| | v0.3-rc4 | v1 |
|---|---|---|
| Apertura con archivio | 6,7 s | 0,18 s (dalla cache), 0,35 s (primo accesso) |
| Memoria | 212 MB | 35 MB |
| Con CPU rallentata 4× | — | 0,75 s / 1,07 s |
| Cambio pagina | — | 15–50 ms |
| JavaScript iniziale | 10,6 MB (HTML unico) | 24 KB compressi (+59 KB solo per l'area personale) |

## Aggiornamento automatico (ora italiana d'inverno)

- 07:30–07:45 e 18:30–18:45: un campionato al minuto (`ta-sync-lg-<codice>`), risultati e calendario della stagione corrente. Uno alla volta perché le Edge Functions gratuite non reggono 16 richieste contemporanee.
- 07:50 e 18:50: quote pre-partita da `fixtures.csv` di football-data.
- 07:55 e 18:55: pubblicazione delle stagioni modificate.

Il registro è nella tabella `ta_sync_runs` e nella pagina **Stato dei dati** dell'app.

### Pausa dopo 7 giorni (piano gratuito Supabase)

Supabase mette in pausa i progetti gratuiti senza attività sul database per 7 giorni. Tre protezioni indipendenti:

1. gli aggiornamenti automatici scrivono nel database due volte al giorno (`pg_cron` conta come attività);
2. il job `ta-heartbeat` scrive ogni giorno in `ta_meta` alle 13:07 (ora italiana);
3. il workflow GitHub `Supabase attivo` legge dal database ogni giorno dall'esterno.

Se nonostante questo il progetto andasse in pausa, Supabase manda un'email una settimana prima; il ripristino è un clic dal pannello. Nel frattempo l'app continua a funzionare con i dati salvati nel browser.

## Squadre: come vengono riconosciute

Ordine di ricerca in `ta_resolve_team`:

1. alias verificato in `ta_team_aliases`;
2. nome identico nello stesso paese;
3. nome normalizzato identico (senza accenti, punteggiatura e sigle come FC, AC, CF), solo se unico;
4. altrimenti viene creata una squadra nuova, segnalata in **Stato dei dati**.

Non si usano somiglianze approssimate: unirebbero squadre diverse (Paris Saint-Germain e Paris FC, Notts County e Nottingham Forest).

Per correggere un doppione, nell'editor SQL di Supabase:

```sql
select public.ta_merge_team(<id_da_eliminare>, <id_corretto>);
```

La funzione sposta le partite, elimina le copie e salva il vecchio nome come alias.

## Aggiungere un campionato

I campionati sono in `ta_leagues`. Alcuni sono già predisposti e disattivati: Scozia, Belgio, Turchia, Grecia (la 2. Bundesliga è attiva dalla v1.4). Prima di attivarne uno, controllare che i nomi delle squadre di Open Matchday abbiano un alias verso quelli di football-data (vedi la migrazione della 2. Bundesliga), altrimenti nascono squadre doppie.

```sql
update public.ta_leagues set active = true where code = 'B1';
select public.ta_schedule_leagues();
select public.ta_call_sync('{"mode":"league","league":"B1","scope":"all"}'::jsonb);
```

Dopo qualche secondo:

```sql
select public.ta_call_sync('{"mode":"publish"}'::jsonb);
```

## Cartelle

- `app/src/data`: cache, download, dati personali
- `app/src/stats`: statistiche squadra/lega, classifiche, Poisson
- `app/src/ui`: pagine e componenti
- `supabase/migrations`: schema, funzioni, pianificazione (già applicati al progetto)
- `supabase/functions/ta-sync`: Edge Function (`parse.ts` è testato in `app/tests`)

## Analisi disponibili (v1.1)

- **Partita** (schede): panoramica con Poisson e quote; confronto con il mercato (quote Betfair, Betflag o bookmaker inserite a mano, commissione, probabilità senza margine, valore back/lay, soglie, quote salvate per momento); statistiche con media della lega per sede; gol e tempi (profilo 1°/2° tempo, incrocio attacco/difesa, Poisson per tempo, intervallo → finale); classifica nel tempo e posizioni per stagione; forma e precedenti.
- **Squadra:** statistiche con media lega, posizione nella stagione, gol e tempi, posizioni per stagione.
- **Campionato:** classifica, classifica nel tempo (fino a 6 squadre), statistiche gol, gol per tempo squadra per squadra, forma, risultati, calendario.

### v1.2
- Zone di classifica per ogni campionato (Champions, Europa, Conference, promozione, playoff, playout, retrocessione; Champions League: ottavi diretti, spareggi, eliminate) nei grafici e nelle tabelle.
- Storico per stagione e categoria: la nazione come piramide (Serie A sopra, Serie B sotto), con promozioni e retrocessioni (↑ ↓), zone dentro ogni fascia e riepilogo per stagione.
- Periodo di analisi (stagione, stagione precedente, ultime 3, tutto lo storico) nelle statistiche e in Gol e tempi; tabella "questa stagione rispetto allo storico" con frecce ▲▼.

### v1.3
- **Registro trade** (menu "📒 Registro trade", solo dopo l'accesso: i trade stanno nell'account Supabase, tabella `ta_user_data`, tipo `trade`). Nuovo trade, modifica, chiusura con un clic quando la partita è finita (esito proposto dal risultato), capitale e limiti (stake consigliato, perdita massima giornaliera), profitto cumulato, CLV con la quota di chiusura dell'archivio, riepilogo per mercato e campionato, esportazione CSV. Il pulsante "＋ Trade" nella scheda mercato della partita apre il modulo già compilato.
- **Stemmi**: cercati su TheSportsDB (gratuito) dalla funzione `ta-sync` in modalità `logos`, a piccoli blocchi (`ta_logos_tick`, ogni 2–3 minuti finché ci sono squadre da controllare, poi una volta al giorno alle 04:20 UTC). Se manca lo stemma: cerchio con i colori della nazione e le iniziali.
- **Pulsante "↻ Aggiorna"** nella barra in alto: chiama `ta_request_refresh` (al massimo una volta ogni 10 minuti per tutti), che scarica le fonti e ripubblica i dati; l'app controlla il manifest ogni 10 secondi e si aggiorna da sola. Gli aggiornamenti automatici restano due al giorno.
- Grafici che si adattano alla larghezza (leggibili da telefono), nessuno scorrimento orizzontale della pagina su schermi stretti, numeri con la virgola nel registro.
- 1.3.1 · Filtri del registro come nella v0.3, più lato e date a scelta: periodo, esito, tipo (reali/simulati), lato, campionato, strategia, mercato, ricerca, aperti/chiusi con i conteggi. Valgono per riepilogo, grafico, elenco, tabelle ed esportazione CSV e restano salvati sul dispositivo. Curva per strategia, calo massimo, riepilogo per strategia e per lato; strategia e note di nuovo separate. Icone PNG per installare l'app sulla schermata Home (iPhone e Android).

### v1.4
- **Chiusura parziale dei trade** (cash out): esito "Parziale (importo)" con scelta Vincita/Perdita e importo netto; si apre dal menu Esito della tabella, da "Parziale…" nei trade da chiudere o dal modulo. Finché l'importo non è scritto il trade resta aperto. I trade vinti contano anche le chiusure parziali in attivo.
- **Partite**: tra le squadre "vs" (prima c'era la quota 1); nelle colonne 1, X, 2 la probabilità del modello e sotto la quota media dei bookmaker.
- **2. Bundesliga** attivata (storico dal 2021/22, stagione in corso, calendario, quote, zone di classifica, piramide Germania a due fasce). Migrazione `20261121120000_ta_bundesliga2.sql`.

### v1.5
- **Grafica a tema calcio**: temi Notturna, Diurna, Azzurri e Classica (più "automatico" che segue il dispositivo), scelti dalla barra laterale. Sullo sfondo un campo regolamentare disegnato in SVG (`ui/components/Stadium.tsx`), in prospettiva e sfocato, con i riflettori; i colori vengono dalle variabili CSS del tema. Caratteri Barlow e Barlow Condensed inclusi nell'app (`src/fonts.css`, licenza OFL). Su telefono le partite stanno su due righe.
- **Minuti dei gol**: colonna `goal_min` in `ta_matches` (migrazione `20261121130000_ta_goal_minutes.sql`), letta da Open Matchday (`goalMinutes` in `parse.ts`) e pubblicata nelle istantanee (`gm`). Statistiche in `stats/minutes.ts`: si usano solo partite con tutti i minuti; il 1° tempo si assegna con il risultato all'intervallo (i recuperi finiscono nel tempo giusto). Sezione "Minuti dei gol" in partita, squadra e campionato; linea del tempo dei gol nelle partite giocate.
- **Punti chiave** (`stats/insights.ts`): nella panoramica delle partite da giocare, confronto modello/mercato con soglie di quota (commissione 5%), primo e secondo tempo, forma, minuti dei gol, avviso sul campione piccolo.
- Roadmap in `docs/ROADMAP.md`.

## Cosa manca (prossime fasi)

- Scanner dei mercati, strategie e backtest, validazione cronologica.
- Sezione Temi con scelta dei colori: i colori sono già variabili CSS e ora si possono scegliere chiaro, scuro o automatico.
- Scanner dei mercati, giudizi 0–100, diario di prova, registro automatico delle previsioni, comparatore libero tra due squadre, forza degli avversari affrontati.
- Minuti dei gol: tabella `ta_goal_events` predisposta, nessuna fonte collegata per scelta.
- Champions League e HNL hanno solo la stagione in corso: Open Matchday non ha lo storico e football-data non le copre.
