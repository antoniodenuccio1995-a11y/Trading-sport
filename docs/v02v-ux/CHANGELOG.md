# TA-V02V-UX-002 — modifiche della candidata rc2

Base esclusiva 43b92dfc21112a1df7f20dc6f56f6add8042219a. Nuovo ramo e PR draft
separata; il commit esaminato, tutti i 597 file non-QA e la PR #6 sono conservati.
La nuova pagina ha HTML e moduli dedicati; motore statistico, identità,
recupero/persistenza e modelli rc5 originali non sono stati modificati.

| # | Priorità | Modifica | Prova prevista nel gate finale |
|---|---|---|---|
| 1 | P0 | Main fluido senza tetto 1060 px; layout mobile con tutti i totali visibili | 1920→360→768→1024→1440→1920 su sei viste, bounding box, screenshot |
| 2 | P1 | Sidebar più compatta, gerarchia e stato attivo sobri | Pin/ordine/Internazionali, focus tastiera, reload |
| 3 | P0 | Shell immediata, progressi reali, motori originali in worker, idratazione osservazioni con yield; Comparator/Calendario lazy | Frame CDP e DOM, backup 28.300, cold e due warm reload, nessun write o fetch live iniziale; confronto indice worker/sincrono |
| 4 | P0 | Tutte le gare odierne a piena larghezza, settimana separata, doppia continuità | 14 gare, ordine competizione/orario, nessun troncamento, ripresa ultima gara e ultimo confronto |
| 5 | P1 | Calendario raggruppato per data/lega, intestazioni sticky, stati testuali e colori | Filtri/alias/50 gare per pagina/CSV completo/apertura identità canonica |
| 6 | P0 | Incrementale corrente/ultimi 7 giorni/sole nuove, cache separata, ETag/SHA, concorrenza massima 2, metriche delle fasi, anteprima conservativa | Fetch reale controllato 200/304/hash, conferma, fonte cambiata, conflitto e CSV invalido; probe fonte online distinta |
| 7 | P1 | Dati utilizzati nel confronto: FT/HT, intervallo osservato, cutoff, perimetro e copertura | Testo effettivo nel browser e dati sintetici con HT mancanti |
| 8 | P1 | Forma/H2H/materiale nuovo dentro la tab Confronti esistente, riepilogo breve sopra | Posizione DOM e clic sulle sette schede rc5 conservate |
| 9 | P0 | Stesso cmx-board con CASA/TOTALE/INDICATORE/TRASFERTA/TOTALE, 17 indicatori e benchmark sotto ogni valore | Python indipendente su asimmetriche 5+5, tutte le celle, FT/HT, stagione/storico, neutro/futuro e mobile |
| 10 | P0 | Scanner Oggi/Domani/3/7/custom, squadra/alias e Paese, filtri rc5 conservati | Conteggi di ciascuna finestra, intervallo invalido, kickoff verificati/incerti e voti invariati |

La media di lega totale usa entrambe le prospettive squadra per incontro. Il
denominate è dichiarato come osservazioni squadra e gare distinte; non si contano
due partite per il campione di un singolo club. Incontri neutri e scopi AET/rigori
sono esclusi dalle quattro colonne con nota esplicita; rimangono in archivio.

Smart Analysis separa qualità/direzione/forza: insufficiente sotto 8/8/30,
contrastante con scarti opposti >=5pp per lato, debole senza concordanza forte,
favorevole/contraria solo con i criteri originali >=10pp concordi. Nessuna nuova
selezione positiva o modifica dei voti. Sul holdout 2025/26, i 659 Over 2.5 prima
raggruppati come contrastanti si distinguono in 176 contrastanti e 483 deboli;
restano 19 favorevoli e 18 selezioni mostrate con 9 eventi. I risultati NON
sostengono un miglioramento predittivo: 9/19 eventi favorevoli contro 21/35 negli
stati contrari. Si migliora la lettura, non si simula una validazione economica.

La verifica conclusiva PASS/FAIL/NON ESEGUITO, SHA, checksum e tempi misurati
sono nel rapporto esterno sul commit finale. Le osservazioni in sviluppo non
sono una ricevuta di approvazione stabile. Nessun merge/deploy.

Nel controllo integrato è emerso un disallineamento preesistente: aprire una
gara canonica cambiava la data visibile, ma non il controllo usato dai pannelli
rc5 e dal trade. La nuova entry sincronizza entrambe le date prima del confronto.
Il predicato di ammissibilità dei dati contestuali usa inoltre il minore tra
data della partita e giorno osservativo: FT erroneamente futuri non influenzano
i voti di una gara futura. Le formule dei voti restano identiche. Una prova
browser confronta tutti i giudizi con/senza un risultato futuro avvelenato e
verifica la data della gara nei controlli effettivi. Il primo gate interno è
stato interrotto e integralmente ripetuto sul nuovo SHA; nessuna microconsegna.
