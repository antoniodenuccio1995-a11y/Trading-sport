/* Incremental QA proposal, never an in-place edit of a personal archive. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),R=require('../../ta-json-recovery-rc4'),C=require('../../ta-clubs-v3'),H=require('../../ta-history-coverage');
const [input,outputDir]=process.argv.slice(2);if(!input||!outputDir)throw Error('Usage: node recover-private.cjs ORIGINAL_BACKUP PRIVATE_OUTPUT_DIRECTORY');
const root=path.resolve(__dirname,'../..'),out=path.resolve(outputDir);if(out===root||out.startsWith(root+path.sep))throw Error('Private output inside repository is forbidden');fs.mkdirSync(out,{recursive:true});
const bytes=fs.readFileSync(input),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),doc=JSON.parse(bytes),first=R.plan(doc);if(!first.report.safe)throw Error('Original recovery is not safe');
let current=first.records;const operations=[],reviewReasons={sourceDisagreement:0,identityOrUnreconciledFixture:0,other:0},asOf=Date.UTC(2026,9,28);const compact=rows=>rows.map(r=>[r.d,r.lg,r.H,r.A,r.h??null,r.a??null,r.ht??null,r.up?1:0,r.o||{},r.hth??null,r.hta??null,r.shots??null]);
fs.writeFileSync(path.join(out,'recovery-initial-report.json'),JSON.stringify(first.report));
for(const ref of H.manifest.rows.filter(r=>r.runtime&&r.referenceCount)){
 const source=fs.readFileSync(path.join(root,ref.path));if(sha(source)!==ref.sha256)throw Error('Public reference hash mismatch');
 const packet=JSON.parse(source);let incoming=C.expandCompact(packet.records).filter(r=>(!r.up&&r.d<asOf)||(r.up&&r.d>=asOf));
 incoming=H.align(incoming,current);const before=current.length,plan=R.plan(incoming,current);
 for(const e of plan.report.errors){const type=e.error.includes('Fonti pubbliche discordanti')?'sourceDisagreement':e.error.includes('Storico da verificare')?'identityOrUnreconciledFixture':'other';reviewReasons[type]++;}
 if(plan.report.problematic)fs.writeFileSync(path.join(out,`conflicts-${ref.code}-${ref.season}.json`),JSON.stringify({collisions:plan.report.collisions.filter(c=>!['identici','integrabili'].includes(c.kind)),errors:plan.report.errors,excluded:plan.report.excluded}));
 if(!plan.report.safe&&!plan.report.canPartial){operations.push({code:ref.code,season:ref.season,status:'blocked',before,after:before,problematic:plan.report.problematic,errors:plan.report.errors.length});continue;}
 // This is a reversible test copy. Conflicting incoming rows are retained in a
 // private diagnostic file; no archive result is discarded or overwritten.
 current=plan.records;const operation={code:ref.code,season:ref.season,status:plan.report.safe?'safe':'safe-partial-proposal',before,after:current.length,added:plan.report.added,identical:plan.report.identical,compatible:plan.report.compatible,problematic:plan.report.problematic,errors:plan.report.errors.length};operations.push(operation);
 console.log(JSON.stringify(operation));
}
const result={...doc,exportedAt:new Date().toISOString(),records:compact(current),manual:first.metadata.manual,manualUnassigned:first.metadata.manualUnassigned,clubRules:C.rules()};
fs.writeFileSync(path.join(out,'PROPOSTA_backup_integrato_TA-STAB-003.json'),JSON.stringify(result));
const coverage=H.compare(current,asOf);fs.writeFileSync(path.join(out,'coverage-after-integration.json'),JSON.stringify(coverage));
const cols=['league','season','status','present','expectedRegular','expectedFull','ft','ht','htExact','missingHT','missingResults','unreconciledReference','duplicates','differentFT','scope','reliability'];const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(out,'MATRICE_ARCHIVIO_INTEGRATO.csv'),[cols.join(','),...coverage.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n'));
const summary={originalSHA256:sha(bytes),originalUnchanged:sha(fs.readFileSync(input))===sha(bytes),originalRecords:doc.records.length,restoredRecords:first.records.length,proposalRecords:current.length,addedRecords:current.length-first.records.length,manualOriginal:doc.manual.length,manualMigrated:result.manual.length,operations:operations.length,incomingRowsRetainedForReview:operations.reduce((n,o)=>n+(o.problematic||0),0),reviewReasons,coverageStates:coverage.reduce((o,r)=>(o[r.status]=(o[r.status]||0)+1,o),{}),personalRecordsPublished:false};
fs.writeFileSync(path.join(out,'incremental-summary.json'),JSON.stringify(summary,null,2));fs.writeFileSync(path.join(out,'incremental-operations.json'),JSON.stringify(operations,null,2));fs.writeFileSync(path.join(root,'qa/stab003/incremental-summary.json'),JSON.stringify(summary,null,2)+'\n');
if(!summary.originalUnchanged)throw Error('Original file changed');console.log(JSON.stringify(summary));
