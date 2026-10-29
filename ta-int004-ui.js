/* Guided recovery and club decisions. All recovery mutations use one IDB transaction. */
'use strict';
let taRepairBeforeExported=false;
let taPending=null,taSourceText=null,taSourceName='',taIdentitySelection=null,taExternalClubs=[],taReportSave=Promise.resolve(),taReportPersistenceError='',taIssuePage=0;
function taStoreGet(key){return new Promise((resolve,reject)=>{
 if(!archiveDb)return reject(Error('La memoria estesa non è disponibile. Riapri con HTTP e abilita la memoria del browser.'));
 const tx=archiveDb.transaction(ARCHIVE_STORE,'readonly'),r=tx.objectStore(ARCHIVE_STORE).get(key);let value;
 r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Lettura interrotta'));
})}
function taStorePut(key,value){return new Promise((resolve,reject)=>{
 if(!archiveDb)return reject(Error('Memoria estesa non disponibile: il rapporto resta scaricabile in questa pagina, ma non è conservato dopo la chiusura.'));
 const tx=archiveDb.transaction(ARCHIVE_STORE,'readwrite');tx.objectStore(ARCHIVE_STORE).put(value,key);
 tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||Error('Salvataggio del rapporto interrotto'));
})}
function taPersistReport(report){
 window.taLastMigration=report;renderClubDiagnostics();
 taReportSave=taReportSave.catch(()=>{}).then(()=>taStorePut('recoveryReport',report)).then(()=>{taReportPersistenceError='';},ex=>{taReportPersistenceError=ex.message;renderClubDiagnostics()});return taReportSave;
}
function taAux(){const out={};for(const k of ['ta_path_memberships','gp_goal_events','gp_man','gp_man_unassigned','gp_strats'])out[k]=archiveReadAux(k)||'[]';return out;}
function taCapture(){return {rows:archiveCompact(rows),aux:taAux(),rules:TAClubs.rules()};}
const taFingerprint=()=>TARecovery.stable(taCapture());
function taEnsureCurrent(disk){
 if(disk&&(!TARecovery.equal(archiveCompact(rows),disk.rows||[])||!TARecovery.equal(TAClubs.rules(),disk.clubRules||[])||(window.taRecoveryGeneration||null)!==(disk.generation||null)))throw Error('L’archivio è cambiato in un’altra scheda. Ricarica la pagina e seleziona di nuovo il backup prima di simulare.');
}
async function taRefresh(){
 const snapshot=await archiveDbGet();archiveLoadBundle(snapshot);rows=archiveExpand(snapshot.rows||[]);
 fill();teams();today();comparisonOptions();refreshDataStatus();refreshStandingsControls();renderStandings();lm();drawS();renderClubDiagnostics();
}
async function taAtomicCommit(pending,kind='importazione'){
 if(!archiveDb||archiveMode!=='indexeddb')throw Error('Il recupero sicuro richiede la memoria estesa IndexedDB. Nessuna modifica: conserva il file e riapri l’app con un server HTTP.');
 if(pending.fingerprint!==taFingerprint())throw Error('L’archivio o le preferenze sono cambiati dopo l’anteprima. Esegui una nuova simulazione.');
 const before=taCapture(),compact=archiveCompact(pending.records),generation=crypto.randomUUID();
 await archiveWriteChain;
 await new Promise((resolve,reject)=>{
  const tx=archiveDb.transaction(ARCHIVE_STORE,'readwrite'),store=tx.objectStore(ARCHIVE_STORE),read=store.get('matches');let reason='';
  read.onsuccess=()=>{
   const disk=read.result;
   if(TARecovery.stable(disk)!==pending.diskToken||pending.fingerprint!==taFingerprint()){reason='L’archivio è stato modificato in un’altra operazione. Ripeti la simulazione.';tx.abort();return;}
   const next={version:2,rows:compact,recoveryAux:pending.aux,clubRules:pending.rules,generation,revision:crypto.randomUUID(),updatedAt:Date.now()};
   store.put({snapshot:{...disk,rows:before.rows,recoveryAux:before.aux,clubRules:before.rules},afterRevision:next.revision,kind,createdAt:new Date().toISOString()},'recoveryUndo');
   store.put(next,'matches');
   store.put({...pending.report,status:'salvata',operation:kind,savedAt:new Date().toISOString(),generation},'recoveryReport');
   // A new atomic bundle supersedes any stale fallback. Cleanup is outside the transaction;
   // rc3 startup always checks the committed generation before reading that fallback.
  };
  tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error(reason||tx.error?.message||'Operazione interrotta: la transazione non è stata applicata.'));
 });
 pending.committed=true;taPending=null;taSourceText=null;
 const verify=await archiveDbGet();
 if(verify?.generation!==generation||!TARecovery.equal(verify.rows,compact)||!TARecovery.equal(verify.recoveryAux,pending.aux)||!TARecovery.equal(verify.clubRules,pending.rules))throw Error('La verifica successiva non corrisponde. Non ripetere l’importazione: ricarica e usa «Ripristina situazione precedente».');
 try{localStorage.removeItem('ta_int004_fallback_v1')}catch(_){}
 window.taLastMigration=await taStoreGet('recoveryReport');
 try{await taRefresh();taStatus('Salvataggio verificato. Puoi scaricare il backup JSON; la situazione precedente è ripristinabile.');}
 catch(ex){window.taLastMigration.refreshError=ex.message;await taPersistReport(window.taLastMigration);taStatus('Dati salvati e verificati, ma una vista non si è aggiornata. Ricarica la pagina; non ripetere l’importazione. Il dettaglio è nel rapporto.',true);}
 renderClubDiagnostics();
}
function taStatus(message,error=false){const el=document.getElementById('taRecoveryStatus');if(el){el.textContent=message;el.style.color=error?'#a22d29':'#1d6240';}}
function taAuxPlan(metadata,rules){
 const saved=TAClubs.rules();return TAClubs.isolated(()=>{try{
  TAClubs.configure(rules);const aux=taAux();
  const mergeList=(key,incoming,id)=>{
   const current=JSON.parse(aux[key]||'[]'),result=current.slice();
   for(const v of incoming||[]){const old=result.find(x=>id(x)===id(v));if(!old)result.push(v);else if(!TARecovery.equal(old,v))throw Error('Dati ausiliari discordanti in '+key+': '+id(v)+'. Nessuna sezione sarà sovrascritta.');}
   aux[key]=JSON.stringify(result);
  };
  const memberships=(metadata.memberships||[]).map(TAClubs.canonicalMembership);
  // Preserve every evidence entry; multiple dated references are not duplicates.
  const currentRefs=JSON.parse(aux.ta_path_memberships||'[]').map(TAClubs.canonicalMembership);
  aux.ta_path_memberships=JSON.stringify([...new Map([...currentRefs,...memberships].map(x=>[TARecovery.stable(x),x])).values()]);
  const goals=JSON.parse(aux.gp_goal_events||'[]');
  for(const incoming of metadata.goalEvents||[]){
   const id=goalEventKey(incoming.d,incoming.H,incoming.A,incoming.lg),old=goals.find(g=>goalEventKey(g.d,g.H,g.A,g.lg)===id);
   if(!old){goals.push(incoming);continue;}
   const values=g=>Object.fromEntries(Object.entries(g).filter(([k])=>!['key','RecoverySourceKeys'].includes(k)));
   if(!TARecovery.equal(values(old),values(incoming)))throw Error('Eventi gol discordanti per lo stesso incontro: nessuna sezione verrà sovrascritta.');
   if(old.key!==incoming.key)old.RecoverySourceKeys=[...new Set([...(old.RecoverySourceKeys||[]),...(incoming.RecoverySourceKeys||[]),old.key,incoming.key])];
  }
  aux.gp_goal_events=JSON.stringify(goals);
  mergeList('gp_strats',metadata.strategies,v=>v.name||TARecovery.stable(v));
  const manual=TARecovery.plan((metadata.manual||[]).length?metadata.manual:[],JSON.parse(aux.gp_man||'[]'));
  if((metadata.manual||[]).length){if(!manual.report.safe)throw Error('Conflitto nelle partite manuali. Risolverlo prima del recupero.');aux.gp_man=JSON.stringify(manual.records);}
  else aux.gp_man=JSON.stringify(JSON.parse(aux.gp_man||'[]').map(TAClubs.canonicalMatch));
  if(JSON.parse(aux.gp_strats||'[]').some(s=>!s||!MK[s.m]||!Array.isArray(s.conds)))throw Error('Una strategia corrente non è compatibile. Correggere l’anomalia prima del recupero; dati originali conservati.');
  JSON.parse(aux.gp_goal_events||'[]').forEach(TARecovery.validateGoal);
  const pending=[...JSON.parse(aux.gp_man_unassigned||'[]'),...(metadata.manualUnassigned||[])];aux.gp_man_unassigned=JSON.stringify([...new Map(pending.map(x=>[TARecovery.stable(x),x])).values()]);
  return aux;
 }finally{TAClubs.configure(saved)}});
}
async function taPrepare(content,name,proposedRules=null,kind='importazione'){
 document.getElementById('taPartialConsent').checked=false;taIssuePage=0;
 const fingerprint=taFingerprint(),disk=archiveDb?await archiveDbGet():null,saved=TAClubs.rules();let result,sourceRecords=[],rules=proposedRules||saved;
 try{
  const parsed=TARecovery.parse(content);sourceRecords=parsed.records;
  taEnsureCurrent(disk);
  const useBackup=document.getElementById('taUseBackupRules').checked;
  if(!proposedRules&&useBackup&&parsed.metadata.clubRules){
   const merged=new Map(saved.map(r=>[TARecovery.stable([r.alias,r.country,r.fromId||'',r.provider||'',r.sourceId??null]),r]));
   for(const r of parsed.metadata.clubRules){const k=TARecovery.stable([r.alias,r.country,r.fromId||'',r.provider||'',r.sourceId??null]);if(merged.has(k)&&!TARecovery.equal(merged.get(k),r))throw Error('Regole anagrafiche del backup discordanti: correggere le associazioni prima di usarle.');merged.set(k,r);}rules=[...merged.values()];
  }
  TAClubs.configure(rules);
  if(!rows.length&&parsed.format==='TradingAnalyticsBackup'&&parsed.metadata.exportedAt&&!parsed.metadata.originalPacketSHA256){
   const full=TARecovery.reconcile(parsed.records);result={...full,metadata:parsed.metadata};Object.assign(result.report,{format:parsed.format,sourceVersion:parsed.version,existingCount:0,manualMigration:parsed.metadata.manualMigration,conservativeFullRestore:true});
  }else result=TARecovery.plan(content,rows);
  result.report.sportingImpact=TARecovery.impact(rows,result.records);
  try{result.aux=taAuxPlan(result.metadata,rules)}catch(ex){result.report.errors.push({section:'dati ausiliari',error:ex.message});result.report.safe=false;result.report.canPartial=false;result.report.status='bloccata';}
  result.report.backupRulesAvailable=parsed.metadata.clubRules?.length||0;
 }catch(ex){result={records:rows.slice(),metadata:{},report:{version:'TA-RECOVERY-1',status:'bloccata',inputCount:sourceRecords.length,outputCount:rows.length,existingCount:rows.length,importable:0,problematic:0,errors:[{error:ex.message}],collisions:[],changes:[],safe:false,canPartial:false}};}
 finally{TAClubs.configure(saved);}
 result.report.fileName=name;result.report.operation=kind;
 taPending={...result,rules,sourceRecords,fingerprint,diskToken:TARecovery.stable(disk),kind};
 await taPersistReport(result.report);renderClubDiagnostics();return result;
}
async function taReadFile(ev){
 const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
 if(archiveBackupBusy||archiveTransferBusy||smartImportBusy||archiveMergePending||!archiveReady){taStatus('Attendi la fine dell’operazione in corso.',true);return;}
 archiveBackupBusy=true;
 try{taSourceText=await file.text();taSourceName=file.name;document.getElementById('taUseBackupRules').checked=false;await taPrepare(taSourceText,file.name);taStatus('Simulazione disponibile. Esamina il riepilogo e gli incontri segnalati, poi conferma se consentito.');}
 catch(ex){await taPersistReport({status:'bloccata',fileName:file.name,errors:[{error:ex.message}],collisions:[],safe:false});taStatus(ex.message,true);}
 finally{archiveBackupBusy=false;document.getElementById('taRecovery').scrollIntoView({behavior:'smooth',block:'start'});}
}
function taRegistryView(){
 const saved=TAClubs.rules();return TAClubs.isolated(()=>{
  TAClubs.configure(saved);for(const row of [...rows,...man,...(taPending?.sourceRecords||[])]){try{TAClubs.canonicalMatch(row)}catch(_){};}
  for(const m of leaguePathRefs){try{TAClubs.canonicalMembership(m)}catch(_){};}
  const observed=TAClubs.diagnostics(),map=new Map(observed.clubs.map(c=>[c.id,c]));
  for(const c of taExternalClubs)if(!map.has(c.id))map.set(c.id,c);
  return {...observed,clubs:[...map.values()]};
 });
}
function taClubOptions(diag=taRegistryView()){
 const map=new Map(TAClubs.seeds.map(c=>[c.id,c]));for(const c of diag.clubs)map.set(c.id,{...map.get(c.id),...c,aliases:[...new Set([...(map.get(c.id)?.aliases||[]),...(c.aliases||[])])]});
 for(const r of TAClubs.rules()){const c=map.get(r.targetId);if(c)c.aliases=[...new Set([...(c.aliases||[]),r.alias])];}
 return [...map.values()];
}
function taRenderClubs(){
 const host=document.getElementById('taClubDiagnostics');if(!host)return;
 const diag=taRegistryView(),query=TAClubs.key(document.getElementById('taClubSearch').value);
 const options=taClubOptions(diag),clubs=options.filter(c=>!query||[c.name,...(c.aliases||[])].some(n=>TAClubs.key(n).includes(query)));
 document.getElementById('taClubCounts').textContent=`${diag.clubs.length} identità osservate · ${diag.clubs.filter(c=>c.status==='ambigua').length} ambigue. Un’identità distinta senza alias alternativi può essere importata senza conferme aggiuntive.`;
 document.getElementById('taClubTable').innerHTML=clubs.map(c=>`<tr><td><button type="button" data-club-select="${e(c.id)}">${e(c.name)}</button></td><td>${e(c.country)}</td><td>${c.status==='ambigua'?'⚠ Da risolvere':c.status==='verificata'?'Verificata':'Identità distinta'}</td><td>${e((c.aliases||[]).join(' / '))}</td></tr>`).join('');
 const targets=document.getElementById('taClubTarget'),selected=targets.value;
 targets.innerHTML='<option value="">Scegli il club corretto</option>'+options.map(c=>`<option value="${e(c.id)}">${e(c.name)} · ${e(c.country)}</option>`).join('');targets.value=selected;
 const suggestions=TARecovery.suggestions(diag);window.taClubSuggestions=suggestions;
 document.getElementById('taClubSuggestions').innerHTML=suggestions.length?suggestions.map((s,i)=>`<p><button type="button" data-club-suggestion="${i}">Esamina ${e(s.alias)}</button> → ${e(s.candidates.map(c=>c.name+' ('+c.country+')').join(', '))}. ${e(s.reason)}.</p>`).join(''):'Nessuna associazione documentata aggiuntiva da proporre. Puoi cercare e aggiungere un alias verificato.';
 document.getElementById('taClubRules').textContent=JSON.stringify(TAClubs.rules(),null,2);
}
function taSelectClub(id){
 const c=taClubOptions().find(c=>c.id===id);if(!c)return;taIdentitySelection=c;
 document.getElementById('taClubAlias').value=c.identityName||c.name;document.getElementById('taClubCountry').value=c.country;document.getElementById('taClubDistinctName').value=c.name;
 document.getElementById('taClubDetails').textContent=JSON.stringify({nome:c.name,alias:c.aliases,Paese:c.country,fonti:c.sources||c.evidence,identificativo:c.id,provider:c.provider,sourceId:c.sourceId},null,2);
 document.getElementById('taClubEdit').open=true;
}
function renderClubDiagnostics(){
 const host=document.getElementById('taRecovery');if(!host)return;
 const r=window.taLastMigration,summary=document.getElementById('taRecoverySummary');const verification=document.getElementById('taRepairBackupVerify');if(verification)verification.hidden=taPending?.kind!=='riconciliazione archivio';
 if(!r)summary.textContent='1. Seleziona il backup JSON delle partite. 2. Controlla la simulazione. 3. Conferma l’importazione. L’archivio corrente viene conservato e unito ai dati validi.';
 else summary.textContent=`${r.fileName||'Archivio'} · ${r.format||'Formato da controllare'}${r.sourceVersion?' v'+r.sourceVersion:''}. ${r.inputCount||0} righe dal file, ${(r.leagues||[]).length} campionati, ${(r.seasons||[]).length} stagioni. ${r.importable||0} righe importabili; ${r.problematic||0} problematiche. ${r.identical||0} copie identiche e ${r.compatible||0} integrabili. Archivio: ${r.existingCount??rows.length} → ${r.outputCount??rows.length} incontri. Stato: ${r.status}.`;
 document.getElementById('taRecoveryReport').textContent=r?JSON.stringify({...r,collisions:r.collisions?.slice(0,10),errors:r.errors?.slice(0,10),changes:r.changes?.slice(0,20),excluded:r.excluded?.slice(0,10),coverage:r.coverage?.slice(0,20),note:'Anteprima limitata. Il download include tutte le righe e i dettagli.'},null,2):'Nessuna simulazione disponibile.';
 const details=[...(r?.collisions||[]),...(r?.errors||[]).map(v=>({kind:'errore',records:[v],fields:[v.error],treatment:'Correggere il file sorgente o escludere esplicitamente la riga; originale conservato.'}))];
 details.sort((a,b)=>Number(['identici','integrabili'].includes(a.kind))-Number(['identici','integrabili'].includes(b.kind)));
 taIssuePage=Math.min(taIssuePage,Math.max(0,Math.ceil(details.length/50)-1));
 document.getElementById('taIssueCount').textContent=details.length?`Segnalazioni ${taIssuePage*50+1}–${Math.min((taIssuePage+1)*50,details.length)} di ${details.length}`:'Nessuna segnalazione';
 document.getElementById('taIssuePrev').disabled=taIssuePage===0;document.getElementById('taIssueNext').disabled=(taIssuePage+1)*50>=details.length;
 document.getElementById('taRecoveryIssues').innerHTML=details.slice(taIssuePage*50,(taIssuePage+1)*50).map((v,i)=>`<tr style="${['identici','integrabili'].includes(v.kind)?'':'background:#ffe8e5;color:#762b26'}"><td>${e(v.kind)}</td><td>${e(v.records?.[0]?.date||'—')}</td><td>${e(v.records?.[0]?.league||'—')}</td><td>${e(v.records?.[0]?.home||'—')} / ${e(v.records?.[0]?.away||'—')}</td><td>${e((v.records||[]).map(x=>(x.origin||'file')+' #'+((x.index??0)+1)+': '+(x.result||'—')).join('; '))}</td><td>${e((v.fields||[]).join(', '))}<details><summary>Esamina dati</summary><pre style="white-space:pre-wrap">${e(JSON.stringify(v,null,2))}</pre></details></td><td>${e(v.treatment||'')}</td></tr>`).join('');
 const changes=r?.changes||[];document.getElementById('taRecoveryChanges').textContent=changes.length?changes.map(c=>'Riga '+(c.index+1)+': '+c.before.join(' / ')+' → '+c.after.join(' / ')).join('\n'):'Nessun nome modificato nella simulazione.';
 document.getElementById('taRecoveryImpact').innerHTML=(r?.sportingImpact||[]).map(v=>{const label=s=>s?`${s.name}: ${s.played} giocate, ${s.fixtures} in programma; GF ${s.gf}, GS ${s.ga}; V/P/S ${s.wins}/${s.draws}/${s.losses}`:'Assente';return `<tr><td>${e((v.before||v.after).league)}</td><td>${e(label(v.before))}</td><td>${e(label(v.after))}</td></tr>`}).join('');
 document.getElementById('taPartialWrap').hidden=!r?.canPartial;
 document.getElementById('taBackupRulesWrap').hidden=!r?.backupRulesAvailable;
 document.getElementById('taRecoveryConfirm').disabled=(taPending?.kind==='riconciliazione archivio'&&(!taRepairBeforeExported||!document.getElementById('taRepairBackupAck')?.checked))||!archiveDb||archiveMode!=='indexeddb'||!taPending||!(r?.safe||(r?.canPartial&&document.getElementById('taPartialConsent').checked));
 document.getElementById('taReportWarning').textContent=taReportPersistenceError;
 document.getElementById('taRecoveryIntegrity').textContent=taPending?.kind==='identità'?'Le formule non cambiano. Il cambio dei raggruppamenti può cambiare classifiche e statistiche: controllare i nomi prima/dopo. Registro trade invariato.':'L’archivio corrente viene conservato. Risultati e campi discordanti non vengono sovrascritti. Registro trade invariato.';
 taRenderClubs();
}
(function(){
 const style=document.createElement('style');style.textContent='#taRecovery [hidden]{display:none!important} #taRecovery input[type=checkbox],#taClubDiagnostics input[type=checkbox]{display:inline-block;width:auto;margin-right:.5rem} #taRecovery label,#taClubDiagnostics label{margin:12px 0} #taRecovery button,#taClubDiagnostics button{margin:4px} #taRecovery td,#taClubDiagnostics td{vertical-align:top} #taRecovery pre,#taClubDiagnostics pre{max-height:350px;overflow:auto}';document.head.append(style);
 const host=document.createElement('section');host.id='taRecovery';host.className='taS-bulk';
 host.innerHTML=`<h3>Recupero guidato JSON · TA-INT-004</h3><p>Seleziona il backup esportato dalla vecchia versione. I rapporti di anagrafica o integrità non contengono le partite.</p><label>1. Scegli backup JSON <input id="taRecoveryFile" type="file" accept=".json,application/json"></label>
 <p id="taRecoveryStatus" role="status" aria-live="polite"></p><p id="taRecoverySummary"></p><p id="taRecoveryIntegrity"></p><p id="taReportWarning" role="alert"></p>
 <label id="taBackupRulesWrap" hidden><input id="taUseBackupRules" type="checkbox"> Usa anche le associazioni verificate presenti nel backup (nuova simulazione obbligatoria)</label>
 <div style="max-height:420px;overflow:auto"><table><thead><tr><th>Classificazione</th><th>Data</th><th>Campionato</th><th>Squadre</th><th>Copie / risultati</th><th>Dettagli</th><th>Trattamento</th></tr></thead><tbody id="taRecoveryIssues"></tbody></table></div>
 <p><button id="taIssuePrev" type="button">Precedenti</button> <span id="taIssueCount"></span> <button id="taIssueNext" type="button">Successive</button></p>
 <details><summary>Nomi prima e dopo</summary><pre id="taRecoveryChanges" style="white-space:pre-wrap"></pre></details>
 <details><summary>Conseguenze sui raggruppamenti statistici</summary><p>Conteggi descrittivi di tutti gli incontri locali, senza filtri di stagione o data. Le analisi conserveranno i loro filtri e le formule attuali.</p><div style="max-height:300px;overflow:auto"><table><thead><tr><th>Campionato</th><th>Prima</th><th>Dopo</th></tr></thead><tbody id="taRecoveryImpact"></tbody></table></div></details>
 <label id="taPartialWrap" hidden><input id="taPartialConsent" type="checkbox"> Importa solo le righe sicure; escludi esclusivamente le righe del file elencate come problematiche. Le partite già presenti restano invariate. Il rapporto conserva tutte le righe escluse.</label>
 <p><button id="taRecoveryConfirm" type="button" disabled>3. Conferma e salva</button> <button id="taRecoveryUndo" type="button">Ripristina situazione precedente</button> <button id="taRecoveryExportBefore" type="button">Scarica backup attuale</button> <button id="taClubIntegrityExport" type="button">Scarica rapporto completo</button> <button id="taRecoveryClear" type="button">Elimina simulazione</button></p>
 <details><summary>Anteprima rapporto · il file completo è scaricabile</summary><pre id="taRecoveryReport" style="white-space:pre-wrap"></pre></details>`;
 document.querySelector('#taRJsonBody').prepend(host);
 const clubs=document.createElement('section');clubs.id='taClubDiagnostics';clubs.className='taS-bulk';
 clubs.innerHTML=`<h3>Gestione squadre e alias</h3><p id="taClubCounts"></p><label>Cerca nome o alias <input id="taClubSearch" type="search" placeholder="es. PSG, Lyon, Manchester"></label> <button id="taClubExport" type="button">Esporta anagrafica e decisioni</button> <label>Carica un rapporto anagrafico da esaminare <input id="taClubReadReport" type="file" accept=".json"></label>
 <div style="max-height:350px;overflow:auto"><table><thead><tr><th>Squadra</th><th>Paese</th><th>Stato</th><th>Alias</th></tr></thead><tbody id="taClubTable"></tbody></table></div>
 <details id="taClubEdit"><summary>Conferma o correggi un’associazione</summary><pre id="taClubDetails" style="white-space:pre-wrap"></pre>
 <label>Denominazione da associare <input id="taClubAlias"></label> <label>Paese / contesto <input id="taClubCountry" placeholder="FRA, ENG, ITA…"></label>
 <label>Azione <select id="taClubAction"><option value="associate">Conferma alias / correggi associazione</option><option value="distinct">Mantieni come club distinto</option></select></label>
 <label>Ambito della decisione <select id="taClubScope"><option value="alias">Solo questa denominazione nel Paese</option><option value="identity">Intera identità selezionata</option></select></label>
 <label>Club corretto <select id="taClubTarget"></select></label> <label>Nome del club distinto <input id="taClubDistinctName"></label>
 <label>Fonte o motivazione della verifica <input id="taClubEvidence" placeholder="Fonte affidabile o verifica operativa"></label>
 <button id="taClubPreview" type="button">Simula conseguenze</button><p>La simulazione mostra gli incontri interessati. Conferma solo dopo aver controllato i raggruppamenti: le formule statistiche e i trade rimangono invariati.</p></details>
 <details><summary>Associazioni plausibili da confermare</summary><div id="taClubSuggestions"></div><label><input id="taClubBatchConsent" type="checkbox"> Ho verificato tutte le proposte con un’unica destinazione e ne confermo il contesto</label> <button id="taClubBatch" type="button">Simula conferme documentate</button></details>
 <details><summary>Decisioni salvate e identificativi tecnici</summary><pre id="taClubRules" style="white-space:pre-wrap"></pre></details>`;
 host.after(clubs);
 for(const id of ['taRecoveryFile','archiveImportBackup','archiveImportLegacy'])document.getElementById(id).addEventListener('change',taReadFile);
 document.getElementById('taClubIntegrityExport').onclick=()=>archiveDownloadFile(JSON.stringify(window.taLastMigration||{status:'nessuna simulazione',instructions:'Seleziona un backup JSON delle partite nel recupero guidato.'},null,2),'TA-INT-004_integrita.json');
 document.getElementById('taRecoveryExportBefore').onclick=()=>{document.getElementById('archiveExportBackup').click();if(taPending?.kind==='riconciliazione archivio'){taRepairBeforeExported=true;const ack=document.getElementById('taRepairBackupAck');if(ack)ack.disabled=false;taStatus('Backup precedente generato. Controlla che il download sia riuscito prima di confermare.');renderClubDiagnostics();}};
 document.getElementById('taPartialConsent').onchange=renderClubDiagnostics;
 document.getElementById('taIssuePrev').onclick=()=>{taIssuePage=Math.max(0,taIssuePage-1);renderClubDiagnostics()};document.getElementById('taIssueNext').onclick=()=>{taIssuePage++;renderClubDiagnostics()};
 document.getElementById('taUseBackupRules').onchange=async ev=>{
  if(archiveBackupBusy||archiveTransferBusy||smartImportBusy||archiveMergePending){ev.target.checked=!ev.target.checked;taStatus('Attendi la fine dell’operazione in corso.',true);return;}
  if(!taSourceText)return;archiveBackupBusy=true;try{await taPrepare(taSourceText,taSourceName)}finally{archiveBackupBusy=false;renderClubDiagnostics()}
 };
 document.getElementById('taRecoveryConfirm').onclick=async()=>{
  if(taPending?.kind==='riconciliazione archivio'&&(!taRepairBeforeExported||!document.getElementById('taRepairBackupAck')?.checked)){taStatus('Scarica il backup precedente e conferma di aver verificato il download prima della riconciliazione.',true);return;}
  if(!taPending||archiveBackupBusy||archiveTransferBusy||smartImportBusy||archiveMergePending)return;
  const p=taPending;if(!p.report.safe&&!(p.report.canPartial&&document.getElementById('taPartialConsent').checked))return;
  if(!confirm('Confermi '+p.report.importable+' righe sicure e '+p.report.problematic+' righe escluse? L’archivio avrà '+p.records.length+' incontri. La situazione precedente resta ripristinabile.'))return;
  archiveBackupBusy=true;document.getElementById('taRecoveryConfirm').disabled=true;
  try{await taAtomicCommit(p,p.kind)}catch(ex){p.report.saveError=ex.message;if(p.committed)p.report.status='salvata_verifica_necessaria';await taPersistReport(p.report);taStatus(ex.message,true)}finally{archiveBackupBusy=false;renderClubDiagnostics()}
 };
 document.getElementById('taRecoveryUndo').onclick=async()=>{
  if(archiveBackupBusy||archiveTransferBusy||smartImportBusy||archiveMergePending)return;archiveBackupBusy=true;
  try{const undo=await taStoreGet('recoveryUndo'),disk=await archiveDbGet();if(!undo)throw Error('Nessun recupero precedente da annullare.');
   if(disk.revision!==undo.afterRevision)throw Error('Ci sono modifiche successive al recupero. Per conservarle, scarica il backup e avvia una nuova simulazione; il ripristino diretto è bloccato.');
   if(!TARecovery.equal(taAux(),disk.recoveryAux))throw Error('Dati ausiliari modificati dopo il recupero: ripristino diretto bloccato. Scarica il backup e avvia una nuova simulazione.');
   if(!confirm('Ripristinare la situazione precedente al recupero, incluse le associazioni dei club?'))return;
   const snap=undo.snapshot,p={records:TAClubs.expandCompact(snap.rows||[]),aux:snap.recoveryAux||{},rules:snap.clubRules||[],diskToken:TARecovery.stable(disk),fingerprint:taFingerprint(),report:{status:'ripristino',inputCount:snap.rows?.length||0,outputCount:snap.rows?.length||0,errors:[],collisions:[],safe:true}};
   await taAtomicCommit(p,'ripristino');taStatus('Situazione precedente ripristinata e riletta correttamente. Il registro trade non è stato modificato.');
  }catch(ex){taStatus(ex.message,true)}finally{archiveBackupBusy=false}
 };
 document.getElementById('taRecoveryClear').onclick=async()=>{if(archiveBackupBusy)return;if(!confirm('Eliminare soltanto l’ultima simulazione? Le partite non verranno modificate.'))return;taPending=null;taSourceText=null;window.taLastMigration=null;await taReportSave;try{await taStorePut('recoveryReport',null)}catch(ex){taStatus(ex.message,true)}renderClubDiagnostics();};
 document.getElementById('taClubSearch').oninput=taRenderClubs;
 clubs.addEventListener('click',ev=>{const selected=ev.target.closest('[data-club-select]');if(selected)taSelectClub(selected.dataset.clubSelect);const suggestion=ev.target.closest('[data-club-suggestion]');if(suggestion){const s=window.taClubSuggestions[+suggestion.dataset.clubSuggestion];taSelectClub(s.fromId);if(s.candidates.length===1)document.getElementById('taClubTarget').value=s.candidates[0].id;}});
 document.getElementById('taClubExport').onclick=()=>archiveDownloadFile(JSON.stringify({...taRegistryView(),rules:TAClubs.rules(),suggestions:window.taClubSuggestions},null,2),'TA-INT-004_anagrafica.json');
 document.getElementById('taClubReadReport').onchange=async ev=>{const f=ev.target.files?.[0];ev.target.value='';if(!f)return;try{const x=JSON.parse(await f.text());if(!Array.isArray(x.clubs)||x.clubs.some(c=>!c.id||!c.name||!c.country||!Array.isArray(c.aliases)))throw Error('Rapporto anagrafico non valido');taExternalClubs=x.clubs;taRenderClubs();taStatus('Elenco squadre caricato per revisione. Nessuna partita o associazione modificata.')}catch(ex){taStatus(ex.message,true)}};
 const ruleKey=r=>TARecovery.stable([TAClubs.key(r.alias),r.country,r.provider||'',r.sourceId??null,r.scope||'alias',r.scope==='identity'?r.fromId:'']);
 async function simulateRules(additions){
  if(!archiveReady||archiveBackupBusy||archiveTransferBusy||smartImportBusy||archiveMergePending)throw Error('Attendi la fine dell’operazione in corso prima di simulare.');
  if(!archiveDb||archiveMode!=='indexeddb')throw Error('Per salvare associazioni in sicurezza serve la memoria estesa IndexedDB. La copia locale precedente resta disponibile.');
  archiveBackupBusy=true;try{
  const map=new Map(TAClubs.rules().map(r=>[ruleKey(r),r]));for(const r of additions)map.set(ruleKey(r),r);const rules=[...map.values()];
  const content=taSourceText||JSON.stringify({format:'TradingAnalyticsBackup',version:2,records:archiveCompact(rows),manual:man,memberships:leaguePathRefs});
  if(!rows.length&&!taSourceText){
   // Registry-only preview, still committed atomically with the unchanged archive.
   const disk=await archiveDbGet(),saved=TAClubs.rules();taEnsureCurrent(disk);try{TAClubs.configure(rules);TAClubs.configure(saved)}catch(ex){TAClubs.configure(saved);throw ex;}
   const report={status:'pronta',operation:'identità',inputCount:0,outputCount:0,importable:0,problematic:0,errors:[],collisions:[],changes:[],safe:true,rulesAdded:additions};
   taPending={records:[],rules,aux:taAux(),fingerprint:taFingerprint(),diskToken:TARecovery.stable(disk),report,sourceRecords:[],kind:'identità'};await taPersistReport(report);
  }else{await taPrepare(content,taSourceText?taSourceName:'Associazioni club',rules,'identità');taPending.report.rulesAdded=additions;await taPersistReport(taPending.report);}
  taStatus('Conseguenze simulate. Esamina incontri e nomi prima/dopo nel recupero guidato, poi usa «Conferma e salva».');host.scrollIntoView({behavior:'smooth'});return taPending;
  }finally{archiveBackupBusy=false;renderClubDiagnostics()}
 }
 // Flusso rapido: due nomi -> stesso club, sempre con simulazione e conferma esplicita.
 const quick=document.createElement('div');quick.className='ta-quick-alias';quick.innerHTML=`<div class="ta-quick-head"><h4>Correggi un nome in 3 passaggi</h4><p>Scegli il nome presente negli incontri e il club corretto. Non devi conoscere codici o modificare JSON.</p></div>
 <div class="ta-quick-grid"><label>1 · Nome da correggere<input id="taQuickFrom" list="taQuickFromOptions" autocomplete="off" placeholder="Cerca nome attuale…"><datalist id="taQuickFromOptions"></datalist></label>
 <label>2 · È la stessa squadra di…<input id="taQuickTo" list="taQuickToOptions" autocomplete="off" placeholder="Cerca il club corretto…"><datalist id="taQuickToOptions"></datalist></label></div>
 <p class="hint" id="taQuickExplain">Seleziona una voce completa dall’elenco. Le squadre omonime di Paesi diversi restano distinte.</p>
 <label class="ta-quick-check"><input type="checkbox" id="taQuickConsent"> Ho verificato che entrambi i nomi indicano lo stesso club.</label>
 <button class="p" type="button" id="taQuickSimulate">3 · Verifica e simula la correzione</button> <button type="button" id="taQuickApply" disabled>4 · Conferma e salva</button>
 <p class="hint" id="taQuickStatus" role="status"></p><p class="hint">Dopo la simulazione, vai in <b>Recupero guidato JSON → Conferma e salva</b>. Per creare un nuovo club o separare due società, usa le opzioni avanzate più sotto.</p>`;
 const header=clubs.querySelector('h3');header.insertAdjacentElement('afterend',quick);
 const advanced=document.createElement('details');advanced.className='ta-quick-advanced';advanced.innerHTML='<summary>Gestione avanzata · Paese, identità, separazione di club e dati delle fonti</summary><div class="ta-quick-advanced-body"></div>';
 const counts=document.getElementById('taClubCounts');clubs.insertBefore(advanced,counts);
 const infoNodes=[counts,document.getElementById('taClubSearch'),document.getElementById('taClubTable'),document.getElementById('taClubEdit')];
 // Le etichette e i comandi già presenti restano nel pannello avanzato.
 for(const node of [...clubs.children])if(node!==header&&node!==quick&&node!==advanced&&node.nodeType===1)advanced.querySelector('div').appendChild(node);
 function taQuickChoices(){
  const clubs=taClubOptions();const labels=new Map();
  const counts=new Map();for(const c of clubs){const k=c.name+' · '+c.country;counts.set(k,(counts.get(k)||0)+1)}
  const used=new Map();for(const c of clubs){const k=c.name+' · '+c.country;const n=(used.get(k)||0)+1;used.set(k,n);const label=k+(counts.get(k)>1?' · voce '+n:'');labels.set(label,c)}
  return labels;
 }
 let quickChoices=new Map(),quickPending=null;
 function taQuickRefresh(){
  quickChoices=taQuickChoices();
  const options=[...quickChoices].sort(([a],[b])=>a.localeCompare(b,'it'));
  const html=options.map(([label])=>'<option value="'+e(label)+'"></option>').join('');
  document.getElementById('taQuickFromOptions').innerHTML=html;
  document.getElementById('taQuickToOptions').innerHTML=html;
 }
 const quickStatus=text=>{document.getElementById('taQuickStatus').textContent=text;};
 const quickDisplay=()=>{
  const from=quickChoices.get(document.getElementById('taQuickFrom').value),to=quickChoices.get(document.getElementById('taQuickTo').value);
  document.getElementById('taQuickExplain').textContent=from&&to?from.name+' ('+from.country+') → '+to.name+' ('+to.country+'). La simulazione confronterà gli incontri prima e dopo.':'Scegli entrambi i nomi dall’elenco che compare mentre scrivi, compreso il Paese.';
 };
 for(const id of ['taQuickFrom','taQuickTo'])document.getElementById(id).addEventListener('input',()=>{quickPending=null;document.getElementById('taQuickApply').disabled=true;quickDisplay()});
 document.getElementById('taQuickConsent').addEventListener('change',()=>{quickPending=null;document.getElementById('taQuickApply').disabled=true});
 document.getElementById('taQuickSimulate').onclick=async()=>{
  try{
   const from=quickChoices.get(document.getElementById('taQuickFrom').value),to=quickChoices.get(document.getElementById('taQuickTo').value);
   if(!from||!to)throw Error('Seleziona entrambi i nomi dalle opzioni proposte, non solo digitando il testo.');
   if(from.id===to.id)throw Error('I nomi selezionati hanno già la stessa identità: non serve unirli.');
   if(!document.getElementById('taQuickConsent').checked)throw Error('Devi verificare e confermare che i due nomi indicano la stessa società.');
   if(['UNSPECIFIED','INT'].includes(from.country)||['UNSPECIFIED','INT'].includes(to.country))throw Error('Paese non definito o competizione internazionale: apri Gestione avanzata e specifica il contesto prima di unire.');
   if(from.country!==to.country)throw Error('I due club hanno Paesi diversi. Usa Gestione avanzata per verificare il contesto; nessuna fusione è stata eseguita.');
   const alias=from.identityName||from.name;
   const rule={alias,country:from.country,fromId:from.id,scope:'alias',provider:from.provider||null,sourceId:from.sourceId??null,targetId:to.id,targetName:to.name,targetCountry:to.country,evidence:'Conferma esplicita nell’interfaccia rapida: '+from.name+' = '+to.name,confirmedAt:new Date().toISOString()};
   if(rule.sourceId!=null&&!rule.provider)throw Error('Questo nome contiene un ID senza provider: usa Gestione avanzata.');
   quickStatus('Simulazione in corso…');document.getElementById('taQuickApply').disabled=true;quickPending=await simulateRules([rule]);
   document.getElementById('taQuickApply').disabled=document.getElementById('taRecoveryConfirm').disabled;
   quickStatus('Simulazione pronta: verifica nomi, risultati e collisioni nel pannello Backup e recupero JSON. Solo il pulsante «Conferma e salva» applica le modifiche.');
  }catch(ex){quickStatus(ex.message||String(ex));}
 };
 // Popola le scelte una volta per ogni aggiornamento dell’anagrafica; non interrompere gli altri gestori.
 document.getElementById('taQuickApply').onclick=()=>{const safe=document.getElementById('taRecoveryConfirm');if(!safe||safe.disabled||!quickPending||quickPending!==taPending){quickStatus('La simulazione non è ancora approvabile: consulta i conflitti nel Recupero guidato JSON.');return}safe.click()};
 const oldRender=taRenderClubs;
 taRenderClubs=function(...args){const r=oldRender(...args);taQuickRefresh();return r;};
 taQuickRefresh();
 const quickStyle=document.createElement('style');quickStyle.textContent='.ta-quick-alias{border:1px solid var(--ln);border-radius:12px;padding:16px;margin:12px 0;background:var(--in)} .ta-quick-head h4{margin:0 0 6px;font-size:17px} .ta-quick-head p{margin:3px 0 10px;font-size:13px;color:var(--mu)} .ta-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px} .ta-quick-grid input{width:100%;min-width:0} .ta-quick-check{display:flex!important;align-items:center;gap:8px} .ta-quick-advanced{margin:16px 0;border:1px solid var(--ln);border-radius:9px;padding:10px} .ta-quick-advanced-body{padding-top:12px} @media(max-width:720px){.ta-quick-grid{grid-template-columns:1fr}}';document.head.append(quickStyle);
 document.getElementById('taClubPreview').onclick=async()=>{
  try{const alias=document.getElementById('taClubAlias').value.trim(),country=document.getElementById('taClubCountry').value.trim().toUpperCase(),evidence=document.getElementById('taClubEvidence').value.trim(),distinct=document.getElementById('taClubAction').value==='distinct';
   const target=distinct?null:taClubOptions().find(c=>c.id===document.getElementById('taClubTarget').value);if(!distinct&&!target)throw Error('Scegli il club corretto dall’elenco.');
   if(distinct&&!taIdentitySelection)throw Error('Seleziona prima la squadra da distinguere.');
   const id=distinct?'club:user:'+crypto.randomUUID():target.id,name=distinct?document.getElementById('taClubDistinctName').value.trim():target.name;
   if(!name)throw Error('Indica il nome del club distinto.');
   const scope=document.getElementById('taClubScope').value;if(scope==='identity'&&!taIdentitySelection)throw Error('Seleziona l’identità prima di applicare una decisione all’intero club.');
   const rule={alias,country,fromId:taIdentitySelection?.id||null,scope,provider:taIdentitySelection?.provider||null,sourceId:taIdentitySelection?.sourceId??null,targetId:id,targetName:distinct?name+' ['+country+' · '+id.slice(-6)+']':name,targetCountry:distinct?country:target.country,evidence,confirmedAt:new Date().toISOString()};
   if(rule.sourceId!=null&&!rule.provider)throw Error('L’ID della fonte richiede il nome del provider: non si può confermare senza contesto.');
   await simulateRules([rule]);
  }catch(ex){taStatus(ex.message,true)}
 };
 document.getElementById('taClubBatch').onclick=async()=>{try{
  if(!document.getElementById('taClubBatchConsent').checked)throw Error('Verifica le proposte e seleziona la conferma esplicita prima di simulare.');
  const list=(window.taClubSuggestions||[]).filter(s=>s.candidates.length===1);if(!list.length)throw Error('Nessuna proposta documentata con destinazione unica.');
  await simulateRules(list.map(s=>({alias:s.alias,country:s.country,fromId:s.fromId,scope:'alias',provider:s.provider,sourceId:s.sourceId,targetId:s.candidates[0].id,targetName:s.candidates[0].name,targetCountry:s.candidates[0].country,evidence:'Conferma operativa esplicita delle proposte documentate: '+s.reason,confirmedAt:new Date().toISOString()})));
 }catch(ex){taStatus(ex.message,true)}};
 const before=refreshDataStatus;refreshDataStatus=function(...args){const result=before(...args);renderClubDiagnostics();return result};
 renderClubDiagnostics();
 window.taRecoveryUIReady=(async()=>{await window.taAppInitialized;try{window.taLastMigration=await taStoreGet('recoveryReport');if(window.taLastMigration&&!window.taLastMigration.savedAt)taStatus('Rapporto precedente conservato. Per confermare, seleziona di nuovo il backup: verrà verificato rispetto all’archivio attuale.');}catch(ex){taReportPersistenceError=ex.message}renderClubDiagnostics();})();
})();
