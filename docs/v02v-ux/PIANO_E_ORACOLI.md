# TA-V02V-UX-002 — piano prima del codice

Mandato: issue #7; base esatta 43b92dfc21112a1df7f20dc6f56f6add8042219a.
Branch feature/ta-v02v-ux-002; nuova PR draft separata e stacked sulla PR #6.
Nessun merge/deploy. Tutti i file del commit auditato rimangono invariati:
nuova entry rc2, moduli UX e test/documenti aggiuntivi.

Componenti: comparisonTeamStats/compactStatsRows/renderCompactCompare e
cmx-board nella nuova copia HTML mantengono gli indicatori esistenti e ricevono
orientamento per club, totali e benchmark; nessun nuovo cruscotto separato.
Scanner: modifica circoscritta a controlli e selezione temporale; evaluate,
gradeMarket, Backtest, journal e quote invariati. Motore TAV02V auditato invariato.
Dashboard/Calendario/forma/H2H: deriva del solo modulo UI per collocazione e UX.
Refresh: cache di fonte separata dall’archivio, hashing/acquisizione corrente,
anteprima attraverso recupero atomico esistente, mai sovrascrivere conflitti.

Oracoli: fixture asimmetrica A 5 casa+5 fuori e B 5 fuori+5 casa, HT parziali,
lega con terzi club, neutro e record futuro avvelenato, stagione/storico.
Python indipendente orienta ciascun risultato, calcola tutti gli indicatori e
benchmark casa/totale/fuori/totale. Verificare DOM e mini-barre esistenti.
Dashboard: almeno 12 gare oggi, passate/programmate, orari verificati/incerti;
nessun troncamento, ordine, separazione prossimi giorni e continuità di entrambe
le viste. Scanner: oggi/domani/3/7/custom, limiti inclusivi, alias e leghe/Paesi,
clock prudenziale conservato, voti e registro congelati.
Responsive: sequenza 1920→360→768→1024→1440→1920 senza reload su ogni sezione;
nessun overflow documento, totali visibili su mobile, screenshot e frames avvio.
Startup: timestamp prima shell/primo frame/archivio/proiezione/index/ready;
nessun frame rc5, nessuna scrittura matches/aux, nessuna richiesta live automatica;
backup 28.300 righe, cold+warm con confronto tempi baseline 9.6s dichiarato AUDIT.
Refresh: fetch/header/download/parse/plan/persist separati; cache invariata evita
parse/merge, cambiamenti incrementali e nuove righe senza rileggere gli storici;
risposte HTTP 304/429/500, CORS e conflitti con ripristino. Rete reale ove accessibile.
Smart Analysis: qualità/direzione/forza distinte con soglie descrittive esplicite;
nessuna modifica ai voti o aumento forzato dei positivi; holdout cronologico.

Gate: tutti gli IND originali e ampliati, 12 CMP e regressioni rc5, backup reali
esatti disponibili (28.544 e 28.402 verificati con SHA, mai sostituire con 13.536),
reimport x3/export/reload/Undo, quote/manuali e trade sintetico. Copia pulita del
commit finale; qualsiasi FAIL impone nuovo commit e ripetizione completa.
Il rapporto Drive nuovo non è stato scaricato: redirect ad autenticazione.
Il riepilogo indipendente completo disponibile nel commento 6527580146 e il
mandato issue #7 sono stati letti; richiesto percorso accessibile per gli oracoli
nuovi. Gli oracoli precedenti restano disponibili nel ramo AUDIT originale.

Consegna unica: SHA esatto, ZIP completo/checksum, QA e matrice 10 punti,
log/screenshot/frame e limiti NON ESEGUITO; Windows nativo non disponibile.

Materiali nuovi acquisiti integralmente il 02/11/2026 da fa2c92a03f2edd4254a9c40b3f7abf9061d1019d.
Rapporto SHA256 bca8d0ebad45d3a0b508834b977ef900cdf8aee7b94bc17967fc184cc22bbda2.
ZIP oracoli fe0967954a6a9739770cf6c5f9c01f4f80567338fec41a095f4083ab9ad7cc1e.
NEW-01/02/03 Node conservato byte per byte; NEW-04 browser adattato solo per
percorsi/entry e navigazione esplicita Confronti richiesta dal nuovo layout.
