# Partecipazione digitale di Antonio e Giulia

Pagina statica (nessuna compilazione) in avorio e bianco, col rosa solo nel nastro e nei fiori, come la partecipazione stampata. Animazioni con [GSAP](https://gsap.com) 3.13 e ScrollTrigger, copiati in `vendor/` (licenza standard gratuita di GSAP).

1. **Invito chiuso:** due ante in carta goffrata con i nomi nella ghirlanda, chiuse da un fiocco di chiffon rosa.
2. **Al tocco del fiocco:** il fiocco viene tirato e scivola via, il nastro si apre, le ante si aprono verso chi guarda, parte la musica (se c'è il file), i fiori entrano dagli angoli e **Antonio & Giulia si scrivono a mano**.
3. **Scorrendo:** il cartoncino a punta si dispiega seguendo il dito, i titoli in corsivo si scrivono, le foto "Noi due" si posano in un collage a due colonne e si sviluppano come polaroid, i biglietti di conferma e "Salva la data" si appoggiano, il conto alla rovescia sale, in fondo la firma si scrive di nuovo.

La scrittura a mano usa i contorni del carattere Alex Brush e, come maschera, le linee centrali dei tratti (calcolate una volta sola dalle lettere): ogni tratto si disegna nell'ordine in cui lo farebbe una penna.

- **Link:** https://antoniodenuccio1995-a11y.github.io/Trading-sport/matrimonio/ (si pubblica insieme all'app a ogni modifica su `main`).
- **Link personalizzato:** con `?per=` il nome compare sulle ante e nel modulo di conferma, per esempio
  `https://antoniodenuccio1995-a11y.github.io/Trading-sport/matrimonio/?per=Famiglia%20Rossi` (gli spazi diventano `%20`).
- **Anteprima su WhatsApp:** titolo, descrizione e immagine (`img/anteprima.jpg`) sono nei tag `og:` in testa a `index.html`. WhatsApp tiene in memoria l'anteprima di un link: se la cambiate, controllatela su un link nuovo (per esempio con `?v=2`).
- **Riservatezza:** la pagina non va sui motori di ricerca (`noindex`), ma chiunque abbia il link la vede, compresi telefoni, IBAN e foto.

## Conferme

Le risposte del modulo finiscono nel database Supabase del progetto (lo stesso dell'app, tabelle `nozze_*`, migrazione `supabase/migrations/20261122120000_nozze_conferme.sql`).

- Gli invitati possono solo **scrivere** una risposta (funzione `nozze_conferma`), non leggere quelle degli altri.
- Gli sposi le leggono su **`conferme.html`** (https://antoniodenuccio1995-a11y.github.io/Trading-sport/matrimonio/conferme.html) inserendo il **codice degli sposi**. Il codice non è salvato nel repository: nel database c'è solo la sua impronta. Per cambiarlo:
  `insert into public.nozze_impostazioni values ('codice', extensions.crypt('<nuovo codice>', extensions.gen_salt('bf'))) on conflict (chiave) do update set valore = excluded.valore;`
- Se il database non risponde, il modulo propone di mandare la risposta su WhatsApp ad Antonio o a Giulia.

## Musica

Mettete il brano in `musica/brano.mp3` (meglio sotto i 4 MB). Parte quando si tocca il fiocco; in alto a destra compare un pulsante per spegnerla. Se il file manca, il pulsante non compare.

## File

| File | Contenuto |
| --- | --- |
| `index.html` | Testi dell'invito, ante, fiocco (SVG), nomi scritti a mano (SVG), disegni di monogramma, rametto e fiori (simboli SVG in cima al `body`) |
| `stile.css` | Carta, colori, caratteri, tempi delle animazioni |
| `invito.js` | Apertura e scrittura a mano, effetti allo scorrimento, bordi sfrangiati, musica, conto alla rovescia, conferme (database con riserva WhatsApp), copia IBAN |
| `conferme.html` | Pagina riservata agli sposi con l'elenco delle risposte |
| `matrimonio.ics` | Evento per il calendario del telefono |
| `font/` | Alex Brush (nomi) e Libre Baskerville (testi), licenza SIL OFL |
| `img/` | Carta goffrata delle ante, anteprima per WhatsApp, icona |
| `vendor/` | GSAP e ScrollTrigger |
| `foto/` | Foto "Noi due" (ritagliate 4:5 e uniformate nei toni) |

## Da completare

- IBAN vero (ora `IT00 X 0000 0000 0000 0000 000`, come sulla bozza stampata): in `index.html`, elemento `#iban`.
- Ora di fine della festa: il calendario ora segna dalle 10:00 alle 18:00 (in `index.html`, link Google Calendar, e in `matrimonio.ics`).
- Brano per la musica (`musica/brano.mp3`).
