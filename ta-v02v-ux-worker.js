/* Same audited pure engines, executed off the UI thread. No network or storage. */
importScripts('ta-source-evidence.js','ta-fixture-identity.js','ta-club-aliases-int004.js','ta-clubs-v4.js',
 'ta-json-recovery-rc5.js','ta-history-manifest-rc5.js','ta-history-coverage-rc5.js','ta-v02v-engine.js');
self.onmessage=function(event){
 try{
  TAClubs.configure(event.data.rules);
  self.postMessage({phase:'projection'});
  const projected=TARecovery.reconcile(event.data.rows);
  self.postMessage({phase:'projected',records:projected.usableRecords,report:projected.report});
  // With stored club IDs the audited index never resolves names. Main-thread
  // registry hydration already performs the original calls; avoid duplicating it.
  const needsObservationContext=projected.usableRecords.some(r=>!r.o?.ClubHomeId||!r.o?.ClubAwayId)||event.data.manual.some(r=>!r.o?.ClubHomeId||!r.o?.ClubAwayId);
  if(needsObservationContext)for(const row of projected.usableRecords)TAClubs.canonicalMatch(row);
  self.postMessage({phase:'index'});
  const analytical=event.data.manual.length?TARecovery.reconcile([...projected.usableRecords,...event.data.manual]).usableRecords:projected.usableRecords;
  const index=TAV02V.createIndex(analytical);
  self.postMessage({phase:'complete',index});
 }catch(error){self.postMessage({phase:'error',error:error.message||String(error)})}
};
