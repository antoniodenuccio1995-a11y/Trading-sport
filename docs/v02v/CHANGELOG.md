# v0.2V-rc1 — TA-V02V-001

- Dashboard iniziale con quattro percorsi, gare di oggi/sette giorni, ricerca universale per club/alias/Paese/competizione/gara, watchlist e ripresa dell'ultima vista di analisi.
- Menu Paesi espandibili con pin e riordino accessibile, competizioni internazionali distinte; preferenze persistenti separate dall'archivio.
- Calendario generale con filtri componibili, ordinamento, pagine da 50, CSV dell'intero filtro e apertura della stessa identità canonica.
- Centro Analisi: modulo rc5 integro più ultime 5 casa/trasferta effettive, ultime 10 totali, H2H 5/10/tutto, risultati/avversari, FT/HT distinti, riposo/congestione e qualità del campione.
- Comparatore storico indipendente dalla gara: due Paesi/competizioni/club/stagioni/intervalli/perimetri/sedi indipendenti; promozioni e alias sullo stesso ID; V/P/S, gol, medie, mercati, HT noti, andamento e avversari, media della lega e posizione descrittiva per punti quando ricostruibile.
- Un solo motore puro condiviso per selezione e statistiche delle due nuove viste. Nessun coefficiente di forza fra leghe, risultato inventato o valore HT mancante trattato come zero.
- Diagnosi reviewer rc5 prima del nuovo livello; letture favorevole/contraria/contrastante/insufficiente con numeri, ultimi 5 come controprova, campioni, data e limiti; massimo tre evidenze, anche nessuna.
- Metadati coppe preservati: fase/girone/andata-ritorno/ripetizioni, sedi neutre e scopo del risultato. Risultati dichiarati dopo supplementari/rigori esclusi dalle statistiche a 90 minuti.
- Nessun aggiornamento remoto automatico o salvataggio archivio all'apertura; prospetto completo di copertura differito all'apertura del pannello. Recupero con chiave IDB assente normalizzato senza allentare guardie contro scritture concorrenti.
- Corretto il clic watchlist perso quando il blur del filtro ricreava le righe; cache manuali invalidata anche con inserimenti sullo stesso array; ripresa del Comparatore e data della gara preservate durante la navigazione.

Tutti i file applicativi rc5, formule/voti, Backtest, Scanner, classifiche, identità, importatori, recupero/Undo e diario trade restano identici alla baseline bf2f0cc. La nuova pagina deriva dall'HTML rc5 con sole differenze di avvio documentate e l'aggiunta dei moduli v0.2V. Nessuna migrazione o modifica silenziosa dei dati salvati.
