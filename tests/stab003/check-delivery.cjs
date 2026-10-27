const fs=require('fs'),path=require('path'),crypto=require('crypto'),H=require('../../ta-history-coverage');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let rows=0,disputed=0;for(const r of H.manifest.rows){const bytes=fs.readFileSync(path.join(root,r.path));if(hash(bytes)!==r.sha256)throw Error('Packet checksum mismatch: '+r.path);const p=JSON.parse(bytes);if(p.records.length!==r.referenceCount)throw Error('Packet count mismatch');for(const x of p.records){if(!x[8]?.HistSources?.length||x[8].HistSources.some(s=>!/^https:\/\//.test(s.url)||!s.sha256))throw Error('Missing public provenance');if(x[8].HistSourceConflict)disputed++;rows++;}}
const read=f=>JSON.parse(fs.readFileSync(path.join(root,'qa/stab003',f)));
const actual=read('real-backup-summary.json'),synthetic=read('synthetic-browser.json'),csv=read('csv-regression.json'),incremental=read('incremental-summary.json');
if(actual.outcome!=='PASS'||actual.pageerrorCount||actual.checks.length!==12)throw Error('Real-data acceptance failed');
if(synthetic.pageerrors.length||synthetic.checks.length!==22)throw Error('Synthetic acceptance failed');
if(csv.matrix.length!==16||csv.checks.length!==9||csv.pageerrors.length)throw Error('CSV regression failed');
for(const name of ['restored','after-csv','playoff','integrated'])if(read('integrity-'+name+'.json').outcome!=='PASS')throw Error('Integrity failed: '+name);
if(incremental.originalRecords!==28544||incremental.restoredRecords!==28402||incremental.proposalRecords!==35022||!incremental.originalUnchanged)throw Error('Incremental summary mismatch');
for(const log of ['unit.txt','csv-unit.txt'])if(!fs.readFileSync(path.join(root,'qa/stab003',log),'utf8').includes('# fail 0'))throw Error('Unit test failed');
const full=read('proposal-browser.json');if(full.outcome!=='PASS'||full.checks.length!==3||full.pageerrorCount)throw Error('Full proposal browser check failed');
if(read('csv-identity-browser.json').outcome!=='PASS')throw Error('CSV identity protection failed');
const files=['Trading_Analytics_v0.2U-rc4_TA-STAB-003.html','ta-clubs-v3.js','ta-json-recovery-rc4.js','ta-csv-import-v02U-rc4.js','ta-stab003-ui.js','ta-source-evidence.js','ta-history-coverage.js','ta-history-manifest.js','ta-stab003-area.js'];
for(const [file,expected] of Object.entries(synthetic.testedSourceSHA256))if(hash(fs.readFileSync(path.join(root,file)))!==expected)throw Error('Synthetic evidence does not match current source: '+file);
const result={outcome:'PASS',sourceSHA256:Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])),publicPackets:H.manifest.rows.length,publicReferences:rows,disputedPublicReferences:disputed,personalBackupIncluded:false,independentReviewPending:true,stableDeploymentPerformed:false};
fs.writeFileSync(path.join(root,'qa/stab003/delivery.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
