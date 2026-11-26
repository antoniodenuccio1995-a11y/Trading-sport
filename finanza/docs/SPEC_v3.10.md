# SPEC funzionale e tecnica — Finanza Personale v3.10.3B REV11 (IndexedDB candidate)

Documento di audit della web app single-file esistente, scritto per ricostruirla come app **Vite + Preact + TypeScript**.
Descrive il comportamento **finale effettivo** (dopo tutte le patch stratificate), non le singole versioni intermedie.

> **Privacy.** Il file sorgente contiene dati reali del titolare (movimenti Cassa precaricati, un piano di migrazione indicizzato per ID di movimenti reali, nome del titolare cablato nei classificatori, nomi di persone nell'elenco controparti). Questo documento descrive **solo strutture, campi, enum e algoritmi**. Dove il codice confronta stringhe con il nome del titolare si scrive `<NOME_TITOLARE>`. Nessuna descrizione, importo, data, IBAN o nome reale è riportato qui. Il nome di catena di supermercati citato più avanti compare già nelle regole di partenza ed è usato solo come esempio di sintassi.

Sorgente analizzata: file HTML unico da 713 KB, 6.298 righe, 25 tag `<script>` (1 esterno da CDN + 24 inline, di cui 21 "deferred"), 32 blocchi `<style>` (89 KB).

---

## 0. Architettura di boot e stratificazione (contesto necessario)

1. `<head>`: CSS di boot + script `v393c-boot-head` (flag globali `__FP_BOOTING__=true`, contatori render) + **`<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js">` sincrono, render-blocking** + script `fp-storage-indexeddb`.
2. `<body class="fp-booting">` con overlay `#fpBootScreen`, header/nav e le `<section class="view">` statiche.
3. Tutta la logica applicativa (≈602 KB) è in 21 `<script type="application/x-fp-deferred">` (il browser non li esegue). Su `DOMContentLoaded` lo storage apre IndexedDB, legge lo snapshot in `window.FPStorage.initialState`, poi **ricrea ogni script deferred come `<script>` inline nel `<body>`** (id originale + `-active`) e li esegue in ordine, nello stesso task.
4. Ordine dei layer (ognuno ridefinisce funzioni globali del precedente, spesso avvolgendole: `const old=save; save=()=>{...old()...}`):
   `main` → `v36-movimenti-js` → `v37-movimenti-js` → `v38-js` → `v381-hotfix` → `v382-category-registry` → `v382-registry-ui-fixes` → `v391-selection-bulk-js` → `v392-inline-classification-js` → `v392-hf3-suggestions-js` → `v392-hf4-picker-js` → `v393-shell-filters-js` (contiene anche v3.9.4 Cestino/CSV e il motore Analytics/Stats v3.10.1–v3.10.2B; **qui finisce il boot**: `__FP_BOOTING__=false`, `renderAll()`, rimozione di `fp-booting` nel `requestAnimationFrame` successivo) → `v3101b-cash-js` → `v3103a-budget-js` → `v3103a-r1-dependency-warning` → `v3103a-r3-visual-labels` → `d3b02-stats-actual-budget` → (anonimo) D3B-02 REV2/REV3 tab Stats → `d3b02-rev4-bootstrap` → `d3b-rev5-sidebar` → `qa-rev10-identity`.
5. `renderAll()` durante il boot è soppresso (conta `__FP_BOOT_SKIPPED_RENDERS__`); molti layer chiamano comunque `persistFinancialStateQA()` → più scritture IndexedDB a ogni apertura.

---

## a. Persistenza e formato dati

### a.1 IndexedDB (script `fp-storage-indexeddb`, FP-STO-001)

| Elemento | Valore |
|---|---|
| DB name | `finanza_personale_indexeddb_v1` (versione IDB `1`) |
| Object store | `snapshots` (chiavi out-of-line) |
| Chiave stato | `current` |
| Chiave backup migrazione | `legacy-migration-backup` (scritta una sola volta, nella stessa transazione della migrazione da localStorage) |
| Chiave legacy localStorage | `finanza_personale_v2` (letta solo se IDB è vuoto; **non viene cancellata** dopo la migrazione) |
| Altre chiavi localStorage | `fp_v393_sidebar_collapsed` = `'1'`/`'0'` (solo UI) |

```ts
/** Record sotto la chiave 'current' */
interface StoredRecord {
  snapshot: Snapshot;      // copia structuredClone dell'oggetto `state`
  revision: number;        // contatore ottimistico, +1 a ogni scrittura
  writerId: string;        // crypto.randomUUID() della finestra che ha scritto
  savedAt: string;         // ISO 8601
}
/** Record sotto la chiave 'legacy-migration-backup' */
interface LegacyMigrationBackup { snapshot: Snapshot; source: 'localStorage legacy'; copiedAt: string; }
```

Algoritmo di scrittura:
- `enqueue(state)` memorizza il **riferimento** a `state` come `pending`, incrementa `changeSeq`, mostra "Salvataggio in corso…" e pianifica un `flush()` in microtask. Più `save()` sincroni si fondono in una sola scrittura.
- `drain()`: `structuredClone(pending)` → transazione `readwrite` (`durability:'strict'` se supportata) → `get('current')`: se `revision` letta ≠ revisione attesa → `StorageConflictError` ("Un'altra finestra ha salvato dati più recenti…"), abort, nessuna sovrascrittura → altrimenti `put({snapshot,revision+1,writerId,savedAt})`.
- Errore: stato "Non salvato · …", `alert` una sola volta, `window.__FP_UNSAVED_QA=true`; i dati restano in memoria.
- `beforeunload` chiede conferma se c'è un `pending`; `visibilitychange → hidden` forza `flush()`.
- Apertura DB con timeout 12 s ("Apertura archivio bloccata: chiudi le altre copie…"); `onversionchange` chiude la connessione.
- Validazione all'avvio (`validSnapshot`): oggetto con `movements` array, `rules` array (o assente), ogni movimento con `id` stringa, ID univoci. Se fallisce: boot interrotto con messaggio, nulla viene cancellato.
- Migrazione da localStorage: `JSON.parse` → `validSnapshot` → scrittura revisione 1 + backup → rilettura e confronto `JSON.stringify` di verifica.
- API esposta: `window.FPStorage = { enqueue, flush, readRecord, initialState, getInfo(): {backend:'IndexedDB',revision,pending,changeSeq,savedSeq,lastError}, databaseName }`.

### a.2 Snapshot (oggetto `state`) — forma finale

Lo snapshot persistito in IndexedDB e il file **"Esporta JSON"** hanno **la stessa identica forma** (è `JSON.stringify(state, null, 2)`); non esiste un wrapper di esportazione.

```ts
type ISODate = string;      // 'YYYY-MM-DD'
type ISODateTime = string;  // new Date().toISOString()
type YearMonth = string;    // 'YYYY-MM'

interface Snapshot {
  // --- versioni ---
  version: number;                 // legacy: 2.1 (default) → 2.2 dopo l'iniezione dei movimenti Cassa precaricati
  appVersion: string;              // valore finale scritto dal salvataggio: '3.10.1' (V395_VERSION)
  dataSchemaVersion: number;       // 4 (v3.8.2 lo porta a 3, v3.9.1+ lo forza a max(…,4))
  categoryRegistryVersion: 1;
  categoryRegistrySnapshot: CategoryRegistrySnapshotItem[]; // copia del registry (senza description)
  categoryMigration: CategoryMigrationLog;

  // --- dati finanziari ---
  movements: Movement[];           // include anche i movimenti nel Cestino (deletedAt ≠ null)
  rules: Rule[];
  initialBalances: Partial<Record<AccountName | string, number>>;
  imports: ImportRecord[];

  // --- budget ---
  budgets: Partial<Record<CategoryId, number>>;      // legacy mensile (pre-v3.8.2 chiavi = label CATS; dopo = categoryId)
  legacyBudgetUnallocated: Record<string, number>;   // budget legacy 1:N non riallocati (es. label 'Abbonamenti')
  budgetPlanV3103A: BudgetPlan;                      // nuovo modello mese×categoria (v3.10.3A)
  budgetLegacyTemplateV3103A: BudgetLegacyTemplate;
  lastBudgetPlanUndoV3103A: BudgetPlanUndo | null;

  // --- undo singoli persistiti ---
  lastBulkUndo: BulkUndo | null;          // ultima azione massiva Movimenti
  lastCashBatchUndo: CashBatchUndo | null; // ultimo inserimento rapido Cassa
}
```

Non esiste un oggetto `settings`: gli unici "settaggi" persistiti sono `initialBalances`; il resto (elenco conti, nome titolare, elenco controparti, anno 2026 negli importer) è **cablato nel codice** (vedi §i).

### a.3 Movimento

```ts
type MovementType =               // valori persistiti CON emoji (non esistono ID canonici per i tipi)
  | '' | '✅ Entrata reale' | '❌ Uscita reale'
  | '🔄 Giroconto uscita' | '🔄 Giroconto entrata'
  | '📈 Acquisto investimento' | '📉 Vendita investimento'
  | '💸 Anticipo pagato' | '💰 Rimborso ricevuto';

type SourceName = 'Banca Sella' | 'Revolut' | 'Tinaba' | 'Poste Italiane' | 'Hype' | 'Trade Republic' | 'Easy Bank' | 'Cassa';
type FieldSource = '' | 'importer' | 'rule' | 'matching' | 'manual' | 'migration';

interface Movement {
  // identità / origine
  id: string;                    // crypto.randomUUID(); univoco (validato a boot e import)
  source: SourceName | string;   // importer/banca d'origine
  account: AccountName | string; // conto contabile per i saldi (= source in tutti i percorsi attuali)
  externalId: string;            // ID banca o sintetico ('' se assente) — vedi §g
  importId: string;              // = ImportRecord.id (uuid) o '' (inserimenti manuali)
  signature: string;             // fnv1a-32 hex di norm(source|externalId|dateTime||date|descriptionRaw|amount.toFixed(2)|currency)

  // dato bancario originale (non riscritto dalla classificazione)
  date: ISODate;                 // data principale scelta dall'importer
  dateTime: string;              // testo originale con ora, se disponibile, altrimenti ''
  valueDate: ISODate | '';       // seconda data (semantica diversa per banca, vedi §g)
  descriptionRaw: string;
  amount: number;                // con segno: < 0 uscita, > 0 entrata
  currency: string;              // 'EUR' atteso; non-EUR esclusi dalle analytics
  sourceType: string;            // tipo nativo banca (vedi §g)
  sourceCategory: string;        // categoria/dettaglio nativo banca (vedi §g)
  raw: Record<string, unknown>;  // riga originale {intestazione: valore} + chiavi diagnostiche '__*'
  inputIssue: string;            // '' oppure testo anomalia di parsing (→ "Da controllare")

  // correzioni manuali del dato (null = nessuna correzione)
  correctedDate: ISODate | null;
  correctedDescription: string | null;
  correctedAmount: number | null;
  // valori effettivi: getDate = correctedDate || date ; getDesc = correctedDescription ?? descriptionRaw ; getAmount = correctedAmount ?? amount

  // classificazione corrente
  type: MovementType;
  categoryId: CategoryId | '';   // CANONICO dalla v3.8.2
  category: string;              // label derivata da categoryId a ogni save (ridondante)
  legacyCategory?: string;       // label pre-v3.8.2
  counterparty: string;          // conto opposto (giroconti), persona/soggetto (anticipi/rimborsi), titolo (TR)
  ruleStatus: string;            // testo libero/causale: 'Regola' | 'Ambigua' | 'Match automatico' | 'Match manuale'
                                 // | 'Classificazione manuale' | 'Candidato giroconto' | '<Banca>: …' | ''
  appliedRule: AppliedRule | null;
  manualLock: boolean;           // protezione: regole e ricalcolo non toccano tipo/categoria/controparte
  typeSource: FieldSource;       // provenance per campo (v3.8.1)
  categorySource: FieldSource;
  counterpartySource: FieldSource;
  classificationSource: 'manual' | 'rule' | 'auto' | 'importer'; // aggregata
  importClassification?: ImportBaseline; // baseline deterministica dell'importer, ricostruibile da raw

  // strutture
  splits: Split[];               // [] = non diviso
  matchedTo: string | null;      // id del contro-movimento giroconto (link reciproco)
  manualTransferMatch: boolean;  // true se collegato a mano (bloccato rispetto al rematch)

  // stato operativo
  verifiedAt: ISODateTime | null;
  deletedAt: ISODateTime | null; // Cestino (soft delete). Nessuna cancellazione fisica nel workflow finale
  deletedReason: string;         // max 160 caratteri
  excludedFromAccounting?: boolean; // righe informative 'SALDO AL …' (Sella, importo 0)
  excludedReason?: string;
  deferredWallet?: boolean;      // depositi Betfair/Sisal: esclusi dalle analytics ("wallet differito")

  // arricchimenti v3.8
  merchant: string;              // "Soggetto / Esercente" (max 160)
  project: string;               // "Progetto / Evento" (max 160)
  recurrence: 'auto' | 'none' | 'weekly' | 'monthly' | 'annual';
  history: HistoryEntry[];       // audit trail, cresce senza limite

  // migrazione Category Registry v3.8.2 (una volta per movimento)
  migrationVersion?: 1;
  migrationStatus?: 'excluded' | 'legacy_1to1' | 'legacy_conditional' | 'semantic_correction' | 'new_category_pattern'
                  | 'type_and_category_correction' | 'type_correction_no_category' | 'type_only_normalization'
                  | 'no_category_required' | 'deferred_wallet' | 'split_parent' | 'review' | 'review_unclassified';
  migrationRule?: string;        // es. 'legacy_direct', 'structural_type', 'capital_flow_type_only', 'betting_wallet_deposit', …
  migrationReason?: string;
  migrationConfidence?: 'deterministic' | 'conditional' | 'review';
  migrationLegacyCategory?: string;
}

interface Split {                // "quota"
  id: string;
  amount: number;                // con segno, stesso verso del padre
  type: MovementType;
  categoryId: CategoryId | '';
  category: string;              // label derivata
  legacyCategory?: string;
  counterparty: string;
  description: string;           // default = descrizione del padre
}

interface AppliedRule {          // snapshot della regola che ha prodotto la classificazione
  id: string; contains: string; type: MovementType;
  categoryId: CategoryId | ''; category: string; categoryLabelSnapshot?: string; legacyCategory?: string;
  counterparty: string; at: ISODateTime;
}

interface ImportBaseline {       // m.importClassification
  schema: 1; source: 'importer';
  type: MovementType; categoryId: CategoryId | ''; category: string; legacyCategory: string;
  counterparty: string; ruleStatus: string; reason: string; // es. 'Revolut: tipo operazione e segno'
}

interface HistoryEntry {
  at: ISODateTime;
  operationId?: string;                              // presente per operazioni massive/cestino
  action?: 'soft_delete' | 'restore' | 'undo_bulk';  // assente per modifiche ordinarie
  changes: { field: string; label: string; before: unknown; after: unknown }[];
}
```

Campi auditati in `history` (diff calcolato a ogni `save()` rispetto a una baseline in memoria): `correctedDate, correctedDescription, correctedAmount, type, category, counterparty, manualLock, merchant, project, recurrence, splits, matchedTo, manualTransferMatch, verifiedAt, appliedRule, classificationSource, typeSource, categorySource, counterpartySource`. Una modifica a uno di questi campi (escluse `verifiedAt/manualLock/appliedRule`) **azzera `verifiedAt`**.

Chiavi diagnostiche in `raw`: Sella `__IMPORTO_CELL_V/W/Z`; Trade Republic `__TR_GROSS_AMOUNT/__TR_FEE/__TR_TAX/__TR_NET_CASH`; Hype `__HYPE_OCCURRENCE`; Easy Bank `__EASY_OCCURRENCE`; Poste `__POSTE_DATA_VALUTA/__POSTE_DATA_CONTABILE`; Tinaba `__TINABA_CAPITALE_RICOSTRUITO/__TINABA_INTERESSI_NETTI`; Cassa manuale `{manual:true, manualBatch, manualBatchId, manualBatchAt}`; Cassa precaricata `{source:'user-provided cash 2026'}`.

### a.4 Regola

```ts
interface Rule {
  id: string;
  source: AccountName | '';      // '' = tutti i conti
  contains: string;              // sottostringa cercata in norm(getDesc(m)); vuota → regola ignorata
  sign: '' | '+' | '-';          // '' = qualsiasi; '+' importo > 0; '-' importo < 0
  type: MovementType;            // '' = non imposta il tipo
  categoryId: CategoryId | '';   // canonico
  category: string;              // label derivata (ridondante)
  counterparty: AccountName | '';// l'editor offre solo i conti
  priority: number;              // maggiore = valutata prima (default: 50 nuova, 80 da "Ricorda/Automatizza", 70–80 starter)
  active: boolean;
  legacyCategory?: string; categoryLabelSnapshot?: string; migrationVersion?: 1;
}
```

Regole di partenza (`starterRules`, 7): conto opzionale + "contiene" + segno → tipo/categoria (es. `contains:'CONAD', sign:'-', type:'❌ Uscita reale', category:'Spesa Alimentare', priority:70`). Una regola per Trade Republic con segno `+` assegna Entrata reale / rendite finanziarie.

### a.5 Conti e saldi iniziali

```ts
type AccountName = 'Banca Sella' | 'Revolut' | 'Cassa' | 'Intesa Sanpaolo' | 'Hype' | 'Poste Italiane'
                 | 'Trade Republic' | 'Easy Bank' | 'Binance' | 'Tinaba' | 'Altro conto';   // ACC (ordine UI)
// initialBalances: { [account]: number }  — il default non contiene 'Easy Bank' (letto come 0)
```
Saldo stimato = `initialBalances[a] + Σ getAmount(m)` sui movimenti con `m.account === a`, esclusi `deletedAt` ed `excludedFromAccounting` (giroconti inclusi, perché spostano liquidità).

### a.6 Registro importazioni

```ts
interface ImportRecord {
  id: string;                    // uuid; 'seed-cassa-2026' è il marcatore dei movimenti Cassa precaricati
  file: string; source: SourceName; at: ISODateTime | ISODate;
  added: number; dups: number; skipped: number;
  // diagnostica per banca (opzionale): transfers, buys, sells, dividends, interests, taxes, issues (TR);
  // transferCandidates, withdrawals (Hype); outsideYear, depositSplits (Tinaba);
  // selfTransfers, gamePayments, fees (Easy Bank); withdrawals (Poste); correctedXls, unreadable (Sella)
  [k: string]: unknown;
}
```

### a.7 Category Registry (v3.8.2, versione 1)

```ts
type CategoryId =
  // entrate (direction 'income', budgetEligible false)
  | 'inc.salary' | 'inc.self_employment' | 'inc.financial_income' | 'inc.public_support'
  | 'inc.tax_refund' | 'inc.gifts' | 'inc.other'
  // uscite (direction 'expense')
  | 'exp.housing' | 'exp.groceries' | 'exp.dining' | 'exp.mobility' | 'exp.vehicle' | 'exp.utilities'
  | 'exp.health' | 'exp.personal_care' | 'exp.clothing' | 'exp.home' | 'exp.education' | 'exp.leisure'
  | 'exp.gifts' | 'exp.events' | 'exp.travel' | 'exp.taxes' | 'exp.financial_services' | 'exp.rewards'
  | 'exp.betting'      // status 'conditional', budgetEligible false
  | 'exp.other'
  | 'exp.technology';  // status 'inactive', budgetEligible true

interface CategoryDef {
  categoryId: CategoryId;
  label: string;                         // es. 'Alimentari / Supermercato'
  direction: 'income' | 'expense';
  status: 'active' | 'conditional' | 'inactive';
  budgetEligible: boolean;
  order: number;                         // 10–90 entrate, 110–290 uscite, 900+ fallback/inattive
  description: string;
  legacyAliases: string[];               // label CATS legacy che puntano a questa categoria
}
type CategoryRegistrySnapshotItem = Omit<CategoryDef, 'description'>;
```

Totale 28 voci: 7 entrate + 21 uscite (19 attive e budgetabili, `exp.betting` condizionale, `exp.technology` inattiva). `ACTIVE_CATEGORIES` = 26 (status `active`), sono le sole selezionabili. **Non esistono gruppi/macro-categorie**: l'unico raggruppamento è `direction` (Entrate/Uscite, usato come `optgroup` nel picker massivo) e l'ordinamento `order`.

Tabella completa (id → label → alias legacy):

| categoryId | label | legacyAliases |
|---|---|---|
| inc.salary | Stipendio | Stipendio |
| inc.self_employment | Lavoro autonomo / Prestazioni | Freelance / Fattura |
| inc.financial_income | Interessi / Dividendi / Rendite finanziarie | Investimenti / Dividendi |
| inc.public_support | Contributi / Agevolazioni | — |
| inc.tax_refund | Rimborso fiscale | Rimborso fiscale |
| inc.gifts | Regali ricevuti | Regali |
| inc.other | Altro Entrate | Altro Entrate |
| exp.housing | Affitto / Mutuo | Affitto / Mutuo |
| exp.groceries | Alimentari / Supermercato | Spesa Alimentare |
| exp.dining | Ristorazione | Ristorazione |
| exp.mobility | Mobilità / Carburante | Trasporti / Carburante |
| exp.vehicle | Auto / Gestione e manutenzione | Automezzi / Manutenzione |
| exp.utilities | Utenze / Telefonia / Internet | Utenze |
| exp.health | Salute / Farmacia | Salute / Farmacia |
| exp.personal_care | Cura personale | — |
| exp.clothing | Abbigliamento / Accessori | Abbigliamento |
| exp.home | Casa / Beni e manutenzione domestica | Spesa per la Casa |
| exp.education | Istruzione / Formazione | Istruzione / Formazione |
| exp.leisure | Svago / Intrattenimento / Hobby | Svago / Hobby, Abbonamenti |
| exp.gifts | Regali / Donazioni | Regali |
| exp.events | Eventi / Cerimonie (servizi) | Matrimoni / Cerimonie |
| exp.travel | Viaggi / Servizi di viaggio | Viaggi / Vacanze |
| exp.taxes | Tasse / Imposte / Tributi | Tasse / F24 |
| exp.financial_services | Servizi finanziari / Commissioni | — |
| exp.rewards | Rewards / Punti fedeltà | — |
| exp.betting | Scommesse / Trading sportivo | Scommesse |
| exp.other | Altro Uscite | Altro Uscite |
| exp.technology | Tecnologia / Elettronica | — |

**Mappatura legacy → ID** (`categoryIdFromLegacyV382`, con wrapper che prima cerca un match esatto sulla label del registry):
- diretta: Stipendio, Freelance / Fattura, Rimborso fiscale, Altro Entrate, Affitto / Mutuo, Spesa Alimentare, Trasporti / Carburante, Utenze, Ristorazione, Salute / Farmacia, Abbigliamento, Svago / Hobby, Istruzione / Formazione, Tasse / F24, Altro Uscite, Spesa per la Casa, Automezzi / Manutenzione;
- condizionale: `Investimenti / Dividendi` → `inc.financial_income` solo se tipo Entrata reale (altrimenti nessuna); `Regali` → `inc.gifts` se entrata/importo > 0, `exp.gifts` se uscita/importo < 0; `Abbonamenti` → `exp.leisure` se descrizione contiene NETFLIX, `exp.utilities` se WIND, altrimenti nessuna;
- 1:N → nessuna (revisione): `Matrimoni / Cerimonie`, `Viaggi / Vacanze`, `Scommesse`, `Versamento contanti`.
- Budget legacy (`migrateBudgetsV382`): `Regali`→`exp.gifts`, `Matrimoni / Cerimonie`→`exp.events`, `Viaggi / Vacanze`→`exp.travel`, `Abbonamenti` → `legacyBudgetUnallocated`, il resto come sopra; tutte le categorie budgetabili senza valore ricevono 0.

```ts
interface CategoryMigrationLog {
  version: 1; firstMigratedAt: ISODateTime; sourceAppVersion: '3.8.1';
  lastMigratedAt?: ISODateTime; lastBatchCount?: number;
  changes: { entity: 'movement' | 'rule' | 'budget'; id: string; before: unknown; after: unknown; rule?: string; reason: string }[];
}
```
Costanti incorporate nel codice (da **non** portare): `V382_DRYRUN_PLAN` (143 KB, 706 voci `{categoryId,type,status,rule,reason,project?}` indicizzate per ID di movimenti reali) e `V382_RULE_PLAN` (28 voci per ID di regole reali). Per movimenti/regole non presenti nei piani si usa `genericPlanV382` (§c.6).

### a.8 Budget

```ts
interface BudgetPlan {                    // state.budgetPlanV3103A
  version: 1; createdAt: ISODateTime;
  values: Record<YearMonth, Partial<Record<CategoryId, number>>>;
  // CONTRATTO: chiave assente = budget NON impostato; 0 = zero esplicito; > 0 = budget pianificato.
  // Valori ≥ 0 arrotondati a 2 decimali. Un mese senza chiavi viene rimosso.
}
interface BudgetLegacyTemplate {           // state.budgetLegacyTemplateV3103A (creato una volta da state.budgets)
  createdAt: ISODateTime; source: 'state.budgets legacy mensile senza storico';
  values: Partial<Record<CategoryId, number>>;  // solo valori > 0
  ambiguousZero: CategoryId[];                  // 0 legacy non interpretati
}
interface BudgetPlanUndo {                 // state.lastBudgetPlanUndoV3103A
  type: 'legacy-template-year' | 'repeat-value' | 'copy-month' | 'copy-year' | 'clear-month' | 'clear-year' | 'assistant-suggestion';
  at: ISODateTime; year?: number;
  cells: { month: YearMonth; cid: CategoryId; before: number | null; after: number | null }[];
  meta?: Record<string, unknown>;          // es. {categoryId,start,end} | {from,to} | {preset,scope,basisMonths,weightedBase,trendAdjustmentPct,roundedBase}
}
```
`state.budgets` (legacy, mensile senza storico, chiavi categoryId) resta usato **solo dalla Dashboard**.

### a.9 Undo persistiti

```ts
interface BulkUndo {                       // state.lastBulkUndo
  operationId: string; action: 'category' | 'type' | 'verify' | 'delete' | 'restore'; label: string; at: ISODateTime;
  changes: { movementId: string; fields: string[]; before: Record<string, unknown>; after: Record<string, unknown> }[];
}
interface CashBatchUndo {                  // state.lastCashBatchUndo
  at: ISODateTime; batchId: string;
  items: { id: string; after: string }[];  // after = JSON di confronto (id, source, account, date, descriptionRaw, amount, currency,
                                           // type, category, counterparty, manualLock, raw, deletedAt, deletedReason,
                                           // corrected*, splits, matchedTo): undo valido solo se nulla è cambiato
}
```

### a.10 Backup JSON — "Esporta JSON" / "Importa JSON" (comportamento finale, layer v393)

**Esporta JSON**
1. `save()` (normalizzazioni + persistenza) e `await FPStorage.flush()` (errori ignorati).
2. Download di `JSON.stringify(state, null, 2)` (indentato), MIME `application/json`.
3. Nome file: `finanza_personale_backup_REV11.json`; se il salvataggio IDB non è riuscito (`__FP_UNSAVED_QA`) → `finanza_personale_recupero_non_salvato.json`.
4. Campi di versione presenti nel file: `version` (2.1/2.2), `appVersion` ('3.10.1'), `dataSchemaVersion` (4), `categoryRegistryVersion` (1), `categoryRegistrySnapshot`, `categoryMigration.version` (1), `budgetPlanV3103A.version` (1), `importClassification.schema` (1) per movimento, `migrationVersion` (1) per movimento/regola.

Backup storici accettati (stessa forma, campi progressivamente assenti): v2 (`finanza_personale_v2_backup.json`, nessun campo v3.8+), v3.8.1, v3.8.2, v3.9.1, v3.9.2/HF5. Tutti vengono migrati all'import.

**Importa JSON** (`<input type=file accept=.json>`)
1. `FileReader.readAsText` → `JSON.parse`.
2. Validazione minima (altrimenti `alert('Backup non valido: …')` e stato invariato):
   - `movements` è un array;
   - ogni movimento: oggetto, `id` stringa non vuota, `source` stringa, `date` stringa, `descriptionRaw` stringa, `amount` numero finito;
   - ID univoci;
   - `rules`, se presente, è un array.
   Nessun controllo su versione, budget, registry, tipi o categorie.
3. **Sostituzione totale** di `state` (nessun merge, **nessuna richiesta di conferma**).
4. Migrazioni in sequenza: `initializeV38` (default campi v3.8) → `migrateDeterministicState` (Tinaba) → `initializeV381(true)` (provenance + baseline importer, ripara tipi/categorie mancanti) → `initializeV382(true)` (registry: regole, budget, movimenti) → `initializeV391/392/393/394` (versioni, `deletedAt/deletedReason` default) → reset filtri/selezione/revisione → baseline audit → `persistFinancialStateQA()` → `renderAll()`.
   Il piano budget (`budgetPlanV3103A`, template legacy) viene creato al primo `renderBudget()`/`save()` successivo. **Non viene eseguito `rematchTransfers()`**.
5. `alert` riepilogativo: movimenti operativi, nel Cestino, numero variazioni Registry.

Altri export: **"Esporta report migrazione"** → `migration_report_v3_8_2.json` = `{appVersion, dataSchemaVersion, categoryRegistryVersion, legacyBudgetUnallocated, categoryMigration}`; **CSV movimenti** (§h).

---

## b. Enum

**TYPES** (ordine UI): `''`, `✅ Entrata reale`, `❌ Uscita reale`, `🔄 Giroconto uscita`, `🔄 Giroconto entrata`, `📈 Acquisto investimento`, `📉 Vendita investimento`, `💸 Anticipo pagato`, `💰 Rimborso ricevuto`.
- Non esistono ID canonici per i tipi: il valore persistito è la stringa con emoji. Per il rebuild si propone un ID stabile con tabella di mappatura (proposta, non presente nel codice): `income`, `expense`, `transfer_out`, `transfer_in`, `invest_buy`, `invest_sell`, `advance_paid`, `refund_received`.
- Segno richiesto (`requiredSignV392`, usato dai picker inline): positivo per Entrata reale, Giroconto entrata, Vendita investimento, Rimborso ricevuto; negativo per Uscita reale, Giroconto uscita, Acquisto investimento, Anticipo pagato.
- "Tipi reali" = Entrata/Uscita reale (richiedono categoria); gli altri sono "strutturali" (categoria non richiesta).

**CATS legacy** (pre-v3.8.2, label usate come valore): `''`, Stipendio, Freelance / Fattura, Investimenti / Dividendi, Rimborso fiscale, Versamento contanti, Altro Entrate, Affitto / Mutuo, Spesa Alimentare, Trasporti / Carburante, Utenze, Abbonamenti, Ristorazione, Salute / Farmacia, Abbigliamento, Svago / Hobby, Istruzione / Formazione, Regali, Matrimoni / Cerimonie, Tasse / F24, Viaggi / Vacanze, Scommesse, Altro Uscite, Spesa per la Casa, Automezzi / Manutenzione.
**CATS finale** (dopo `v382-registry-ui-fixes`): `['', ...label delle 26 categorie attive in ordine]`; i valori canonici sono i `categoryId` del §a.7.

**Conti (ACC)**: Banca Sella, Revolut, Cassa, Intesa Sanpaolo, Hype, Poste Italiane, Trade Republic, Easy Bank, Binance, Tinaba, Altro conto. Importer disponibili solo per 7 di essi + Cassa manuale.

**Controparti** (select dettaglio/quote): `'' + ACC + un elenco fisso di persone/ruoli` (contiene nomi personali del titolare: va reso configurabile). Nell'editor regole la controparte offre solo `'' + ACC`.

**Stati filtro movimenti**: `unclassified, review, unverified, verified, transfer, split, signals, recurring, edited, conflict, complete`. **Origini**: `manual, applied, rule, no-rule, auto`.

---

## c. Pipeline di classificazione

### c.1 Normalizzazione testo
`norm(s)` = NFD, rimozione diacritici, spazi compressi, trim, MAIUSCOLO. Tutti i confronti (regole, rilevamento banca, ricerca) usano `norm`.

### c.2 baseClassify / baseline importer
- `baseClassify(m)` (main, ancora usato dall'inserimento Cassa): se `manualLock` non fa nulla; Revolut per `sourceType`; Sella per causale (vedi §g).
- Dalla v3.8.1 la classificazione deterministica dell'importer è ricostruibile dai metadati: `deriveImportClassificationV381(m)` → `{type, category, counterparty, ruleStatus, reason}` per banca (stesse regole di §g, ricalcolate da `source/amount/descriptionRaw/sourceType/sourceCategory/raw`). Il wrapper v3.8.2 aggiunge `categoryId` per parole chiave: `SPICCIOLI REVPOINTS`→`exp.rewards`; `BETFAIR|SISAL`→nessuna; `WIND TRE`→`exp.utilities`; `NETFLIX`→`exp.leisure`; `EASYPARK`→`exp.mobility`; barbiere/parrucchiere→`exp.personal_care`; importo < 0 con `COMMISSIONE|COSTO CARTA`→`exp.financial_services`; acquisto/vendita investimento → nessuna; altrimenti mappatura legacy della categoria importer.
- `ensureImportClassificationV381(m)` crea/aggiorna `m.importClassification` (schema 1) e la usa come **baseline**.

### c.3 ruleMatch
Una regola `r` corrisponde a `m` se: `m` non è nel Cestino; `r.active`; `norm(r.contains)` non vuoto; `r.source` vuoto o `norm(r.source)===norm(m.source)`; `norm(getDesc(m)).includes(norm(r.contains))` (descrizione **corretta** se presente); segno: `'+'` ⇒ `getAmount(m)>0`, `'-'` ⇒ `getAmount(m)<0`.

### c.4 applyRules (finale = versione v3.8.2 di `applyRulesV381`)
1. Esce senza modifiche se `m.manualLock` o `m` ha quote o `m.manualTransferMatch`.
2. `restoreImportBaseline(m)`: `type/categoryId/category/counterparty/ruleStatus` ← baseline; `appliedRule=null`; `typeSource/categorySource/counterpartySource = 'importer'` per i campi valorizzati, altrimenti `''`.
3. Regole corrispondenti ordinate per `priority` decrescente; si considerano solo quelle con **priorità massima** (`top`).
4. **Ambiguità**: se le `top` producono più di un output distinto `type|categoryId|counterparty` → `ruleStatus='Ambigua'` (la baseline importer resta), nessuna regola applicata.
5. Altrimenti si applica `top[0]`: `type` se valorizzato (`typeSource='rule'`); `categoryId` se valorizzato (`categorySource='rule'`), **se la regola ha `categoryId===''` la categoria viene svuotata**; `counterparty` se valorizzata; `ruleStatus='Regola'`; `appliedRule` = snapshot regola + timestamp.
6. `refreshAggregateSource`: `classificationSource` = `manual` se lock o un campo manuale, poi `rule`, poi `auto` (matching), poi `importer`.

Negli importer `applyRules(m)` viene chiamato **prima** delle regole specifiche della banca, che quindi possono sovrascrivere l'esito delle regole (es. tipi Trade Republic, candidati giroconto).

### c.5 learnRule ("Ricorda" / "＋⚙️ Crea regola" / "Automatizza")
`prompt` con la descrizione corrente; token trim ≥ 4 caratteri; se esiste già una regola attiva con stesso conto, stesso `contains` normalizzato e stesso segno → avviso, nessuna creazione. Altrimenti nuova regola `{source:m.source, contains:token, sign: getAmount(m)>=0?'+':'-', type:m.type, category:m.category (→ categoryId al save), counterparty:m.counterparty, priority:80, active:true}`. Disabilitato per movimenti con quote. Non riapplica le regole agli altri movimenti.

### c.6 Migrazione registry post-import (`initializeV382` a ogni `save()`)
- **Movimenti** senza `migrationVersion` (cioè ogni movimento appena importato o inserito): piano = `V382_DRYRUN_PLAN[id]` oppure `genericPlanV382(m)`, che in ordine: Betfair/Sisal con importo < 0 → `deferredWallet=true`, categoria vuota; `SPICCIOLI REVPOINTS` → `exp.rewards`; WIND TRE → utenze; NETFLIX → svago; barbiere → cura personale; EASYPARK → mobilità; due pattern specifici del titolare (ente regionale → tipo Rimborso ricevuto + progetto; master formativo → Uscita reale/istruzione + progetto); Trade Republic acquisto/vendita → nessuna categoria; TR Entrata reale con DIVIDEND/INTEREST → `inc.financial_income`; importo < 0 con COMMISSIONE/COSTO CARTA → `exp.financial_services`; mappatura legacy; categoria legacy non mappabile → `review`; tipo strutturale → `no_category_required`; altrimenti `review`. Può **cambiare il tipo** e assegna `categorySource='migration'`; aggiorna anche `importClassification.categoryId`, `appliedRule.categoryId`, `splits[].categoryId`. Poi `migrationVersion=1` (non viene più ripetuta).
- **Regole**: rielaborate **a ogni save senza guardia di versione** (vedi §i, rischio C3).
- **Budget**: migrati una sola volta (se nessuna chiave è già un categoryId).

### c.7 Lock manuale e provenance
- Modifica di Tipo/Categoria/Controparte da dettaglio, inbox, picker inline o azione massiva ⇒ `manualLock=true`, `<campo>Source='manual'`, `classificationSource='manual'`, `appliedRule=null`, `ruleStatus='Classificazione manuale'`.
- Correzioni di data/descrizione/importo, soggetto, progetto, ricorrenza **non** attivano il lock.
- Dettaglio: **Proteggi** (lock), **Sblocca** (conserva la classificazione), **Sblocca e ricalcola** / **Ricalcola con le regole** (baseline + regole + rematch). Disabilitati se il movimento ha quote o collegamento manuale.
- Salvataggio di una divisione in quote ⇒ `manualLock=true`.
- Picker inline Tipo: rifiuta tipi incompatibili con il segno; se il nuovo tipo non è reale o la categoria non è compatibile con la direzione, svuota la categoria; scollega un giroconto manuale se il tipo non è più Giroconto; poi `rematchTransfers()`.
- Picker inline Categoria: solo per tipi reali, solo categorie della direzione del tipo.

### c.8 reprocess ("Ricalcola classificazioni automatiche")
Azzera selezione e `lastBulkUndo`; per ogni movimento non nel Cestino, non lockato, senza quote e senza collegamento manuale esegue `applyRules` (baseline importer + regole, **non** azzera più il tipo a vuoto); poi `rematchTransfers()`, `save()`, `renderAll()`.

### c.9 "Da controllare" (ex Inbox)
La pagina Inbox è nascosta dalla navigazione finale ma ancora renderizzata; il concetto vive come preset/filtro **Da controllare** in Movimenti e come badge numerico sulla voce Movimenti.

`status(m)` finale (primo che si verifica):
1. `deferredWallet` → `⚠️ Wallet Betfair/Sisal differito`
2. quote non quadrate → `⚠️ Quote non quadrate`
3. `inputIssue` → `⚠️ Input: <testo>`
4. `ruleStatus==='Ambigua'` → `⚠️ Regola ambigua`
5. quote quadrate → `✅ Diviso`
6. tipo vuoto → `⚠️ Tipo mancante`
7. tipo reale senza `categoryId` → `⚠️ Categoria mancante`
8. giroconto: senza `matchedTo` → `⚠️ Giroconto non abbinato`, altrimenti `✅ Giroconto collegato manualmente` / `✅ Giroconto abbinato`
9. Anticipo/Rimborso senza controparte → `⚠️ Controparte mancante`
10. `✅ OK`

`reviewV37(m)` (= "Da controllare") = non nel Cestino **e** (`status` inizia con ⚠️ **o** `unclassified(m)` **o** `conflict(m)`), dove `unclassified` = (con quote: una quota senza tipo o reale senza categoria; senza quote: tipo vuoto o reale senza categoria) e `conflict` = non lockato e le regole a priorità massima corrispondenti danno output diversi. Righe `excludedFromAccounting` sono sempre fuori dalle liste.

### c.10 KPI ed esclusioni (motore Analytics v3.10.1 `buildAnalyticsV310`, funzione pura)
Ingresso: movimenti **attivi** (`!deletedAt && !excludedFromAccounting`). Per ciascuno:
- data effettiva valida `YYYY-MM-DD`, importo finito, valuta `EUR` → altrimenti `controls.invalid` + escluso;
- `deferredWallet` → escluso (motivo "Wallet differito");
- con quote: se una quota ha importo non numerico o `|Σquote − importo| ≥ 0,005` → `controls.split` + **padre sospeso** (escluso); altrimenti una riga per quota (`id = parentId + '::' + splitId`, tipo/categoria della quota);
- riga con tipo vuoto o sconosciuto → `controls.untyped` + esclusa;
- tipo reale senza categoria valida → `controls.uncategorized` (inclusa nei totali);
- `controls.unverified` (senza `verifiedAt`) e `controls.transfer` (giroconto senza coppia reciproca valida, anche se la coppia è nel Cestino) sono solo controlli.
Ogni riga: `{id, parentId, date, source, description, amount, cents, type, categoryId, isSplit}`; importi in **centesimi interi**.

`summarize(core, month|'all')`: **Entrate** = Σ centesimi delle righe `✅ Entrata reale`; **Spese** = −Σ centesimi delle righe `❌ Uscita reale` (un rimborso positivo classificato Uscita reale riduce la spesa; un'entrata negativa riduce le entrate); **Risparmio** = Entrate − Spese; **Tasso** = Risparmio/Entrate se Entrate > 0, altrimenti N/D; spesa per categoria.
**Esclusi dai KPI per natura**: giroconti, acquisti/vendite investimento, anticipi pagati, rimborsi ricevuti (mostrati come "flussi separati"); **esclusi per qualità**: wallet differito, quote non quadrate, tipo mancante, dati non validi, Cestino, righe informative.

---

## d. Giroconti

### d.1 rematchTransfers (finale = `rematchTransfersV381`)
`isTransfer(m)` = tipo contiene "Giroconto". `opposite(a,b)` = entrambi giroconti, tipi diversi, `|getAmount(a)+getAmount(b)| < 0,005`, `norm(a.source) ≠ norm(b.source)`.
1. **Conservazione** link esistenti (movimenti attivi): un link `m→x` resta se è reciproco e `opposite(m,x)` e i due hanno lo stesso flag `manualTransferMatch`. Un link reciproco verso una coppia nel Cestino viene conservato (non operativo). Altrimenti entrambi i lati vengono scollegati (`matchedTo=null`). Nessun controllo della finestra temporale sui link esistenti.
2. **Nuovi match** (solo movimenti attivi, non già collegati), in ordine di array: candidati `x` = giroconto attivo non usato e non collegato, tipo opposto, somma importi ≈ 0 (< 0,5 cent), conto diverso, `|data(x) − data(m)| ≤ 5 giorni` (date effettive). Filtro controparte: se `m.counterparty` è valorizzata → solo `x.source === m.counterparty`; altrimenti solo `x` senza controparte o con `x.counterparty === m.source`.
   **Unicità**: il link si crea solo se resta **esattamente un** candidato (unicità valutata dal punto di vista di `m`; l'algoritmo è greedy e dipende dall'ordine). Effetto: `matchedTo` reciproci, `manualTransferMatch=false`; al lato senza controparte si assegna `counterparty = source dell'altro`, `counterpartySource='matching'`, `ruleStatus='Match automatico'`.
3. Chiamato dopo: import file, modifiche inline/dettaglio di data/importo/tipo/controparte, picker Tipo, inbox, ricalcolo, ripristino dati originali. **Non** chiamato al boot, dopo import backup, dopo azioni massive.

### d.2 Collegamento manuale ("🔗 Gestisci giroconto")
Dialog con il movimento, il collegamento attuale (manuale/automatico) e fino a 80 candidati di **tipo opposto** (nessun filtro su Cestino, conto o finestra) ordinati per differenza importo poi giorni. "Collega": se il candidato è già collegato altrove → conferma e scollega il vecchio; scollega anche il vecchio partner di `m`; poi link reciproco con `manualTransferMatch=true`, `counterparty` = conto dell'altro su entrambi, `ruleStatus='Match manuale'`. "Scollega attuale": azzera entrambi i lati (ruleStatus 'Match automatico' → ''). Un link manuale viene rotto automaticamente se data/importo/tipo modificati lo rendono incoerente (segno uguale o somma ≠ 0).
Cestino di una sola riga di una coppia: avviso; la riga rimasta appare "giroconto da verificare" nelle Stats. Azione massiva Cestino esclude un giroconto collegato se la coppia non è selezionata.

---

## e. Quote (split)

- Struttura: `Split` (§a.3). Movimento diviso ⇔ `splits.length > 0`.
- **Regola di quadratura**: `|Σ split.amount − getAmount(m)| < 0,005` (`splitBalanced`).
- Editor (bozza transazionale su `structuredClone`): prima apertura propone una quota pari all'intero importo (tipo Entrata/Uscita reale per segno, categoria corrente); "+ Quota" aggiunge `{amount:0, type:'💸 Anticipo pagato'}`; righe con importo/tipo/categoria/controparte; indicatore somma e differenza; "Salva divisione" consentito solo se quadrata ⇒ copia quote, `manualLock=true`; "Rimuovi divisione" ⇒ `splits=[]`; "Chiudi" scarta la bozza.
- `effectiveLines()` (legacy, usato da riepilogo progetti): movimenti attivi non wallet; un movimento quadrato con quote produce una riga per quota (`id parent::split`, `isSplit`, `parentId`, importo/tipo/categoryId/controparte della quota, descrizione della quota o del padre); un movimento non quadrato resta riga unica. Le Analytics v3.10 usano invece la logica di §c.10 (padre non quadrato sospeso).
- Le quote ereditano il `project` del padre; regole e azioni massive non agiscono su movimenti con quote.
- Caso automatico: Tinaba rientro conto deposito (capitale + interessi, §g).

---

## f. Budget e Stats

### f.1 Budget Planning (v3.10.3A) — pagina Budget
- Griglia **categoria × mese** per l'anno selezionato: righe = 19 categorie `expense` attive e budgetabili (ordine registry); colonne = 12 mesi (viste Annuale, Semestre 1/2, Trimestre 1–4 con navigazione); colonna mese corrente evidenziata; mesi senza celle evidenziati "non pianificati".
- Cella vuota = **non impostato**; `0` = **zero esplicito**; valori validi `^\d+([.,]\d{1,2})?$` (≥ 0). Commit su blur/Invio (Invio scende di riga, Shift+Invio sale), Esc annulla; aggiornamento totali in-place (mese, conteggio celle `n/19`, riga, vista, anno, celle compilate `x/228`).
- Navigazione anno ‹ › (range: min anni presenti − 1 … max(anno corrente + 10, anni presenti + 1)).
- Blocco **budget legacy**: se il template legacy ha valori > 0 → "Anteprima precompilazione <anno>" → "Applica base a tutti i mesi" (sovrascrive, crea undo).
- **Azioni ▾**: Ripeti valore (categoria, da mese, a mese, importo), Copia mese (solo celle impostate; le vuote non cancellano), Copia anno precedente (stessi mesi/categorie), Svuota mese, Svuota anno. Ogni azione ha anteprima, `confirm`, e crea **un solo undo** (`lastBudgetPlanUndoV3103A`), valido solo se le celle coinvolte non sono state modificate; editare a mano una cella coinvolta invalida l'undo.
- **Assistente Budget** (pulsante "AB" → panoramica delle categorie con mesi correnti/futuri da pianificare e suggerimenti disponibili; ✨ per riga → assistente di categoria):
  - basato sulle righe Analytics validate (§c.10), spesa = −Σ centesimi delle Uscite reali della categoria nel mese, minimo 0;
  - nessun suggerimento per anni passati ("senno di poi");
  - mesi osservati = mesi **precedenti al mese corrente** con almeno una riga Entrata/Uscita reale; base = ultimi ≤ 6; servono ≥ 3;
  - media ponderata per recenza (pesi 1…n, il più recente pesa di più);
  - trend (solo con 6 mesi): media ultimi 3 vs 3 precedenti; se |Δ| ≥ 10% si applica metà del trend limitata a ±15%;
  - arrotondamento a €5 (minimo €5 se > 0); preset −10% / Storico / +10%;
  - ambito: solo un mese (default mese corrente) / solo celle correnti-future vuote / sovrascrivi correnti-future;
  - stagionalità solo informativa: ≥ 18 mesi osservati, ≥ 2 osservazioni per ≥ 6 mesi di calendario, mese più alto ≥ 1,35 × media complessiva;
  - spiegazione con tabella dei mesi usati.
- Nota UI: "La Dashboard continua temporaneamente a usare il vecchio budget mensile".

### f.2 Stats (v3.10.1A–v3.10.2B + D3B-02)
Pagina unica con **periodo condiviso** (mese `YYYY-MM` o "Tutto lo storico"): pulsanti ‹ › tra mesi disponibili, popover con accesso rapido (mese corrente, mese precedente, ultimo mese con dati, tutto lo storico), anno + griglia mesi (selezionabili solo i mesi presenti nei dati più il mese corrente). Default all'apertura: ultimo mese disponibile, che coincide di solito con il **mese corrente (parziale)**. Quattro sotto-sezioni raggiungibili dal sottomenu "Stats" della sidebar (le tab interne sono nascoste via CSS):

1. **Panoramica**: frase di sintesi (entrate > / < spese, mese corrente parziale), avviso "dati del periodo da verificare", pannello **Copertura dati** per conto (n. movimenti, ultima data presente; per Cassa "completezza da verificare"; mai "certificata"); 4 card: Entrate, Spese, Entrate − Spese, Tasso di risparmio, con drill-down "Vedi movimenti".
2. **Trend** — "Perché le spese sono cambiate?": benchmark selezionabile `prev` (mese precedente), `avg3`, `avg6`, `avg12` (medie dei mesi precedenti), `yoy` (stesso mese anno precedente). Confronto consentito solo se: mese singolo, non mese corrente, mese con righe economiche, tutti i mesi del benchmark con righe economiche (mesi mancanti **non** trattati come zero). Output: Δ spesa assoluto e %, Δ entrate, Δ risparmio, driver per categoria (variazione), top 3 e loro quota sullo scostamento lordo nella stessa direzione, compensazioni in direzione opposta, concentrazione top-3 della spesa, storico 12 mesi a barre (N/D per mesi senza dati), stati: `not-comparable | current-empty | partial-current | no-current-data | missing-benchmark | zero-benchmark | ok`.
3. **Indicatori**: *Cause della spesa* (categorie con spesa: barra, spesa, incidenza %, variazione vs mese precedente se disponibile; ordinamento spesa ↑↓, variazione ↑↓, incidenza, nome; prime 5 o tutte; "Movimenti"); *Flussi fuori da Entrate e Spese* (per tipo strutturale: totale con segno, prime 30 righe, "Apri"); *Qualità del dato* (tipo da definire, divisione da correggere, dato non valido → cambiano i KPI; categoria da assegnare → dettaglio incompleto; giroconto da collegare, non verificato → riconciliazione) con conteggi e drill-down; righe escluse dai KPI; numero record nel Cestino.
4. **Actual vs Budget** (D3B-01/02/04/05, motore puro `computeBudgetActualV3103B`):
   - periodo: grana mese/trimestre/semestre/anno + anno + indice, sincronizzato con il mese condiviso (se il periodo condiviso è "tutto" → anno);
   - per ogni (mese, categoria budgetabile): `budgetPresent`, `budgetCents`, `actualCents` (= −Σ cents Uscite reali), `variance = actual − budget`, sforamento lordo = max(0, variance), residuo lordo = max(0, −variance); spese di categorie senza budget nel mese = **non pianificate**; spese senza categoria o con categoria non budgetabile = **senza categoria**; quadrature verificate (`totale = coperto + non pianificato + senza categoria`; `scostamento netto = sforamenti − residui`), altrimenti eccezione;
   - stato mese: `historical | partial | future`; confronto "non conclusivo" se il periodo include mesi in corso, futuri o senza spese;
   - UI: sintesi (spese oltre/sotto il budget di X), mini-KPI (sforamenti, spese senza budget, residui), dettagli di calcolo (spese totali, budget, coperte, copertura %, scostamento netto %), top 3 sforamenti (categoria×mese), tabella categorie (stato: Non pianificata / Budget futuro / Non conclusivo / Sopra budget / Nei limiti), dettaglio mensile per periodi multi-mese, pannello **Analisi categoria** (12 mesi dell'anno: barre budget vs spesa, mesi sopra budget, spesa nei mesi senza budget, confronto con media 3 e 6 mesi precedenti che richiede movimenti in tutti i mesi), drill-down righe.
- Elenco dettaglio comune (`showStatsRowsV310`): prime 100 righe, importi firmati, motivo esclusione, "Apri movimento" (apre il padre in Movimenti azzerando i filtri).

---

## g. Importer per banca (sintesi)

Comune: drag&drop o "Scegli file" (multipli, `.xls,.xlsx,.csv`); i file sono processati in sequenza; un errore su un file produce una riga "Errore" nel report e non ferma gli altri; nessuna transazione per file (righe già aggiunte restano). Per ogni riga: `mkMovement` → `applyRules` → regole specifiche banca → `signature` → controllo duplicati (scansione lineare di tutti i movimenti) → push. A fine lotto: `rematchTransfers()`, `save()`, `renderAll()`. Report per file (importati / duplicati ignorati / esclusi + diagnostica specifica) e voce in `state.imports`. Excel richiede la libreria XLSX dal CDN (senza rete: errore "Libreria XLS non caricata" + banner).

Rilevamento (`importOne`): 1) prima riga del file decodificata UTF-8 contenente `DATA OPERAZIONE, DATA CONTABILE, IBAN, TIPOLOGIA, NOME, DESCRIZIONE` ⇒ **Hype** (qualsiasi estensione); 2) `.csv`: intestazione con `TRANSACTION_ID, ACCOUNT_TYPE, ASSET_CLASS, PAYMENT_REFERENCE` ⇒ **Trade Republic**; con `CRO/NOP, CONTROPARTE, COMMUNITY` ⇒ **Tinaba**; altrimenti **Revolut**; 3) `.xls/.xlsx`: `XLSX.read(cellDates, cellNF, cellText)`, primo foglio, prime 30 righe appiattite: `CONTO O CARTA + CONTABILIZZAZIONE + OPERAZIONE + DETTAGLI + IMPORTO` ⇒ **Easy Bank**; `DATA VALUTA + DATA CONTABILE + IMPORTO (EURO)` ⇒ **Poste**; altrimenti **Banca Sella**.

Parsing condiviso: `parseBankAmount` (numeri passano; stringhe con separatori IT/EN, parentesi = negativo, correzione migliaia `1.234,56`; vuoto ⇒ 0 + issue "Importo mancante"; non numerico ⇒ 0 + issue); `parseItalianFormattedAmount` (punto = migliaia, virgola = decimali); `dateOnly` (Date → data locale; seriale Excel 20000–100000; prefisso ISO; `g/m/aaaa`; altrimenti primi 10 caratteri); CSV: parser con virgolette, `,` (Revolut/TR/Hype) o `;` (Tinaba).

| Banca | Header | Colonne usate → campi | Segno / importo | Date | ID / duplicati | Casi speciali |
|---|---|---|---|---|---|---|
| **Banca Sella** `.xls/.xlsx` | riga nelle prime 30 con cella ⊃ `DATA OPERAZIONE`, cella = `IMPORTO`, cella ⊃ `DESCRIZIONE` (ricerca colonne per uguaglianza o "contiene") | Codice identificativo/Identificativo → externalId; Descrizione; Importo; Divisa/Valuta → currency; Categoria → sourceCategory; Sottocategoria → sourceType | dal file; cella letta dal worksheet confrontando `.v` (valore) e `.w` (testo): uguali ⇒ `.v`; rapporto 1000 o 0,001 ⇒ il maggiore in valore assoluto ("Disallineamento XLS corretto"); altrimenti vince il testo formattato | date = Data operazione; valueDate = Data valuta | externalId (Sella) oppure signature | righe vuote saltate; `SALDO AL…` con importo 0 escluse; uscita con `REVOLUT` ⇒ Giroconto uscita (cp Revolut); `GIROCONTO TR PUB` ⇒ Giroconto uscita (cp Trade Republic); `RICARICA A <NOME_TITOLARE>` ⇒ Giroconto uscita candidato. Nessun filtro anno |
| **Revolut** `.csv` | riga 0; richiede `TIPO, DATA DI INIZIO, DESCRIZIONE, IMPORTO, STATE` | Tipo → sourceType; Descrizione; Importo; Valuta; raw con chiavi normalizzate | Importo così com'è (colonne commissione non considerate) | date = Data di completamento ‖ Data di inizio; dateTime = Data di inizio | signature (stessi campi ⇒ duplicato) | `State = OPERAZIONE ANNULLATA` ignorate (conteggiate); Pagamento con carta/Pagamento/Pagamento Revolut con importo < 0 ⇒ Uscita reale; Rimborso su carta > 0 ⇒ Entrata reale; Ricarica > 0 con `PAGAMENTO DA <NOME_TITOLARE>` ⇒ Giroconto entrata candidato. Nessun filtro anno |
| **Tinaba** `.csv` (`;`) | riga 0; richiede Data, Descrizione, Importo, Categoria | Categoria → sourceType; Causale/Messaggio → sourceCategory; Controparte; CRO/NOP → externalId | ricostruito: valore negativo resta; altrimenti negativo se testo ⊃ `EFFETTUATO A FAVORE DI`/`NUOVA SOTTOSCRIZIONE`/`ADDEBITO`, positivo se ⊃ `RICEVUTO DA`/`ACCREDITO`/`RIMBORSO`/`DISINVESTIMENTO`/`LIQUIDAZIONE`, altrimenti positivo + issue | date = Data; dateTime = testo originale; **solo anno 2026** | externalId (Tinaba) o signature | uscita a favore di `<NOME_TITOLARE>` con causale GIROCONTO ⇒ Giroconto uscita candidato; bonifico a terzi ⇒ controparte = Controparte; **rientro conto deposito** (`ACCREDITO CAPITALE INVESTITO` + `INTERESSI`, categoria CONTI DEPOSITO): capitale = Σ sottoscrizioni pre-2026 nello stesso file (≤ importo) → quota Giroconto entrata (cp "Tinaba Conto deposito") + quota Entrata reale interessi, se 0 ≤ interessi ≤ 20% capitale; altrimenti issue |
| **Poste Italiane** `.xlsx` | riga nelle prime 30 con celle = `DATA VALUTA`, = `DATA CONTABILE`, cella ⊃ `IMPORTO` | Descrizione; Importo (euro)/Importo | dal file | date = Data valuta ‖ Data contabile; **valueDate = Data contabile** (semantica invertita rispetto a Sella); righe senza date saltate | signature tra i soli movimenti Poste (righe identiche collassano) | uscita con `PRELIEVO CONTANTI ATM` ⇒ Giroconto uscita, cp **Cassa**; altrimenti nessun tipo ("da verificare") |
| **Hype** `.csv` (o `.xls` che è CSV) | riga 0: Data operazione, Data contabile, Iban, Tipologia, Nome, Descrizione, prima colonna ⊃ IMPORTO | Tipologia → sourceType; Nome → sourceCategory; Descrizione (‖ Nome) | dal file | date = Data operazione; valueDate = Data contabile; **solo 2026** | externalId `HYPE-` + fnv(data, contabile, iban, tipologia, nome, descrizione, importo + n° occorrenza) — conserva i duplicati reali | Nome = titolare con GIROCONTO/BONIFICO ⇒ Giroconto entrata/uscita candidato per segno; RICARICA CARTA / RICARICA HYPE > 0 ⇒ Giroconto entrata da riconciliare; PRELIEVO < 0 ⇒ Giroconto uscita cp Cassa; COMMISSIONE ⇒ Uscita reale/Altro Uscite; BOLLO ⇒ Uscita reale/Tasse; PAGAMENTO < 0 ⇒ Uscita reale; altre entrate ⇒ Entrata reale "da verificare" |
| **Trade Republic** `.csv` | riga 0; richiede datetime, date, category, type, amount, fee, tax, currency, description, transaction_id | type → sourceType; category·asset_class → sourceCategory; name → counterparty (BUY/SELL/DIVIDEND); transaction_id → externalId | **netto** = amount + fee + tax (arrotondato 1e-6); lordo/fee/tax in raw | date = date ‖ datetime; dateTime = datetime; **solo 2026** | transaction_id (TR), altrimenti signature | TRANSFER_INBOUND / TRANSFER_INSTANT_INBOUND ⇒ Giroconto entrata da riconciliare; BUY ⇒ Acquisto investimento; SELL ⇒ Vendita investimento (categoria poi rimossa dalla migrazione); DIVIDEND ⇒ Entrata reale rendite; INTEREST_PAYMENT ⇒ Entrata reale rendite; TAX_OPTIMIZATION ⇒ Uscita reale Tasse (positivo = storno); altro ⇒ "tipo da verificare" |
| **Easy Bank** `.xlsx` | riga nelle prime 35 con celle = DATA, OPERAZIONE, DETTAGLI, CONTO O CARTA e cella ⊃ IMPORTO | Operazione → descriptionRaw; Dettagli → sourceCategory; Categoria → sourceType; Valuta | dal file | date = Data; **solo 2026** | externalId `EASY-<COD. DISP.>` se presente nei dettagli, altrimenti `EASY-` + fnv(riga + occorrenza) | bonifico in entrata con il nome del titolare nei dettagli ⇒ Giroconto entrata (cp Hype se dettagli ⊃ GIROCONTO e BIC Hype); COSTO CARTA ⇒ Uscita reale/Altro Uscite; BETFAIR/SISAL/SCOMMESSE ⇒ Uscita reale/Scommesse (poi `deferredWallet` alla migrazione); altrimenti Uscita/Entrata reale per segno |
| **Cassa** (manuale) | — | dialog "Inserimento rapido Cassa" multi-riga | segno dal tipo (toggle Entrata/Uscita; `+`/`-` iniziale imposta il tipo) | data default oggi, righe successive ereditano l'ultima | nessun controllo duplicati | tipo Entrata/Uscita reale, nessuna categoria, non lockato; undo dell'ultimo lotto se intatto. Movimenti Cassa precaricati nel codice (dati reali: da eliminare) |

Pulsante **"🔎 Controlla importi importati"**: `alert` diagnostico (n. movimenti bancari, errori input, movimenti ≥ €500 elencati, controllo su una data cablata): strumento di debug da sostituire.

---

## h. Funzioni e pagine visibili (comportamento finale)

**Shell**
- Overlay di boot "Caricamento workspace…" fino alla fine dell'inizializzazione; messaggio d'errore se il boot fallisce.
- Sidebar (desktop) comprimibile (stato in localStorage) / barra inferiore (≤ 720 px): primarie **Dashboard, Movimenti** (badge "Da controllare"), **Budget**; gruppo **Altro**: **Stats** (sottomenu Panoramica, Actual vs Budget, Indicatori, Trend), **Conti, Importa, Regole, Backup**. Pagina iniziale: **Movimenti**. Inbox nascosta. Stato salvataggio ("Salvato HH:MM", "Salvataggio in corso…", "Non salvato · …") nell'header.

**Dashboard**: KPI storici (Entrate, Uscite, Avanzo, n. Da controllare) da Analytics v3.10; Saldi stimati (conti con saldo ≠ 0 più Sella/Revolut/Cassa); "Budget mese più recente" (ultimo mese con movimenti, spesa per categoria vs `state.budgets` legacy > 0, barra %); Giroconti (righe abbinate vs da verificare).

**Movimenti**
- Barra: ricerca (debounce 120 ms; descrizione, categoria, controparte, tipo, conto, importo come numero JS, soggetto, progetto, campi delle quote), mese, **Filtri** (pannello: OR nello stesso gruppo, AND tra gruppi — Conto, Tipo (+mancante), Categoria (+senza), Stato, Origine, Dal/Al, Segno, Importo min/max in valore assoluto), **Esporta**, **Revisiona risultati / Termina revisione**.
- Preset: Da classificare, Da controllare, Da verificare, Senza regola, Giroconti aperti, Con segnali, **Cestino** (modalità cestino); chip dei filtri attivi rimovibili; messaggi di errore filtro.
- Tabella: checkbox selezione, Data, Conto, Descrizione (soggetto se presente + descrizione banca; chip origine, quote, giroconto, dato corretto; stato regola Applicata/Disponibile/Conflitto/Nessuna), **Tipo** e **Categoria** con picker inline a popover (suggerimento: regola compatibile > storico ≥ 70% con stessa descrizione/conto/segno > parola chiave), Importo, Stato (badge, verificato, n. segnali, ricorrenza). Intestazioni ordinabili (data, conto, descrizione, categoria, importo, stato); ordine di default: data ↓, |importo| ↓, id. Clic su data/descrizione/importo = modifica rapida in cella.
- **Dettaglio** (pannello a tutta larghezza sopra la tabella, resta aperto anche fuori dai filtri): precedente/successivo, chiudi (anche Esc); Verifica / Rimuovi verifica; campi Data, Importo, Conto (sola lettura), Descrizione; Tipo, Categoria, Controparte, Soggetto/Esercente, Progetto/Evento (datalist), Ricorrenza; protezione (Proteggi/Sblocca/Ricalcola); azioni: Dividi/Modifica quote, Gestisci collegamento, Automatizza (crea regola), Gestisci regole, **Simili (n)** (dialog: criterio regola/identica/contiene, testo, conto, segno, periodo, tipo, categoria, vista; selezione esplicita; anteprima; applica **solo la categoria** del riferimento e lock; manuali selezionabili solo con consenso esplicito), **Verifica e successivo**, Altre azioni: Ripristina dati originali, Elimina (Cestino con motivo, opzione "cestina entrambi" per giroconti); blocchi Automazione, **Segnali di controllo** (ricorrenza mensile suggerita se ≥ 3 date con intervalli 23–38 gg; importo > mediana dei ≤ 8 precedenti di almeno +50% e +€20; possibile duplicato stesso conto/data/importo/descrizione; primo esercente), Quote, Coppia giroconto, Dati bancari originali + record raw JSON, **Cronologia**.
- **Selezione e azioni massive**: seleziona tutti i filtrati, barra (Categoria, Tipo solo Entrata/Uscita reale, Verifica, Cestino; in modalità Cestino: Ripristina), anteprima con inclusi/esclusi/no-op e motivi, avviso sovrascrittura manuali, commit con fingerprint (se i dati cambiano si ripresenta l'anteprima), **undo dell'ultimo batch** (valido solo se i campi non sono cambiati dopo). Cambiare filtri azzera la selezione.
- Riepilogo **Progetti / Eventi** nei risultati (entrate/uscite reali per progetto).
- **Esporta CSV** (dialog: tutti gli operativi / filtrati / selezionati): `;`, BOM UTF-8, colonne `movementId, Fonte, Data corrente, Descrizione corrente, Importo corrente, Tipo, Category ID, Categoria label, Controparte, Project, Merchant, Stato, Verified, Deleted, Deleted At, Deleted Reason, Origine Tipo, Origine Categoria, Origine Controparte, Origine classificazione, Regola applicata ID, External ID, Source Type, Source Category, Data originale, Descrizione originale, Importo originale, Raw JSON`; file `movimenti_v3_9_5_<ambito>.csv`.

**Importa**: dropzone, "Scegli file", "＋ Inserimento rapido Cassa" (griglia Data/Descrizione/Importo/Tipo, Tab/Invio avanzano, riga nuova automatica, anteprima entrate/uscite/netto, righe incomplete evidenziate, conferma), "↶ Annulla ultimo inserimento Cassa", "🔎 Controlla importi importati", report diagnostici, note sulle regole d'importazione (testo statico con riferimenti personali da riscrivere), avviso XLSX non disponibile.

**Regole**: griglia per priorità decrescente (Fonte, Contiene, Segno, Tipo, Categoria registry, Controparte (conti), Priorità, Attiva, ×), "+ Regola" (priorità 50), "Ricalcola classificazioni automatiche". Modifiche salvate al change, senza ricalcolo automatico.

**Conti**: saldo iniziale per ciascun conto di ACC (input numerico).

**Budget**: §f.1. **Stats**: §f.2.

**Backup**: Esporta JSON, Importa JSON, Esporta movimenti CSV (dialog), Esporta report migrazione. "Svuota import bancari", "Svuota tutti i movimenti", "Azzera app" sono nascosti e disattivati (solo Cestino/Ripristina).

---

## i. Problemi rilevati

### Prestazioni
- **P1 — Script CDN render-blocking nel `<head>`** (xlsx 0.18.5, 882 KB): blocca il parsing; misurato +≈280 ms di DOMContentLoaded quando la rete rifiuta la richiesta, +≈1,5 s con 1,5 s di latenza, +≈90 ms di parse/esecuzione anche se servito istantaneamente, +≈4,7 MB di heap. Serve solo per importare Excel. → `import()` dinamico su richiesta, libreria nel bundle (o Web Worker).
- **P2 — Boot "deferred"**: 602 KB di JS conservati come testo e reiniettati dopo l'apertura di IndexedDB; 21 layer eseguiti in un unico long task; il codice dei layer superati (v3.6–v3.9) gira ancora dentro le catene di wrapper.
- **P3 — Catene di wrapper su `save()`** (≈11 livelli): ogni salvataggio riesegue migrazioni su **tutti** movimenti e regole (`initializeV38/V381/V382`), il diff audit con `JSON.stringify` per campo per movimento, `structuredClone` dell'intero stato per la baseline e per la scrittura, e un `put` IndexedDB dell'**intero snapshot** (O(n) per ogni singola modifica; ≈1 s a 3.000 movimenti, ≈2,3 s a 10.000).
- **P4 — `renderAll()` ridisegna tutto** a ogni modifica: Inbox nascosta, Movimenti, Regole, Conti, Budget, Dashboard, Stats + Actual vs Budget anche se non visibili. Stats viene calcolata più volte durante il boot (v393, REV3, rAF REV4, evento `load`).
- **P5 — Tabella Movimenti senza virtualizzazione** + più passate di decorazione per riga (v38, v391, v392, v394) con `state.movements.find` per riga (O(n²)), `ruleMatch`/`norm` ripetuti per riga, segnali di controllo per riga. È il collo di bottiglia dominante: 5,5 s a 3.000 movimenti, 29 s a 10.000; 305.000 nodi DOM a 10.000.
- **P6 — Assistente Budget**: `buildAnalyticsV310` ricalcolato per ogni categoria × mese (panoramica ≈ 19 × 7 ricostruzioni complete).
- **P7 — Peso del bundle**: 143 KB di piano di migrazione per ID reali + dati Cassa precaricati + 89 KB di CSS in 32 blocchi.
- **P8 — Scritture a ogni apertura**: ogni boot riscrive lo snapshot (revisione che cresce senza modifiche: osservato +3 al primo avvio, +1 a ogni riapertura).

### Correttezza / rischi dati
- **C1 — Anno 2026 cablato** negli importer Trade Republic, Hype, Tinaba, Easy Bank: le righe di altri anni vengono scartate in silenzio (solo contatore "esclusi"); Sella/Revolut/Poste non filtrano → comportamento incoerente.
- **C2 — Dati personali nel codice**: nome del titolare cablato in 13 confronti (importer, baseClassify, migrazioni), nomi di persone nell'elenco controparti e nelle parole chiave dei suggerimenti, movimenti Cassa reali precaricati, piano di migrazione per ID reali, note d'importazione con riferimenti personali. → impostazione "nomi del titolare" + dati fuori dal bundle.
- **C3 — Migrazione regole ad ogni save** (`migrateRuleV382` senza guardia di versione): per le regole presenti nel piano v3.8.2 e per quelle che contengono parole chiave (WIND, NETFLIX, EASYPARK, barbiere/parrucchiere) il `categoryId` viene **ri-forzato a ogni salvataggio**, annullando le modifiche dell'utente; `categoryMigration.changes` cresce.
- **C4 — Importa JSON** sostituisce tutto senza conferma, senza controllo di versione/schema oltre ai minimi, senza merge e senza `rematchTransfers`.
- **C5 — Duplicati per firma**: righe genuinamente identiche nello stesso file vengono scartate per Revolut, Poste, Sella senza ID, TR senza ID, Tinaba senza CRO (solo Hype/Easy Bank usano contatori di occorrenza). Controllo O(n) per riga.
- **C6 — Poste**: `date` = data valuta e `valueDate` = data contabile (semantica opposta a Sella/Hype).
- **C7 — Revolut**: eventuali commissioni in colonna separata non sono sottratte (da verificare su un export reale).
- **C8 — "Ricalcola"** riparte dalla baseline importer: per i movimenti Cassa inseriti a mano non ancora lockati (baseline senza tipo) il tipo viene azzerato; analogo per Poste.
- **C9 — Regola senza categoria** (`categoryId===''`) svuota la categoria della baseline quando vince.
- **C10 — Matching giroconti greedy** e dipendente dall'ordine; unicità valutata da un solo lato; controparti confrontate come stringhe di nome conto; il collegamento manuale propone anche movimenti nel Cestino; nessun rematch al boot/import backup.
- **C11 — `status()` finale** non controlla più la coppia nel Cestino (mostra "✅ Giroconto abbinato") mentre Stats, filtro "Giroconti aperti" e verifica la considerano da collegare → incoerenza.
- **C12 — Wallet Betfair/Sisal**: l'importer li classifica come spesa Scommesse ma la migrazione al save li trasforma in `deferredWallet`; restano per sempre in "Da controllare" senza un flusso dedicato.
- **C13 — Due modelli budget**: la Dashboard usa `state.budgets` legacy, Budget/Stats usano `budgetPlanV3103A`.
- **C14 — Crescita illimitata** di `history` per movimento e di `categoryMigration.changes`; backup JSON indentato (file più grandi).
- **C15 — Parsing permissivo**: `num()` restituisce 0 per input non numerici (saldi iniziali, budget legacy); `dateOnly` restituisce i primi 10 caratteri per formati sconosciuti.
- **C16 — Ricerca per importo** confronta la stringa JS (`-12.5`), non il formato italiano.

### UX
- **U1** Pagina Inbox rimossa dalla nav ma ancora renderizzata; "Da controllare" è solo un preset.
- **U2** Uso di `alert`/`prompt`/`confirm` (creazione regole, diagnostica import, conferme).
- **U3** Etichette di versione incoerenti (titolo REV11, boot "v3.10.3A-UX4 R3", nomi file CSV "v3_9_5", alert import "v3.10.1A").
- **U4** Testi statici obsoleti/personali (pagina Conti, note importazione).
- **U5** Import Excel dipendente da Internet senza alternativa offline.
- **U6** Stats apre di default sul mese corrente parziale; tab interne nascoste via CSS e pilotate dalla sidebar (fragile).
- **U7** Elenco controparti fisso con nomi personali; controparte nelle regole limitata ai conti.
- **U8** Mobile non collaudato (dichiarato nel codice).

### Raccomandazioni per il rebuild (sintesi)
Store unico tipizzato (es. signals/Preact) con selettori memoizzati; Analytics come funzione pura in Web Worker o memoizzata per revisione; tabella virtualizzata; indici `Map` per id, firma, regole precompilate (`norm` una volta per movimento); persistenza per-movimento (store IDB `movements` keyed by id + store `meta`) o snapshot con debounce; migrazioni **una volta** con `schemaVersion` (v4) e funzioni idempotenti; XLSX lazy; configurazione utente (nomi titolare, conti, controparti, anno) al posto delle costanti; import backup con anteprima, conferma e validazione per schema.

---

## Misure

Ambiente: Chromium headless (Playwright), file aperto via `file://`, CPU 4 core / 16 GB. Script in
`/tmp/claude-0/-home-user-Trading-sport/cbf8d0c2-059b-550a-a8ff-1d08dd251f3b/scratchpad/audit/` (`measure.js`, `gen.js`, `static.js`, `profile.js`, risultati `result_*.json`).
Metodo: nuovo contesto browser per ogni run (profilo vuoto ⇒ dataset predefinito = 69 movimenti Cassa precaricati), oppure IndexedDB pre-popolato con dataset **sintetico** (descrizioni fittizie tipo "NEGOZIO 0123", importi casuali, 80% uscite, 7% entrate, 8% coppie di giroconti, investimenti, anticipi/rimborsi, 1% quote, 1% cestino, 60 regole, piano budget 2026) nella forma snapshot v3.10. "cold" = primo avvio, "warm" = riapertura nello stesso profilo. Valori = mediana dei run (3 run, 2 per i casi più lenti). "Boot" = tempo dal navigation start alla rimozione di `body.fp-booting`.

**Analisi statica**: file 713.166 B; 25 script (1 esterno CDN 882 KB non minificabile ulteriormente + 24 inline = 609.567 B), di cui 21 deferred = 602.505 B (il più grande `v382-category-registry` 180.546 B, di cui ~143 KB di piano di migrazione); 32 blocchi CSS = 88.749 B. Dopo il boot il DOM contiene 46 `<script>` (21 copie `-active`).

### Caricamento — effetto del CDN (dataset predefinito, 69 movimenti)

| Scenario CDN xlsx | DOMContentLoaded | load | Boot completato | Richiesta CDN | Heap JS (dopo GC) | Long task al boot |
|---|---|---|---|---|---|---|
| Così com'è (proxy rifiuta la richiesta) | 335 ms | 335 ms | 522 ms | fallisce dopo ~290 ms | 9,5 MB (2,4 MB) | 2 · 214 ms totali (max 160) |
| Bloccato con `page.route` → abort | 62 ms | 62 ms | 259 ms | abort immediato | 9,5 MB (2,4 MB) | 1 · 161 ms |
| Servito localmente, latenza 0 | 148 ms | 148 ms | 349 ms | 23 ms | 12,1 MB (7,1 MB) | 2 · 211 ms (max 156) |
| Servito con 1,5 s di latenza simulata | 1.674 ms | 1.675 ms | 1.880 ms | 1.525 ms | 14,5 MB (7,1 MB) | 3 · 283 ms |

Riapertura (warm) con CDN bloccato: DCL 59 ms, boot 279 ms.

### Scalabilità (CDN bloccato)

| Dataset | Boot cold / warm | Long task più lungo al boot | Heap JS dopo GC | Nodi DOM | `renderAll()` | `renderMovements()` | `renderStats` | `save()` sync + scrittura IDB | Ricerca (1 battuta) |
|---|---|---|---|---|---|---|---|---|---|
| 69 (predefinito) | 259 / 279 ms | 161 ms | 2,4 MB | 7.628 | 59 ms | 47 ms | 6 ms | 5 + 36 ms | 26 ms |
| 3.000 sintetici | 7.376 / 7.092 ms | 6.420 ms | 9,3 MB | 97.084 | 5.412 ms | 5.551 ms | 23 ms | 203 + 964 ms | 1.769 ms |
| 10.000 sintetici | 36.268 / 37.306 ms | 34.003 ms | 25 MB | 305.357 | 28.825 ms | 29.364 ms | 476 ms | 593 + 2.323 ms | 8.324 ms |

`buildAnalyticsV310` da solo: 0 / 8 / 26 ms — il motore Analytics non è il problema; lo sono rendering e persistenza.

### Cambio scheda (click sui pulsanti nav, tempo fino al frame successivo al render, include ≤16 ms di allineamento al frame)

| Dataset | → Movimenti | → Stats | → Budget | → Dashboard | → Movimenti (2ª volta) |
|---|---|---|---|---|---|
| 69 | 9 ms | 27 ms | 60 ms | 27 ms | 46 ms |
| 3.000 | 141 ms (1 long task) | 344 ms (2) | 246 ms (1) | 240 ms (1) | 1.331 ms (1) |
| 10.000 | 432 ms (1) | 904 ms (2) | 694 ms (1) | 539 ms (1) | 3.278 ms (1) |

Ciclo di modifica tipico (`save()` + `renderAll()`): 71 ms (69) · 5,1 s (3.000) · 29,7 s (10.000).

Profilo CPU di `renderMovements()` a 3.000 movimenti (5,7 s campionati): **`norm()` 34%** del tempo (normalizzazione Unicode ripetuta per ogni riga × ogni regola × più chiamate di `rulesMatchingMovement`/`topRulesMatchingMovement`/`conflictV37`/`ruleStateV392` per riga), `renderMovementsV37` 8%, `decorateMovementsV392` 2%, `ruleMatch` 2%, altre funzioni anonime dei layer di decorazione ~30%, "(program)"/layout 15%. Precalcolare `norm` una volta per movimento e indicizzare le regole elimina la quota principale.

Conclusione: con il carico attuale (centinaia di movimenti) l'app è utilizzabile ma ogni modifica ridisegna tutto; il tempo cresce in modo **super-lineare** (≈×20 da 3.000 a 10.000 per `renderMovements`), quindi a qualche migliaio di movimenti l'app diventa inutilizzabile. Il rebuild deve garantire: boot < 300 ms anche a 10.000 movimenti (rendering virtualizzato, nessun lavoro O(n²)), modifica < 50 ms (aggiornamento incrementale e persistenza differita/per-record), XLSX fuori dal percorso critico.
