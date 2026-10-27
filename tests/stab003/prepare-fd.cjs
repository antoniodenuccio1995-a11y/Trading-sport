const fs=require('fs'),path=require('path'),C=require('../../ta-csv-import-v02U-rc2');
const dir=process.argv[2]||'/tmp/ta-stab003-sources',manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),out=[];
for(const f of manifest.filter(x=>['fd','extra'].includes(x.kind)&&x.status==='downloaded')){
 const bytes=fs.readFileSync(path.join(dir,f.file));let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch(_){text=new TextDecoder('windows-1252').decode(bytes)}
 try{const p=C.read(text,{allowFixtures:true,filename:f.file,league:C.codes[f.code]});out.push({source:f,invalid:p.invalid,incomplete:p.incomplete,records:p.records.map(r=>({...r,H:r.o.ClubHomeRaw||r.H,A:r.o.ClubAwayRaw||r.A,o:{CsvSeason:r.o.CsvSeason,HistSourceURL:f.url,HistSourceSHA256:f.sha256,HistProvider:'Football-Data',Phase:'regular'}}))});}
 catch(e){out.push({source:f,error:e.message,records:[]})}
}
fs.writeFileSync(path.join(dir,'fd-parsed.json'),JSON.stringify(out));
console.log(JSON.stringify({files:out.length,rows:out.reduce((n,f)=>n+f.records.length,0),errors:out.filter(f=>f.error).map(f=>({file:f.source.file,error:f.error}))}));
