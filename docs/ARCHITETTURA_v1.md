# Trading Analytics v1 · Architettura

## In breve

| Parte | Dove | Cosa fa |
|---|---|---|
| Fonti | football-data.co.uk, Open Matchday | storico dal 2021/22 con quote e statistiche; stagione in corso, calendario, primo tempo |
| Sincronizzazione | Supabase Edge Function `ta-sync` + `pg_cron` | scarica i CSV, riconosce le squadre, aggiorna `ta_matches` |
| Pubblicazione | Supabase Storage, bucket pubblico `ta-data` | un file JSON compatto per stagione + manifest |
| App | `app/` (Vite + Preact + TypeScript), GitHub Pages | legge i file, li tiene in cache nel browser, calcola le statistiche |
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

Nota: il piano gratuito di Supabase mette in pausa il progetto dopo 7 giorni senza utilizzo. Se succede, si riattiva dal pannello di Supabase.

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

I campionati sono in `ta_leagues`. Alcuni sono già predisposti e disattivati: 2. Bundesliga, Scozia, Belgio, Turchia, Grecia.

```sql
update public.ta_leagues set active = true where code = 'D2';
select public.ta_schedule_leagues();
select public.ta_call_sync('{"mode":"league","league":"D2","scope":"all"}'::jsonb);
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

## Cosa manca (prossime fasi)

- Inserimento e chiusura dei trade nell'app; ora il registro è in sola lettura.
- Scanner dei mercati, strategie e backtest, validazione cronologica.
- Sezione Temi con scelta dei colori: i colori sono già variabili CSS e ora si possono scegliere chiaro, scuro o automatico.
- Minuti dei gol: tabella `ta_goal_events` predisposta, nessuna fonte collegata per scelta.
- Champions League e HNL hanno solo la stagione in corso: Open Matchday non ha lo storico e football-data non le copre.
