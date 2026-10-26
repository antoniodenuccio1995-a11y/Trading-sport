const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),R=require('../../ta-clubs-v1'),C=require('../../ta-csv-import-v02U-rc2');
const sourceDir=process.argv[2]||'/tmp/ta-data002-sources',root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(sourceDir,'manifest.json'),'utf8'));
const corpus=[],files=[];
for(const file of manifest){
 if(file.status!=='downloaded')continue;
 const bytes=fs.readFileSync(path.join(sourceDir,file.file));if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Source checksum mismatch: '+file.file);
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(_){text=new TextDecoder('windows-1252').decode(bytes);}
 const parsed=C.read(text,{filename:file.file,allowFixtures:false});
 const raw=parsed.records.map(r=>({...r,H:r.o.ClubHomeRaw,A:r.o.ClubAwayRaw,o:Object.fromEntries(Object.entries(r.o).filter(([k])=>!k.startsWith('Club')))}));
 corpus.push(...raw);files.push({source:file.file,count:raw.length,invalid:parsed.invalid,incomplete:parsed.incomplete});
}
const fingerprint=rows=>crypto.createHash('sha256').update(JSON.stringify(rows.map(R.protectedValue))).digest('hex');
const original=JSON.stringify(corpus),before=fingerprint(corpus),plan=R.plan(corpus),after=fingerprint(plan.records);
if(JSON.stringify(corpus)!==original)throw Error('Input corpus mutated');
if(before!==after||!plan.report.protectedFieldsUnchanged||plan.records.length!==corpus.length)throw Error('Protected values/count mismatch');
const report={outcome:plan.report.safe?'PASS':'REVIEW_REQUIRED_COLLISIONS',inputCount:corpus.length,outputCount:plan.records.length,changedNames:plan.report.changedNames,protectedFieldsSHA256Before:before,protectedFieldsSHA256After:after,protectedFieldsUnchanged:before===after,fields:['date','league','FT goals','HT goals and totals','shots','upcoming status','all original non-Club metadata including ALL source odds'],inputNotMutated:JSON.stringify(corpus)===original,collisions:plan.report.collisions,errors:plan.report.errors,sources:files,note:'Dry run only, no database writes; source names restored before applying identity normalization.'};
fs.writeFileSync(path.join(root,'qa/data002/integrity-corpus.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,sources:files.length},null,2));if(!plan.report.safe)process.exitCode=1;
