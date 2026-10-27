/* Integration glue. Repair requires preview, backup generation and explicit save. */
'use strict';
async function taPreviewArchiveReconciliation(){
 if(archiveBackupBusy||archiveTransferBusy||smartImportBusy||archiveMergePending)return;
 archiveBackupBusy=true;taRepairBeforeExported=false;const ack=document.getElementById('taRepairBackupAck');if(ack){ack.checked=false;ack.disabled=true;}
 try{
  await archiveWriteChain;const disk=await archiveDbGet();taEnsureCurrent(disk);
  const result=TARecovery.reconcile(rows),report={...result.report,fileName:'Riconciliazione conservativa dell’archivio attuale',existingCount:rows.length,operation:'riconciliazione archivio',sportingImpact:TARecovery.impact(rows,result.records)};
  taPending={records:result.records,aux:taAux(),rules:TAClubs.rules(),report,kind:'riconciliazione archivio',fingerprint:taFingerprint(),diskToken:TARecovery.stable(disk)};
  taSourceText=null;await taPersistReport(report);document.getElementById('taRJsonCard').open=true;
  taStatus(`Simulazione: ${rows.length} → ${result.records.length} righe. ${result.report.preservedUnresolved} righe irrisolte saranno conservate senza modifiche. Scarica il backup attuale, poi conferma se il confronto è corretto.`);
 }catch(e){taStatus(e.message,true)}finally{archiveBackupBusy=false;renderClubDiagnostics()}
}
(function(){
 const note=document.createElement('p');note.id='taIntegrityNotice';note.className='note';note.hidden=true;document.querySelector('h1').after(note);
 const repair=document.createElement('button');repair.type='button';repair.id='taReconcileArchive';repair.textContent='Simula riconciliazione archivio';repair.onclick=taPreviewArchiveReconciliation;document.getElementById('taRJsonBody').prepend(repair);
 const verify=document.createElement('label');verify.id='taRepairBackupVerify';verify.hidden=true;verify.innerHTML='<input type="checkbox" id="taRepairBackupAck" disabled> Ho verificato che il backup precedente sia stato scaricato e conservato.';document.getElementById('taRJsonBody').append(verify);document.getElementById('taRepairBackupAck').onchange=renderClubDiagnostics;
 const report=document.createElement('button');report.type='button';report.id='taCsvIdentityReport';report.textContent='Scarica conflitti e identità CSV';report.hidden=true;report.onclick=()=>archiveDownloadFile(JSON.stringify(window.taLastCsvIdentityReport,null,2),'TA-INT-004_rapporto_importazione_CSV.json');document.querySelector('#smartImportStatus').after(report);
})();
