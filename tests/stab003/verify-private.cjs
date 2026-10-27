const fs=require('fs'),path=require('path'),crypto=require('crypto'),C=require('../../ta-clubs-v3'),R=require('../../ta-json-recovery-rc4');
const [originalPath,restoredPath,privateDir]=process.argv.slice(2);if(!privateDir)throw Error('Provide original backup, recovered copy and private output directory');
const root=path.resolve(__dirname,'../..'),out=path.resolve(privateDir);if(out===root||out.startsWith(root+path.sep))throw Error('Private output inside repository forbidden');
const originalBytes=fs.readFileSync(originalPath),doc=JSON.parse(originalBytes),restored=JSON.parse(fs.readFileSync(restoredPath)),input=C.expandCompact(doc.records),output=C.expandCompact(restored.records),index=new Map(output.map(r=>[C.matchId(r),r])),errors=[];let checked=0,sourceNames=0,quoteValues=0;
const empty=v=>v===undefined||v===null||v==='';
for(const [i,raw] of input.entries()){
 const old=C.canonicalMatch(raw);let next=index.get(C.matchId(old));
 if(!next){const candidates=output.filter(r=>r.d===old.d&&r.lg===old.lg&&['Home','Away'].every(side=>r.o?.['Club'+side+'Id']===old.o?.['Club'+side+'Id']||(r.o?.['Club'+side+'LegacyIds']||[]).includes(old.o?.['Club'+side+'Id'])));if(candidates.length===1)next=candidates[0];}
 if(!next){errors.push({index:i,field:'missing match'});continue;}
 for(const k of ['d','lg','h','a','ht','hth','hta','shots']){
  if(raw.up&&!next.up&&['h','a','ht','hth','hta','shots'].includes(k)){
   if(!empty(raw[k])&&!R.equal(raw[k],next[k])&&!(next.o.RecoveryFixtureEvidence||[]).some(e=>R.equal(e.values?.[k],raw[k])))errors.push({index:i,field:'lost fixture placeholder '+k});continue;
  }
  if(raw.up&&['h','a'].includes(k))continue;if(!empty(raw[k])&&!R.equal(raw[k],next[k]))errors.push({index:i,field:k});
 }
 if(!raw.up&&next.up)errors.push({index:i,field:'downgraded FT'});
 for(const [k,v] of Object.entries(raw.o||{})){
  if(k.startsWith('Club')||empty(v))continue;
  const fixtureValue=raw.up&&!next.up&&(next.o.RecoveryFixtureEvidence||[]).some(e=>R.equal(e.metadata?.[k],v));
  if(!R.equal(v,next.o[k])&&!fixtureValue&&!(next.o.RecoveryEvidence||[]).some(e=>e.field===k&&e.values?.some(x=>R.equal(x,v))))errors.push({index:i,field:'o.'+k});
  if(/^(B365|Avg|Max|PS|BW|BF)/.test(k))quoteValues++;
 }
 for(const [side,field] of [['Home','H'],['Away','A']]){const name=raw.o?.['Club'+side+'Raw']??raw[field];if(next.o['Club'+side+'Raw']===name||(next.o['Club'+side+'Sources']||[]).some(s=>s.name===name))sourceNames++;else errors.push({index:i,field:'lost source denomination '+side});}
 checked++;
}
const manual=doc.manual||[];for(const m of manual)if(!(restored.manual||[]).some(x=>R.equal(x.o?.LegacyManualOriginal,m)||R.equal(x,m))&&!(restored.manualUnassigned||[]).some(x=>R.equal(x,m)))errors.push({field:'lost original manual payload'});
const result={outcome:errors.length?'FAIL':'PASS',originalSHA256:crypto.createHash('sha256').update(originalBytes).digest('hex'),originalRecords:input.length,recoveredRecords:output.length,originalRecordsAccountedFor:checked,sourceDenominationsPreserved:sourceNames,nonemptyQuoteValuesChecked:quoteValues,originalManualPayloadsPreserved:manual.length,errorCount:errors.length,personalRecordsPublished:false};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'integrity-'+path.basename(restoredPath)+'.json'),JSON.stringify({result,errors},null,2));fs.writeFileSync(path.join(root,'qa/stab003/integrity-'+({'restored-backup.json':'restored','after-supplied-csv.json':'after-csv','browser-integrated-sample.json':'playoff'}[path.basename(restoredPath)]||'integrated')+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(errors.length)process.exitCode=1;
