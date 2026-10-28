# Correzione urgente rc5 — orari nel Backtest

**Candidata per nuovo AUDIT, non stabile.** Difetto segnalato dal collaudo Windows sul commit `b379d6f60b7bdc559b56516a15a38af6d2368041`, riprodotto dall'autore con il pulsante effettivo del Backtest in Chromium Linux via HTTP. I precedenti PASS della rc5 non coprivano questo percorso con incontri della giornata corrente.

## Causa e modifica

`run(S)` chiamava `safeKickoffFuture(r)` per gli incontri di oggi, ma la funzione era locale alla funzione autoinvocata dello Scanner. I test con gare soltanto di domani saltavano quella chiamata grazie alla valutazione abbreviata di `day(r)>today || ...`, lasciando nascosto il problema di ambito.

La funzione esistente è spostata, invariata, nell'ambito condiviso dell'applicazione. Backtest e Scanner risolvono la medesima definizione. La conversione dell'orario rimane in `TAFixtures.context`; non sono introdotti parser alternativi o fusi dedotti dal solo Paese.

Una verifica confronta l'HTML con `b379d6f`: rimuovendo soltanto la funzione rilocata, tutti gli altri byte coincidono. Nessuna modifica a classifiche, formule, modelli, voti, registro trade o logica di recupero JSON. I file originali personali non vengono modificati né pubblicati.

## Test browser riproducibile

```sh
python tests/int004/today-backtest-browser.py
```

Ora fissata al 28 ottobre 2026, 10:00 UTC; browser con fuso Europe/Rome. Storico pubblico Serie A 2024/25 e 2025/26 e calendario sintetico in un profilo temporaneo; nessun JSON personale utilizzato in questa prova.

| Partita sintetica | Orario | Esito Backtest e Scanner |
|---|---|---|
| Oggi | 12:00 UTC | Inclusa quando la strategia è soddisfatta |
| Oggi | 12:30 CEST, offset esplicito | Inclusa: 10:30 UTC, ancora futura |
| Oggi, manuale | 13:00 UTC | Inclusa |
| Oggi | 08:00 UTC | Esclusa, già trascorsa |
| Oggi | 10:00 UTC | Esclusa, non strettamente futura |
| Oggi | Orario assente o malformato | Esclusa |
| Oggi | 23:59 senza fuso verificabile | Esclusa |
| Oggi, manuale | Orario assente | Esclusa |
| Domani | Orario assente | Inclusa sulla base della data futura, se qualificata |
| Ieri | Orario presente | Esclusa |

Il test clicca Backtest prima e dopo l'aggiunta del calendario e verifica tutti i record delle operazioni storiche, non soltanto il totale. Quindi aggiorna realmente lo Scanner, esegue i sei preset con gare di oggi presenti, ricerca una squadra ed esporta tutte le operazioni CSV. L'export deve mantenere il totale anche con ricerca attiva.

## Evidenze

- `qa/int004/today-backtest-before-fix.json`: FAIL effettivo sul commit precedente, con `safeKickoffFuture is not defined`.
- `qa/int004/today-backtest-browser.json`: PASS dei cinque gruppi browser sulla correzione, con gli hash dei sorgenti.
- `qa/int004/today-fix-preservation.json`: sola rilocazione, una definizione, resto dell'HTML identico.
- `qa/int004/today-backtest.png`: schermata del risultato con il nuovo percorso eseguito.
- Le prove di regressione precedenti sono rieseguite sul nuovo HTML; `check-readiness.cjs` richiede anche queste nuove evidenze.

Il nuovo AUDIT e il collaudo Windows nativo restano da eseguire. Nessun merge o rilascio stabile.
