# Trading Analytics v0.2T — Recupero storici

**Baseline:** v0.2S, conservata e non modificata. La v0.2T è una candidata da collaudare.

## Procedura

1. Conserva la v0.2S e scarica prima un backup JSON dal gestionale attuale. Non cancellare alcun archivio originale.
2. Apri `Trading_Analytics_v0.2T_Recupero_Storici.html` in Chrome/Edge.
3. Apri **Area tecnica / Area import** e premi **Recupera storici mancanti · 8 leghe**.
4. Leggi la console. Una lega può essere aggiornata parzialmente: il resoconto indica separatamente le stagioni recuperate e quelle non recuperate.
5. Se la fonte originale Football-Data è bloccata da CORS, il gestionale tenta `footballcsv/cache.footballdata` per le stagioni **2021/22, 2022/23, 2023/24**.
6. Per eventuali **2024/25 e 2025/26** mancanti, seleziona il campionato, apri i collegamenti CSV della stagione dal Centro download, salva i CSV sul PC e usa **CSV storico scaricato manualmente** nella pagina Area import, selezionando la lega corretta.
7. Dopo il caricamento, controlla il numero delle partite per anno, in particolare i gol del primo tempo.
8. Esporta un nuovo backup JSON.

## Otto campionati dell'intervento

Eredivisie (`N1`), Primeira Liga (`P1`), Superliga Danimarca (`DNK`), SuperLiga Romania (`ROU`), La Liga (`SP1`), Segunda División (`SP2`), Ligue 1 (`F1`), Ligue 2 (`F2`).

## Formati supportati

- Football-Data ordinario: `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG,...`
- Football-Data cumulativo extra: `Country,League,Season,Date,Time,Home,Away,HG,AG,...` (non fornisce HT nel formato verificato)
- Cache FootballCSV: `Date,Team 1,FT,HT,Team 2`, con `HT=?` quando mancante

**Attenzione:** nei dati di Danimarca e Romania senza risultato del primo tempo, le analisi 1T non hanno evidenza. I file alternativi non comprendono necessariamente playoff, gare rinviate o tutte le stagioni; per ogni lega vanno controllati i conteggi.

## Fonte e limiti

- Football-Data: https://www.football-data.co.uk/downloadm.php
- Archivio cumulativo: https://www.football-data.co.uk/all_new_data.php
- Fallback pubblico: https://github.com/footballcsv/cache.footballdata
- Open Matchday 2026/27: https://github.com/oladeeayo/open-matchday

L'aggiornamento in un file HTML aperto come `file://` resta condizionato dai permessi CORS dei siti sorgente. Questa versione non pretende di superare tali restrizioni.
