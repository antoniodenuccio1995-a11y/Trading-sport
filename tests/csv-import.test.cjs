const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../ta-csv-import');
const standard='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG\n';
const line=(code='N1',date='12/08/2024',home='Ajax',away='PSV',hg='2',ag='1',ht='1',at='0')=>[code,date,home,away,hg,ag,ht,at].join(',')+'\n';
for(const code of ['ROU','DNK','P1','SP1','SP2','F1','F2','N1'])for(const year of [2024,2025]){
 test(`${code} ${year}/${year+1}: league, season, scores`,()=>{
  const x=C.read(standard+line(code,`12/08/${year}`),{filename:'normalizzato.csv',season:year});
  assert.equal(x.league,C.codes[code]);assert.equal(x.records.length,1);
  assert.equal(x.records[0].o.CsvSeason,year);assert.equal(x.records[0].h,2);assert.equal(x.records[0].ht,1);
 });
}
test('normalized UTF-8 BOM, semicolon, case/aliases, quote escaping and Unicode',()=>{
 const x=C.read('\uFEFFleague;season;match_date;home_team;away_team;home_goals;away_goals\r\nSuperLiga Romania;2024/25;2024-08-12;" FC  Universitatea ";"Oțelul, Galați";2;1\r\n');
 assert.equal(x.league,'SuperLiga Romania');assert.equal(x.records[0].H,'FC Universitatea');assert.equal(x.records[0].A,'Oțelul, Galați');assert.equal(x.records[0].ht,null);
 assert.equal(C.grid('a,b\n"x ""y""",z')[1][0],'x "y"');
});
test('manual league required when both filename and metadata are absent',()=>{
 const csv='Date,HomeTeam,AwayTeam,FTHG,FTAG\n2025-01-10,Ajax,PSV,1,0';
 assert.throws(()=>C.read(csv),/selezionarlo/);
 assert.equal(C.read(csv,{league:'Eredivisie',season:'2024/25'}).records[0].lg,'Eredivisie');
});
test('unrecognized code is recoverable through explicit selection',()=>{
 const csv=standard+line('UTILITY_UNKNOWN');
 assert.deepEqual(C.read(csv,{inspect:true}).unknown,['UTILITY_UNKNOWN']);
 assert.equal(C.read(csv,{league:'Ligue 2'}).league,'Ligue 2');
});
test('recognized metadata cannot be relabelled by manual selection',()=>{
 assert.throws(()=>C.read(standard+line('F2'),{league:'Ligue 1'}),/conflitto/);
 assert.throws(()=>C.read(standard+line('F1')+line('F2')),/più campionati/);
 assert.throws(()=>C.read('Div,League,Date,HomeTeam,AwayTeam,FTHG,FTAG\nF1,Ligue 2,2024-08-12,A,B,1,0'),/contraddittorio/);
});
test('Country disambiguates Superliga and survives cumulative season filter',()=>{
 const csv='Country,League,Season,Date,Home,Away,HG,AG\nRomania,Superliga,2024/2025,2024-08-10,A,B,2,1\nRomania,Superliga,2025/2026,2025-08-10,A,B,1,0';
 const x=C.read(csv,{season:'2025/26'});assert.equal(x.league,'SuperLiga Romania');assert.equal(x.records.length,1);assert.equal(x.outOfSeason,1);assert.equal(x.records[0].ht,null);
 const den=C.read(csv.replaceAll('Romania','Denmark'),{season:2024});assert.equal(den.league,'Superliga Danimarca');
});
test('invalid dates rejected without Date.UTC rollover; EU and leap dates supported',()=>{
 for(const value of ['31/02/2025','2025-02-29','2024-13-01','01/01/1899'])assert.equal(C.date(value),null,value);
 assert.equal(C.date('29/02/2024'),Date.UTC(2024,1,29));assert.equal(C.date('31/12/24'),Date.UTC(2024,11,31));
 const x=C.read(standard+line('N1','31/02/2025')+line());assert.equal(x.invalid,1);assert.equal(x.records.length,1);
});
test('partial, negative, fractional and non numeric scores never become zero',()=>{
 const csv=standard+line('N1','12/08/2024','A','B','','')+line('N1','13/08/2024','A','B','1','')+line('N1','14/08/2024','A','B','-1','0')+line('N1','15/08/2024','A','B','1.5','0')+line();
 const x=C.read(csv);assert.equal(x.incomplete,1);assert.equal(x.invalid,3);assert.equal(x.records.length,1);
 const f=C.read(csv,{allowFixtures:true});assert.equal(f.records.filter(r=>r.up).length,1);assert.equal(f.records.find(r=>r.up).h,null);
});
test('missing/impossible HT is null, actual 0-0 is evidence',()=>{
 const a=C.read(standard+line('N1','12/08/2024','A','B','2','1','','')).records[0];assert.equal(a.ht,null);
 const b=C.read(standard+line('N1','12/08/2024','A','B','2','1','3','0')).records[0];assert.equal(b.ht,null);
 const c=C.read(standard+line('N1','12/08/2024','A','B','2','1','0','0')).records[0];assert.equal(c.ht,0);
});
test('date/metadata disagreement rejected; explicit season cannot invent games',()=>{
 assert.throws(()=>C.read('Season,Date,HomeTeam,AwayTeam,FTHG,FTAG\n2024/25,2021-08-12,A,B,1,0',{league:'Eredivisie'}),/Nessun incontro/);
 assert.throws(()=>C.read(standard+line(),{season:'2025/26'}),/Nessun incontro/);
 assert.equal(C.read(standard+line('N1','01/07/2025'),{season:'2024/25'}).records[0].o.CsvSeason,2024);
 assert.equal(C.read(standard+line('N1','01/07/2025'),{season:'2024/25'}).seasonReassigned,1);
 assert.throws(()=>C.read(standard+line(),{season:'2024/26'}),/non valida/);
});
test('cache and community schema remain supported',()=>{
 const cache=C.read('Date,Team 1,FT,HT,Team 2\nFri Aug 11 2023,Volendam,1-2,?,Vitesse',{league:'Eredivisie'});
 assert.equal(cache.records[0].ht,null);assert.equal(cache.records[0].a,2);
 const cm=C.read('date,home,away,ft_home,ft_away,ht_home,ht_away\n2025-08-12,Ajax,PSV,2,1,1,0',{league:'Eredivisie'});assert.equal(cm.records[0].ht,1);
 const fx=C.read('date,home,away\n2025-08-12,Ajax,PSV',{league:'Eredivisie',allowFixtures:true});assert.equal(fx.records[0].up,true);
});
test('malformed quoting, duplicate aliases and shifted columns blocked',()=>{
 assert.throws(()=>C.grid('a,b\n"x,y'),/virgolette/);
 assert.throws(()=>C.read('Date,date,HomeTeam,AwayTeam\n2024-01-01,2024-01-01,A,B'),/duplicate/);
 assert.throws(()=>C.read(standard+line().trim()+',nonempty'),/colonne/);
});
test('filename mapping covers new leagues without guessing active sidebar',()=>{
 for(const code of ['ROU','DNK','SP2','F2','P1'])assert.equal(C.filenameLeague(code+'_2425_normalizzato.csv'),C.codes[code]);
 assert.equal(C.filenameSeason('F2_2024_2025.csv'),2024);assert.equal(C.filenameSeason('SP2_2526.csv'),2025);
});
test('exact 131-column utility header preserves scores, odds and explicit unknown-code recovery',()=>{
 const header=fs.readFileSync(path.join(__dirname,'fixtures/utility-header.csv'),'utf8').trim();
 const fields=header.split(',');assert.equal(fields.length,131);
 const values={Div:'RO1',Date:'12/08/2025',Time:'20:00',HomeTeam:'FCSB',AwayTeam:'CFR Cluj',FTHG:'2',FTAG:'1',FTR:'H',HTHG:'1',HTAG:'0',B365H:'2.25'};
 const csv=header+'\n'+fields.map(h=>values[h]||'').join(',');
 const x=C.read(csv);assert.equal(x.league,'SuperLiga Romania');assert.equal(x.records[0].o.B365H,'2.25');assert.equal(x.records[0].o.Time,'20:00');
 assert.equal(C.read(csv.replace('RO1,','UTILITY_UNKNOWN,'),{league:'SuperLiga Romania',season:'2025/26'}).records[0].h,2);
});
test('candidate script syntax and protected baseline byte identity',()=>{
 const crypto=require('node:crypto'),cp=require('node:child_process');
 const root=path.resolve(__dirname,'..');
 const original=fs.readFileSync(path.join(root,'Trading_Analytics_v0.2T_Recupero_Storici.html'));
 const baseline=cp.execFileSync('git',['show','9dc238b:Trading_Analytics_v0.2T_Recupero_Storici.html'],{cwd:root,maxBuffer:2e6});
 assert.equal(crypto.createHash('sha256').update(original).digest('hex'),crypto.createHash('sha256').update(baseline).digest('hex'));
 const html=fs.readFileSync(path.join(root,'Trading_Analytics_v0.2U-rc1_TA-CSV-001.html'),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
 assert.equal(scripts.length,4);
 for(const script of scripts)cp.execFileSync(process.execPath,['--check'],{input:script});
 // Protect the unchanged statistical/model code block, not just a few sample outputs.
 const block=s=>s.slice(s.indexOf('function weightedHistorical('),s.indexOf('// v0.2E: guided, verified historical import.'));
 // The merge wrapper is inside the block and remains unchanged too.
 assert.equal(block(html),block(original.toString()));
});
