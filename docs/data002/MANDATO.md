# DIREZIONE — MANDATO OPERATIVO TA-DATA-002

**Progetto:** Trading Analytics  
**Data:** 26 ottobre 2026  
**Destinatario:** CODEX — Sviluppo e correzione tecnica  
**Repository:** `antoniodenuccio1995-a11y/Trading-sport`  
**Baseline:** v0.2U-rc1 — TA-CSV-001  
**Stato:** AUTORIZZATO  
**Priorità:** P0 + P1

## 1. Obiettivo generale

La DIREZIONE autorizza un intervento unitario per:

1. Risolvere i quattro rilievi della revisione indipendente TA-CSV-001, conclusa con esito FAIL.
2. Realizzare un sistema centralizzato e affidabile di identificazione delle squadre, eliminando le incongruenze causate da denominazioni differenti nei CSV e nelle altre fonti.

L'incarico comprende analisi, correzione, sviluppo, test e consegna di una nuova versione candidata.

## 2. FASE A — P0: Correzione difetti AUDIT

Utilizzare il pacchetto `REVISIONE_TA_CSV_001_v02U_rc1_2026-10-26.zip`, inclusi rapporto, fixture e test indipendenti.

**F-01 — Integrità dei campionati**

Impedire che righe con campionato sconosciuto vengano attribuite automaticamente a un campionato riconosciuto nello stesso file.

Prevedere validazione per riga e gestione esplicita delle anomalie.

**F-02 — Provenienza e stagione**

Correggere l'importazione delle associazioni squadra/categoria affinché rispetti la stagione dichiarata e i filtri dell'anteprima.

**F-03 — Compatibilità dei parser**

Uniformare la lettura dei CSV tra anteprima, importazione degli incontri e importazione della provenienza.

Un file considerato valido nell'anteprima non deve essere rifiutato successivamente senza un messaggio chiaro.

**F-04 — Integrità temporale**

Correggere il cutoff degli storici pluriennali, escludendo qualsiasi risultato successivo alla data della partita analizzata, indipendentemente dalla stagione assegnata.

Ogni difetto dovrà essere riprodotto prima della correzione e sottoposto nuovamente ai test dopo l'intervento.

## 3. FASE B — P1: Anagrafica unica delle squadre

Progettare un sistema centralizzato di identificazione dei club, condiviso da tutti i moduli di Trading Analytics.

### 3.1 Identità delle squadre

Ogni squadra deve avere:

- Identificativo interno permanente.
- Nome principale visualizzato.
- Nomi alternativi riconosciuti.
- Denominazione originale della fonte.
- Eventuale codice identificativo della fonte.
- Stato dell'associazione: verificata, da verificare o ambigua.

Esempi da gestire:

- PSG / Paris SG / Paris Saint-Germain.
- Lione / Lyon / Olympique Lyonnais.
- Inter / Internazionale Milano.
- Manchester United / Man Utd.
- Sporting CP / Sporting Lisbon.

Non effettuare associazioni automatiche basate esclusivamente sulla somiglianza testuale.

### 3.2 Ricognizione completa

Analizzare le denominazioni presenti negli storici disponibili di tutti i campionati supportati, non soltanto delle sei nazioni recentemente aggiunte.

Produrre un registro delle denominazioni alternative e dei possibili duplicati.

Distinguere rigorosamente club differenti con nomi simili.

### 3.3 Integrazione con il gestionale

Il sistema di identità unica deve essere utilizzato per:

- Importazione e aggiornamento CSV.
- Riconoscimento delle partite duplicate.
- Calendario e risultati.
- Classifiche e grafici posizionali.
- Analisi delle partite.
- Scanner dei mercati.
- Associazioni tra squadre e campionati.

Il registro trade deve mantenere la compatibilità con le operazioni esistenti.

### 3.4 Gestione delle anomalie

Prevedere un riepilogo diagnostico delle squadre non riconosciute o potenzialmente duplicate.

Le associazioni ambigue devono rimanere da verificare, senza accorpamenti arbitrari.

## 4. Integrità degli archivi

La nuova gestione dei nomi non deve causare:

- Perdita di partite storiche.
- Duplicazioni degli incontri.
- Modifiche involontarie ai risultati.
- Alterazione dei dati HT o delle quote.
- Modifiche retroattive al registro trade.
- Incompatibilità non gestite con i backup precedenti.

Prima di applicare migrazioni, produrre una simulazione con confronto dei dati iniziali e finali.

Nessun archivio personale deve essere modificato durante i test.

## 5. Verifiche obbligatorie

Eseguire:

1. Nuovamente tutti i test previsti da TA-CSV-001.
2. I quattro test falliti nell'AUDIT indipendente.
3. Test sui CSV contenenti squadre con denominazioni differenti.
4. Test di reimportazione senza duplicati.
5. Test su classifiche e statistiche prima/dopo la normalizzazione.
6. Test di backup, ripristino e persistenza.
7. Test di regressione su calendario, analisi partita e registro trade.
8. Test sul mancato utilizzo di risultati futuri.

Distinguere chiaramente verifiche automatiche, verifiche browser e test non effettuati.

## 6. Vincoli operativi

- Lavorare su un ramo GitHub dedicato.
- Conservare integralmente le versioni precedenti.
- Non effettuare merge automatici su `main`.
- Non pubblicare la nuova versione come stabile.
- Non modificare le formule dei voti statistici 0–100.
- Non introdurre nuove funzionalità di trading.
- Non sviluppare ancora la nuova interfaccia delle classifiche.
- Procedere autonomamente all'interno del mandato senza richiedere approvazioni per ogni correzione tecnica ordinaria.

## 7. Consegne richieste

Al termine consegnare:

1. Nuova versione candidata del gestionale.
2. Rapporto delle correzioni F-01/F-04.
3. Registro degli alias e delle identità delle squadre.
4. Rapporto dei nomi ambigui o non risolti.
5. Changelog e documentazione tecnica.
6. Risultati dei test con evidenze riproducibili.
7. Rapporto di integrità prima/dopo.
8. Istruzioni per il collaudo indipendente.
9. Pull request disponibile per la revisione, senza merge.

## 8. Condizioni di completamento

L'incarico sarà considerato tecnicamente concluso quando:

- Tutti e quattro i rilievi AUDIT risulteranno corretti e verificati.
- Il sistema di identificazione delle squadre funzionerà sui casi verificati.
- Non saranno rilevate regressioni bloccanti.
- Tutte le anomalie residue saranno documentate.
- La nuova versione candidata sarà disponibile per l'AUDIT indipendente.

**La DIREZIONE mantiene l'autorità esclusiva di approvazione della versione stabile.**