# DIREZIONE — MANDATO OPERATIVO TA-INT-004

**Progetto:** Trading Analytics — Gestionale sport trading  
**Data:** 27 ottobre 2026  
**Destinatario:** CODEX — Sviluppo tecnico  
**Oggetto:** Identificazione degli incontri, deduplicazione, normalizzazione squadre e integrità degli storici  
**Priorità:** P0 — Bloccante  
**Stato:** AUTORIZZATO PER SVILUPPO; NON PER MERGE O RILASCIO

## 1. Baseline e materiali

- Baseline tecnica: `fix/ta-stab-003-recupero-copertura` (rc4 Codex), PR #3 del repository `antoniodenuccio1995-a11y/Trading-sport`.
- Ultima candidata operativa da integrare selettivamente: `Trading_Analytics_rc4_BACKTEST_MERCATO_CORRETTO.zip` (Backtest, Mercato, gestione semplificata alias).
- Rapporto indipendente: `RISCONTRO_NUOVO_ZIP_RC4.md` (FAIL sull'integrazione degli storici).
- Nota tecnica: `NOTA_VERIFICA_PRELIMINARE_TA_STAB_003_RC4.md`.
- Analisi funzionale di supporto: `VERIFICA_BACKTEST_RC4_2026-10-27.md`.

Non sostituire automaticamente la rc4 originale con l'HTML corretto: confrontare le modifiche, applicarle in modo selettivo e sottoporle a regressione.

## 2. Difetto P0 confermato dall'AUDIT

Il 22/08/2025 le due righe `Pescara – Cesena 1–3` (`regular`) e `Delfino Pescara – Cesena FC 1–3` (`1. Round`) sono state importate come due gare e quattro club. La prova indipendente ha confermato il doppio conteggio nella classifica e la persistenza dopo il reload.

**Requisito:** una singola gara reale deve contribuire una sola volta alle classifiche, statistiche, confronti e Backtest, anche quando le fonti impiegano denominazioni differenti o usano il numero di giornata nel campo `Phase`.

## 3. Identità univoca degli incontri

- Distinguere competizione, stagione, data/orario, identificativi persistenti dei club, campo effettivo, fase sportiva reale ed eventuale identificativo fonte affidabile.
- Non usare `Phase=N. Round` come indicatore automatico di nuova fase rispetto a `regular`; modellare esplicitamente il numero della giornata.
- La somiglianza testuale o la coincidenza di risultato non basta per fondere due partite.
- Supportare incontri rinviati, annullati/rigiocati, fasi finali, gare di coppa e situazioni con identità incerta; nessuna fusione arbitraria.
- Distinguere copie identiche, record compatibili integrabili, conflitti nei risultati/HT/tiri/quote e identità ambigue.
- Conservare tutte le provenienze e i campi originali; mostrare diagnostica e simulazione di qualsiasi consolidamento.
- Rendere idempotente la reimportazione dello stesso pacchetto.

## 4. Anagrafica squadre e alias

- Unica identità club attraverso importazione CSV/JSON, classifiche, calendario, analisi, scanner e Backtest.
- Correggere alias documentati tra cui `Pescara`/`Delfino Pescara`, `Cesena`/`Cesena FC`, `PSG`/`Paris Saint-Germain`, `Lyon`/`Olympique Lyonnais`, `Man Utd`/`Manchester United`.
- Distinguere inequivocabilmente club diversi con nomi simili (es. PSG e Paris FC).
- Conservare ID persistenti, nomi sorgente, Paese, lega, fonti e decisioni approvate.
- Preservare l'interfaccia semplificata di correzione alias dell'ultima candidata operativa, con preview prima della conferma.

## 5. Fasi campionato e fonti

- Separare fase (regular, playoff, playout, gruppi, altre fasi effettive), giornata e competizione/stagione.
- Regole specifiche per lega, stagione e struttura del torneo; non generalizzare i conteggi della Serie B ad altre leghe.
- Esaminare prioritariamente `histories/stab003/I2_2025.json`, `E2_2025.json`, `E3_2025.json`, poi tutte le altre combinazioni.
- Ricostruire l'intera matrice delle 138 combinazioni con righe sorgente, incontri distinti, consolidamenti, conflitti, gare mancanti, FT/HT e fasi reali.
- Rivalutare le categorie dichiarate prima della correzione: 17 complete, 92 parziali, 29 non verificabili.
- Non chiamare una stagione completa soltanto perché la somma delle righe raggiunge il numero teorico.
- Non acquisire automaticamente le righe che rimangono in revisione.

## 6. Archivi esistenti e persistenza

- Progettare una diagnostica conservativa anche per duplicati già presenti nell'archivio locale dell'utente.
- Richiedere backup, preview con mapping riga→incontro, consenso e possibilità di annullamento/ripristino.
- Proteggere tutti i valori FT/HT, quote, stato calendario, eventi, fonte e record trade; vietata cancellazione silenziosa.
- Mantenere il supporto ai backup JSON v2 precedenti e il recupero delle due partite manuali con campionato non valorizzato.
- Nessun backup personale o sua derivazione nel repository o nei pacchetti pubblici.

## 7. Regressioni sull'ultima candidata operativa

- Conservare il menu Mercato funzionante e i preset della strategia, come verificati dall'utente nel browser Windows.
- Testare clic Backtest, strategie con condizioni solo casa o solo trasferta, tutte le operazioni storiche, esportazione CSV, partite future manuali, filtri per lega/stagione e diagnostica dei motivi d'esclusione.
- Accertare che statistiche e Backtest non includano due copie dello stesso incontro o risultati successivi alla partita valutata.
- Proteggere classifiche, grafici, scanner, scheda Analisi partita, registro trade, backup e formule/voti 0–100.

## 8. Prove di accettazione obbligatorie

1. **AUDIT riprodotto:** le due registrazioni Pescara–Cesena diventano **un incontro e due club** in classifica, anche dopo reload.
2. **Idempotenza:** reimportazione identica non aumenta i conteggi.
3. **Conflitti:** valori discordanti non vengono sovrascritti o uniti arbitrariamente.
4. **Fasi reali:** playoff/playout rimangono incontri distinti.
5. **Storici:** matrice completa di tutte le combinazioni ricostruita su dati deduplicati con prove, non su sole righe.
6. **Backtest:** verifica indipendente dei campioni, dei filtri, del cutoff e dei mercati.
7. **Persistenza:** importazione, esportazione, reload, rollback e report d'integrità.
8. **Backup personale, solo se disponibile privatamente:** nuova migrazione senza regressioni del risultato documentato 28.544 record → 28.402 incontri distinti, 0 esclusioni nella fase iniziale e conservazione dei 172.964 valori di quota non vuoti.
9. **Browser:** end-to-end con sorgenti e moduli effettivi; dichiarare esplicitamente ogni scenario non verificabile (inclusi eventuali blocchi `file://`).

## 9. Vincoli

- Ramo GitHub dedicato basato sulla rc4 di Codex; eseguire un'integrazione selettiva delle correzioni dirette, non un reset della storia.
- Non riscrivere le formule statistiche protette né voti e regole trading.
- Nessun merge su `main`, nessun deploy, nessuna etichetta stabile.
- Nessun intervento sui backup personali senza consenso e simulazione.
- Non sviluppare ancora nuove sezioni dell'Analisi partita, fasce delle classifiche o altri nuovi moduli.

## 10. Deliverable

- Nuova candidata ZIP completa e autonoma, con moduli adiacenti e istruzioni d'avvio.
- Diagnosi del difetto e tabella riga-per-riga dei casi rappresentativi.
- Matrice rigenerata degli storici, anomalie residue, fonti e limiti.
- Rapporto prove unit, browser, migrazione, salvataggio/Undo, Backtest e regressioni.
- Changelog, sintesi dei rischi, istruzioni di collaudo indipendente.
- PR in bozza senza merge, pronta per AUDIT indipendente.

**La DIREZIONE autorizza lo sviluppo ma non approva la versione stabile.**
