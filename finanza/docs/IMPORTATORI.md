# Importatori degli estratti conto (v4)

Porting degli importatori della v3.10 in `src/import/`. I valori che entrano nella firma
anti-doppione (`account`, `externalId`, `dateTime`/`date`, `description`, `amount`, `currency`)
sono identici a quelli che la v3.10 salvava, così reimportare un file già importato non crea doppioni.

## Uso

```ts
import { parseBankFile, dedupeKeys } from "./import/index.ts";
const xlsx = await import("xlsx");            // solo se serve: non è nel bundle di avvio
const res = await parseBankFile(file, { xlsx, ownerNames: settings.ownerNames });
// res.rows: TUTTE le righe del file (anche identiche tra loro); res.skipped; res.notes (italiano)
```

- Le righe identiche dello stesso file (es. due caffè uguali) vengono restituite tutte: la v3.10
  le scartava. I doppioni rispetto all'archivio li gestisce l'app con `dedupeKeys(row)`, che
  restituisce `ext:<conto>:<codice>` (se la banca dà un codice) e `sig:<firma>` (usa `signature`
  già salvata sul movimento, se c'è). La v3.10 confrontava anche i movimenti nel Cestino.
- `ownerNames`: nomi del titolare. Il confronto ignora maiuscole, accenti e spazi doppi e accetta
  sia "nome cognome" sia "cognome nome". Senza nomi, le regole legate al titolare non scattano.
- Classificazione proposta: `type` (codici v4, equivalenti di `LEGACY_TYPE`), `categoryId`
  (mappa v3.8.2 `categoryIdFromLegacyV382` + parole chiave), `counterparty`, `ruleStatus`:
  `"candidate"` per i giroconti candidati di `baseClassify` (Revolut, Sella), `"import"` per tutto
  ciò che l'importatore ha classificato (così "Ricalcola" lo conserva), `""` se nulla.
- Dopo la baseline la v3.10 applicava al primo salvataggio un piano della v3.8.2, portato qui:
  Betfair/Sisal con importo negativo → `deferredWallet: true` e nessuna categoria; WIND TRE,
  NETFLIX, EASYPARK, barbiere/parrucchiere, SPICCIOLI REVPOINTS → categoria fissa e, se l'importo è
  negativo, tipo Uscita; importo negativo con COMMISSIONE/COSTO CARTA → Uscita, servizi finanziari.
- Anno: nessun filtro. La v3.10 teneva solo il 2026 per Trade Republic, Hype, Tinaba ed Easy Bank;
  ora restano escluse (e contate in `skipped`) solo le righe senza una data leggibile.

## Riconoscimento (come `importOne`)

1. Prima riga del file (UTF-8) con `DATA OPERAZIONE`, `DATA CONTABILE`, `IBAN`, `TIPOLOGIA`, `NOME`,
   `DESCRIZIONE` → **Hype**, qualunque sia l'estensione.
2. `.csv`: prima riga con `TRANSACTION_ID`, `ACCOUNT_TYPE`, `ASSET_CLASS`, `PAYMENT_REFERENCE` →
   **Trade Republic**; con `CRO/NOP`, `CONTROPARTE`, `COMMUNITY` → **Tinaba**; altrimenti **Revolut**
   (errore "CSV non riconosciuto" se mancano le sue intestazioni).
3. `.xls`/`.xlsx` (serve `opts.xlsx`, altrimenti errore): `XLSX.read` con `cellDates`, `cellNF`,
   `cellText`; primo foglio; `sheet_to_json(header:1, defval:"", raw:true)`; testo delle prime 30
   righe: `CONTO O CARTA`+`CONTABILIZZAZIONE`+`OPERAZIONE`+`DETTAGLI`+`IMPORTO` → **Easy Bank**;
   `DATA VALUTA`+`DATA CONTABILE`+`IMPORTO (EURO)` → **Poste**; altrimenti **Banca Sella**.
4. Altre estensioni → "Formato non supportato".

## Banca Sella (`.xls`/`.xlsx`)

- **Intestazione**: riga, nelle prime 30, con una cella che contiene `DATA OPERAZIONE`, una uguale a
  `IMPORTO` e una che contiene `DESCRIZIONE`. Le colonne si cercano per uguaglianza o "contiene".
- **Colonne**: Codice identificativo/Identificativo → `externalId`; Data operazione → `date`;
  Data valuta → `valueDate`; Descrizione; Importo; Divisa/Valuta → `currency`;
  Categoria → `sourceCategory`; Sottocategoria → `sourceType`.
- **Importo**: letto dalla cella del foglio confrontando `.v` (valore) e `.w` (testo visualizzato):
  uguali → `.v`; rapporto 1000 o 1/1000 (vecchio .xls: 1 ↔ "1.000,00") → il maggiore, contato nelle
  note come "correzione XLS automatica"; altra differenza → il testo. `raw.__IMPORTO_CELL_V/W/Z`.
- **Tipi** (`baseClassify`, importo negativo): causale con `REVOLUT` → Giroconto uscita verso Revolut;
  `GIROCONTO TR PUB` → verso Trade Republic; `RICARICA A <titolare>` → Giroconto candidato.
- **Esclusi**: righe vuote; `SALDO AL …` con importo zero (contate).
- **Limiti**: se manca la colonna "Divisa", la ricerca "Valuta" (come nella v3.10) prende la prima
  colonna che contiene VALUTA, cioè "Data valuta": la valuta diventa una data. Lasciato così per
  la compatibilità della firma.

## Revolut (`.csv`, export in italiano)

- **Colonne obbligatorie**: Tipo, Data di inizio, Descrizione, Importo, State. Usate anche Data di
  completamento e Valuta. `raw` con le intestazioni normalizzate (maiuscole), come nella v3.10.
- **Date**: `date` = Data di completamento, altrimenti Data di inizio; `dateTime` = Data di inizio.
- **Segno**: l'importo del file. La colonna commissione non è sottratta.
- **Tipi**: Pagamento con carta / Pagamento / Pagamento Revolut negativi → Uscita; Rimborso su
  carta positivo → Entrata; Ricarica positiva con `PAGAMENTO DA <titolare>` (basta il nome) →
  Giroconto entrata candidato.
- **Esclusi**: `State = OPERAZIONE ANNULLATA` (contate). Righe in inglese non riconosciute.

## Tinaba (`.csv` con `;`)

- **Colonne**: Data, Descrizione, Importo, Categoria (obbligatorie); Causale/Messaggio →
  `sourceCategory`; Controparte; CRO/NOP → `externalId`. Categoria → `sourceType`;
  `dateTime` = testo originale della data.
- **Segno ricostruito**: negativo se già negativo o se il testo contiene `EFFETTUATO A FAVORE DI`,
  `NUOVA SOTTOSCRIZIONE`, `ADDEBITO`; positivo con `RICEVUTO DA`, `ACCREDITO`, `RIMBORSO`,
  `DISINVESTIMENTO`, `LIQUIDAZIONE`; altrimenti positivo con anomalia in `inputIssue`.
- **Tipi**: uscita "effettuato a favore di <titolare>" con causale GIROCONTO → Giroconto uscita;
  bonifico negativo a terzi → `counterparty` = Controparte, tipo da decidere.
- **Conto deposito**: il rientro (`ACCREDITO CAPITALE INVESTITO` + `INTERESSI`, categoria CONTI
  DEPOSITO) diventa due quote in `splits`: capitale → Giroconto entrata ("Tinaba Conto deposito"),
  interessi → Entrata `inc.financial_income`, se 0 ≤ interessi ≤ 20% del capitale. Capitale =
  sottoscrizioni con data precedente nello stesso file meno il capitale già rientrato (la v3.10
  sommava le sottoscrizioni pre-2026). Se non ricostruibile → anomalia "da verificare".

## Poste Italiane (`.xlsx`)

- **Intestazione**: nelle prime 30 righe, celle uguali a `DATA VALUTA` e `DATA CONTABILE` e una
  che contiene `IMPORTO`. Colonne Descrizione e Importo (euro)/Importo.
- **Date**: come nella v3.10 `date` = Data valuta (o Data contabile se manca) e `valueDate` =
  Data contabile: semantica invertita rispetto a Sella/Hype, mantenuta perché `date` entra nella
  firma. Entrambe anche in `raw.__POSTE_DATA_VALUTA/__POSTE_DATA_CONTABILE`.
- **Tipi**: uscita `PRELIEVO CONTANTI ATM` → Giroconto uscita verso **Cassa**; il resto senza tipo.
- **Esclusi**: righe senza nessuna delle due date (contate). Nessun codice: doppioni per firma.

## Hype (`.csv`, a volte con estensione `.xls`)

- **Colonne**: Data operazione → `date`; Data contabile → `valueDate`; Iban; Tipologia →
  `sourceType`; Nome → `sourceCategory`; Descrizione (o Nome); prima colonna che contiene IMPORTO.
- **ID**: `HYPE-` + fnv(data, contabile, iban, tipologia, nome, descrizione, importo, n° occorrenza):
  due movimenti identici hanno ID diversi (`raw.__HYPE_OCCURRENCE`).
- **Tipi**: Nome = titolare con Tipologia GIROCONTO/BONIFICO → Giroconto entrata/uscita per segno;
  RICARICA CARTA o "Ricarica Hype" positiva → Giroconto entrata; PRELIEVO negativo → Giroconto
  uscita verso Cassa; COMMISSIONE → Uscita (`exp.other`, o servizi finanziari se la descrizione dice
  COMMISSIONE); BOLLO → Uscita `exp.taxes`; PAGAMENTO negativo → Uscita; altre entrate → Entrata.

## Trade Republic (`.csv`)

- **Colonne obbligatorie**: datetime, date, category, type, amount, fee, tax, currency,
  description, transaction_id; facoltative asset_class, name.
- **Importo** = netto di cassa: amount + fee + tax (già con segno, arrotondato a 1e-6); lordo,
  commissione, imposta e netto in `raw.__TR_*`. `sourceCategory` = "category · asset_class".
- **Tipi**: TRANSFER_INBOUND/TRANSFER_INSTANT_INBOUND → Giroconto entrata da abbinare; BUY →
  `invest_buy`, SELL → `invest_sell` (controparte = name, nessuna categoria); DIVIDEND → Entrata
  `inc.financial_income` (controparte = name); INTEREST_PAYMENT → Entrata `inc.financial_income`
  (controparte Trade Republic); TAX_OPTIMIZATION → Uscita `exp.taxes` (positivo = storno);
  altri tipi → da classificare (contati nelle note).
- **ID**: transaction_id; senza id vale la firma.

## Easy Bank (`.xlsx`)

- **Intestazione**: nelle prime 35 righe, celle uguali a DATA, OPERAZIONE, DETTAGLI, CONTO O CARTA
  e una che contiene IMPORTO; servono anche CATEGORIA e VALUTA.
- **Colonne**: Data → `date`; Operazione → `description`; Dettagli → `sourceCategory`;
  Categoria → `sourceType`; Valuta; Importo.
- **ID**: `EASY-<codice>` se i dettagli contengono `COD. DISP.`, altrimenti `EASY-` + fnv(riga +
  occorrenza) (`raw.__EASY_OCCURRENCE`).
- **Tipi**: bonifico in entrata con il nome del titolare nei dettagli → Giroconto entrata (da Hype
  se i dettagli contengono GIROCONTO e il BIC HYEEIT22); COSTO CARTA → Uscita servizi finanziari;
  BETFAIR/SISAL/SCOMMESSE → Uscita senza categoria (wallet differito se la descrizione cita
  Betfair/Sisal); altrimenti Uscita/Entrata per segno.

## Limiti noti

- `parseBankAmount("(1.234,56)")` restituisce +1234,56 (correzione migliaia della v3.10 che perde
  il segno delle parentesi): mantenuto perché l'importo entra nella firma.
- `num()` restituisce 0 per testo non numerico; `dateOnly` restituisce i primi 10 caratteri dei
  formati sconosciuti (es. "31.01.2026"): queste righe finiscono escluse o "da controllare".
- Rispetto alla v3.10 non sono portate: le due regole legate a casi personali del titolare del
  piano v3.8.2 e il riferimento a un singolo esercente (resta il pattern generico "BARBER"); la
  cancellazione delle categorie al primo salvataggio (bug v3.10: es. "Tasse / F24" e i dividendi
  Trade Republic perdevano la categoria).
- Le regole dell'utente non sono applicate qui: l'app le applica dopo l'import.
