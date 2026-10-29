# Diagnosi neutralità e verifica cronologica

Misurazione prima della consegna sui CSV pubblici congelati Serie A / La Liga. Reviewer rc5 eseguito direttamente dal suo codice originale; nessuna riscrittura delle soglie baseline. Il gate del commit finale ripete da zero questa misura e pubblica la ricevuta JSON completa.

## Diagnosi della baseline

Minimo 8 incontri storici per lato, 5 stagionali e 30 di lega; scarti di 7/12 punti percentuali, spread fino a 35. Storico e stagione discordanti diventano mixed. Eventi frequenti in entrambi i lati possono comunque diventare neutral nella sintesi, perché frequenza alta non significa scarto dalla lega. Con sola stagione e storico insufficiente la headline è mixed. Un HT assente viene escluso dal denominatore.

2024/25: periodo di diagnosi dichiarato; 2025/26: periodo cronologico distinto tenuto separato. Regole descrittive fissate a priori, nessuna ricerca di soglie sul holdout.

## Livello separato v0.2V

Almeno 8 osservazioni valide per lato (ultime 20 dell’effettivo contesto) e 30 della competizione. Lega: corrente e tre stagioni precedenti. Scarti concordi di almeno ±10 punti percentuali: evidenza favorevole/contraria. Altrimenti contrastante o insufficiente. Si mostrano al massimo 3 evidenze per ampiezza minima dello scarto; nessuna se non giustificata. Ultime 5 per lato mostrate anche come possibile fattore contrario. Nessun voto 0–100 modificato; nessuna quota, EV o profitto presunto.

## Holdout 2025/26 — 760 gare / due leghe

| Mercato | Baseline positivo / negativo / neutro / misto / insuff. | v0.2V favorevole / contraria / contrastante / insuff. | Evidenze favorevoli mostrate: eventi / n | Baseline positiva: eventi / n |
|---|---|---|---|---|
| o15 | 42 / 31 / 365 / 302 / 20 | 34 / 18 / 661 / 47 | 27 / 33 | 34 / 42 |
| o25 | 42 / 35 / 291 / 372 / 20 | 19 / 35 / 659 / 47 | 9 / 18 | 23 / 42 |
| u25 | 35 / 42 / 291 / 372 / 20 | 35 / 19 / 659 / 47 | 14 / 33 | 17 / 35 |
| btts | 44 / 23 / 312 / 361 / 20 | 25 / 31 / 657 / 47 | 13 / 24 | 19 / 44 |
| ht | 24 / 21 / 338 / 357 / 20 | 31 / 20 / 662 / 47 | 18 / 26 | 16 / 24 |
| draw | 11 / 20 / 375 / 334 / 20 | 19 / 21 / 673 / 47 | 4 / 17 | 2 / 11 |
| home | 98 / 106 / 176 / 360 / 20 | 36 / 97 / 580 / 47 | 23 / 36 | 67 / 98 |
| away | 77 / 121 / 185 / 357 / 20 | 71 / 70 / 572 / 47 | 36 / 70 | 39 / 77 |

Gli eventi verificatisi o mancati dopo una lettura favorevole sono contati nella ricevuta, come pure gli eventi rimasti fuori dalla selezione: non sono una misura di profitto né una probabilità calibrata. La selezione top-3 v0.2V è più restrittiva; non si dichiara maggiore precisione o miglioramento economico rispetto alla baseline. In particolare Over 2.5 mostra 9 eventi su 18 selezioni, contro 23 su 42 della baseline. Non si aumentano artificialmente i consigli positivi per ridurre la neutralità.

## Fonti e riproduzione

`node tests/v02v/neutrality.cjs` produce distribuzioni per mercato per entrambi i periodi, conteggi degli eventi non selezionati e delle non-occorrenze tra le selezioni. Il confronto usa sempre e solo risultati di giorni precedenti alla gara, senza usare il risultato verificato come input.
- `histories/stab003/I1_2021.json` — SHA-256 `2b93e1b6bfe6ca57747fdcf36a7cc8b976d4a5e00ba6d53505a0b4ec82d81de5`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/I1_2022.json` — SHA-256 `fc5459f71dbe05b6b4d27779a98c8565924365837756ee789680595801860c8a`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/I1_2023.json` — SHA-256 `7cbce434b0fe63153ee8f5f21009587002cc8bb1f3561c43aab63c1936b5dcda`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/I1_2024.json` — SHA-256 `642d5aa408f20ebafa13fe51374a22cbe2e6967495d26b2149bc928d3ea5bac3`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/I1_2025.json` — SHA-256 `7ab334f3485ff9025fada307fabf9851cb706b5a0b25629e563ce629f79a0444`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/SP1_2021.json` — SHA-256 `ee4a91dbaf58c85d96e614a1e7fe7251ac473558846778385df569dec653985d`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/SP1_2022.json` — SHA-256 `4e299651c13ac569ee8c43477e33dd0185c84bc97eab6239e2db1bbce57bd388`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/SP1_2023.json` — SHA-256 `fdfd058c0d4bcaedc922dc1daea829a3487ebf5a553896d752cb07312bccef7d`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/SP1_2024.json` — SHA-256 `cfaa05525d0bb8d52eaef7adb1c874ceb12a239cf722e094aeb6d78d44ee2a74`; provenienza Football-Data dichiarata nei record pubblici.
- `histories/stab003/SP1_2025.json` — SHA-256 `3c8dcc8c7b31a56e5a0cef3751c5fd38c40f9806f83953075fd6c026f7c9d849`; provenienza Football-Data dichiarata nei record pubblici.
