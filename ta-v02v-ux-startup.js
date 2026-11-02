/* Read-only startup acceleration; fallback retains the audited synchronous path. */
'use strict';
window.taUXPrepareProjection=async function(snapshot){
 const rules=JSON.stringify(TAClubs.rules()),manualKey=JSON.stringify(man),status=document.querySelector('#uxLoading');
 let worker;
 try{
  if(typeof Worker==='undefined')throw Error('Worker non disponibile');
  worker=new Worker('ta-v02v-ux-worker.js');
  let projected,hydration=Promise.resolve();
  const result=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Preparazione in background oltre 45 secondi')),45000);
   worker.onerror=event=>{event.preventDefault();clearTimeout(timeout);reject(Error(event.message||'Worker non disponibile'))};
   worker.onmessage=event=>{const data=event.data;
    if(data.phase==='projected'){
     window.taUXStartup.workerProjected=performance.now();
     projected=data;
     hydration=(async()=>{for(let offset=0;offset<data.records.length;offset+=500){for(const row of data.records.slice(offset,offset+500))TAClubs.canonicalMatch(row);await new Promise(resolve=>setTimeout(resolve,0));}window.taUXStartup.hydrationReady=performance.now();})();
     hydration.catch(()=>{});
    }
    if(data.phase==='projection'&&status)status.textContent='Verifica delle identità e dei duplicati in background…';
    if(data.phase==='index'&&status)status.textContent='Identità verificate. Preparazione delle viste in background…';
    if(data.phase==='error'){clearTimeout(timeout);reject(Error(data.error))}
    if(data.phase==='complete'){window.taUXStartup.workerIndexReady=performance.now();clearTimeout(timeout);resolve({...data,records:projected.records,report:projected.report})}
   };
   worker.postMessage({rows:snapshot,manual:man,rules:TAClubs.rules()});
  });
  await hydration;
  if(rows!==snapshot||rules!==JSON.stringify(TAClubs.rules())||manualKey!==JSON.stringify(man))throw Error('Il contesto dei dati è cambiato durante la preparazione');
  // Registry hydration above overlaps background indexing, with identical calls.
  taProjectionCache=result.records;taProjectionRows=rows;taProjectionRules=rules;window.taProjectionReport=result.report;
  const note=document.getElementById('taIntegrityNotice'),p=result.report;
  if(note){note.hidden=!p.preservedUnresolved&&!p.compatible&&!p.identical;note.textContent=`Campioni: ${result.records.length} incontri distinti. ${p.compatible+p.identical} copie consolidate nel conteggio; ${p.preservedUnresolved} righe da verificare escluse dalle statistiche. La riconciliazione dei dati salvati si simula nell’Area tecnica.`}
  window.taUXPreparedIndex={rows:snapshot,rules,manualKey,index:result.index};window.taUXStartup.worker='background';
 }catch(error){window.taUXStartup.worker='fallback sincrono';window.taUXStartup.workerNote=error.message;if(status)status.textContent='Preparazione locale compatibile…';}
 finally{worker?.terminate()}
};
