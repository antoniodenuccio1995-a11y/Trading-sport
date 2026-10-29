/* TA-INT-004: coverage uses the same canonical fixture identity as import and analysis. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./ta-history-manifest-rc5'),require('./ta-clubs-v4'),require('./ta-fixture-identity'),require('./ta-json-recovery-rc5')):factory(root.TAHistoryManifest,root.TAClubs,root.TAFixtures,root.TARecovery);if(typeof module==='object'&&module.exports)module.exports=api;else root.TAHistory=api})(globalThis,function(manifest,clubs,fixtures,recovery){
 'use strict';
 const season=fixtures.season,key=r=>fixtures.key(r,clubs.resolve),identity=(name,league)=>clubs.resolve(name,league).id;
 function align(incoming){return incoming.map(clubs.canonicalMatch)}
 function compare(records,asOf=Date.now()){
  const reconciled=recovery.reconcile(records),groups=new Map(),originalGroups=new Map();
  const collect=(rows,map)=>{for(const r of rows){const k=fixtures.competition(r.lg)+'|'+season(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r)}};collect(reconciled.usableRecords,groups);collect(records,originalGroups);
  return manifest.rows.map(ref=>{
   const k=ref.league+'|'+ref.season,all=groups.get(k)||[],input=originalGroups.get(k)||[],map=new Map(all.map(r=>[key(r),r])),refs=new Map(ref.references.map(r=>[key(r),r])),missing=[],missingFT=[],differentFT=[],unreconciledReference=[],availableHT=[],unmatched=[],futureScored=[];
   const refBases=new Map();for(const r of refs.values()){const b=fixtures.base(r,clubs.resolve);if(!refBases.has(b))refBases.set(b,[]);refBases.get(b).push(r)}
   const byBase=new Map();for(const r of all){const b=fixtures.base(r,clubs.resolve);if(!byBase.has(b))byBase.set(b,[]);byBase.get(b).push(r)}
   for(const r of refs.values()){
    let old=map.get(key(r));if(!old){const candidates=(byBase.get(fixtures.base(r,clubs.resolve))||[]).filter(x=>fixtures.relation(x,r).kind==='same');if(candidates.length===1)old=candidates[0];else if(candidates.length>1){unreconciledReference.push(r);continue;}}
    if(!old){missing.push(r);if(!r.up&&r.d<asOf)missingFT.push(r)}else if(!r.up&&r.d<asOf){if(old.up)missingFT.push(r);else if(old.h!==r.h||old.a!==r.a)differentFT.push({archive:old,reference:r});else if(old.ht==null&&r.ht!=null)availableHT.push(r)}
   }
   for(const r of all){if(!refs.has(key(r))&&!(refBases.get(fixtures.base(r,clubs.resolve))||[]).some(x=>fixtures.relation(x,r).kind==='same'))unmatched.push(r);if(!r.up&&r.d>=asOf)futureScored.push(r)}
   const ft=all.filter(r=>!r.up),ht=ft.filter(r=>Number.isInteger(r.ht)),regular=ft.filter(r=>fixtures.phase(r).stage==='regular'||fixtures.phase(r).stage==='unknown'&&refs.get(key(r))?.o?.Phase==='regular'),teams=new Set(regular.flatMap(r=>[r.o.ClubHomeId,r.o.ClubAwayId])),pairs=new Set(regular.map(r=>r.o.ClubHomeId+'|'+r.o.ClubAwayId)),regularStructure=ref.expectedRegular!=null&&regular.length===ref.expectedRegular&&pairs.size===ref.expectedRegular&&teams.size*(teams.size-1)===ref.expectedRegular;
   const affected=reconciled.report.collisions.filter(c=>c.records?.[0]?.league===ref.league&&(c.records[0].season??season({d:Date.parse(c.records[0].date),o:c.records[0].record?.o}))===ref.season),duplicates=affected.filter(c=>['identici','integrabili'].includes(c.kind)).reduce((n,c)=>n+c.records.length-1,0),conflicts=affected.filter(c=>!['identici','integrabili'].includes(c.kind)).length;
   const archiveReviewRows=reconciled.report.coverage.filter(c=>c.retainedForReview).flatMap(c=>c.inputs).filter(i=>{const r=records[i.index];return r&&fixtures.competition(r.lg)===ref.league&&season(r)===ref.season}).length;
   const closed=ref.season<new Date(asOf).getUTCFullYear()-(new Date(asOf).getUTCMonth()<6?1:0),graphRequired=['I1','I2','E0','E1','E2','E3','D1','F1','F2','SP1','SP2','N1','P1'].includes(ref.code);
   const complete=closed&&ref.expectedFull!=null&&ft.length===ref.expectedFull&&ref.referenceFT===ref.expectedFull&&!missingFT.length&&!differentFT.length&&!unmatched.length&&!unreconciledReference.length&&!duplicates&&!conflicts&&!archiveReviewRows&&!ref.reviewCount&&!ref.sourceConflicts&&!futureScored.length&&(!graphRequired||regularStructure);
   return {code:ref.code,league:ref.league,season:ref.season,runtime:ref.runtime,status:complete?'completo verificato':!ref.originalReferenceCount?'non verificabile':'parziale',present:all.length,inputRows:input.length,archiveReviewRows,ft:ft.length,ht:ht.length,htExact:ft.filter(r=>r.hth!=null&&r.hta!=null).length,missingHT:ft.length-ht.length,fixtures:all.length-ft.length,duplicates,conflicts,differentFT:differentFT.length,missingResults:missingFT.length,missingFromReference:missing.length,unreconciledReference:unreconciledReference.length,availableHT:availableHT.length,unmatchedArchive:unmatched.length,futureScored:futureScored.length,expectedRegular:ref.expectedRegular,expectedFull:ref.expectedFull,regularFT:regular.length,regularStructureVerified:regularStructure,referenceFT:ref.referenceFT,referenceCount:ref.referenceCount,sourceReviewCount:ref.reviewCount||0,sourceConflicts:ref.sourceConflicts,sourceWarnings:ref.parserWarnings,scope:ref.scope,reliability:ref.reliability,sources:ref.sources,path:ref.path,sha256:ref.sha256,reviewPath:ref.reviewPath,details:{missing,missingFT,unreconciledReference,differentFT,availableHT,unmatched,futureScored}};
  });
 }
 return {identity,key,season,align,compare,manifest};
});
