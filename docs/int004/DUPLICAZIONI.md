# Duplicazioni e matrici rivalutate

Tutti i 138 pacchetti rc4 sono stati letti e verificati contro i rispettivi checksum. Gli originali in `histories/stab003` sono conservati. I pacchetti provvisori stanno in `histories/int004`; ciascuno dichiara lo SHA-256 originale e affianca un file `.review.json` con le righe non importabili automaticamente.

## Esame completo dei pacchetti

Le 40.248 righe originali sono contabilizzate come **35.974 incontri/calendari utilizzabili, 913 copie consolidate e 3.361 righe in revisione**. Questi numeri si riferiscono ai pacchetti pubblici, non al backup dell'utente. I calendari futuri non sono risultati finali. `packet-lineage.json` rende conto di ciascun indice originale; `packet-audit.json` espone FT, HT, fasi, fonti e motivi della revisione.

| Pacchetto | Righe originali | Distinti utilizzabili | Copie consolidate | Righe in revisione |
|---|---:|---:|---:|---:|
| I2_2025 | 756 | 380 | 300 | 76 |
| E2_2025 | 958 | 459 | 288 | 211 |
| E3_2025 | 1.001 | 453 | 325 | 223 |

Per I2_2025 sono verificate le 380 gare regolari: i 76 riferimenti secondari non riconciliati per data non vengono aggiunti come nuove partite. L'atteso dell'intera competizione, comprese tutte le fasi condizionali, non è attestato; lo stato resta parziale.

Per E2_2025 ed E3_2025 il riferimento primario contiene tutte le 552 gare regolari. Sono trattenuti per revisione rispettivamente **93 e 99 incontri primari** perché risultati o statistiche discordano dalle altre osservazioni. Non sono partite fisicamente mancanti. Sono inoltre assenti dai pacchetti le cinque gare dei playoff attesi di ciascuna competizione: queste sono una lacuna distinta. Le rispettive righe di revisione comprendono anche copie secondarie, date discordanti e conflitti già documentati; non vanno sommate come altrettante gare mancanti.

Le intestazioni vere dei playoff, fra cui `Finals, Semifinals` e `Finals, Final`, vengono conservate come fasi finali nelle competizioni appropriate. La prova pubblica di Championship 2024/25 conserva 557 incontri complessivi e ne usa 552 per la classifica regolare.

## Come leggere i tre perimetri

1. **MATRICE_PACCHETTI.csv:** 138 combinazioni delle fonti pubbliche riconciliate. Esito 17 complete verificate, 92 parziali, 29 non verificabili.
2. **MATRICE_ORIGINALE_AGGREGATI.csv:** backup personale originale, misurato senza integrazioni. Esito 11/98/29.
3. **MATRICE_PROPOSTA_RC4_AGGREGATI.csv:** rivalutazione della proposta privata rc4 da 35.022 righe, senza modificarla. Esito **14/95/29**, che supera il precedente 17/92/29 attribuito a quella proposta.

Lo stesso numero 17 nel primo perimetro non conferma il conteggio precedente del terzo perimetro. I campioni, i dati riconciliati e i criteri applicati sono distinti. Le matrici relative a dati privati pubblicano soltanto conteggi, senza incontri, quote o partite manuali.

`verifiedDistinct`/`present` riguarda il campione utilizzabile. `inputRows` include le osservazioni originali; `archiveReviewRows` e `reviewRows` mostrano le osservazioni mantenute fuori dal campione. `ft`, `ht` e `htExact` sono separati. Un HT ignoto non è uno 0–0 e non rappresenta un incontro assente.

`missingRegularMatches` misura lacune del riferimento primario regolare; `missingFinalPhaseMatches` misura le gare aggiuntive attese soltanto quando struttura e regolamento del conteggio sono verificabili. Un campo vuoto significa non verificato. `resultsHeldForReview` distingue FT presenti ma contestati da incontri realmente assenti. Il confronto con un archivio personale distingue inoltre mancanze nel riferimento sicuro da dati non riconciliabili.

## Completezza e limiti

La completezza richiede stagione chiusa, atteso complessivo documentato, FT coerenti, assenza di duplicati/conflitti/revisioni aperte e copertura delle fasi previste. Per i gironi all'italiana viene verificato anche il grafo di tutte le coppie ordinate, non soltanto il totale di righe. La copertura HT viene dichiarata separatamente. Una stagione corrente resta parziale.

Le fonti sono aggregatori pubblici con URL e hash: non si presenta il risultato come certificazione federale. Per Danimarca, Romania e Belgio alcune fonti non descrivono le fasi dei singoli record. Il semplice numero della giornata resta insufficiente. Le combinazioni senza fonti già segnalate nella rc4 rimangono non verificabili; non sono automaticamente archivi vuoti.

Gli orari privi di un fuso confrontabile, gli identificativi contraddittori e i disaccordi FT/HT richiedono verifica. Nessun risultato viene selezionato soltanto perché consente di raggiungere un totale atteso. I dati in revisione sono conservati nei file diagnostici pubblici o, per gli archivi personali, nell'ambiente privato.
