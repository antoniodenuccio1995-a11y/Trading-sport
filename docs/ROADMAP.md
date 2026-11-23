# Roadmap · Trading Analytics

Aggiornata al 23 novembre 2026 (versione 1.6). Ordine = priorità proposta; si cambia in qualsiasi momento.

## Fatto

| Versione | Cosa |
|---|---|
| 1.0 | Dati su Supabase con aggiornamento automatico due volte al giorno, app veloce (apertura in meno di mezzo secondo), funziona anche offline |
| 1.1 | Classifica nel tempo, gol per tempo, Poisson anche per tempo, confronto con la media della lega, confronto quote di mercato e modello |
| 1.2 | Zone di classifica, storico a piramide con promozioni e retrocessioni, confronti con lo storico |
| 1.3 | Registro trade (con accesso), stemmi, pulsante "Aggiorna", grafici leggibili da telefono |
| 1.3.1 | Filtri del registro ricordati sul dispositivo, curva per strategia, calo massimo |
| 1.4 | Chiusura parziale dei trade, righe partite "Casa vs Ospite", 2. Bundesliga |
| 1.5 | Temi a tema calcio (Notturna, Diurna, Azzurri, Classica) con il campo sullo sfondo, minuti dei gol, punti chiave della partita |
| 1.6 | Profilo a esagono delle squadre, grafici a ciambella, movimenti di quota (apertura → chiusura, storico delle rilevazioni, studio "quando la quota si muove") |

## Prossimi passi

### 1. Quote Betfair in diretta e allarmi sui movimenti
La base è pronta: ogni cambio di quota viene salvato (tabella `ta_odds_hist`) e l'app mostra i movimenti. Manca una fonte frequente.
- **Betfair Exchange Italia**: con un conto Betfair Italia si crea una chiave applicazione; quella "ritardata" (prezzi con 1–180 secondi di ritardo, senza volumi scambiati) è gratuita ed è solo per uso personale.
- Cosa serve da te: conto verificato, chiave ritardata, e i tre segreti salvati in Supabase (Edge Functions → Secrets: `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD`). Per il login automatico Betfair Italia chiede la chiave abilitata ("white-listed") oppure un certificato: si decide quando hai la chiave.
- Poi: rilevazioni ogni 15–30 minuti (più fitte vicino al calcio d'inizio), segnalazione dei movimenti forti in pagina e su Telegram.
- Betflag non ha un'API pubblica: le sue quote restano da inserire a mano nella sezione mercato.

### 1b. Altre quote automatiche
Oggi le quote arrivano da football-data (medie e chiusura, aggiornate a giorni alterni) o si scrivono a mano.
- **The Odds API**: piano gratuito (500 richieste al mese), include le quote Betfair Exchange europee e i principali bookmaker. Serve una chiave gratuita, da salvare tra i segreti di Supabase (mai nel codice).
- Con le quote automatiche: confronto modello/mercato già compilato, CLV calcolato da solo sui trade, storico dei movimenti di quota.

### 2. Scanner delle occasioni
Ogni giorno, le partite in cui modello e quote si discostano oltre una soglia scelta da te, ordinate per differenza. Usa le stesse regole dei "Punti chiave", su tutte le partite.

### 3. Pagella del modello
Salvataggio automatico delle previsioni prima di ogni partita e confronto con i risultati: affidabilità per campionato e per mercato (calibrazione), per sapere dove fidarsi del modello e dove no.

### 4. Backtest delle strategie
Una regola (es. "Over 2,5 quando entrambe hanno almeno il 60% di Over") provata su tutto lo storico dal 2021 con le quote di chiusura: profitto, rendimento, calo massimo, stabilità stagione per stagione.

### 5. Avvisi su Telegram
Messaggi gratuiti con un bot: trade da chiudere, occasioni dello scanner, limite di perdita giornaliero raggiunto. Serve creare un bot (2 minuti con @BotFather) e salvare il token tra i segreti di Supabase.

### 6. Minuti dei gol per squadra (Germania)
OpenLigaDB (gratuito) ha per Bundesliga e 2. Bundesliga anche chi ha segnato e lo storico delle stagioni passate; Open Matchday ha un file con ogni gol e il punteggio dopo il gol (quindi chi ha segnato) per la stagione in corso. Con questi: gol fatti e subiti per fascia, per squadra.

### 7. Il tuo modo di fare trading
Dove guadagni e dove perdi: fasce di quota, back contro lay, giorni, campionati, minuto di ingresso. Stake suggerito con Kelly frazionato dentro i limiti di capitale.

### 8. Report mensile su Google Sheets
Il registro del mese esportato da solo in un foglio Google (collegamento già disponibile).

### 9. Modello più completo
Peso maggiore alle ultime partite (forma), forza degli avversari affrontati, comparatore libero tra due squadre qualsiasi.

### 10. Altri campionati
Seconda divisione olandese (solo stagione in corso, senza storico). Già predisposti e attivabili: Belgio, Turchia, Grecia, Scozia.

### 11. Prodotto vendibile
Piano completo in [VENDERE.md](VENDERE.md): dati con licenza commerciale, stemmi, licenza Betfair, regole sulla pubblicità del gioco, progetto separato, abbonamenti.

## Limiti noti
- Minuti dei gol: solo stagione in corso; completi per Bundesliga e 2. Bundesliga, parziali per Serie A, Premier, Liga, Ligue 1 e Champions, assenti altrove.
- Le fonti gratuite pubblicano i risultati con 1–3 giorni di ritardo.
- Champions League e campionato croato: solo stagione in corso.
