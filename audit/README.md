# Audit indipendente v0.2V — 30 ottobre 2026

Esito: **FAIL** sul commit candidato `240f747d9891e4754945be66096cbda67e1a05fd` (PR #6).

1. Leggere [RAPPORTO.md](RAPPORTO.md).
2. [EVIDENZE.zip](EVIDENZE.zip) contiene ricevute, log e riproduttori sintetici. Non contiene backup personali, export personali o screenshot.
3. Dalla cartella della candidata eseguire:

```sh
node audit/2026-10-30-v02v-240f747/repro-engine.cjs .
```

Sul commit esaminato il controllo termina con exit 1: V02V-IND-01, IND-02, IND-03 sono i tre FAIL attesi. Il retest di una correzione dovrà produrre i valori attesi e terminare con exit 0.

Il riproduttore browser `independent_edges.py` usa solo dati sintetici. Configurare i percorsi locali BASE/ROOT e Playwright/Chromium prima di eseguirlo; non cambiare aspettative o asserzioni.

Questo ramo aggiunge esclusivamente documenti e prove dell'audit. Non modifica la candidata, main o le PR di sviluppo. Nessun merge, deploy o rilascio stabile è autorizzato. Gli originali dell'utente restano invariati e non sono pubblicati.

EVIDENZE.zip SHA-256: `873846128bf55f6cbb9309fa49ebafed296455a0cca9ed2903a156fc32fe51c5`.
