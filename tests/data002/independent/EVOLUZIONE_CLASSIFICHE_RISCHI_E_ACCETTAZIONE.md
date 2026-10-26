# Evoluzione Classifiche in Analisi partita — rischi e criteri

Stato: analisi tecnica preparatoria, nessuna implementazione e nessuna autorizzazione stabile implicita.

## Punti di riuso

| Componente attuale | Uso possibile | Condizione |
|---|---|---|
| standingsCompute(league,season,cutoff,scope) | Snapshot comune a tabella e grafico | Stesso cutoff, campionato, stagione e futuro identificatore di fase |
| analysisLeagueStandings | Punto di integrazione della scheda Classifiche della partita | Non dipendere da selettori globali del menu principale |
| standingsPositionLines / standingsProgressByDate | Tracce delle due squadre su date comuni | Verifica cutoff di ogni snapshot; nessun aggiornamento anticipato della giornata |
| standingsZoneRules / Info / Legend | Registro unico di bande e legenda | Configurazione versionata per campionato, stagione e fase; una fascia generica Europa non soddisfa i tre accessi UEFA richiesti |
| standingsHistoryBySeason | Storico per annata | Correggere il cutoff Infinity delle annate precedenti (F-04) |

## Rischi e scelte da fissare prima del codice

1. **Fase e metadati persistenti.** Il parser conserva una colonna Phase nell’oggetto temporaneo ma archiveCompact la elimina: prova indipendente con Phase=regular, backup Phase assente. Per regole specifiche di fase serve uno schema persistente con fase, fonte e migrazione dei backup precedenti; le vecchie gare senza fase non vanno classificate per supposizione.
2. **Regole sportive versionate e verificabili.** Registro unico keyed da leagueId/seasonId/phaseId, con fonte e data di verifica, formato, numero atteso di partecipanti e intervalli non sovrapposti. Champions, Europa League, Conference, promozione, playoff/playout e retrocessione vanno differenziati solo se previsti dal regolamento di quella competizione/annata/fase. Questa revisione non ha verificato regole federali di singole stagioni e non assegna nuovi posti numerici.
3. **Accesso europeo condizionale.** Coppe, assegnazioni aggiuntive e qualificazioni condizionali possono cambiare le bande; distinguere fasce indicative da esiti già certificati. Non trasportare regole di oggi su anni precedenti senza un record dedicato.
4. **Fasi, spareggi e carry-over.** Regular season, gruppi, split e playoff non sono sempre una sola classifica con punti ripartiti da zero. Servono esplicitamente criteri di ordinamento, eventuali trasferimenti/arrotondamenti di punti, penalizzazioni con data di efficacia e squadre della fase. Una tabella calcolata dai soli risultati senza tali dati resta una ricostruzione, non la graduatoria ufficiale.
5. **Cutoff uniforme.** Tutte le letture, compresi storico, colori, riferimenti e ogni punto del grafico, devono rispettare risultati.d < cutoff. Non leggere il risultato della partita analizzata, né risultati successivi, né metadati ricavati da un esito futuro. Con sole date, conservare la scelta prudente di escludere tutta la giornata: non inventare un ordine intragiornaliero da orari non verificati.
6. **Squadre e integrità.** Risolvere F-01/F-02 e alias prima di colorare ranghi. Se il roster è incompleto o ha più partecipanti del previsto, mostrare l’anomalia e non presentare fasce come certe. Il controllo attuale teamCount < size non intercetta un numero eccessivo di club.
7. **Performance.** Il grafico richiama standingsCompute per molte date e due squadre. Su molti campionati/stagioni, preferire calcolo incrementale o cache per league/season/phase/cutoff/snapshot; invalidare dopo import o correzioni. Misurare reattività con campioni reali: non promettere velocità solo perché il grafico esiste già.
8. **UX e colori.** Distinguere evidenziazione delle due squadre da banda di qualificazione, usando bordi/etichette oltre al colore. Legenda coerente, assi condivisi, primo posto in alto, testo accessibile, contrasto e dettaglio mobile. Non forzare la stessa fascia alla classifica casa/trasferta.

## Criteri di accettazione proposti

| ID | Prova | Atteso |
|---|---|---|
| CL-01 | Configurazioni approvate per ogni lega/annata/fase supportata | Roster e bande coerenti con la fonte; fallback esplicito se manca la configurazione |
| CL-02 | Una partita analizzata prima e dopo l’importazione di risultati futuri alterati | Tabella, fasce, riferimenti e punti precedenti del grafico invariati |
| CL-03 | Gara di luglio attribuita alla stagione precedente, cutoff antecedente | Nessuna inclusione nello storico; regressione di F-04 |
| CL-04 | Snapshot menu principale e scheda Analisi con identici parametri | Stesse posizioni e stessi punti; nessuna dipendenza dal filtro DOM globale |
| CL-05 | Cambio fase e annata con carry-over/penalità note in fixture | Regole applicate solo dalla loro efficacia, con fonte e stato della ricostruzione visibili |
| CL-06 | Squadra promossa, omonimi, alias, roster incompleto o eccessivo | Nessuna fusione impropria o fascia certa su dati anomali |
| CL-07 | Backup nuovo e migrazione da backup senza fase | Metadati conservati o stato non valutabile; nessuna fase inventata |
| CL-08 | Grafico due squadre desktop/mobile | Stesse date, scala posizionale corretta, legenda, selezione squadra e leggibilità |
| CL-09 | Importazioni, persistenza, backup e registro trade dopo integrazione | Regressioni principali superate su nuovo commit identificato |

Prima implementazione consigliata, solo dopo autorizzazione: funzioni pure con gli stessi parametri per tabella e grafico; registro di regole centralizzato; quindi rendering della scheda Analisi. Non iniziare copiando il DOM del menu Classifiche.
