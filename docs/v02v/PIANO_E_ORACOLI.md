# TA-V02V-001 — Piano e oracoli prima dello sviluppo

Baseline esclusiva: bf2f0cc8558fa30ddecf1d969c1d84fba3a2da4a. Ramo feature/ta-v02v-match-center. Nessuna modifica a PR #4, main, release o deploy.

## Mappa della baseline e riuso
- HTML rc5: navigazione openWorkspace/WORKSPACES, calendario e selezione compareMatch; analisi buildMatchAnalysis e reviewerPeriod/reviewerHeadline; Backtest run, 8 MK e 6 PR; Scanner e registro trade in IIFE; classifiche e validazione cronologica. Il file rc5 e tutti i moduli esistenti restano byte per byte invariati.
- ta-clubs-v4: identificativi canonici, alias esatti, Paese, club promossi/retrocessi. Nessun fuzzy merge nuovo.
- ta-fixture-identity e ta-json-recovery-rc5: contesto, provenienza, dedup, osservazioni orario e proiezione utilizzabile taStatRows. Non riscrivere né riconciliare i dati all'apertura.
- IndexedDB e Undo rc5 restano il percorso esclusivo per mutazioni archivio. Preferenze v02v separate in una singola chiave locale; nessun dato personale in Git.
- TAHistoryManifest/TAHistoryCoverage: limiti documentati dei pacchetti; non chiamare il confronto integrale pesante all'avvio.

## Confini della nuova implementazione
Nuovo HTML derivato con aggiunta CSS/motore/UI. Motore puro condiviso tra estensioni Analisi partita e Comparatore: selezione per ID club, competizione/Paese, stagione e date, casa/fuori/neutro, risultati a 90 minuti noti, HT con denominatore separato. Tutti i campioni escludono il futuro; analisi gara esclude sempre il giorno della gara, incluse gare con kickoff incerto. Nessuna modifica alle formule/voti storici. Coppe preparate mediante metadati esistenti; supplementari e rigori non sostituiscono il risultato regolamentare.

Dashboard senza scansione segnali; calendario paginato e filtri persistenti, watchlist per identità gara. Apertura riga trasporta il contesto canonico completo, non soltanto nomi e data. Comparatore senza gara reale: descrizione, nessun pronostico. Segnali in livello separato con soglie fisse esplicite e massimo tre evidenze, nessuna promessa di rendimento.

## Oracoli e matrice bloccante
1. Prima dei segnali: diagnosi distribuzione reviewer rc5 su Serie A/La Liga 2024/25, split cronologico 2025/26 intatto; 8 mercati, campioni insufficienti e motivazioni. Non ottimizzare soglie sul test.
2. Motore: oracolo Python indipendente su fixture pubbliche e sintetiche; V/P/S, GF/GA, Over, BTTS, HT, riposo, H2H, stesso campione nelle due viste, date e neutralità.
3. CMP01–12: click browser reali, selettori indipendenti, promozione, anni diversi, niente futuro, tutte le competizioni, neutro, dati mancanti, inversione e reset, nessun consiglio ipotetico.
4. Dashboard: quattro destinazioni, ricerca alias/Paese/competizione/gara, watchlist e ripresa; sidebar Paesi apribili/pin/ordine/refresh; preferenze non cambiano fingerprint archivio.
5. Calendario: tutti i filtri combinati, ordine/pagine/ripristino, FT/HT mancanti e orari prudenziali, click identità completa.
6. Regressioni rc5: tutte le suite esistenti, veri backup privati x3, export/rilettura/Undo, alias, duplicati, quote, manuali, classifiche, trade, Scanner/Backtest/preset/mercati.
7. Nuova pagina: test browser delle stesse funzioni critiche e archivio reale ~28k; console/pageerror zero, misure di startup, nessuna mutazione durante navigazione.
8. Consegna: commit congelato, clone pulito, intero gate nuovamente; ZIP confrontato con Git e checksum, evidenze separate. Qualunque FAIL comporta correzione e ripetizione completa sul nuovo SHA.

## Rischi e limiti da riportare
Coperture parziali non complete per semplice conteggio; nazioni/club non verificati espliciti; fusi orari non dedotti; gare oggi senza orario non future certe; fonti importate non live; confronto interlega descrittivo. Windows/file:// non verificati da Linux; AUDIT indipendente ancora richiesto. Dati e journal personali non pubblicati. Nessuna conferma chiesta per decisioni tecniche già autorizzate.
