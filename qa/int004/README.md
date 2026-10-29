# Evidenze TA-INT-004

I file qui presenti sono prove di sviluppo e input congelati. Le ricevute storiche o di preflight non sostituiscono il ciclo finale.

La consegna consolidata del 29 ottobre è attestata dal **report exact-commit e dal gate finale** pubblicati come evidenze immutabili nella PR #4: contengono SHA della candidata, checksum dello ZIP, tutti i comandi e log freschi. Il ramo di sole evidenze non contiene un’altra candidata o archivi personali.

`tests/int004/run-consolidated-qa.py --require-clean` genera le nuove ricevute e il manifest da una copia pulita. `tests/int004/check-readiness.cjs` rifiuta ricevute mancanti, FAIL, working tree non identificato come commit esatto o sorgenti non coincidenti. La ricevuta finale è conservata fuori dal commit testato per poter includere il suo SHA senza modificarlo dopo la prova.

Il vecchio preflight, compreso un controllo manuale corretto prima della build finale, rimane in `history/` e non costituisce PASS di consegna.
