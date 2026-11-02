# Trading Analytics v0.2V-rc2 — candidata TA-V02V-UX-002

Estrarre **l’intero ZIP** in una nuova cartella. Non sostituire i singoli HTML o JS
nella precedente candidata. Conservare i backup originali e le versioni precedenti.
La rc1 esaminata, tutti i suoi moduli e le ricevute AUDIT rimangono invariati.

Su Windows, da un terminale aperto nella cartella estratta:

```powershell
py -m http.server 8000
```

Aprire nel browser:
`http://localhost:8000/Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html`.
Usare un profilo browser dedicato al collaudo, quindi importare **una copia** del
backup tramite Area tecnica → Backup e recupero JSON. Non occorre modificare JSON.
Se Python non è disponibile, usare un server HTTP locale equivalente. Il doppio
clic `file://` non è un percorso certificato. Non pubblicare la cartella con dati
personali su un server accessibile ad altri.

La Dashboard appare subito con il caricamento esplicito dell’archivio. Le viste
diventano operative dopo la verifica locale, senza scaricamenti automatici o
riscritture dei dati. I calcoli iniziali usano gli stessi motori esaminati in un
worker locale; su browser non compatibili rimane la preparazione sincrona.

- **Oggi** mostra tutte le partite realmente presenti. I prossimi sette giorni
  sono separati. Continua analisi conserva ultima partita e ultimo Comparatore.
- **Analisi partita → Confronti** amplia lo stesso cruscotto con CASA/TOTALE e
  TRASFERTA/TOTALE, indicatori e media della lega. Totale significa casa+fuori nel
  periodo selezionato; le sedi neutre sono dichiarate a parte e non sommate alle
  colonne. La forma recente e gli H2H sono nella stessa tab.
- **Scanner** parte da Oggi. Domani/3/7 giorni includono soltanto l’intervallo
  scelto; tre/sette giorni comprendono oggi. Custom usa entrambe le date, incluse.
  Le gare odierne senza un kickoff futuro verificabile restano escluse.
- **Area tecnica → Risultati recenti** acquisisce soltanto la stagione corrente.
  Selezionare campionati e perimetro, cercare gli aggiornamenti, verificare il
  confronto e confermare nel recupero JSON. Ogni conflitto resta visibile.
  Cache/ETag e contenuto invariato evitano parsing e riscritture inutili. Le fonti
  CSV statiche possono comunque inviare l’intera stagione corrente: non è un feed
  live né un servizio che fornisce necessariamente solo gli ultimi giorni.
  Se la fonte è bloccata dal browser, scaricare il CSV e usare l’importatore
  manuale esistente. I dati dell’archivio non vengono cancellati dal fallimento.

Il report QA conclusivo della PR identifica **lo SHA esatto** collaudato e lo ZIP
verificato. Le ricevute precedenti presenti nei sorgenti sono riferimenti storici,
non la prova finale della rc2. La nuova PR è stacked sulla PR #6 e richiede una
revisione indipendente; nessun merge o deploy è stato autorizzato.

Windows nativo, `file://` e registro personale non fornito restano NON ESEGUITI.
Le prove Codex sono su Chromium/Linux/HTTP. Lo stato della fonte live e gli
impedimenti effettivamente incontrati sono nel report QA, separati dai test con
risposte controllate. Nessuna capacità predittiva o redditività certificata;
frequenze, segnali descrittivi, voti e diario trade rimangono concetti distinti.
