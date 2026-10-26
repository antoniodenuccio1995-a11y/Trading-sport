# Consegna TA-DATA-002 — v0.2U-rc2

Stato: **candidata per revisione indipendente**. Ramo `fix/ta-data-002-identita-integrita`, baseline `b80ff664ff1ffe05045662ad43d22d5c2e9dd3fc`. Nessun nuovo merge su main, nessuna pubblicazione come stabile.

## Versione da collaudare

- `Trading_Analytics_v0.2U-rc2_TA-DATA-002.html`
- `ta-csv-import-v02U-rc2.js`
- `ta-clubs-v1.js`

I tre file devono restare insieme. Usare un server HTTP locale e un profilo browser di collaudo. La nuova candidata apre **un archivio separato**, quindi zero incontri iniziali non significa perdita dei dati precedenti. Importare solo copie dei backup dopo aver letto la simulazione.

## Consegne

1. [Correzioni F-01/F-04 e riesecuzione AUDIT](docs/data002/CORREZIONI_AUDIT.md).
2. [Documentazione dell'identità unica e copertura](docs/data002/ANAGRAFICA.md).
3. [Registro delle identità e alias](qa/data002/club-registry.json), [CSV consultabile](qa/data002/club-aliases.csv) e [alias osservati già revisionati](qa/data002/reviewed-aliases.json).
4. [Nomi non risolti, regole di ambiguità e somiglianze da revisionare](qa/data002/unresolved-clubs.json).
5. [Changelog](docs/data002/CHANGELOG.md).
6. [Rapporto QA e test riproducibili](docs/data002/QA.md).
7. [Rapporto d'integrità prima/dopo](docs/data002/INTEGRITA.md).
8. [Collaudo operativo e riproduzione](docs/data002/COLLAUDO.md).
9. PR in bozza sul ramo dedicato, da revisionare senza merge automatico.

## Limiti dichiarati

La ricognizione comprende 83 sorgenti e 500 identità osservate: 58 verificate attraverso alias espliciti, 442 ancora da verificare. Queste ultime hanno ID persistenti ma non sono trasformate in equivalenze verificate. Sono segnalati anche 32 gruppi di nomi con token in comune: nessuno viene accorpato per somiglianza.

Quattro campionati non hanno CSV storici configurati o forniti (Liga Portugal 2, 1st Division Danimarca, Prva NL Croazia, Liga II Romania); per HNL Croazia è disponibile solo la fonte corrente 2026/27. Il rapporto non certifica la completezza degli storici di tali competizioni. L'apertura file:// resta bloccata dalla policy del browser cloud; è collaudato il percorso HTTP. Il file completo della utility esterna non è disponibile, oltre all'intestazione già fornita.
