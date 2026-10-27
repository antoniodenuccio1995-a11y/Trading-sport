# TA-STAB-003 — Consegna v0.2U-rc4

**Candidata per revisione, non versione stabile.** Baseline rc3 `313841c37e493b3ca3b7ba83f2799e0643c4abda`, ramo dedicato `fix/ta-stab-003-recupero-copertura`. Nessun merge su main e nessun deploy stabile. La rc3 e le versioni precedenti sono conservate.

## Risultato

Il backup JSON originale fornito è stato collaudato integralmente: 28.544 record diventano **28.402 incontri distinti**, senza perdere i valori originali; sono recuperate anche le due partite manuali. Il problema era il vecchio formato di queste partite, seguito da identità ambigue e copie con alias. Non occorre modificare manualmente il JSON.

Il controllo degli storici riguarda **138 combinazioni** campionato/stagione. Nella proposta privata di integrazione risultano **17 complete verificate, 92 parziali e 29 non verificabili** rispetto alle fonti e allo scopo dichiarati. La proposta contiene 35.022 incontri, 6.620 in più dell'archivio recuperato. Non è stata applicata automaticamente al browser dell'utente e non attesta la completezza di tutti i campionati.

L'Area tecnica ha cinque pannelli indipendenti, compresa **Gestione squadre e alias**, e i comandi **Apri tutti / Chiudi tutti**. La chiusura mantiene la simulazione e i valori non confermati. Il prospetto di copertura consente di esaminare e simulare integrazioni per campionato/stagione prima di salvare.

## File e avvio

- [Scarica lo ZIP del ramo candidato](https://github.com/antoniodenuccio1995-a11y/Trading-sport/archive/refs/heads/fix/ta-stab-003-recupero-copertura.zip).
- Candidata: [Trading_Analytics_v0.2U-rc4_TA-STAB-003.html](Trading_Analytics_v0.2U-rc4_TA-STAB-003.html). Estrarre tutta la cartella: i moduli JavaScript e `histories/stab003` devono restare accanto al file.
- [Istruzioni di avvio e collaudo operativo](docs/stab003/COLLAUDO.md): server HTTP locale, recupero del proprio backup originale, controllo prima/dopo e ripristino.

Il backup personale, le copie recuperate/integrate e i rapporti contenenti incontri personali restano esterni al repository. Nel ramo sono presenti soltanto codice, fonti sportive pubbliche, test e riepiloghi aggregati. Per il normale recupero è sufficiente selezionare nell'app il backup originale già in possesso della DIREZIONE.

## Documentazione

| Consegna | Documento |
|---|---|
| Causa specifica e correzione | [Diagnosi tecnica](docs/stab003/DIAGNOSI.md) |
| Modifiche | [Changelog](docs/stab003/CHANGELOG.md) |
| Test reali, regressioni e limiti | [Rapporto QA](docs/stab003/QA.md) |
| Definizioni, fonti e fasi | [Copertura degli storici](docs/stab003/STORICI.md) |
| Matrice leggibile delle stagioni | [Sintesi per campionato/stagione](docs/stab003/MATRICE_SINTESI.md) |
| Conteggi prima del recupero | [CSV archivio originale](docs/stab003/MATRICE_ARCHIVIO_ORIGINALE.csv) |
| Conteggi dopo il recupero | [CSV archivio recuperato](docs/stab003/MATRICE_ARCHIVIO_RECUPERATO.csv) |
| Conteggi dopo le integrazioni di prova | [CSV proposta integrata](docs/stab003/MATRICE_PROPOSTA_INTEGRATA.csv) |
| Copertura delle fonti pubbliche | [CSV fonti](docs/stab003/MATRICE_FONTI.csv) |
| Comandi e prerequisiti | [Riproduzione dei controlli](docs/stab003/RIPRODUZIONE.md) |

Le matrici pubbliche riportano conteggi aggregati, fonti e stato, senza le righe del backup personale. I dettagli delle gare sono consultabili nell'Area tecnica del proprio browser e nelle esportazioni private.

## Confini della consegna

Recupero personale e completezza degli storici hanno esiti distinti. Restano incontri e alias da riconciliare, fonti discordanti, fasi non documentate e 29 combinazioni prive di riferimenti acquisiti. La prova del registro trade usa dati sintetici perché non è stato fornito un registro reale; il suo codice e i voti congelati non sono modificati. Le formule statistiche e le regole di trading sono identiche alla rc3.

La candidata è consegnata per revisione indipendente. I test ripetuti dell'AUDIT precedente non costituiscono una nuova approvazione indipendente o un'autorizzazione stabile.
