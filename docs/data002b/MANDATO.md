# DIREZIONE — MANDATO CORRETTIVO TA-DATA-002B

**Progetto:** Trading Analytics  
**Data:** 26/10/2026  
**Destinatario:** CODEX — Sviluppo tecnico  
**Versione di riferimento:** v0.2U-rc2 — TA-DATA-002  
**Priorità:** Alta  
**Stato:** AUTORIZZATO

## 1. Contesto

La versione v0.2U-rc2 ha introdotto un sistema centralizzato di identificazione delle squadre e una procedura di migrazione degli archivi.

Durante il collaudo operativo sono emerse alcune difficoltà che devono essere risolte prima della revisione indipendente.

In particolare:

- L'importazione del precedente backup JSON viene bloccata con il messaggio: «Simulazione migrazione bloccata: 40 collisioni di identità, 0 errori; nessuna modifica effettuata».
- L'esportazione del rapporto di integrità restituisce `{"status":"nessuna simulazione"}`, impedendo di analizzare le collisioni riscontrate.
- L'anagrafica identifica numerose squadre come «da verificare» e alcune come ambigue, senza offrire un sistema sufficientemente semplice per gestirle.
- Sono presenti denominazioni associate a un Paese conosciuto e altre alla categoria `UNSPECIFIED`.

La DIREZIONE allega il backup JSON originale che ha generato il problema, affinché Codex possa riprodurre e analizzare l'errore reale.

## 2. Obiettivo A — Semplificazione importazione JSON

Analizzare e migliorare l'intera procedura di importazione dei backup precedenti.

Realizzare un percorso guidato che consenta di:

1. Selezionare un file JSON.
2. Riconoscerne automaticamente il formato e la versione.
3. Visualizzare il numero di partite, stagioni e campionati contenuti.
4. Individuare duplicati, collisioni e dati incompatibili.
5. Mostrare una simulazione comprensibile prima dell'importazione.
6. Consentire la risoluzione delle anomalie effettivamente risolvibili.
7. Confermare l'importazione soltanto dopo i controlli di sicurezza.
8. Verificare il corretto salvataggio e consentire il ripristino della situazione precedente in caso di errore.

**Non deve essere necessario modificare manualmente il JSON.**

Distinguere chiaramente duplicati identici, record compatibili integrabili, risultati discordanti e identità ambigue.

I duplicati effettivamente identici potranno essere consolidati in sicurezza, preservando eventuali dati aggiuntivi. I conflitti non risolvibili devono invece restare bloccati e visibili all'utente.

Valutare anche una modalità di importazione parziale sicura, escludendo esclusivamente i record problematici, ma soltanto con anteprima, consenso esplicito e garanzia che nessun dato venga perso o sovrascritto silenziosamente.

## 3. Obiettivo B — Diagnosi delle 40 collisioni

Utilizzare il backup JSON originale allegato per:

- Riprodurre esattamente le 40 collisioni.
- Identificare gli incontri coinvolti.
- Individuare la causa di ciascuna collisione.
- Distinguere duplicati reali da falsi positivi.
- Verificare se le anomalie dipendono dagli alias, dai dati originali o dalla logica di migrazione.
- Proporre e implementare correzioni sicure.

Produrre una tabella con data, campionato, squadre, risultati, identificativi coinvolti, causa e trattamento applicato o proposto.

Non eliminare automaticamente partite con risultati contrastanti.

## 4. Obiettivo C — Gestione semplificata delle squadre

Evolvere l'attuale anagrafica in una sezione operativa, non soltanto diagnostica.

L'utente deve poter:

- Cercare una squadra per nome.
- Visualizzare il nome principale e tutti gli alias conosciuti.
- Consultare Paese, fonti e identificativo interno.
- Confermare che due denominazioni rappresentano lo stesso club.
- Correggere associazioni errate.
- Aggiungere un alias verificato.
- Distinguere due club differenti con nomi simili.
- Visualizzare preventivamente le conseguenze sulle partite e sulle statistiche.

Esempi:

- PSG / Paris SG / Paris Saint-Germain → stessa società.
- Lyon / Lione / Olympique Lyonnais → stessa società.
- Paris FC e Paris Saint-Germain → società differenti.
- Manchester United / Man Utd → stessa società.

Il sistema deve proporre automaticamente le associazioni plausibili, senza confermarle arbitrariamente quando vi sono incertezze.

## 5. Obiettivo D — Miglioramento identificazione automatica

Studiare una procedura per ridurre progressivamente le centinaia di identità «da verificare».

Priorità:

1. Utilizzare i codici identificativi affidabili delle fonti, quando disponibili.
2. Utilizzare il contesto del Paese e della competizione.
3. Riconoscere gli alias già verificati.
4. Evitare duplicazioni dovute alla categoria `UNSPECIFIED`.
5. Segnalare soltanto le associazioni realmente incerte.

Valutare la possibilità di confermare più associazioni contemporaneamente quando tutte sono documentate e prive di conflitti.

Una squadra senza alias alternativi non deve essere necessariamente trattata come un'anomalia bloccante.

Le identità verificate devono mantenere identificativi persistenti e riutilizzabili nelle importazioni successive.

## 6. Obiettivo E — Miglioramento dell'esperienza utente

La nuova procedura deve essere comprensibile anche senza conoscenze tecniche.

Prevedere:

- Messaggi in italiano chiari.
- Numero di partite importabili e problematiche.
- Anteprima prima/dopo.
- Segnalazione visiva dei conflitti.
- Possibilità di esaminare gli incontri interessati.
- Esportazione del rapporto diagnostico anche quando l'importazione fallisce.
- Conservazione della simulazione fino a quando l'utente non la elimina o ne esegue una nuova.
- Indicazione chiara dei passaggi necessari per completare il recupero.

Evitare di esporre identificativi tecnici lunghi quando non sono necessari all'utente.

## 7. Integrità e sicurezza

Vincoli obbligatori:

- Non modificare il backup JSON originale.
- Non cancellare dati personali.
- Non modificare le formule statistiche.
- Non alterare il registro trade.
- Non sovrascrivere risultati contrastanti.
- Non pubblicare il backup personale nel repository GitHub.
- Non eseguire migrazioni distruttive.
- Mantenere la compatibilità con i backup delle precedenti versioni.
- Prevedere test di backup, recupero e persistenza.
- Garantire che un'operazione interrotta non lasci l'archivio in uno stato parziale o incoerente.

## 8. Modalità operative

Lavorare a partire dal ramo della candidata TA-DATA-002, conservando tutte le versioni precedenti.

Codex è autorizzato a effettuare le correzioni tecniche e le modifiche UX necessarie all'interno del perimetro.

Non eseguire merge su `main` né deploy stabile.

Non iniziare ancora l'evoluzione grafica delle classifiche.

## 9. Consegne obbligatorie

1. Diagnosi dettagliata delle 40 collisioni reali.
2. Versione candidata corretta.
3. Procedura semplificata per importare i JSON.
4. Interfaccia di gestione delle identità delle squadre.
5. Rapporto delle associazioni risolte e residue.
6. Test automatici e browser.
7. Verifiche di integrità prima/dopo.
8. Changelog e istruzioni operative.
9. Aggiornamento della pull request TA-DATA-002 per revisione indipendente.

## 10. Criterio di accettazione

L'intervento sarà considerato completato quando il backup allegato potrà essere analizzato integralmente, le 40 collisioni saranno classificate e gestibili in modo sicuro, la procedura di recupero sarà utilizzabile senza modifiche manuali al JSON e l'anagrafica consentirà di risolvere le associazioni dei club.

Eventuali conflitti irrisolvibili dovranno essere documentati e non trattati automaticamente.

La versione resterà candidata fino all'approvazione della DIREZIONE dopo AUDIT indipendente.