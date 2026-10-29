# Trading Analytics — Nota di verifica preliminare TA-STAB-003 (v0.2U-rc4)

Data: 27 ottobre 2026. Verifica preliminare sulla consegna ZIP `Trading-sport-fix-ta-stab-003-recupero-copertura.zip` e sulle informazioni GitHub accessibili. Non è un AUDIT indipendente completo né un'approvazione al merge.

## Baseline e stato GitHub

- Commit della consegna: `242a15efae0ab64fd851335354c40c750d2d2e95`.
- PR #3: `https://github.com/antoniodenuccio1995-a11y/Trading-sport/pull/3` — aperta, in bozza, non integrata in `main`.
- Base PR #3: ramo rc3 `fix/ta-data-002-identita-integrita`, commit `313841c37e493b3ca3b7ba83f2799e0643c4abda`. Un commit aggiuntivo rispetto alla base.

## Quanto è verificato direttamente

- Archivio ZIP estratto e ispezionato; documentazione e matrici presenti.
- Test puri: `node --test tests/stab003/core.test.cjs` => 51 PASS / 51.
- Parser calcio: `python tests/stab003/parse-football.test.py` => 6 PASS / 6.
- Test CSV: `node --require ./tests/stab003/load-rc4.cjs --test tests/csv-import.test.cjs` => 29 PASS / 30: l'ultimo test necessita `git show 9dc238b:...`, non eseguibile perché lo ZIP non contiene `.git`. È un limite del test nell'estrazione, non prova di difetto CSV.
- La documentazione Codex dichiara il recupero del backup reale (28.544 record originali a 28.402 incontri distinti, 141 copie integrabili + una identica, zero esclusioni; 172.964 quote non vuote conservate). Questi risultati non sono stati rieseguiti indipendentemente perché nel pacchetto ZIP non è presente il backup personale.
- Matrice integrata: 138 campionato/stagione, di cui 17 complete verificato rispetto al perimetro/fonti di Codex, 92 parziali, 29 non verificabili.

## Criticità prioritaria sulla proposta pubblica di integrazione

Esame diretto dei pacchetti `histories/stab003/*_2025.json`:

| Pacchetto | Riga con `Phase=regular` | Riga con `Phase=N. Round` | Totale |
|---|---:|---:|---:|
| `I2_2025.json` — Serie B | 380 | 376 | 756 |
| `E2_2025.json` — League One | 552 | 406 | 958 |
| `E3_2025.json` — League Two | 552 | 449 | 1.001 |

Le righe `N. Round` paiono descrivere giornate di stagione regolare già presenti, non una nuova fase. Esempi riscontrati con stessa data e risultato nel file `I2_2025.json`:

- 22/08/2025 Pescara–Cesena 1–3 vs Delfino Pescara–Cesena FC 1–3.
- 23/08/2025 Empoli–Padova 3–1 vs Empoli FC–Calcio Padova 3–1.
- 23/08/2025 Monza–Mantova 1–0 vs AC Monza–Mantova 1911 SSD 1–0.

I campi nome e fase divergenti rendono possibile la mancata riconciliazione dei duplicati; l'ordine di grandezza è significativo. La `MATRICE_PROPOSTA_INTEGRATA.csv` indica 617 incontri distinti per Serie B 2025/26 dopo la proposta, rispetto ai 380 risultati regolari già presenti nell'archivio recuperato. Non è stato analizzato ogni incontro dei 617: è un indicatore di rischio concreto, non una certificazione di 237 duplicati.

Il revisore deve verificare e correggere se necessario la distinzione tra *giornata* (`N. Round`) e *fase* (regular/playoff/playout), l'identità dei club tra fonti, la riconciliazione data/avversari/risultato e il comportamento per tutte le stagioni e competizioni. Richiedere la rigenerazione dei pacchetti, delle matrici e dei test se la contaminazione è confermata.

## Raccomandazione

- **Il recupero JSON merita collaudo indipendente e operativo**; non richiedere modifiche manuali del backup.
- **Non eseguire integrazione massiva dei pacchetti storici** e non promuovere la rc4 a stabile prima dell'AUDIT.
- Priorità AUDIT: P0 integrità e deduplicazione pacchetti storici; P0 roundtrip backup 28.544/28.402 e conservazione quote; P1 rapporto di copertura (138 combinazioni); P1 pannelli espandibili; regressioni trade, cutoff temporale, HT/FT.
- `6.480` righe pubbliche in revisione nel dossier non sono sinonimo di partite mancanti né di righe originali eliminate.
