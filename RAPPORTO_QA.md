# QA — v0.2T (26 ottobre 2026)

## Esito sintetico

- HTML derivato dalla v0.2S originale; originale non modificato.
- Parsing JavaScript: quattro script controllati con `node --check`; nessun errore sintattico.
- Chromium con risposte CSV simulate: **8 leghe processate**, report delle stagioni recuperate/non recuperate, merge in archivio simulato, nessun errore JavaScript registrato.
- Mock di fonte originale indisponibile: la cache GitHub è stata selezionata per 2021–2023; i due anni più recenti senza fallback sono stati segnalati come non recuperati.
- Parsing dei CSV extra `Country,League,Season,Date,Home,Away,HG,AG`: verificato.
- Parsing dei CSV cache `Date,Team 1,FT,HT,Team 2`: verificato, inclusi valori `?` per HT.
- Import manuale mediante file picker: verificato con dati sintetici Football-Data extra e Football-Data standard. Test eseguito simulando un salvataggio riuscito.
- Navigazione sulle sezioni principali controllata nei test di integrazione.

## Non verificato, non dichiarato superato

- Accessibilità CORS delle fonti reali su Chrome/Windows dell'utente.
- Persistenza della v0.2T con archivio personale IndexedDB e JSON.
- Completezza delle gare playoff per le leghe che le disputano.
- Omogeneità dei nomi squadra fra il cache FootballCSV e i file della stagione attuale.
- Copertura delle stagioni 2024/25–2025/26 qualora Football-Data non sia accessibile.

**Stato:** candidata v0.2T da collaudare. Non promuovere a baseline operativa senza verifica del conteggio per stagione e salvataggio in ambiente reale.
