# v0.2U-rc4 — TA-STAB-003

Candidata per revisione, 27/10/2026. Nessun merge su main e nessun deploy stabile.

- Recupero automatico dei backup precedenti con partite manuali prive del campionato; assegnazione guidata dei casi senza contesto univoco, con conservazione integrale del payload.
- Disambiguazione Paris FC/PSG basata su prove pubbliche per incontro; alias Spurs/Tottenham e consolidamento prudente dei doppioni con alias espliciti, conservando ID e provenienze precedenti.
- Anteprima prima/dopo, conflitti leggibili, commit atomico, controllo delle schede concorrenti, esportazione e Undo persistente.
- Importazioni CSV incrementali senza sovrascrittura delle quote o statistiche esistenti; mantenimento della distinzione fra calendari, FT e HT ignoti. Supporto alle colonne di tiro della utility pubblica. I blocchi per identità non risolte sono rispettati anche nel percorso CSV.
- Prospetto di copertura di 138 combinazioni campionato/stagione, filtri, dettaglio, esportazioni CSV/JSON e simulazione dell'integrazione dai pacchetti pubblici con verifica SHA-256.
- Cinque pannelli tecnici indipendenti, «Apri tutti»/«Chiudi tutti», gestione squadre separata dal recupero JSON. Chiudere un pannello conserva file e modifiche non confermate.
- Gli incontri con fase esplicita playoff/playout/qualificazione vengono esclusi dalla classifica della stagione regolare. Gli incontri precedenti privi di fase non vengono riclassificati per supposizione.
- Archivi rc4 separati da rc3; namespace del registro trade conservato, insieme a formule e regole precedenti.
- Nuovi test su backup e CSV reali, persistenza, conservazione dei valori, identità, conflitti, cutoff temporali e regressioni del registro trade su dati sintetici.
