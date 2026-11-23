# Rendere Trading Analytics vendibile

Analisi del 23 novembre 2026. Non è una consulenza legale: prima di vendere servono un avvocato (gioco e dati) e un commercialista.

## In breve
Sì, si può vendere, ma **non così com'è**. La parte tecnica è già quasi pronta (ogni utente ha i suoi dati e il registro è privato). Prima di incassare il primo euro vanno cambiate quattro cose:

1. **Fonti dati con licenza commerciale.** Le fonti gratuite di oggi sono per uso personale.
2. **Stemmi delle squadre.** Sono marchi: in un prodotto a pagamento servono permessi, oppure si torna ai cerchi con i colori della nazione (già pronti).
3. **Quote Betfair.** La chiave gratuita vale solo per uso personale. Per vendere serve la licenza "Software Vendor" di Betfair.
4. **Regole italiane sul gioco.** Niente pubblicità di bookmaker e niente affiliazioni: va presentato come strumento di analisi statistica.

## 1. Dati: cosa si può usare oggi e cosa servirebbe

| Fonte attuale | Uso | Per vendere |
|---|---|---|
| Open Matchday (risultati della stagione, minuti dei gol) | Dichiarato "gratuito per uso informativo non commerciale" nel README del progetto | Da sostituire o da chiedere al gestore |
| football-data.co.uk (storico, quote) | Condizioni commerciali non trovate | Da chiedere al gestore prima di usarlo in un prodotto a pagamento |
| TheSportsDB (stemmi), chiave gratuita | Fonti discordanti sull'uso commerciale | Piano a pagamento e attribuzione, oppure niente stemmi |
| Betfair API, chiave ritardata | Solo uso personale; per uso commerciale serve l'approvazione di Betfair | Licenza Software Vendor (costo da chiedere a Betfair) |

Alternative con licenza commerciale, da confrontare su prezzo e condizioni: API-Football (da circa 19 $/mese secondo listini di terzi), Sportmonks e simili. Prima di scegliere vanno lette le loro condizioni d'uso.

Stemmi e loghi: per l'uso commerciale serve il permesso di leghe e club (lo dice anche Football DataCo per i campionati inglesi).

## 2. Gioco e pubblicità in Italia
- Il **Decreto Dignità (art. 9)** vieta ogni pubblicità, anche indiretta, di giochi e scommesse con vincite in denaro, social compresi. Le sanzioni partono da 50.000 € per violazione. Nel 2025 la Corte costituzionale è stata chiamata a esaminare le sanzioni, ma il divieto resta in vigore.
- Conseguenze per il prodotto:
  - niente link o loghi di bookmaker;
  - niente bonus né affiliazioni;
  - niente frasi come "vinci con…".
- Va presentato come **analisi statistica** per persone maggiorenni, con il messaggio sul gioco responsabile (già presente nell'app).
- Da verificare con un legale: se vendere "pronostici" o "consigli" rientra in regole particolari. Più prudente presentarlo come strumento di analisi, dove le decisioni restano all'utente.

## 3. Cosa c'è già
- App web veloce, installabile sul telefono, temi grafici.
- Database con controllo degli accessi: ogni utente vede solo i propri trade e impostazioni.
- Aggiornamento automatico dei dati due volte al giorno.

## 4. Cosa manca tecnicamente
1. **Progetto Supabase dedicato.** Oggi il progetto è condiviso con altre app (tabelle "nozze" e "quadra"): per un prodotto venduto serve un progetto separato, a pagamento (Supabase Pro), con backup.
2. **Registrazione e account**: iscrizione, recupero password, protezione dalle password compromesse (oggi segnalata come disattivata), cancellazione dell'account.
3. **Abbonamenti**: pagamenti con Stripe; piani Free/Pro gestiti nel database, con le funzioni Pro riservate agli abbonati.
4. **Sito di presentazione** con prezzi, domande frequenti, privacy e termini.
5. **Privacy (GDPR)**: informativa, registro dei trattamenti, accordo con Supabase (dati in UE, regione Irlanda), cookie.
6. **Assistenza e monitoraggio**: email di supporto, avvisi in caso di errori dei dati.

## 5. Un'ipotesi di offerta (da validare)
- **Free**: 3 campionati, statistiche e modello.
- **Pro (9,90–14,90 €/mese, sconto annuale)**:
  - tutti i campionati, scanner delle occasioni, movimenti di quota, avvisi Telegram;
  - registro trade con analisi completa.
- **Costi mensili indicativi**: Supabase Pro circa 25 $, dati con licenza 20–100 $, commissioni Stripe, dominio. Con 20–30 abbonati Pro i costi sono coperti.

## 6. Passi consigliati, in ordine
1. **Validare l'interesse**: 5–10 trader provano gratis per un mese e dicono cosa userebbero e quanto pagherebbero.
2. **Decidere le fonti dati** con licenza e il nome/marchio del prodotto ("Trading Analytics" è troppo generico per essere registrato).
3. **Parere legale** su gioco, dati e marchi; apertura o adeguamento della partita IVA.
4. **Separare il progetto**, poi iscrizioni e abbonamenti.
5. **Lancio** senza pubblicità legata alle scommesse: contenuti di analisi, community, passaparola.

## Fonti consultate
- Betfair, [scommettere sull'exchange italiano](https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687808/Betting+On+Italian+Exchange) e [guida alle chiavi applicazione](https://betfair-datascientists.github.io/api/apiappkey/).
- AGCOM, delibere sul divieto di pubblicità del gioco, es. [18/23/CONS](https://www.agcom.it/sites/default/files/migration/delibera/Delibera%2018-23-CONS.pdf); [Il Post sul Decreto Dignità](https://www.ilpost.it/2019/08/01/decreto-dignita-gioco-azzardo/); [Sigma, relazione AGCOM 2026](https://sigma.world/it/news/italia-relazione-agcom-2026-zero-sanzioni-pubblicita-sul-gioco/).
- [Football DataCo, FAQ](https://www.football-dataco.com/faqs) (diritti sui dati e sui loghi).
- [Documentazione TheSportsDB](https://www.thesportsdb.com/documentation); [prezzi API-Football](https://www.api-football.com/pricing); [prezzi Sportmonks](https://www.sportmonks.com/football-api/plans-pricing).
- README di Open Matchday (licenza: uso non commerciale).
