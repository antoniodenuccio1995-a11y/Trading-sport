# Riscontro indipendente sul nuovo ZIP rc4

Data: 27 ottobre 2026. Esito della verifica mirata: **FAIL per l’integrazione degli storici**. Non è un audit completo né un’autorizzazione al rilascio stabile.

## Pacchetto esaminato

`Trading_Analytics_rc4_BACKTEST_MERCATO_CORRETTO(1).zip` — SHA-256 `559e6504d5fe3d45ce4378ca91c47865f036c4ab6c3c09d708ec5960e53cb1ca`. Versione provata: `Trading_Analytics_v0.2U-rc4_FIX_BACKTEST_ALIAS_MERCATO.html`, con i moduli e i dati inclusi nel medesimo ZIP.

La documentazione del pacchetto riferisce la correzione del menu Mercato e specifica che si tratta di una versione sperimentale. La presente verifica non certifica il funzionamento complessivo del backtest o della correzione degli alias.

## Prova indipendente nel browser

In un profilo temporaneo isolato, con accesso consentito solo al server locale, è stata caricata una copia sintetica contenente due righe tratte dagli storici pubblici del pacchetto:

| Data | Incontro | Risultato | Fase nel pacchetto |
|---|---|---|---|
| 22/08/2025 | Pescara – Cesena | 1–3 | regular |
| 22/08/2025 | Delfino Pescara – Cesena FC | 1–3 | 1. Round |

Le righe si riferiscono allo stesso incontro con denominazioni differenti. L’anteprima le ha accettate entrambe come sicure, senza segnalare problemi. Dopo la conferma di questa prova isolata, la classifica ha contato **2 partite e 4 squadre**, anziché una partita e due squadre. Dopo il riavvio della pagina erano persistenti entrambe le righe; nessun errore JavaScript è stato rilevato nel percorso di prova.

Il comportamento interessa la nuova versione, non solo il pacchetto precedente. I moduli di identificazione dello storico e recupero JSON sono identici ai rispettivi moduli del precedente pacchetto esaminato. La fase `1. Round` viene trattata come distinta da `regular`, mentre i nomi alternativi non sono riconciliati in questo caso; il controllo non intercetta la duplicazione.

## Interpretazione dei conteggi

In una fase regolare con 20 squadre e andata e ritorno, le partite sono 20 × 19 = 380. La stagione complessiva può contenere ulteriori partite di playoff, playout o altre fasi, se previste: superare 380 da solo non dimostra un errore. Nel caso provato, tuttavia, lo stesso incontro entra due volte. Non si può dedurre da questa prova quante siano le duplicazioni complessive o sostenere che tutte le partite oltre 380 siano errate.

Nel precedente pacchetto, il confronto automatico delle fonti aveva inoltre individuato possibili coppie da verificare nei campionati I2, E2 ed E3. Questi candidati non sono un conteggio certificato dei duplicati e non giustificano un’unione automatica.

## Limiti e azioni raccomandate

- Non integrare in massa gli storici del pacchetto finché le identità delle squadre e le fasi non siano state verificate e le anomalie corrette. Non cancellare manualmente le righe basandosi solo su data e risultato.
- Distinguere la fase della competizione dal numero di giornata, verificare gli alias con corrispondenze documentate e bloccare o sottoporre a revisione i casi ambigui. Preservare le reali fasi successive alla stagione regolare.
- Rigenerare i pacchetti e le relative matrici di copertura dopo la correzione; ripetere test di integrazione, importazione ripetuta, classifiche e persistenza, inclusi playoff e playout reali.
- Conservare separatamente copie dei backup originali delle partite e del registro trade. Effettuare prove su un profilo browser isolato e su copie; la porta o il profilo diversi possono mostrare un archivio vuoto senza implicare perdita dei dati.
- Il backup personale non era disponibile per questa verifica: non è stato modificato, e la sua migrazione completa e persistenza non sono state certificate. I test del produttore riportati nel pacchetto sono dichiarazioni dell’autore, non sostituiscono una prova indipendente sull’archivio personale.

Nessun codice del progetto è stato modificato e nessun rilascio stabile è stato autorizzato.
