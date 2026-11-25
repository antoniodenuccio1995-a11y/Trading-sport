# Scheda investimento DiSalento

Generatore della scheda di 2 pagine A4 da proporre all'investitore (caso d'esempio: Casa Ruggiano).

- **Strumento pubblicato:** https://claude.ai/artifact/TMGgnVNhbhrXBM3uCiTr9T
- **Sorgente:** [`index.html`](index.html). È il corpo della pagina: la pubblicazione come artifact aggiunge `<!doctype html>`, `<head>` e `<body>`.
- **Versione precedente:** [`versione-1.html`](versione-1.html), conservata invariata.

## Cosa fa

- Scheda in due pagine: foto, titolo e dati in evidenza; i conti dell'operazione (rivendita prevista, capitale, costi, utile); il riquadro dell'investitore (quanto versa, quanto riceve, guadagno, rendimento, pareggio); il dettaglio dei conti, la divisione del ricavato, gli scenari, le foto e i contatti.
- Moduli: ogni blocco si accende o si spegne, si sposta su o giù, cambia pagina e occupa mezza riga o la riga intera.
- Immagini: copertina, 3 foto per pagina 2 (per esempio stato attuale, progetto, planimetria) e logo. Si scelgono dal telefono, si trascinano o si incollano; vengono ridotte in automatico.
- Download: PDF, Excel con formule vive, dati (.json) e "Tutto (.zip)" con PDF, Excel, dati e foto.
- Su telefono: schede "Modifica" e "Anteprima", riepilogo dei numeri sempre visibile, anteprima ingrandibile.
- Controlli automatici: pagina troppo piena, foto mancante, m² mancanti, nessuna riserva imprevisti, margine di sicurezza basso, referente mancante.

Tutti i valori sono al lordo delle imposte.

## Calcoli

- prezzo = somma della composizione (m² × €/m², oppure importo a corpo)
- costi di vendita = costi fissi + prezzo × somma delle percentuali
- utile = prezzo − capitale − costi di vendita
- quota investitore = utile × quota %; rientro = capitale + quota investitore
- pareggio = (capitale + costi fissi) / (1 − percentuali / 100)
