/* Independent disclosures and an archive-backed coverage view. */
'use strict';
let taCoverageRows=[];
function taRenderCoverage(){
 const body=document.getElementById('taCoverageRows');if(!body)return;
 taCoverageRows=TAHistory.compare(rows);
 const league=document.getElementById('taCoverageLeague').value,year=document.getElementById('taCoverageSeason').value,state=document.getElementById('taCoverageState').value;
 const selected=taCoverageRows.filter(r=>(!league||r.league===league)&&(!year||r.season===+year)&&(!state||r.status===state));
 document.getElementById('taCoverageSummary').textContent=`${selected.length} combinazioni mostrate. Le partite future non hanno ancora un risultato dovuto. HT assente non significa incontro mancante. «Completo verificato» riguarda lo scopo e le fonti dichiarati nella singola riga.`;
 body.innerHTML=selected.map(r=>`<tr><td>${e(r.league)}${r.runtime?'':' <small>(CSV aggiuntivo)</small>'}<br>${r.season}/${String(r.season+1).slice(-2)}</td><td>${e(r.status)}${r.season===2026?'<br><small>stagione in corso</small>':''}</td><td>${r.present}<br><small>${r.ft} FT · ${r.fixtures} calendario</small></td><td>${r.expectedFull??'non verificato'}<br><small>regolare: ${r.expectedRegular??'non verificato'}</small></td><td>${r.missingResults}<br><small>${r.unreconciledReference} riferimenti da riconciliare per nome/data; ${r.missingFromReference} chiavi assenti nel confronto</small></td><td>${r.ht}/${r.ft}<br><small>${r.missingHT} HT assenti; ${r.availableHT} recuperabili dalla fonte</small></td><td>${r.duplicates} doppioni<br>${r.conflicts+r.differentFT} risultati discordanti</td><td>${e(r.scope)}<br><small>${e(r.reliability)} · ${r.sourceConflicts} conflitti tra fonti; ${r.unmatchedArchive} incontri non riconciliati</small></td><td><button type="button" data-coverage-details="${r.code}|${r.season}">Dettagli</button><button type="button" data-coverage-recover="${r.code}|${r.season}" ${r.referenceCount?'':'disabled'}>Simula integrazione</button></td></tr>`).join('');
}
async function taHistoryPreview(code,season){
 const ref=TAHistoryManifest.rows.find(r=>r.code===code&&r.season===season);if(!ref?.referenceCount)return;
 if(archiveBackupBusy||archiveTransferBusy||smartImportBusy||archiveMergePending){taStatus('Attendi il completamento dell’operazione in corso.',true);return;}
 archiveBackupBusy=true;try{
  const response=await fetch(ref.path);if(!response.ok)throw Error('Pacchetto storico non disponibile. Mantieni la cartella histories accanto al candidato e apri con HTTP.');
  const text=await response.text(),bytes=new TextEncoder().encode(text),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==ref.sha256)throw Error('Il pacchetto storico non corrisponde al checksum dichiarato. Nessuna modifica.');
  const packet=JSON.parse(text),expanded=TAClubs.expandCompact(packet.records),asOf=Date.now();
  const usable=expanded.filter(r=>!r.up?r.d<asOf:r.d>=asOf-asOf%86400000);
  packet.records=TAHistory.align(usable,rows);
  // These are typed rows, deliberately supported by the same legacy JSON reader.
  taSourceText=JSON.stringify(packet);taSourceName=ref.league+' '+ref.season+'/'+(ref.season+1)+' · fonti pubbliche';
  await taPrepare(taSourceText,taSourceName,null,'integrazione storici');
  if(taPending){taPending.report.publicSourceRowsExcluded=expanded.length-usable.length;await taPersistReport(taPending.report);}
  window.document.getElementById('taRJsonCard').open=true;
  taStatus('Integrazione incrementale simulata. Controlla nuovi incontri, HT e conflitti prima di confermare; nessun risultato esistente viene sovrascritto.');
  window.document.getElementById('taRecovery').scrollIntoView({behavior:'smooth'});
 }catch(ex){taStatus(ex.message,true)}finally{archiveBackupBusy=false;renderClubDiagnostics()}
}
function taRenderManualPending(){
 const host=document.getElementById('taManualPending');if(!host)return;
 const pending=window.taManualUnassigned||[];host.hidden=!pending.length;
 host.querySelector('tbody').innerHTML=pending.map((r,i)=>`<tr><td>${e(new Date(r.d).toISOString().slice(0,10))}</td><td>${e(r.H)} / ${e(r.A)}</td><td><select data-manual-league="${i}"><option value="">Scegli il campionato</option>${SUPPORTED_LEAGUES.map(l=>`<option>${e(l.name)}</option>`).join('')}</select><button type="button" data-manual-resolve="${i}">Simula assegnazione</button></td></tr>`).join('');
}
(function(){
 const json=document.getElementById('taRJsonCard'),clubs=document.getElementById('taClubDiagnostics');
 const style=document.createElement('style');style.textContent='#taManualPending[hidden]{display:none!important}';document.head.append(style);
 const card=document.createElement('details');card.className='ta-tech-card';card.id='taRClubsCard';card.innerHTML='<summary><span class="ta-tech-number">03</span><span>Gestione squadre e alias<small>Identità, associazioni e denominazioni originali.</small></span></summary><div class="ta-tech-body"></div>';card.querySelector('div').append(clubs);json.after(card);
 const controls=document.createElement('div');controls.className='ta-controls';controls.innerHTML='<button id="taTechOpenAll" type="button">Apri tutti</button><button id="taTechCloseAll" type="button">Chiudi tutti</button><p class="hint">Richiudere un pannello conserva selezioni, simulazioni e modifiche non confermate.</p>';json.before(controls);
 const ids=['taRJsonCard','taRLeagueCard','taRClubsCard','taRQuotesCard','taRToolsCard'];
 const cards=()=>ids.map(id=>document.getElementById(id)).filter(Boolean);
 for(const c of cards())if(c.id!==json.id)c.open=false;
 document.getElementById('taTechOpenAll').onclick=()=>cards().forEach(c=>c.open=true);document.getElementById('taTechCloseAll').onclick=()=>cards().forEach(c=>c.open=false);
 document.addEventListener('change',ev=>{if(['taRecoveryFile','archiveImportBackup','archiveImportLegacy','taUseBackupRules'].includes(ev.target.id))json.open=true;if(ev.target.id==='taClubReadReport')card.open=true;if(['smartHistoricFiles','taTManualFiles','f'].includes(ev.target.id))document.getElementById('taRLeagueCard').open=true;},true);
 document.getElementById('taClubPreview').addEventListener('click',()=>json.open=true,true);document.getElementById('taClubBatch').addEventListener('click',()=>json.open=true,true);
 const selectBefore=taSelectClub;taSelectClub=function(...args){card.open=true;return selectBefore(...args)};
 const coverage=document.createElement('details');coverage.id='taCoverage';coverage.className='ta-tech-expand';coverage.innerHTML='<summary>Copertura storici · incontri, FT, HT e fasi</summary><p>Il confronto usa riferimenti pubblici datati e distingue gli incontri dalle statistiche mancanti. Apri i dettagli per fonte, scopo e limiti.</p><div class="ta-controls"><label>Campionato <select id="taCoverageLeague"><option value="">Tutti</option></select></label><label>Stagione <select id="taCoverageSeason"><option value="">Tutte</option></select></label><label>Stato <select id="taCoverageState"><option value="">Tutti</option><option>completo verificato</option><option>parziale</option><option>non verificabile</option></select></label><button id="taCoverageRefresh" type="button">Aggiorna confronto</button><button id="taCoverageExport" type="button">Scarica matrice CSV</button><button id="taCoverageJSON" type="button">Scarica diagnosi completa</button></div><p id="taCoverageSummary"></p><div style="max-height:550px;overflow:auto"><table><thead><tr><th>Campionato / stagione</th><th>Stato</th><th>Presenti</th><th>Attesi</th><th>FT da recuperare</th><th>HT</th><th>Duplicati / conflitti</th><th>Fasi e fonte</th><th>Azioni</th></tr></thead><tbody id="taCoverageRows"></tbody></table></div><details id="taCoverageDetail"><summary>Dettaglio del confronto selezionato</summary><pre style="max-height:400px;overflow:auto;white-space:pre-wrap"></pre></details>';
 document.getElementById('taRLeagueCard').querySelector('.ta-tech-body').prepend(coverage);
 for(const league of [...new Set(TAHistoryManifest.rows.map(r=>r.league))])document.getElementById('taCoverageLeague').add(new Option(league,league));for(const y of [2021,2022,2023,2024,2025,2026])document.getElementById('taCoverageSeason').add(new Option(y+'/'+(y+1),y));
 for(const id of ['taCoverageLeague','taCoverageSeason','taCoverageState'])document.getElementById(id).onchange=taRenderCoverage;
 document.getElementById('taCoverageRefresh').onclick=taRenderCoverage;
 coverage.addEventListener('click',ev=>{const d=ev.target.closest('[data-coverage-details]'),recover=ev.target.closest('[data-coverage-recover]');if(d){const [c,s]=d.dataset.coverageDetails.split('|');const row=taCoverageRows.find(r=>r.code===c&&r.season===+s);document.querySelector('#taCoverageDetail pre').textContent=JSON.stringify(row,null,2);document.getElementById('taCoverageDetail').open=true;}if(recover){const [c,s]=recover.dataset.coverageRecover.split('|');taHistoryPreview(c,+s);}});
 document.getElementById('taCoverageJSON').onclick=()=>archiveDownloadFile(JSON.stringify({asOf:new Date().toISOString(),rows:taCoverageRows},null,2),'TA-STAB-003_copertura_privata.json');
 document.getElementById('taCoverageExport').onclick=()=>{const cols=['league','season','status','present','expectedRegular','expectedFull','ft','ht','missingHT','missingResults','missingFromReference','duplicates','differentFT','scope','reliability'];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';archiveDownloadFile([cols.join(','),...taCoverageRows.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n'),'TA-STAB-003_copertura.csv')};
 const pending=document.createElement('details');pending.id='taManualPending';pending.className='ta-tech-expand';pending.hidden=true;pending.innerHTML='<summary>Partite manuali precedenti da assegnare</summary><p>Il file originale non dichiarava il campionato. Queste partite sono conservate nel backup e restano fuori dalle analisi finché non viene confermato il contesto.</p><table><thead><tr><th>Data</th><th>Squadre</th><th>Assegnazione</th></tr></thead><tbody></tbody></table>';document.getElementById('taRJsonBody').append(pending);
 pending.addEventListener('click',async ev=>{const button=ev.target.closest('[data-manual-resolve]');if(!button)return;const i=+button.dataset.manualResolve,lg=pending.querySelector(`[data-manual-league="${i}"]`).value;if(!lg){taStatus('Scegli il campionato prima di simulare.',true);return;}const original=window.taManualUnassigned[i],manual={...original,lg,up:true,o:{...(original.o||{}),LegacyManualOriginal:original,LegacyManualResolution:'explicit-user-confirmation'}};
  const doc={format:'TradingAnalyticsBackup',version:2,records:archiveCompact(rows),manual:[...man,manual]};await taPrepare(JSON.stringify(doc),'Assegnazione partita manuale');if(taPending?.aux){taPending.aux.gp_man_unassigned=JSON.stringify(window.taManualUnassigned.filter((_,n)=>n!==i));taPending.report.manualExplicitAssignment={index:i,league:lg};await taPersistReport(taPending.report);taStatus('Assegnazione simulata: conferma nel recupero guidato.');json.open=true;}
 });
 const refreshBefore=refreshDataStatus;refreshDataStatus=function(...args){const value=refreshBefore(...args);taRenderCoverage();taRenderManualPending();return value};
 window.taStabAreaReady=(async()=>{await window.taRecoveryUIReady;taRenderCoverage();taRenderManualPending();})();
})();
