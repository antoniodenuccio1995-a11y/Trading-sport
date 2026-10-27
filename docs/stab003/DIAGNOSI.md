# TA-STAB-003 — Diagnosi tecnica

Baseline immutata: `313841c37e493b3ca3b7ba83f2799e0643c4abda`, v0.2U-rc3. Candidata: v0.2U-rc4, ramo `fix/ta-stab-003-recupero-copertura`.

## Errore riprodotto sul backup originale

Il backup versione 2 contiene 28.544 record compatti e due partite manuali nel vecchio formato `{d,H,A}`. La rc3 applica a `manual` la validazione dei record completi: richiede anche campionato e stato dell'incontro. La lettura termina prima della simulazione delle partite. Il JSON originale è valido; non serve modificarlo manualmente.

Isolando in memoria i soli record, la rc3 rileva inoltre 40 gruppi integrabili e 42 incontri con la denominazione ambigua «Paris». Questo secondo problema è distinto dal fallimento del lettore del backup completo.

## Migrazione e identità

La rc4 legge i formati compatti v1/v2, le liste precedenti di partite, `rows` e il formato di trasferimento precedente. I rapporti diagnostici di anagrafica/integrità vengono riconosciuti come rapporti: non contengono l'archivio da recuperare.

Alle partite manuali senza campionato viene assegnato un contesto soltanto se esiste un unico incontro con data e squadre esatte nell'archivio. Il payload originale è conservato in `LegacyManualOriginal`. Se la prova non è univoca, il record resta in `manualUnassigned`, esportabile e assegnabile dall'interfaccia. Non viene eliminato né ammesso alle analisi senza contesto.

Per «Paris» non viene introdotta un'associazione globale a PSG. Si confrontano data, competizione, lato casa/trasferta, avversario e FT disponibile con le gare pubbliche del commit Open Matchday `5bab54301722564438c8070b70b446271e639637`. I 42 record del backup corrispondono a 34 Paris FC e 8 PSG. Le prove per incontro restano nei metadati.

L'esame successivo ha trovato 102 copie ulteriori con alias espliciti delle fonti: 35 sono risolte dall'alias documentato Spurs/Tottenham; 67 mediante identico incontro datato e dizionario pubblico. Quest'ultimo collegamento richiede competizione nazionale, stesso Paese, alias esplicito e soli ID provvisori generati dal nome. Non fonde ID distinti forniti da provider e non trasferisce decisioni a omonimi di altri Paesi. Gli ID provvisori consolidati rimangono in `ClubHomeLegacyIds`/`ClubAwayLegacyIds`.

La simulazione finale del backup completo produce 28.402 incontri distinti: 141 copie integrabili e una identica vengono consolidate; nessuna riga problematica viene esclusa. Entrambe le partite manuali vengono recuperate. Le 40 collisioni precedenti sono quindi solo una parte del fenomeno rilevato sui dati reali.

## Conservazione e ripristino

Il consolidamento riempie i campi vuoti e conserva provenienze e denominazioni originali. FT discordanti, statistiche/quote non equivalenti e identità ambigue impediscono la fusione: l'interfaccia mostra data, squadre, valori e motivo. È possibile escludere esplicitamente le sole righe problematiche in ingresso, mantenendo intatti i record precedenti. Non è una correzione automatica del risultato.

Gli zeri dei calendari non diventano un HT inventato quando arriva il risultato. Eventuali valori precedenti del calendario rimangono nell'evidenza di recupero. Un CSV successivo non sovrascrive quote o statistiche esistenti non vuote.

Anteprima, conferma e controllo della revisione proteggono dalle modifiche concorrenti. Una sola transazione IndexedDB scrive incontri, dati ausiliari, regole, rapporto e puntatore Undo. La verifica successiva confronta il contenuto scritto. «Ripristina situazione precedente» annulla l'ultima operazione compatibile con la revisione corrente. Non è una cronologia illimitata: per conservare più punti di recupero esportare i backup.

L'ordinamento cronologico e le etichette delle squadre restano stabili alla riapertura. In particolare è stato eliminato il suffisso artificiale `[INT]` aggiunto a club senza Paese nazionale conosciuto, che rendeva il contenuto in memoria diverso dallo snapshot salvato e impediva l'Undo.

## Confini

Gli ID già verificati e le decisioni esplicite dell'utente restano protetti. Gli altri alias non ricevono automaticamente lo stato di verifica giuridica del club. I conflitti tra fonti e le fasi non documentate restano visibili nella copertura. Le formule statistiche, i voti dei mercati, le regole di trading e il codice del registro trade sono conservati byte per byte rispetto alla rc3.
