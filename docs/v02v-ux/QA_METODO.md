# Metodo e limiti del collaudo rc2

Il gate `tests/v02v-ux/run-full.py` richiede una copia pulita dell’esatto commit.
Esegue 22 gruppi esterni, uno dei quali contiene i 17 controlli rc5 completi;
misura le prestazioni sequenzialmente dopo la chiusura delle altre suite.
Qualsiasi FAIL impone un nuovo commit e la ripetizione integrale prima della consegna.

Gli originali IND e NEW-01/02/03 sono conservati. NEW-04 browser resta identico
nei valori attesi: cambiano soltanto percorsi, entry rc2 ed apertura della tab
Confronti per lo screenshot. Le suite precedenti adattano soltanto entry/hash,
la navigazione richiesta dal nuovo layout e il selettore che distingue le righe
gruppo dalle partite. La precedente prova Scanner multi-giorno seleziona ora
esplicitamente 7 giorni; la nuova prova verifica il default Oggi e tutti i periodi.
Ogni adattatore registra SHA originale/adattato e non elimina asserzioni.

Oracolo Python indipendente: tutte le 17 metriche della card reale, quattro
colonne e benchmark casa/fuori/totale, stagioni diverse, 5+5 per squadra,
risultati asimmetrici, HT mancanti, neutro e risultato futuro avvelenato.
Le ricevute riportano attesi/osservati e denominatori completi su dati sintetici.

Startup: frame reali CDP e osservazioni DOM su archivio sintetico/vuoto, senza
screenshot del backup personale. Con il backup reale si salvano soltanto tempi,
stato visibile, conteggi e checksum; confronto integrale dell’indice del worker
con quello calcolato dal motore originale sincrono. Le date dei record restano
codificate come date civili, il cutoff Europe/Rome e le formule sono invariati.
Il worker non accede a storage o rete remota: carica moduli locali e invia copie
in memoria. Il caricamento mantiene le stesse chiamate di osservazione club,
suddivise in piccoli lotti sul thread UI; evita la seconda idratazione nel worker
quando tutti gli ID sono già espliciti. In caso di incompatibilità usa il percorso
sincrono conservativo, senza cambiare i dati.

Cold significa prima riapertura dopo l’import, non cache OS svuotata o Windows
a freddo. Seguono due reload warm per ciascuna entry, in profili separati ma con
lo stesso input. Shell/frame e disponibilità completa sono tempi distinti.

Refresh: la fonte controllata usa fetch browser, ETag 304, SHA corpo invariato,
nuova gara, FT discordante e risposta non CSV. Non è una misura della velocità
live. Fetch fino agli header, lettura body, hash, parse e confronto sono separati;
merge/anteprima e persistenza atomica sono batch comuni, non sommati più volte
come se fossero misure di singola competizione. Una cache valida non autorizza
scritture nell’archivio; ogni proposta passa per recupero/anteprima/conferma.
La fonte statica può richiedere download completo del CSV corrente, mai la
riapertura di tutti gli storici. Una nuova acquisizione discordante resta in revisione.

Il probe live non sostituisce risposte né ignora verifiche TLS. Se la fonte è
inaccessibile, registra HTTP/CORS/certificato, dati immutati e NON ESEGUITO per
import live/idempotenza; conserva anche gli errori di rete della Console e non li
presenta come zero errori. Le suite funzionali con fonte controllata richiedono
zero Console/pageerror. I tempi live non sono dedotti dal tempo del recupero JSON.

Backup: originali effettivi Codex da 28.544 e 28.402 record, verificati con SHA
prima del run. Non si usa il file da 13.536 come sostituto dell’originale mancante
all’auditor. Il recuperato Codex ha SHA diverso dall’export 95bf… dell’auditor;
non si dichiarano identici gli input solo perché hanno lo stesso numero di righe.
Entrambi gli input disponibili sono verificati in cicli separati: reimport x3,
proprio export, reload, Undo del reimport e ritorno al profilo vuoto, tutte le
sezioni, quote e manuali. Non vengono pubblicati backup, export, schermate o
identità personali. Copertura degli storici rimane separata dal recupero.

NON ESEGUITO: Windows nativo, file://, dispositivo mobile fisico e journal
personale non fornito. Il journal sintetico e il codice protetto sono verificati.
Nessuna calibrazione probabilistica, redditività o completezza delle stagioni
è certificata. La candidata richiede nuovo AUDIT indipendente.
