# Trading Analytics — Verifica preliminare indipendente del backtest (v0.2U-rc4)

**Data:** 27/10/2026  
**Oggetto:** Motore di selezione, visualizzazione delle operazioni storiche, partite future e condizioni su casa/trasferta.  
**Materiale verificato:** ZIP `Trading-sport-fix-ta-stab-003-recupero-copertura.zip`, HTML `Trading_Analytics_v0.2U-rc4_TA-STAB-003.html` e pacchetti pubblici `histories/stab003/I1_2024.json`, `I1_2025.json`.

## Esito

**PARZIALMENTE FUNZIONANTE, CON DIFETTI DA CORREGGERE.** Il motore estrae risultati storici validi in casi ordinari ma esclude impropriamente partite con condizioni su un solo lato, non scandisce le partite manuali future e non espone l'intera selezione storica.

Non sono stati modificati codice sorgente, archivi personali o trade. Le prove sono state realizzate eseguendo la funzione `run(S)` estratta senza modifiche dall'HTML in Node.js, con gli oggetti `MK`, `TM` e la funzione `odds`. Le identità dei club dei pacchetti pubblici sono state normalizzate mediante `ta-clubs-v3.js`. **Non è un collaudo del browser:** Chromium è stato bloccato dall'ambiente con `ERR_BLOCKED_BY_ADMINISTRATOR`, anche attraverso un server HTTP locale. Non è disponibile in questa verifica il backup personale del titolare.

## Prove del motore (Serie A)

Campione pubblico: Serie A 2024/25 (380 incontri) + 2025/26 (380 incontri), 760 incontri complessivi; filtro campionato `Serie A`; filtro periodo `Tutte le stagioni`.

| Caso | Condizioni | Incontri storici selezionati |
|---|---|---:|
| Preset Over 2.5 | ultimi 10 in casa ≥60% Over 2.5; ultimi 10 fuori ≥60% | 51 |
| Preset Over 1.5 | ultimi 10 in casa ≥75% Over 1.5; ultimi 10 fuori ≥75% | 98 |
| Preset Over 0.5 primo tempo | ultimi 10 in casa ≥70% eventi 1T; ultimi 10 fuori ≥70% | 158 |
| Test permissivo | ultimi 3 in casa ≥0% e ultimi 3 fuori ≥0% Over 2.5 | 678 |

Risultati validi per il campione e le condizioni esatte; non sono conteggi dell'archivio personale e non certificano profitti ottenibili sul mercato.

## Rilievi

### BT-01 — Condizione su un solo lato esclusa impropriamente · P1 (errore logico confermato)

Nella funzione `run` (circa righe 1424–1445), `qual` richiede sempre sia `hh.length >= S.n` sia `aa.length >= S.n`, anche quando `S.conds` contiene soltanto elementi `s: 'H'` o soltanto `s: 'A'`.

**Riproduzione:** 14 partite sintetiche con la stessa squadra di casa (tutte Over 2.5) contro 14 avversarie diverse; strategia con sola condizione «casa Over 2.5 ≥60%, ultimi 10». Motore: **0 incontri**, benché dalle gare successive alla decima esista uno storico casalingo adeguato. La carenza di partite precedenti dell'ospite non dovrebbe bloccare una condizione che non la riguarda.

**Atteso:** verificare i requisiti minimi soltanto per i lati e gli indicatori effettivamente selezionati; mantenere il controllo storico prima della partita e l'esclusione dei dati assenti.

### BT-02 — Le partite manuali future sono escluse · P1 (limite funzionale confermato dal codice)

`run(S)` costruisce `U` da `D().filter(r=>r.up...)`. Le partite create dal modulo manuale sono memorizzate separatamente in `man` e non entrano in `D()`. Il calendario ordinario le visualizza perché unisce `rows` e `man`, mentre il backtest non lo fa.

**Atteso:** scansione anche del calendario manuale, con deduplicazione per data/campionato/identità dei club e cutoff cronologico specifico per partita. Non inventare quote quando assenti; etichettare gli scenari.

### BT-03 — Solo ultime 12 operazioni, manca l'elenco completo · P1 (limite UX confermato)

La risposta storica contiene `bets.slice(-12).reverse()`, senza paginazione né esportazione delle restanti gare. Il riepilogo indica il numero totale delle operazioni, ma l'utente non può identificare tutte le partite.

**Atteso:** tabella completa filtrabile (campionato, stagione, data, mercato, esito), paginazione, CSV esportabile, riepilogo della strategia e campioni realmente impiegati per ciascuna selezione.

### BT-04 — Mancano le cause di esclusione · P1

Se `bets.length === 0`, l'interfaccia mostra soltanto «Nessuna partita storica rispetta questa strategia...». Non distingue gare non disponibili, meno di N precedenti per lato richiesto, HT assente, percentuali non soddisfatte, filtro campionato o stagione, partite future non caricate.

**Atteso:** diagnostica a imbuto con conteggi per causa, dati mancanti e condizioni specifiche non soddisfatte, in modo da non confondere bug, restrizioni e scarsità di dati.

### BT-05 — Rischio duplicati e fasi · P0 (verifica d'integrità)

Il motore si basa direttamente su `rows` e non elimina localmente le partite duplicate. Le anomalie già segnalate su alcuni pacchetti storici (Serie B, League One, League Two 2025/26) possono alterare cronologie, frequenze, campioni e risultati se i duplicati entrano nell'archivio. Verificare che i record importati siano risolti con gli ID club e le fasi vere prima del backtest, senza fusioni arbitrarie.

### BT-06 — Scope, calendario e tempo dell'analisi · P1

La scelta della lega deriva dal controllo generale `#lg`, non da un filtro contestuale nel Backtest. Le partite future vengono cercate soltanto nelle righe `up` con `d >= Date.now()-1 giorno`, senza includere la lista manuale. Il filtro stagione si applica alle operazioni storiche, non al calendario futuro. La verifica prepartita deve ricostruire lo storico fino al cutoff di ciascuna partita ed evitare qualunque risultato successivo.

## Altre osservazioni

- Con `S.n=20` su 16 precedenti sintetici, risultato 0, coerente con la regola del campione minimo.
- Con dati HT assenti, il preset che richiede HT ritorna 0: comportamento conservativo, ma deve essere spiegato con una diagnostica HT disponibile/mancante.
- Il motore elabora gli incontri del medesimo giorno come gruppo e inserisce i risultati nello storico solo dopo aver valutato tutti quelli del gruppo: buona precauzione contro leakage tra partite dello stesso giorno.
- Le percentuali sono frequenze sui precedenti della squadra nel medesimo contesto, non probabilità previste. Le quote fisse sostitutive sono scenari ipotetici, non quote storiche verificate.

## Criteri di accettazione proposti per Codex

1. Correggere BT-01 e testare strategie con soli `H`, soli `A` e ambedue.
2. Includere le partite manuali nel motore di ricerca futura, senza scrivere duplicati e senza risultati futuri.
3. Esporre **tutte** le partite storiche selezionate in tabella paginata, con esportazione CSV e prove sui conteggi.
4. Aggiungere un pannello diagnostico dei motivi di esclusione e dei dati disponibili: campionati/stagioni, N precedenti casa/fuori, HT, calendario.
5. Verificare l'immunità dai duplicati storici e dalle fasi errate prima di computare le frequenze.
6. Ripetere i test su scenari sintetici e su almeno due stagioni pubbliche di più campionati; collaudare l'interfaccia in browser su HTTP.
7. Nessuna modifica a formule statistiche protette, voti trade o archivi personali; nessun merge/deploy stabile senza AUDIT.

**Raccomandazione:** bloccare l'approvazione del modulo Backtest come ricerca affidabile delle partite fino alla correzione di BT-01/BT-03 e al controllo di BT-05. Le altre funzioni della rc4 richiedono revisione indipendente secondo il mandato TA-STAB-003.
