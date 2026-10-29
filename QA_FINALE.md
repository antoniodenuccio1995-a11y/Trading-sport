# QA finale TA-INT-004 — candidata consolidata 29/10/2026

**Esito: PASS, zero FAIL bloccanti. Disponibile per un unico nuovo AUDIT; non approvata come stabile.**

- Commit della candidata: `bf2f0cc8558fa30ddecf1d969c1d84fba3a2da4a`.
- ZIP effettivamente verificato: [scarica](https://github.com/antoniodenuccio1995-a11y/Trading-sport/archive/bf2f0cc8558fa30ddecf1d969c1d84fba3a2da4a.zip).
- ZIP SHA-256: `2aa88d6d34dd43678e3c6ee1408c28694992cad6f9a2bb85588d8ff739f95950`.
- Tutti i 680 file dello ZIP coincidono byte per byte con quel commit. L'app estratta è stata avviata via HTTP.
- Intero ciclo eseguito di nuovo da copia Git pulita dello stesso commit, verificata contro lo ZIP: nessun sorgente applicativo o test modificato durante la prova.
- Run: 2026-10-29T09:24:04.960113+00:00 → 2026-10-29T09:37:33.757158+00:00.
- Ambiente: Chromium 154.0.8037.57 built on Debian GNU/Linux 13 (trixie) / Linux; Node v24.19.0; Python 3.12.14; HTTP locale, profili isolati.

Questo ramo contiene soltanto le **evidenze finali**, non un'altra candidata. I rapporti di sviluppo/preflight presenti nel commit del codice non vengono riciclati come prova del ciclo finale. Qui sono conservate le nuove ricevute, tutti i log, screenshot e manifest esatto dei sorgenti.

## Gate e comandi

| Suite | Esito | Secondi |
|---|---|---:|
| all-unit | PASS | 1.227 |
| identity-unit | PASS | 0.724 |
| csv-current | PASS | 0.433 |
| all-public-packets | PASS | 10.78 |
| protected-files | PASS | 1.485 |
| archive-browser | PASS | 17.606 |
| audited-input | PASS | 3.223 |
| public-browser | PASS | 28.67 |
| consultation | PASS | 4.634 |
| backtest-contract | PASS | 5.102 |
| today-backtest | PASS | 7.464 |
| operational-browser | PASS | 21.729 |
| reimport-e2e | PASS | 744.095 |
| original-recovery | PASS | 55.386 |
| original-values | PASS | 4.43 |
| recovered-values | PASS | 4.123 |
| final-readiness | PASS | 0.621 |

## Risultati attesi e osservati

| Caso | Atteso | Osservato | Stato |
|---|---|---|---|
| Sintetico calendario 15:30 / risultato 14:30 | Un incontro, reimport sicuro | Un incontro; tre reimport browser e reimport export sicuri | PASS |
| Backup recuperato rc4 | 28.402 input, recupero 28.300 e riimportazioni invarianti | 28.300; tre sorgente + una export, zero nuovi conflitti | PASS |
| Backup originale | 28.544 input, 28.302 righe conservative | 28.302; quattro osservazioni irrisolte conservate; reimport no-op | PASS |
| Quote originali | 172.964 valori conservati | 172964, zero errori | PASS |
| Quote backup recuperato | 172.964 valori conservati | 172964, zero errori | PASS |
| Manuali | Due payload e dati originali conservati | Due in entrambi i file; 6 / 14 campi di dominio verificati oltre a nomi e ID | PASS |
| Undo | Stato precedente identico, incluso profilo inizialmente vuoto | Entrambi i casi verificati per tutti e tre i dataset | PASS |
| Nuove discordie di orario/quote/FT | Blocco senza alterare l'archivio | Asserzioni pure e nuovo conflitto nel browser | PASS |
| Backtest di oggi | UTC/offset futuri inclusi; passato/assente/senza fuso esclusi | Quattro fixture attese ed effettive, incluse domani/manuale | PASS |
| Scanner | Stesso filtro prudenziale | Quattro gare ammissibili | PASS |
| Preset e mercati | Sei preset, otto mercati, numeri indipendenti | 144 confronti; 158 HT / 98 Over1.5 / 51 Over2.5 preservati | PASS |
| Ricerca/CSV | Ricerca/pagine e export completo | CSV conserva tutto il campione anche con ricerca attiva | PASS |
| Fasi e identità | Vere gare finali e replay conservati | Championship 557/552; Serie A 381/380; replay FA Cup reale e provider distinti | PASS |
| Pacchetti | 109 non vuoti, 29 senza record utilizzabili | 35.974 record verificati, reimport invariato | PASS |
| Modelli, classifiche, trade | Nessuna modifica protetta | 314 file rc4 preservati; HTML esattamente c6d9aa4, codice trade invariato | PASS |
| Browser | Zero pageerror e console error | Zero nei profili di prova | PASS |
| Originali privati | Byte invariati | SHA-256 prima/dopo invariati; nessuna riga privata pubblicata | PASS |

Il primo preflight aveva rilevato un errore nel verificatore delle manuali già recuperate: cercava un secondo annidamento del record rc4 in `LegacyManualOriginal`. La foglia originale era già conservata; i soli cambiamenti erano nomi/ID normalizzati, stato e versione del registro. Il verificatore ora controlla tutti i campi di dominio, la foglia immutabile, i nomi sorgente e gli ID legacy. Non è stato modificato alcun backup per rendere verde il test. Dopo la correzione è stato rifatto **tutto** questo ciclo sul commit definitivo.

## Limiti dichiarati

- **NON ESEGUITO:** Windows nativo e `file://`. Il collaudo della DIREZIONE e il nuovo AUDIT rimangono necessari.
- **NON ESEGUITO:** aggiornamento live delle fonti. La suite usa input pubblici congelati e copie private isolate; gli aggiornamenti automatici sono posticipati soltanto nei profili di test mediante i timestamp di cache già previsti dall'app. CSS remoto dei font vuoto, moduli locali reali. Gli errori di console non sono filtrati.
- Registro trade verificato con fixture sintetica; nessun registro personale reale fornito.
- Le quattro osservazioni originali irrisolte rimangono nei dati e fuori dal campione automatico. Non vengono dichiarate sanate.
- Matrici distinte: pacchetti pubblici 17/92/29; precedente proposta privata rivalutata 14/95/29; originale 11/98/29. Il fix non completa le stagioni parziali e non è un aggiornamento live.
- Nessun merge su main, nessun deploy stabile. `readyForStableRelease=false`.

## Comandi eseguiti e checksum dei log

I percorsi degli input privati sono espressi tramite variabili; i checksum degli input e i confronti aggregati sono nelle ricevute. Nessun file o record personale è incluso.

### all-unit

```sh
node --test --test-reporter=tap tests/csv-import.test.cjs tests/data002/core.test.cjs tests/data002b/recovery.test.cjs tests/stab003/core.test.cjs tests/int004/identity.test.cjs
```

Exit 0; log SHA-256 `58961ba0be7e253d91f84f842ced7e86aa0edbebd4301e5a4c1c0a57c8d7719d`.

### identity-unit

```sh
node --test --test-reporter=tap tests/int004/identity.test.cjs
```

Exit 0; log SHA-256 `7d3651710f0157b1176a29504234b134668f72a9eb91398338f98103fd969bf6`.

### csv-current

```sh
node -r ./tests/int004/load-rc5.cjs --test --test-reporter=tap tests/csv-import.test.cjs
```

Exit 0; log SHA-256 `671aefbb96fdb4bdd16a21666f9f324e8b0a0c7eaaf63585b265b6de34b01696`.

### all-public-packets

```sh
node tests/int004/packet-contract.cjs
```

Exit 0; log SHA-256 `b4ecffad2395ba73ceda8ae8f46c6983d9f274bd90cf10ec65b0edbeea06cca7`.

### protected-files

```sh
python tests/int004/preservation.py
```

Exit 0; log SHA-256 `7cde11be486e0d88f8e67238ccfb11b26ba068915bf5bf76ad30400be279d166`.

### archive-browser

```sh
python tests/int004/browser.py
```

Exit 0; log SHA-256 `670e4ca86374e3f09b108c32e2fa51412686ea231a409601e9511eed1ed3b213`.

### audited-input

```sh
python tests/int004/operational-input-reproduction.py --operational-root "$OPERATIONAL_ROOT"
```

Exit 0; log SHA-256 `91af04016e78ec568dda926e90ec09c4e4c7b5a83ac4a94443b1514b27a1a598`.

### public-browser

```sh
python tests/int004/public-browser.py
```

Exit 0; log SHA-256 `ba1a062154f3a811de9607ca7407f66da7a50bf24a491a0b46c7542998be12e7`.

### consultation

```sh
python tests/int004/consultation-browser.py
```

Exit 0; log SHA-256 `32847f7fbf858c1e0a88c92b7632cb6a70f8b689b31ef4671d85417be5729489`.

### backtest-contract

```sh
python tests/int004/backtest-contract.py
```

Exit 0; log SHA-256 `8cb57f47028be6571c950a67856428e9b21d33445089931f59f7131a6f55b675`.

### today-backtest

```sh
python tests/int004/today-backtest-browser.py
```

Exit 0; log SHA-256 `e17a7b6c6290a63fc3bf9cdf55306a0b1d86039c3bb61f2e07d0eeb92b309421`.

### operational-browser

```sh
python tests/int004/operational-browser.py
```

Exit 0; log SHA-256 `783fcc50bd637daf4625ccc85536414680e7119cb513f0881059af94201d8021`.

### reimport-e2e

```sh
python tests/int004/reimport-browser.py --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" --private-output "$PRIVATE_OUTPUT"
```

Exit 0; log SHA-256 `10c978d99d208e08f7d25e6fec78da94f877f7addecf00ebd861a55954de5844`.

### original-recovery

```sh
python tests/int004/private-backup.py --backup "$ORIGINAL_BACKUP" --private-output "$PRIVATE_OUTPUT"
```

Exit 0; log SHA-256 `41c5e5d894e816f890e03b182ef32cd2b1e1463652a073d499381ba0c6ec2590`.

### original-values

```sh
node tests/int004/verify-private.cjs "$ORIGINAL_BACKUP" "$PRIVATE_OUTPUT/original-first.json" "$PRIVATE_OUTPUT" private-integrity
```

Exit 0; log SHA-256 `160e765775d9a7c0456cab791f7ef11dccc3ff038ccc02d5ae7a9db6e36f6d49`.

### recovered-values

```sh
node tests/int004/verify-private.cjs "$REAL_BACKUP" "$PRIVATE_OUTPUT/rc4Recovered-first.json" "$PRIVATE_OUTPUT" private-recovered-integrity
```

Exit 0; log SHA-256 `d6becd18f3c6fd51c632179b700f65fa7ddcefdfcafbb5abe45577d44c22f2f0`.

### final-readiness

```sh
node tests/int004/check-readiness.cjs --evidence-out "$RUN_DIR/readiness.json"
```

Exit 0; log SHA-256 `d5390523fc0b6cde4755bf35c1567f18b60d0c27552608382274566a90c9e48e`.
