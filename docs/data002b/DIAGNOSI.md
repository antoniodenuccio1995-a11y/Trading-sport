# Diagnosi TA-DATA-002B

## Materiale effettivamente ricevuto

| Allegato | Contenuto verificato | Utilità / limite |
| --- | --- | --- |
| ZIP del ramo rc2 | Codice e dossier della consegna precedente | HTML rc2 e due moduli corrispondono byte per byte ai sorgenti conservati |
| Primo rapporto anagrafico | 4 identità, tutte senza Paese | Non contiene partite |
| Secondo rapporto anagrafico | 657 identità: 55 verificate, 599 da verificare, 3 ambigue | Non contiene partite; 242 identità sono UNSPECIFIED e hanno almeno un nome uguale in un contesto nazionale |
| Primo rapporto integrità | `status: nessuna simulazione` | Nessun record o collisione recuperabile |
| Ultimo rapporto integrità | 8.225 righe, 31 cambi nome, 28 collisioni, 0 errori | Contiene indici e chiavi delle collisioni, ma non risultati o metadati delle due righe |

Il mandato parla di 40 collisioni. Il rapporto ricevuto ne contiene 28. Non è dimostrabile che descriva lo stesso tentativo del messaggio iniziale. Non sono presenti un elenco `records` o `rows` del backup originale, né nello ZIP né negli altri JSON. L'utente ha confermato di disporre solo di questi allegati.

## Cause tecniche verificate nel codice rc2

1. `TAClubs.plan` considerava collisione ogni seconda chiave composta da data, campionato, ID casa e ID ospite. Non confrontava risultati, HT, tiri o quote. Anche due copie identiche bloccavano l'intero recupero.
2. La simulazione viveva soltanto in `window.taLastMigration`. Un ricaricamento la perdeva. Errori di lettura, formato o preparazione dei dati ausiliari potevano inoltre precedere l'assegnazione del rapporto. Il primo allegato vuoto è compatibile con questi percorsi, ma non prova quale si sia verificato nel browser dell'utente.
3. Le ricerche interne di nomi senza competizione potevano aggiungere osservazioni `UNSPECIFIED`, separate da osservazioni nazionali dello stesso nome. La rc3 evita che una ricerca senza contesto crei un club diagnostico fittizio. I club realmente privi di contesto restano da esaminare.
4. La vecchia interfaccia esportava l'anagrafica ma non salvava decisioni operative dell'utente.
5. Il ripristino rc2 salvava prima le partite e poi i dati ausiliari su più chiavi. Un errore successivo poteva lasciare sezioni aggiornate solo in parte. La rc3 usa una transazione unica.

## Analisi delle collisioni disponibili

Tutte le 28 chiavi ricevute coinvolgono il club della denominazione `Man Utd`, normalizzata attraverso l'alias già verificato `Man United`. La normalizzazione in sé è corretta; la sola uguaglianza della chiave non dimostra però che FT, stato di calendario o quote delle due righe coincidano.

È stata costruita una tabella privata per tutte le 28 coppie, con data UTC, campionato, squadre ricavabili dalle chiavi, indici originali, ID, cambi nome associati e trattamento proposto. **Il campo risultati è marcato NON DISPONIBILE**, non come zero o partita futura. Tale tabella e gli allegati rimangono fuori da GitHub. La classificazione reale tra copie identiche, integrabili e contrastanti resta da eseguire sul backup.

Il nuovo algoritmo produce le seguenti classificazioni verificabili:

| Classe | Controllo | Trattamento |
| --- | --- | --- |
| Identici | Stessa identità incontro, risultati e valori presenti compatibili, nessun nuovo campo statistico | Consolidamento con tutte le provenienze |
| Integrabili | Un record aggiunge campi mancanti, senza valori discordanti | Integrazione senza sovrascritture |
| Risultati discordanti | Due FT conclusi diversi | Gruppo bloccato, entrambe le righe nel rapporto |
| Dati incompatibili | HT, tiri, stagione, quote o altri valori presenti divergono | Gruppo bloccato, campi divergenti visibili |
| Identità ambigue | Nome o ID non risolto con certezza | Gestione squadre, simulazione e conferma esplicita |
| Riga non valida | Data, nomi, risultato o schema incompatibile | Dettaglio esportabile; nessun dato inventato |

Le differenze di etichette o fonti non diventano falsi conflitti sportivi: sono conservate nelle provenienze e in `RecoveryEvidence`. Quote differenti non sono sostituite scegliendone arbitrariamente una.

Quaranta coppie **sintetiche** con il precedente falso positivo sono state classificate correttamente dal test automatico. Il test non è presentato come riproduzione delle 40 collisioni personali citate nel mandato.

## Associazioni risolte e residue

Il difetto di registrazione delle ricerche senza Paese è corretto. Le 242 coincidenze di nome negli allegati sono proposte contestuali, non 242 fusioni certificate. L'interfaccia le può proporre dopo il caricamento del rapporto anagrafico e richiede verifica esplicita, anche nel caso di conferma multipla. Le tre ambiguità dichiarate restano da risolvere sui dati originali. Non sono state modificate in blocco le 657 identità dell'utente.

Gli alias espliciti PSG/Paris SG/Paris Saint-Germain, Lyon/Lione/Olympique Lyonnais e Manchester United/Man Utd rimangono verificati. Paris FC e Paris Saint-Germain rimangono società distinte. Non sono introdotte equivalenze per sola somiglianza.
