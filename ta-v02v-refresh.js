/* Explicit current-season acquisitions. No request, cache open or write at startup. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.TARecent=api;if(root.document)api.install(root)}
})(globalThis,function(){
 'use strict';
 const ignored=/^(?:Club|Hist|CsvSourceFile$|Source$|Acquisition)/;
 function covered(incoming,current){
  for(const k of ['h','a','ht','hth','hta','shots','up'])
   if(incoming[k]!=null&&JSON.stringify(incoming[k])!==JSON.stringify(current[k]))return false;
  for(const [k,v] of Object.entries(incoming.o||{}))
   if(!ignored.test(k)&&v!==''&&v!=null&&JSON.stringify(v)!==JSON.stringify(current.o?.[k]))return false;
  return true;
 }
 function delta(records,existing,{mode='season',today,key,day=86400000}){
  const lookup=new Map(existing.map(r=>[key(r),r]));
  return records.filter(r=>!r.up&&r.d<=today&&(mode!=='recent'||r.d>=today-6*day))
   .filter(r=>{const old=lookup.get(key(r));return !old||(mode!=='new'&&!covered(r,old))});
 }
 function install(w){
  const $=s=>w.document.querySelector(s),host=$('#taRLeagueCard .ta-tech-body');if(!host)return;
  const codes=new Map(SUPPORTED_LEAGUES.filter(x=>x.code).map(x=>[x.name,x.code]));
  const box=w.document.createElement('section');box.className='ux-refresh';box.id='uxRefresh';
  box.innerHTML='<h3>Risultati recenti · aggiornamento incrementale</h3><p>Acquisisce soltanto i CSV della stagione corrente, senza scaricare gli storici. Le fonti statiche inviano l’intero CSV corrente: il confronto locale propone solo righe nuove o integrabili. Controlla l’anteprima prima di confermare.</p><div class="ta-controls"><label>Campionati<select id="uxRefreshLeague" multiple size="4"></select></label><label>Perimetro<select id="uxRefreshMode"><option value="recent">Ultimi 7 giorni</option><option value="season">Stagione corrente</option><option value="new">Soltanto nuove gare della stagione</option></select></label><button id="uxRefreshRun" type="button">Cerca aggiornamenti e simula</button></div><p id="uxRefreshStatus" role="status">Nessuna acquisizione eseguita. Fonti bloccate o leghe senza CSV corrente: resta disponibile l’importazione manuale.</p><ul id="uxRefreshSources"></ul><details><summary>Tempi e stato per campionato</summary><pre id="uxRefreshTiming" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></details>';
  host.prepend(box);for(const [name] of codes)$('#uxRefreshLeague').add(new Option(name,name));
  let active=false;const memory=new Map();
  function cacheDb(){return new Promise((resolve,reject)=>{const q=indexedDB.open('TradingAnalyticsSourceCacheV02V',1);q.onupgradeneeded=()=>q.result.createObjectStore('sources');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
  async function cacheGet(url){if(memory.has(url))return memory.get(url);let db;try{db=await cacheDb();return await new Promise((resolve,reject)=>{const q=db.transaction('sources').objectStore('sources').get(url);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}catch(_){return null}finally{db?.close()}}
  async function cachePut(url,value){memory.set(url,value);let db;try{db=await cacheDb();await new Promise((resolve,reject)=>{const t=db.transaction('sources','readwrite');t.objectStore('sources').put(value,url);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}catch(_){/* cache optional; archive persistence has independent strict checks */}finally{db?.close()}}
  async function acquire(league,year,receipt){
   const code=codes.get(league);if(!code)throw Error('Lega senza CSV stagionale configurato: usare importazione manuale');
   const url=`https://www.football-data.co.uk/mmz4281/${String(year).slice(-2)}${String(year+1).slice(-2)}/${code}.csv`;
   receipt.url=url;const old=await cacheGet(url),headers={};if(old?.etag)headers['If-None-Match']=old.etag;if(old?.modified)headers['If-Modified-Since']=old.modified;
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response,start=performance.now();
   try{try{response=await fetch(url,{mode:'cors',cache:'no-cache',headers,signal:controller.signal})}
    catch(error){if(!Object.keys(headers).length)throw error;response=await fetch(url,{mode:'cors',cache:'no-cache',signal:controller.signal})}
    receipt.fetchMs=performance.now()-start;receipt.httpStatus=response.status;
    if(response.status===304&&old){receipt.downloadMs=receipt.hashMs=receipt.parseMs=0;receipt.cache='HTTP 304';receipt.acquiredAt=new Date().toISOString();return old.records}
    if(!response.ok)throw Error('HTTP '+response.status+'; nessun dato modificato');
    start=performance.now();const bytes=await response.arrayBuffer();receipt.downloadMs=performance.now()-start;receipt.bytes=bytes.byteLength;
    start=performance.now();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');receipt.hashMs=performance.now()-start;
    receipt.acquiredAt=new Date().toISOString();receipt.sourceSHA256=digest;
    if(old?.sha===digest){receipt.parseMs=0;receipt.cache='contenuto invariato';return old.records}
    const text=new TextDecoder('windows-1252').decode(bytes);start=performance.now();
    const parsed=TACsv.read(text,{filename:code+'.csv',league,season:year,allowFixtures:true});
    if(parsed.invalid||parsed.quarantinedLeagueRows)throw Error('CSV con righe non valide: usare anteprima CSV manuale');
    const records=parsed.records.filter(r=>TAV02V.season(r)===year).map(r=>({...r,o:{...r.o,Source:url,AcquisitionSourceSHA256:digest}}));
    receipt.parseMs=performance.now()-start;receipt.cache='nuova acquisizione';receipt.parsedRows=records.length;
    await cachePut(url,{sha:digest,etag:response.headers.get('ETag'),modified:response.headers.get('Last-Modified'),records,acquiredAt:receipt.acquiredAt});return records;
   }finally{clearTimeout(timeout)}
  }
  async function run(requested){
   if(active||!archiveReady||archiveBackupBusy||archiveTransferBusy||smartImportBusy||taPending){$('#uxRefreshStatus').textContent='Archivio occupato o simulazione da completare: conserva/conferma la proposta corrente prima di aggiornare.';return}
   const list=requested||[...$('#uxRefreshLeague').selectedOptions].map(x=>x.value);
   if(!list.length){$('#uxRefreshStatus').textContent='Seleziona almeno un campionato. Le altre leghe restano disponibili nel CSV manuale.';return}
   active=true;$('#uxRefreshRun').disabled=true;$('#uxRefreshStatus').textContent='Acquisizione esplicita in corso…';$('#uxRefreshSources').textContent='';
   const today=TAV02V.day(Date.now()),dt=new Date(today),year=dt.getUTCFullYear()-(dt.getUTCMonth()<6?1:0),receipts=[],incoming=[];let batchMergeMs=0;
   try{
    let next=0;async function worker(){while(next<list.length){const league=list[next++],receipt={league,outcome:'FAIL',merge:'piano batch comune, misurato separatamente',persistence:'non richiesta: anteprima non confermata'};receipts.push(receipt);
     try{const records=await acquire(league,year,receipt),start=performance.now();const aligned=TAHistory.align(records,rows);const additions=delta(aligned,rows,{mode:$('#uxRefreshMode').value,today,key:r=>TAFixtures.key(r)});receipt.compareMs=performance.now()-start;receipt.proposedRows=additions.length;incoming.push(...additions);receipt.outcome='PASS'}
     catch(error){receipt.error=error.message||String(error);receipt.outcome='FAIL: fonte non acquisita'}
     const item=document.createElement('li');item.className='ux-refresh-source';item.textContent=league+': '+(receipt.error||`${receipt.proposedRows} righe da esaminare · ${receipt.cache} · acquisita ${receipt.acquiredAt}`);$('#uxRefreshSources').append(item);
    }}
    await Promise.all([worker(),worker()]);
    if(incoming.length){if(taPending)throw Error('Un’altra simulazione è stata aperta nel frattempo: ripeti dopo averla completata');const start=performance.now();
     await taPrepare(JSON.stringify({format:'TradingAnalyticsBackup',version:2,records:archiveCompact(incoming)}),'Aggiornamento incrementale stagione corrente',null,'aggiornamento recente');
     batchMergeMs=performance.now()-start;
     $('#taRJsonCard').open=true;$('#uxRefreshStatus').textContent=`${incoming.length} osservazioni proposte. Archivio invariato: controlla l’anteprima e conferma nel recupero JSON. Conflitti reali restano bloccati.`;
    }else $('#uxRefreshStatus').textContent=receipts.some(r=>r.error)?'Una o più fonti non acquisite. Archivio invariato; usa il CSV manuale.':'Nessuna riga nuova o integrabile nel perimetro. Archivio invariato, nessuna riscrittura.';
   }catch(error){$('#uxRefreshStatus').textContent=error.message}
   finally{w.taUXRefreshReceipt={asOf:new Date().toISOString(),mode:$('#uxRefreshMode').value,receipts,mergeMs:batchMergeMs,persistenceMs:null,proposedRows:incoming.length,maxConcurrency:2,historicalSourcesFetched:0};$('#uxRefreshTiming').textContent=JSON.stringify(w.taUXRefreshReceipt,null,2);active=false;$('#uxRefreshRun').disabled=false}
  }
  $('#uxRefreshRun').onclick=()=>run();
  // Direct existing update controls to the incremental path; explicit history import stays separate.
  const old=$('#taSCurrent');if(old){const replacement=old.cloneNode(true);replacement.textContent='Aggiorna stagione corrente · incrementale';old.replaceWith(replacement);replacement.onclick=()=>run([...codes.keys()])}
  function bindSelectedUpdate(){for(const id of ['upd2627','heroUpdate','sideUpdate']){const old=$('#'+id);if(!old)continue;const button=old.cloneNode(true);button.disabled=false;button.textContent='Aggiorna risultati recenti';button.title='Acquisizione incrementale con anteprima, senza rileggere gli storici';old.replaceWith(button);button.onclick=()=>run([selectedLeague()])}}
  const priorSourceUI=updateLeagueSourceUI;updateLeagueSourceUI=function(...args){const value=priorSourceUI(...args);bindSelectedUpdate();return value};bindSelectedUpdate();
  document.addEventListener('click',event=>{if(event.target.closest('[data-taS-selected]')){event.preventDefault();event.stopImmediatePropagation();run([selectedLeague()])}},true);
  const confirm=$('#taRecoveryConfirm');confirm.addEventListener('click',()=>{
   if(!taPending||taPending.kind!=='aggiornamento recente')return;
   const started=performance.now(),receipt=w.taUXRefreshReceipt;
   const timer=setInterval(()=>{if(!archiveBackupBusy){clearInterval(timer);if(receipt){
    receipt.persistenceMs=performance.now()-started;
    receipt.persistence=taPending?'non confermata: verificare conflitti o errore':'conferma conclusa; rilettura atomica eseguita dal recupero';
    for(const r of receipt.receipts)if(r.proposedRows)r.persistence=receipt.persistence;
    if(w.taUXRefreshReceipt===receipt)$('#uxRefreshTiming').textContent=JSON.stringify(receipt,null,2);
   }}},50);
  });
  w.taUXRecentRun=run;
 }
 return {covered,delta,install};
});
