# Trading Analytics

Gestionale di analisi statistica delle partite di calcio per il trading sportivo: calendario, classifiche, statistiche gol in stile SoccerStats, analisi pre-partita con modello di Poisson, registro trade.

- **App (v1):** **https://antoniodenuccio1995-a11y.github.io/Trading-sport/** (codice nella cartella [`app/`](app/); si ripubblica da sola a ogni modifica su `main`).
- **Dati:** Supabase (progetto principale, tabelle `ta_*`), aggiornati in automatico due volte al giorno.
- **Versioni precedenti:** [`legacy/`](legacy/) (v0.3-rc4) e i file `Trading_Analytics_v0.2*.html` nella radice, conservati invariati.

Documenti:

- [Audit della v0.3-rc4](docs/AUDIT_v0.3-rc4.md): misure, bug e problemi dei dati che hanno motivato la v1.
- [Architettura della v1](docs/ARCHITETTURA_v1.md): come funzionano dati, aggiornamenti e app; cosa fare per aggiungere un campionato o correggere un nome.

## Sviluppo

```bash
cd app && npm install
```

```bash
npm run dev
```

```bash
npm test
```
