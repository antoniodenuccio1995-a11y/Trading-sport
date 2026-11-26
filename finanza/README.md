# Finanza Personale v4

Gestionale della finanza personale: estratti conto di più banche, contanti, regole di classificazione, budget e analisi. Tutto gira nel browser e i dati restano sul dispositivo (IndexedDB): nessun server, nessun account.

Sostituisce il file unico v3.10 (`finanza_personale_v3_10_3B…html`), che resta utilizzabile e non viene modificato.

## Come si usa

- **Online:** `https://antoniodenuccio1995-a11y.github.io/Trading-sport/finanza/` (dopo l'unione su `main`; si installa sul telefono come app).
- **File unico:** `npm run build:file` crea `dist-file/FinanzaPersonale.html`, da aprire con doppio clic anche offline, come la v3.10.
- **Dalla v3.10:** nella vecchia app *Backup → Esporta JSON*, poi nella v4 *Importa → Carica backup JSON*. Vengono convertiti movimenti, categorie, regole, giroconti, quote, cestino, saldi iniziali e piano budget; i campi senza equivalente restano conservati nel movimento (`legacy`).
- **Il tuo nome** (Importa o Impostazioni): serve a riconoscere i giroconti verso te stesso («ricarica da …»). Non è scritto nel codice.
- **Prova senza dati:** «Esplora con dati dimostrativi» (inventati, si rimuovono con un clic).

## Pagine

| Pagina | Cosa mostra |
|---|---|
| Panoramica | patrimonio netto, mese corrente con previsione di fine mese, ritmo di spesa rispetto al mese prima e alla media, dove vanno i soldi, budget, ricorrenti, note automatiche, conti |
| Analisi | periodo a scelta: flusso di cassa (Sankey), entrate/uscite per mese, categorie con confronti, dettaglio categoria, esercenti, calendario della spesa, giorni della settimana, abbonamenti con variazioni di prezzo, spese fuori dal solito |
| Movimenti | elenco virtualizzato raggruppato per giorno, ricerca (anche per importo), filtri, stati («da controllare», senza categoria, giroconti da abbinare, divisi, modificati, cestino), dettaglio con categoria, tipo, quote, collegamento giroconti, regola dal movimento, correzioni |
| Budget | budget per categoria (predefinito o del singolo mese), ritmo atteso a oggi, proiezione a fine mese |
| Conti | saldi, patrimonio nel tempo (liquidità + investito al costo), saldi iniziali, crediti verso altri (anticipi/rimborsi) |
| Importa | estratti conto Banca Sella, Revolut, Tinaba, Poste Italiane, Hype, Trade Republic, Easy Bank; inserimento manuale (contanti); backup JSON/CSV |
| Regole | «se la descrizione contiene… allora…», con priorità, anteprima dei movimenti coinvolti e ricalcolo |

## Struttura

```
src/domain     modello dati, regole, giroconti, stato dei movimenti
src/import     importatori bancari (caricati solo quando si importa) → docs/IMPORTATORI.md
src/analytics  analisi pure su righe effettive (quote espanse), con test
src/storage    IndexedDB (revisione anti-sovrascrittura tra finestre) e migrazione v3.x
src/state      stato, azioni, calcoli memorizzati per versione dei dati, dati dimostrativi
src/ui         interfaccia Preact, grafici SVG scritti a mano, pagine
```

Scelte per la velocità: solo la Panoramica è nel pacchetto iniziale, le altre pagine si scaricano quando il browser è libero; SheetJS (lettura Excel) si carica solo all'import; i calcoli si rifanno solo quando cambiano i dati; l'elenco movimenti disegna solo le righe visibili; nessun font da scaricare; grafici SVG senza librerie.

Specifica e misure della v3.10: [docs/SPEC_v3.10.md](docs/SPEC_v3.10.md).

## Sviluppo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build:file
```
