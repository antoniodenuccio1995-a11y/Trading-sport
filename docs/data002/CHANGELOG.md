# TA-DATA-002 — Changelog v0.2U-rc2

Baseline `b80ff66`; precedente applicativo `73fc0e2`. Versione candidata, nessuna approvazione stabile implicita.

- Corretti F-01/F-04 con i test del pacchetto indipendente riprodotti prima e dopo.
- Aggiunta quarantena per metadati di campionato irrisolti per riga; risoluzione esplicita registrata nel backup.
- Unificata la preparazione della provenienza con il parser, i filtri e la stagione dell'anteprima.
- Applicato il cutoff a tutte le annate e alle evidenze di appartenenza usate negli storici.
- Aggiunto registro centrale di ID permanenti, nomi, alias espliciti, fonti, provider ID facoltativi e stati di verifica.
- Integrati gli ID nel confronto delle gare e dei riferimenti; normalizzati gli ingressi dei moduli, senza matching fuzzy.
- Aggiunta diagnosi tecnica dei club e delle simulazioni, esportabile in JSON.
- Separati database e chiavi della candidata dagli archivi precedenti. Nessuna migrazione personale automatica.
- Aggiunta simulazione pura prima dell'importazione dei vecchi backup; collisioni e dati invalidi bloccano la migrazione.
- Conservati tutti i metadati originali nel backup, comprese quote non presenti nella whitelist precedente.
- Conservate le fotografie dei trade esistenti senza rinomina o ricalcolo retroattivo.
- Aggiunti inventario fonti, registro alias, rapporti d'integrità e regressioni riproducibili.

Non modificati: v0.2T, rc1, relativo modulo CSV e documenti storici; formule 0–100; funzioni di trading; nuova interfaccia delle classifiche. Il merge precedente della PR #1 è riconosciuto come evento storico, senza attribuirgli un'approvazione stabile.
