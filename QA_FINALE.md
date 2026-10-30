# Intervento limitato ai tre FAIL indipendenti

Letti README, rapporto integrale ed evidenze nel ramo `audit/v02v-240f747-20261030`, commit `30fddfa99b6c78acd5f38c94c41f67352fde6420`. Nessuna nuova funzionalità o correzione UX inclusa. Il precedente esito AUDIT FAIL rimane una prova storica valida; questo rapporto registra il retest Codex e richiede un nuovo AUDIT indipendente.

| Caso | Prima della correzione | Retest sul commit finale |
|---|---|---|
| IND-01 H2H | 3 FT invece di 5 | PASS: 5/6/6 per limiti 5/10/tutto; FT prima del limite, HT assenti e AET/rigori |
| IND-02 giorno osservativo | ieri escluso a 00:30 Roma | PASS: 15 prove browser, tre fusi, inverno/estate/DST/fine anno, ieri incluso e oggi/futuro esclusi |
| IND-03 ufficialità | coppa sconosciuta inclusa dal nome | PASS: ufficiali n=1; sconosciuta consultabile singolarmente n=1; registro/flag espliciti |

Backup reale: **5358 coppie, 16074 confronti H2H 5/10/tutto, 14 coppie esposte al vecchio difetto, zero discrepanze** contro filtro FT indipendente. Nessuna coppia personale pubblicata.

Le riproduzioni prima della correzione sono in `audit/`: FAIL attesi sulla vecchia candidata, distinti dal gate finale. Il riproduttore Node originale è identico byte per byte e ora termina con exit 0. Le prove browser corrette sono in `v02v/audit-browser.json` e nei tre screenshot `audit-*-fixed.png`.

HTML v0.2V e CSS invariati. Tutti i 577 file non-QA rc5 preservati; il controllo aggiuntivo protegge anche i file della candidata precedente salvo due moduli e test autorizzati. Documentazione tecnica: `docs/v02v/CORREZIONI_AUDIT_2026-10-30.md` nella candidata.

**Le ulteriori richieste grafiche, responsive, startup, Scanner e aggiornamento incrementale dei commenti DIREZIONE non fanno parte di questo intervento, come richiesto nell’ultima istruzione. Non vengono dichiarate risolte o approvate.**

# QA finale — correzione dei tre difetti AUDIT v0.2V

**Commit candidato verificato: `43b92dfc21112a1df7f20dc6f56f6add8042219a`.**
Baseline rc5 `bf2f0cc8558fa30ddecf1d969c1d84fba3a2da4a`; correzione della candidata `240f747d9891e4754945be66096cbda67e1a05fd`; ramo `feature/ta-v02v-match-center`. Candidata pronta per AUDIT indipendente, non approvata stabile.

- [ZIP completo verificato](https://github.com/antoniodenuccio1995-a11y/Trading-sport/archive/43b92dfc21112a1df7f20dc6f56f6add8042219a.zip)
- SHA-256 ZIP: `f8ba9a8c842deadad3d86baea138084cdff17d15ecc22187da4b7673ae4bc6ac`
- Dimensione: 7,425,120 byte; 701 file identici byte per byte al commit Git.
- Avvio: `Trading_Analytics_v0.2V-rc1_TA-V02V-001.html`, **intera cartella estratta**, via HTTP. [Istruzioni Windows](https://github.com/antoniodenuccio1995-a11y/Trading-sport/blob/43b92dfc21112a1df7f20dc6f56f6add8042219a/LEGGIMI_v0.2V.md).

Gate iniziato: 2026-10-30T10:38:46.113267+01:00; concluso: 2026-10-30T10:54:03.137582+01:00 (Europe/Rome). **17 gruppi esterni PASS, zero FAIL bloccanti**; il gruppo di regressione rc5 contiene ulteriori **17** controlli consolidati. Nessun sorgente modificato dopo il run.

## Matrice funzionale

| Verifica | Esito e prova |
|---|---|
| Dashboard e navigazione | PASS: quattro destinazioni reali, ricerca club/alias/Paese/competizione/gara, ripresa partita e Comparatore |
| Calendario | PASS: filtri composti, 50 righe/pagina, ordine, CSV completo, apertura stessa identità canonica |
| Persistenza UI | PASS: watchlist, filtri, pin/riordino Paesi e cartella Internazionali, reload |
| Avvio | PASS: nessun dato demo, richiesta remota automatica, scrittura matches o confronto integrale copertura; copertura calcolata su apertura esplicita |
| CMP01–12 | PASS: tutti i 12 casi, con clic browser e confronto numerico fra le due viste |
| Oracolo indipendente | PASS: Python legge le colonne pubbliche I1_2024; partite, V/P/S, GF/GA e HT confrontati al motore JS |
| Motore nuovo | PASS: 21 test unitari, inclusi campioni mancanti, HT zero/assente, neutralità, alias, riposo e no leakage |
| Segnali | PASS: diagnosi baseline e confronto temporale 2024/25 → 2025/26; 760 gare per periodo, otto mercati, falsi positivi/negativi sintetici e conteggi storici espliciti |
| Gare future | PASS: profili, H2H e segnali nuovi escludono risultati datati dopo oggi, anche se già presenti nel file; giorno della gara escluso |
| Mercati e preset rc5 | PASS sulla nuova pagina e baseline: otto mercati, sei preset, 144 confronti indipendenti, payoff e commissioni, ricerca e CSV |
| Backtest e Scanner oggi | PASS: clock UTC/offset verificato, orario assente/malformato/senza fuso, passato/oggi/domani; funzione condivisa rc5 preservata |
| Archivio reale | PASS: entrambi i backup, tre reimportazioni ciascuno più il nuovo export, conferma/reload/export e Undo |
| Valori originali | PASS: 28544 righe → 28302; tutte contabilizzate, 172964 valori quote, 2 payload manuali conservati |
| Backup recuperato rc4 | PASS: 28402 → 28300; tutte le righe contabilizzate, quote/manuali integri |
| Concorrenza | PASS: chiave IDB realmente assente gestita senza scrittura iniziale; writer concorrente continua a bloccare conferma obsoleta |
| Alias e dedup | PASS: identità, provenienze, conflitti nuovi bloccati, proiezione non mutante e riconciliazione esplicita con backup/Undo |
| Storico e classifiche | PASS: playoff Championship, playout Serie A e ripetizione vera FA Cup; nessun risultato successivo alla data storica studiata |
| CSV e pacchetti | PASS: tutti i 109 pacchetti pubblici non vuoti, 29 privi di record importabili distinti; parser e import/reimport rc5 |
| Diario trade | PASS: backup/import/export sintetico, voti/quote/eventi congelati e Undo archivio senza modificare il diario |
| File protetti | PASS: tutti i 577 file non-QA della rc5 invariati; differenze del nuovo HTML limitate alla whitelist di avvio/inclusione dei moduli |
| Console / pageerror | PASS: zero errori in tutte le suite browser bloccanti |
| ZIP consegnato | PASS: tutti i file del commit identici e avvio reale HTTP dell’estrazione |

## Prestazioni con backup reale

| Operazione | Secondi | Budget bloccante |
|---|---:|---:|
| Importazione esplicita reale | 19.496 | informativo |
| Riavvio Dashboard 28.300 gare | 9.601 | 30 |
| Calendario e filtro alias | 0.993 | 10 |
| Aggiornamento Comparatore | 0.064 | 10 |

## Evidenze ispezionabili

Requisiti: [mandato esecutivo #5](https://github.com/antoniodenuccio1995-a11y/Trading-sport/issues/5). Riproduzione Linux: Node.js, Python con Playwright e Chromium in `/usr/bin/chromium`; comando completo e dipendenze operative nel piano/metodo del pacchetto. I backup privati necessari non sono pubblici.

- [Ricevuta finale e manifest di tutti i sorgenti](readiness.json).
- [Gruppi di log nuovi](logs/) e [run completo rc5](rc5/consolidated-run.json).
- [Ricevute/screenshot v0.2V](v02v/) e [ricevute rc5](rc5/receipts/).
- [Confronto neutralità completo](v02v/neutrality.json).
- [Cicli backup reali](v02v/v02v-reimport-browser.json), [integrità originale](v02v/private-integrity.json), [integrità recuperato](v02v/private-recovered-integrity.json).
- [Verifica ZIP](delivery.json); `SHA256SUMS` firma tutti gli artefatti di questa cartella.

Gli screenshot usano esclusivamente dati pubblici e sintetici di QA. Nessun backup, export personale, riga privata o schermata dell’archivio personale è pubblicato. I log dettagliati degli input privati restano nell’ambiente isolato; le ricevute pubbliche contengono solo aggregati e checksum.

## Interpretazione del confronto storico

Il nuovo livello non cambia i voti o le formule. Le evidenze sono descrittive, non previsioni calibrate. Sul holdout Over 2.5: 9 eventi su 18 evidenze favorevoli mostrate, contro 23/42 nella baseline; nessuna superiorità o redditività dichiarata. Si mostrano anche campioni contrari, scarsi o discordanti e sono possibili zero segnali. I risultati completi per gli otto mercati includono eventi non selezionati e non-occorrenze fra le selezioni.

## Limiti e NON ESEGUITO

- **Windows nativo, `file://`, aggiornamenti live delle fonti: NON ESEGUITO.** Ambiente Chromium/Linux via HTTP; non sono prove Windows. Sono fornite istruzioni operative per AUDIT.
- Il registro trade personale non è stato fornito; regressione su dati sintetici e preservazione byte per byte del codice precedente.
- La completezza degli storici resta separata dal recupero dei backup. Le stagioni parziali/non verificabili non diventano complete; quattro osservazioni originali irrisolte restano conservate ed escluse dai campioni automatici.
- Il Comparatore riporta sempre denominatori e stato di copertura del campione; il prospetto completo verificabile resta in Area tecnica. HT mancante non significa incontro mancante.
- Posizione nuova ricostruita per punti, pari punti a pari posizione; spareggi ufficiali non pretesi né classifiche rc5 modificate.
- Coppe: preparazione tecnica su metadati effettivi, sedi/fasi/andata-ritorno e scopo del risultato; confronto coppe completo e grafici posizionali rimangono P1/futura v0.2W.

**Nessun merge su main, nessun deploy e nessuna approvazione stabile.** PR distinta in bozza; PR #4 rimane invariata. Dopo questo gate non viene modificato il codice della candidata.
