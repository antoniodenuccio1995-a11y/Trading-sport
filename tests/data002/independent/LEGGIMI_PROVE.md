# Contenuto e riproduzione

I due rapporti descrivono esiti, difetti e rischi. I CSV in fixtures sono sintetici, esclusivamente per riprodurre i tre errori di importazione: non vanno caricati nel gestionale operativo.

I log reproduced-* provengono dalla riesecuzione dei test già presenti nel repository al commit indicato. I log independent-* provengono da nuove prove indipendenti; un risultato ERROR sarebbe un problema del test, mentre qui i FAIL riportano risultati funzionali osservati.

Per riprodurre: checkout separato del repository nel percorso review_repo, mantenendo il commit b80ff664ff1ffe05045662ad43d22d5c2e9dd3fc. Node/Playwright e Chromium di test sono necessari soltanto al collaudatore. Gli script allegati assumono questa struttura di workspace e un eseguibile Chromium in independent_review/runtime/bin/chromium: adattare percorsi e dipendenze alla propria macchina, senza cambiare il prodotto. Usare profili isolati e una porta loopback libera, mai il profilo operativo.

La suite esistente può essere eseguita con --output verso una cartella di evidenze esterna al checkout e --chromium verso il proprio eseguibile; non promuovere automaticamente un PASS della sola suite esistente a PASS della revisione. Nessun HTML corretto o nuovo modulo applicativo è incluso: il mandato era di sola revisione.

Non sono incluse screenshot, archivi utente o CSV pubblici integrali; il manifest consente di verificare i download pubblici. Le fixture avversariali e gli output essenziali sono nel rapporto e nei JSON.
