# Partecipazione digitale di Antonio e Giulia

Pagina statica (nessuna compilazione): busta avorio con fiocco rosa che si apre, cartoncino che si dispiega, conferma su WhatsApp, IBAN da copiare, data da salvare nel calendario.

- **Link:** https://antoniodenuccio1995-a11y.github.io/Trading-sport/matrimonio/ (si pubblica insieme all'app a ogni modifica su `main`).
- **Link personalizzato:** aggiungendo `?per=` il nome compare scritto sulla busta e nel modulo di conferma, per esempio
  `https://antoniodenuccio1995-a11y.github.io/Trading-sport/matrimonio/?per=Famiglia%20Rossi` (gli spazi diventano `%20`).
- **Anteprima su WhatsApp:** titolo, descrizione e immagine (`img/anteprima.jpg`) sono nei tag `og:` in testa a `index.html`. WhatsApp tiene in memoria l'anteprima di un link: se la cambiate, controllatela su un link nuovo (per esempio con `?v=2`).
- **La pagina non va sui motori di ricerca** (`noindex`), ma chiunque abbia il link può vederla: dentro ci sono telefoni e IBAN.

## File

| File | Contenuto |
| --- | --- |
| `index.html` | Testi dell'invito, busta, fiocco (SVG) e disegni del monogramma e del rametto (simboli SVG in cima al `body`) |
| `stile.css` | Carta, colori, caratteri, tempi delle animazioni |
| `invito.js` | Apertura della busta, bordi sfrangiati, conferma su WhatsApp (numeri in `DATI`), copia IBAN, giorni che mancano |
| `matrimonio.ics` | Evento per il calendario del telefono |
| `font/` | Alex Brush (nomi) e Libre Baskerville (testi), licenza SIL OFL |
| `img/` | Legno del tavolo, anteprima per WhatsApp, icona |

## Da completare

- IBAN vero (ora `IT00 X 0000 0000 0000 0000 000`, come sulla bozza stampata): in `index.html`, elemento `#iban`.
- Ora di fine della festa: il calendario ora segna dalle 10:00 alle 18:00 (in `index.html`, link Google Calendar, e in `matrimonio.ics`).
