# Roadmap – Scheda investimento DiSalento

Aggiornata al 25 novembre 2026. Fonti: richieste di Antonio, handoff, revisione grafica e tecnica, lettura della scheda da parte di un "investitore scettico" simulato.

## Fatto (versione attuale)

- Impaginazione predefinita in 3 pagine A4, ariosa (pagina 1 proposta, pagina 2 conti e grafici, pagina 3 foto grandi e scenari); in alternativa 2 pagine più fitte.
- Colori della scheda tutti modificabili (accento, riquadro investitore, secondo colore, quota società, costi, sfondo riquadri, testo), più i colori delle voci del capitale.
- Titolo dei comparabili modificabile (non più fisso su Ruggiano).
- Moduli: accendi/spegni, ordine, pagina 1–3, riga intera o mezza riga; avviso di pagina troppo piena. Impaginazioni pronte: 2 pagine compatta, 3 pagine con grafici accesi e foto grandi a pagina 3.
- Grafici, tutti spegnibili: A dal prezzo all'utile (una riga, spento), B quanto riceve l'investitore al variare del prezzo (acceso), C dove va il capitale (spento; sfumatura salvia, terracotta, sabbia, colori diversi, o colore per voce), D prezzo al m² rispetto alla zona (dentro "Come stimiamo il prezzo", con media della zona e fonte modificabili).
- Comparabili di zona, prove di stress (lavori più cari, vendita in ritardo) nella tabella scenari.
- Chi incassa ogni voce del capitale e parti collegate; modulo "Verifiche e documenti".
- Foto: copertina in pagina 1, galleria di 3 foto grandi a pagina 3 (o piccole in fondo a pagina 2 nella versione a 2 pagine), planimetria senza ritaglio; logo.
- Download: PDF, Excel con formule, JSON, ZIP completo, pagina 1 in JPG per WhatsApp.
- Telefono: schede Modifica/Anteprima, riepilogo fisso, comandi grandi.
- Perdita: resta all'investitore, la società prende la sua quota solo se c'è utile (da confermare nel contratto).

## Dati da completare per Casa Ruggiano (non dipendono dallo strumento)

1. m² per tipologia (abitazione, giardino, parcheggio…).
2. Chi incassa "Intermediazione 3.000 €" e se è collegata a Riquality.
3. Riserva per imprevisti sui lavori.
4. Referente con nome completo, telefono, email.
5. Foto vere: stato attuale, progetto, planimetria.
6. Stato delle verifiche (titolo edilizio, conformità, provenienza, vincoli, preventivo firmato, bozza di contratto).

## Prossimi sviluppi dello strumento (in ordine)

1. **Archivio di più operazioni, sincronizzato tra telefono e computer.** Oggi i dati restano nel browser del dispositivo. Elenco delle schede, duplica, confronto tra operazioni. È anche la base dati del software 3D.
2. **"Chi siamo".** Profilo della società riutilizzabile: ragione sociale, sede, partita IVA, legame con DiSalento, studio di architettura collegato, operazioni concluse.
3. **Linea del tempo e versamenti.** Fasi in mesi (compromesso, rogito, permessi, lavori, vendita), quando l'investitore paga cosa e a chi, cosa succede a 12, 18 e 24 mesi senza vendita.
4. **Riserva imprevisti e "capitale massimo"** nel riquadro dell'investitore.
5. **Costi di mantenimento** (IMU, utenze, assicurazione al mese) nelle prove di ritardo.
6. **Scenario peggiore combinato** (prezzo −25% e lavori +20%) come riga e come linea tratteggiata nel grafico B.
7. **PDF con testo vero**, selezionabile e più leggero.
8. **Presentazione per l'investitore** generata dagli stessi dati.
9. **Nota fiscale neutra** (i valori restano al lordo): plusvalenza, fatturazione della quota della società, da verificare con il commercialista.

## Da verificare con professionisti

- Avvocato: che "Proposta di investimento" e la presentazione dei rendimenti non facciano passare la scheda per offerta di un prodotto finanziario; forma del contratto; regola della perdita.
- Commercialista: trattamento fiscale per l'investitore e per la quota della società.
- Tecnico: responsabilità dell'investitore come committente in cantiere (coordinatore sicurezza, notifica preliminare).

## Progetto successivo: piattaforma 3D (venerdì)

Un software con un mondo 3D girevole e fluido che mostra le opportunità e permette di inviarle direttamente ai possibili investitori. Funzionalità da discutere. Punto di partenza: i dati di ogni scheda (file .json) e l'archivio del punto 1.
