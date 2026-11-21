# Promemoria: aggiornare GitHub appena l'account viene riattivato

L'8 novembre 2026 GitHub ha sospeso l'account `antoniodenuccio1995-a11y`: il repository e il sito
(https://antoniodenuccio1995-a11y.github.io/Trading-sport/) risultano 404 finché la sospensione resta.
Il lavoro fatto dopo la sospensione è nei commit locali del ramo `claude/practical-brahmagupta-uk9m6a`
e nel file `Trading-sport.bundle` consegnato.

Quando l'account torna attivo:

1. Ricollegare GitHub a Claude (claude.ai → Impostazioni → Connettori).
2. Caricare i commit del ramo `claude/practical-brahmagupta-uk9m6a`
   (da una nuova sessione si possono recuperare dal bundle: `git fetch Trading-sport.bundle claude/practical-brahmagupta-uk9m6a`).
3. Aprire la pull request verso `main` e unirla: il workflow "Pubblica app" ricompila e ripubblica il sito da solo.
4. Controllare che il workflow "Supabase attivo" sia di nuovo abilitato (Actions).
5. Verificare il sito: partite, analisi partita (tutte le schede), area personale.

Supabase non dipende da GitHub: dati e aggiornamenti automatici continuano a funzionare.
