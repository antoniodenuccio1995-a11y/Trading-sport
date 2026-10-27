# Collaudo operativo della candidata rc4

## Avvio

1. Scaricare lo ZIP del ramo `fix/ta-stab-003-recupero-copertura` da GitHub ed estrarre tutta la cartella. Conservare insieme HTML, moduli `.js` e `histories/stab003`.
2. Dalla cartella estratta avviare `python -m http.server 8000 --bind 127.0.0.1`.
3. Aprire `http://127.0.0.1:8000/Trading_Analytics_v0.2U-rc4_TA-STAB-003.html` in un browser con IndexedDB e memoria disponibili. Usare una finestra/profilo di collaudo separato. Il protocollo `file://` non è stato collaudato perché il browser cloud lo blocca per policy.

La candidata usa un archivio incontri separato dalla rc3. Il registro trade mantiene il namespace precedente: il profilo separato evita di confondere il collaudo con un registro reale. Un cambio di origine/porta usa uno spazio browser diverso.

## Recupero del proprio backup

1. Aprire **Area tecnica → Backup e recupero JSON** e scegliere il backup originale con **Scegli backup JSON**. Non modificarne il contenuto.
2. Attendere la simulazione: sul backup del 26/10 fornito al collaudo, in un archivio vuoto sono attesi 28.544 record in ingresso, 28.402 incontri in uscita, 141 copie integrabili, una identica e due partite manuali assegnate. In presenza di altri dati i conteggi possono cambiare: consultare sempre il rapporto.
3. Controllare prima/dopo e gli eventuali conflitti. La simulazione non salva le partite. Confermare con il comando di salvataggio soltanto dopo questo esame.
4. Esportare il backup JSON della candidata, ricaricare la pagina e verificare gli stessi conteggi. Conservare anche il file originale.
5. Provare **Ripristina situazione precedente**, verificare il ritorno ai dati precedenti e ricaricare. Il ripristino riguarda l'ultima operazione; una modifica successiva richiede una nuova simulazione, senza forzare uno snapshot obsoleto.

I record manuali non assegnabili restano nell'apposito pannello: scegliere il campionato, simulare e confermare. Non occorre aprire o modificare il JSON con un editor.

## CSV e copertura

- In **Risultati e calendari**, caricare i cinque CSV I1 storici, il file risultati e il calendario 2026/27. Verificare le stagioni in anteprima prima della conferma. Reimportare gli stessi file: non devono apparire nuovi incontri.
- Le cinque stagioni I1 2021/22–2025/26 fornite contengono 380 risultati ciascuna. Il file 2022/23 manca dello spareggio salvezza: usare **Copertura → Serie A → 2022/23 → Simula integrazione** per aggiungere la gara documentata. La classifica regolare resta di 380 partite, l'archivio della stagione arriva a 381.
- Il file risultati 2026/27 contiene 71 FT, 70 HT e 70 osservazioni di tiro; il calendario aggiunge 309 incontri distinti. Non dichiarare completa la stagione: 309 partite sono ancora in programma.
- Filtrare il prospetto per campionato, stagione o stato. **Dettagli** espone partite assenti, riferimenti non riconciliati, conflitti, fasi, URL e checksum delle fonti. Un HT mancante non è una partita mancante.
- **Simula integrazione** carica solo il pacchetto pubblico scelto, verifica il checksum ed esegue la stessa anteprima incrementale del recupero JSON. I conflitti richiedono revisione; non vanno risolti scegliendo arbitrariamente un risultato. Il catalogo è una fotografia al 27/10/2026, non un aggiornamento automatico continuo.
- Esportare la matrice dall'Area tecnica dopo ogni gruppo di integrazioni. Confrontarla con la matrice iniziale; gli stati si riferiscono al contenuto effettivo del proprio archivio.

## Interfaccia e regressioni

Tenere aperto il recupero JSON e chiudere soltanto **Gestione squadre e alias**. Scrivere un alias senza confermarlo, richiudere e riaprire il pannello: il valore deve rimanere. Provare **Apri tutti** e **Chiudi tutti** durante una simulazione: la proposta e il file scelto restano disponibili.

Controllare classifiche e analisi su una data storica, poi su una data successiva: ogni vista deve rispettare la data selezionata. Le fasi esplicitamente non regolari non devono alterare la classifica regolare. Per campionati con fasi prive di metadati il prospetto resta prudente; non costituisce una classifica federale certificata.

Per il registro trade usare soltanto un registro sintetico nel profilo di collaudo. Esportarlo prima e dopo il recupero: operazioni, voti congelati, eventi e quote devono essere identici. Il backup partite fornito non conteneva un registro trade reale da validare.
