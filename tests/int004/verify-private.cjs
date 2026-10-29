/* Exact original-value accounting via reconciliation lineage, never fuzzy matching. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),C=require('../../ta-clubs-v4'),R=require('../../ta-json-recovery-rc5'),Baseline=require('../../ta-json-recovery-rc4');
const [sourcePath,recoveredPath,privateDir,publicReport='private-integrity']=process.argv.slice(2);if(!privateDir||!/^private-[a-z-]+$/.test(publicReport))throw Error('Provide original, actual browser export, private output directory and safe report name');const root=path.resolve(__dirname,'../..'),out=path.resolve(privateDir);if(out===root||out.startsWith(root+path.sep))throw Error('Private evidence cannot be in the repository');
const bytes=fs.readFileSync(sourcePath),doc=JSON.parse(bytes),raw=C.expandCompact(doc.records),recoveredDoc=JSON.parse(fs.readFileSync(recoveredPath)),actual=C.expandCompact(recoveredDoc.records),legacy=Baseline.plan(doc),proposal=R.reconcile(raw),errors=[];let count=0,quotes=0,names=0;
if(legacy.report.outputCount!==28402||!legacy.report.safe)throw Error('Frozen rc4 baseline changed');if(actual.length!==proposal.records.length)throw Error('Actual browser export count differs from the conservative preview');
const empty=x=>x===null||x===undefined||x==='';const preserved=(r,k,v)=>R.equal(r.o?.[k],v)||(Array.isArray(v)&&Array.isArray(r.o?.[k])&&v.every(item=>r.o[k].some(next=>R.equal(item,next))))||(r.o?.RecoveryEvidence||[]).some(e=>e.field===k&&e.values?.some(x=>R.equal(x,v)))||(r.o?.RecoveryFixtureEvidence||[]).some(e=>R.equal(e.metadata?.[k],v))||(k==='Phase'&&(r.o?.FixtureSourceContexts||[]).some(e=>e.phase===v));
for(const entry of proposal.report.coverage){const next=actual[entry.outputIndex];for(const item of entry.inputs){const old=raw[item.index];count++;
 for(const k of ['d','lg','h','a','ht','hth','hta','shots']){if(empty(old[k]))continue;if(old.up&&['h','a','ht','hth','hta','shots'].includes(k)&&!next.up){if(!R.equal(old[k],next[k])&&!(next.o?.RecoveryFixtureEvidence||[]).some(e=>R.equal(e.values?.[k],old[k])))errors.push({index:item.index,field:k});}else if(!R.equal(old[k],next[k]))errors.push({index:item.index,field:k});}
 for(const [k,v]of Object.entries(old.o||{})){if(empty(v))continue;if(k.startsWith('Club')){if(k.endsWith('Id')&&next.o?.[k]!==v&&!(next.o?.[k.replace(/Id$/,'LegacyIds')]||[]).includes(v))errors.push({index:item.index,field:k});continue;}if(!preserved(next,k,v))errors.push({index:item.index,field:'o.'+k});if(/^(B365|Avg|Max|PS|BW|BF)/.test(k))quotes++;}
 for(const [side,k]of[['Home','H'],['Away','A']]){const name=old.o?.['Club'+side+'Raw']??old[k];if(next[k]===name||next.o?.['Club'+side+'Raw']===name||(next.o?.['Club'+side+'Sources']||[]).some(s=>s.name===name))names++;else errors.push({index:item.index,field:'source name '+side});}
}}
let manualFieldsChecked=0,manualsPreserved=0;
for(const [index,m]of (doc.manual||[]).entries()){
 if((recoveredDoc.manualUnassigned||[]).some(n=>R.equal(n,m))){manualsPreserved++;continue;}
 // A recovered rc4 manual already carries its immutable original payload.
 // Compare that leaf and EVERY domain field; do not require wrapping the
 // whole derived rc4 identity metadata as a second "original" payload.
 const original=m.o?.LegacyManualOriginal??m,candidates=(recoveredDoc.manual||[]).filter(n=>R.equal(n.o?.LegacyManualOriginal,original)||R.equal(n,m));
 if(candidates.length!==1){errors.push({manual:index,field:'missing or ambiguous original manual payload'});continue;}
 const n=candidates[0],before=errors.length;
 for(const [k,v]of Object.entries(m))if(!['H','A','o'].includes(k)&&!empty(v)){manualFieldsChecked++;if(!R.equal(n[k],v))errors.push({manual:index,field:k});}
 for(const [k,v]of Object.entries(m.o||{})){
  if(empty(v))continue;
  if(k.startsWith('Club')){
   if(k.endsWith('Id')&&n.o?.[k]!==v&&!(n.o?.[k.replace(/Id$/,'LegacyIds')]||[]).includes(v))errors.push({manual:index,field:k});
   continue;
  }
  manualFieldsChecked++;if(!preserved(n,k,v))errors.push({manual:index,field:'o.'+k});
 }
 for(const [side,k]of [['Home','H'],['Away','A']]){
  const raw=m.o?.['Club'+side+'Raw']??m[k];manualFieldsChecked++;
  if(n[k]!==raw&&n.o?.['Club'+side+'Raw']!==raw&&!(n.o?.['Club'+side+'Sources']||[]).some(s=>s.name===raw))errors.push({manual:index,field:'source name '+side});
 }
 if(errors.length===before)manualsPreserved++;
}
const summary={outcome:errors.length?'FAIL':'PASS',originalSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),originalRecords:raw.length,rc4BaselineDistinct:legacy.report.outputCount,rc5ConservativeRecords:actual.length,consolidatedCopies:proposal.report.compatible+proposal.report.identical,additionalConsolidationsComparedWithRc4:legacy.report.outputCount-actual.length,retainedUnresolvedRows:proposal.report.preservedUnresolved,originalRowsAccountedFor:count,nonemptyQuoteValuesChecked:quotes,originalNamesPreserved:names,manualPayloadsPreserved:manualsPreserved,manualFieldsChecked,errorCount:errors.length,personalRowsPublished:false};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,publicReport+'-details.json'),JSON.stringify({summary,errors},null,2));fs.writeFileSync(path.join(root,'qa/int004',publicReport+'.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));if(errors.length)process.exitCode=1;
