const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const C=require('../../ta-csv-import-v02U-rc2'),R=require('../../ta-clubs-v1');
const header='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG\n';
const mixed=header+'F1,2024-08-01,Known A,Known B,1,0\nOTHER_UNKNOWN,2024-08-02,Unknown C,Unknown D,2,0';
test('F-01: mixed known/unknown requires an explicit row resolution, not merely a league option',()=>{
 assert.throws(()=>C.read(mixed),/righe 3/);assert.throws(()=>C.read(mixed,{league:'Ligue 1'}),/righe 3/);
 const p=C.read(mixed,{inspect:true});assert.equal(p.records.length,1);assert.equal(p.quarantinedLeagueRows,1);assert.deepEqual(p.unresolvedLeagueRows.map(r=>r.row),[3]);
 const x=C.read(mixed,{league:'Ligue 1',confirmUnknownRows:true});assert.equal(x.records.length,2);
 assert.equal(x.records[1].o.CsvLeagueResolution.originalDiv,'OTHER_UNKNOWN');assert.equal(x.records[1].o.CsvLeagueResolution.method,'explicit-user-confirmation');
});
test('F-01: missing row metadata cannot inherit a known code elsewhere',()=>{
 assert.throws(()=>C.read(mixed.replace('OTHER_UNKNOWN','')),/non risolto/);
 assert.throws(()=>C.read(mixed.replace('OTHER_UNKNOWN','N1'),{league:'Ligue 1',confirmUnknownRows:true}),/più campionati/);
});
test('Five required verified aliases resolve to one permanent identity each',()=>{
 for(const [league,variants] of [['Ligue 1',['PSG','Paris SG','Paris Saint-Germain']],['Ligue 1',['Lione','Lyon','Olympique Lyonnais']],['Serie A',['Inter','Internazionale Milano']],['Premier League',['Manchester United','Man Utd']],['Primeira Liga',['Sporting CP','Sporting Lisbon']]]){
  const clubs=variants.map(n=>R.resolve(n,league));assert.equal(new Set(clubs.map(c=>c.id)).size,1);assert.ok(clubs.every(c=>c.status==='verificata'));
 }
});
test('No similarity-only joining; distinct clubs and ambiguities stay separate',()=>{
 assert.notEqual(R.resolve('Paris FC','Ligue 1').id,R.resolve('PSG','Ligue 1').id);
 assert.notEqual(R.resolve('Man United','Premier League').id,R.resolve('Man City','Premier League').id);
 assert.notEqual(R.resolve('ABC FC','Serie A').id,R.resolve('ABC','Serie A').id);
 assert.notEqual(R.resolve('FCSB','SuperLiga Romania').id,R.resolve('CSA Steaua Bucuresti','SuperLiga Romania').id);
 assert.notEqual(R.resolve('Universitatea Craiova','SuperLiga Romania').id,R.resolve('FC U Craiova 1948','SuperLiga Romania').id);
 assert.notEqual(R.resolve('Inter','Serie A').id,R.resolve('Inter','La Liga').id);
 assert.equal(R.resolve('Manchester','Premier League').status,'ambigua');assert.equal(R.resolve('Paris','Ligue 1').status,'ambigua');
 assert.equal(R.resolve('Sporting','Primeira Liga').status,'ambigua');
});
test('Unverified IDs are deterministic, country scoped and survive promotions',()=>{
 const a=R.resolve('QA Wanderers','Premier League'),b=R.resolve('QA Wanderers','Championship');assert.equal(a.id,b.id);assert.equal(a.status,'da_verificare');
 const independent=cp.execFileSync(process.execPath,['-e',`console.log(require('./ta-clubs-v1').resolve('QA Wanderers','Premier League').id)`],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'}).trim();assert.equal(a.id,independent);
 assert.notEqual(a.id,R.resolve('QA Wanderers','Serie A').id);
});
test('Multinational competitions require context for unverified homonyms',()=>{
 assert.notEqual(R.resolve('QA United','Champions League',{country:'ENG'}).id,R.resolve('QA United','Champions League',{country:'ITA'}).id);
 assert.equal(R.resolve('PSG','Champions League').id,R.resolve('Paris SG','Ligue 1').id);
});
test('Provider team IDs distinguish homonyms and permit only exact scoped identifier joins',()=>{
 const a=R.resolve('QA United','Premier League',{sourceId:'11',provider:'example-provider'});
 const b=R.resolve('QA United','Premier League',{sourceId:'22',provider:'example-provider'});assert.notEqual(a.id,b.id);
 assert.equal(a.id,R.resolve('QA United Renamed','Championship',{sourceId:'11',provider:'example-provider'}).id);
 assert.notEqual(a.id,R.resolve('QA United','Premier League',{sourceId:'11',provider:'different-provider'}).id);
});
test('Homonymous opponents with distinct source IDs or countries stay distinct in string-based modules too',()=>{
 const csv='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,Provider,HomeTeamID,AwayTeamID\nE0,2025-08-10,QA United,QA United,1,0,provider,11,22';
 const r=C.read(csv).records[0];assert.notEqual(r.H,r.A);assert.notEqual(r.o.ClubHomeId,r.o.ClubAwayId);assert.equal(r.o.ClubHomeRaw,r.o.ClubAwayRaw);
 const normalized=C.read(csv.replace('Provider,HomeTeamID,AwayTeamID','provider,home_team_id,away_team_id')).records[0];assert.equal(normalized.o.ClubHomeId,r.o.ClubHomeId);assert.equal(normalized.o.ClubAwayId,r.o.ClubAwayId);
 const international='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HomeCountry,AwayCountry\nCL,2025-08-10,QA Rangers,QA Rangers,1,0,ENG,ITA';
 const i=C.read(international).records[0];assert.notEqual(i.H,i.A);assert.notEqual(i.o.ClubHomeId,i.o.ClubAwayId);
 const manual=R.canonicalMatch({d:r.d,lg:r.lg,H:r.H,A:r.A,o:{},up:true});assert.equal(R.matchId(manual),R.matchId(r));assert.equal(R.canonicalMatch(manual).H,r.H);
 const countryManual=R.canonicalMatch({d:i.d,lg:i.lg,H:i.H,A:i.A,o:{},up:true});assert.equal(R.matchId(countryManual),R.matchId(i));assert.equal(R.canonicalMatch(countryManual).H,i.H);
});
test('Original name, provider ID, results, HT, odds and shots remain available',()=>{
 const text='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG,HS,AS,HST,AST,B365H,HomeTeamID\nF1,2024-08-10," Paris Saint-Germain ",Lyon,2,1,0,0,10,8,3,2,2.25,provider-123';
 const row=C.read(text,{filename:'provider.csv'}).records[0];assert.equal(row.H,'Paris SG');assert.equal(row.o.ClubHomeRaw,' Paris Saint-Germain ');assert.equal(row.o.ClubHomeSourceId,'provider-123');assert.equal(row.ht,0);assert.deepEqual(row.shots,[10,8,3,2]);assert.equal(row.o.B365H,'2.25');
});
test('F-02/F-03 shared reader preserves Season and normalizes reference schemas',()=>{
 const s='div;season;match_date;home_team;away_team;home_goals;away_goals\nE1;2024/25;2025-07-10;Reference A;Reference B;1;0\nE1;2025/26;2025-08-10;Other C;Other D;2;0';
 const x=C.read(s,{league:'Championship',season:2024,allowFixtures:true});assert.equal(x.records.length,1);assert.equal(x.records[0].o.CsvSeason,2024);assert.equal(x.outOfSeason,1);
});
test('A permanent stored ID is never silently reallocated by a changed registry',()=>{
 const r=R.resolve('PSG','Ligue 1',{storedId:'historical-permanent-id',storedName:'Historical PSG'});assert.equal(r.id,'historical-permanent-id');assert.equal(r.status,'ambigua');
});
test('Migration simulation is pure and preserves all protected values',()=>{
 const input=[{d:Date.UTC(2024,7,10),lg:'Ligue 1',H:'PSG',A:'Olympique Lyonnais',h:2,a:1,ht:0,hth:0,hta:0,shots:[10,8,3,2],up:false,o:{B365H:'2.25',CsvSeason:2024,Source:'synthetic'}}];
 const before=JSON.stringify(input),registryBefore=JSON.stringify(R.diagnostics()),p=R.plan(input);assert.equal(JSON.stringify(input),before);assert.equal(JSON.stringify(R.diagnostics()),registryBefore);assert.equal(p.report.safe,true);assert.equal(p.report.inputCount,p.report.outputCount);assert.equal(p.report.protectedFieldsUnchanged,true);assert.equal(R.protectedValue(input[0]),R.protectedValue(p.records[0]));assert.equal(p.records[0].A,'Lyon');
});
test('Migration collisions are reported and block application without dropping matches',()=>{
 const row={d:Date.UTC(2024,7,10),lg:'Ligue 1',H:'PSG',A:'Lyon',h:2,a:1,up:false,o:{}};
 const p=R.plan([row,{...row,H:'Paris SG',h:9}]);assert.equal(p.records.length,2);assert.equal(p.report.safe,false);assert.equal(p.report.collisions.length,1);
});
test('Invalid backup values are reported before migration rather than coerced or saved',()=>{
 const row={d:Date.UTC(2024,7,10),lg:'Ligue 1',H:'PSG',A:'Lyon',h:-1,a:0,up:false,o:{}};
 const p=R.plan([row]);assert.equal(p.report.safe,false);assert.equal(p.report.errors.length,1);assert.equal(row.h,-1);
 const badName=R.plan([{...row,h:1,H:123}]);assert.equal(badName.report.safe,false);
});
test('Provenance from alias re-imports is merged rather than discarded',()=>{
 const a=R.canonicalMatch({H:'PSG',A:'Lyon',lg:'Ligue 1',o:{Source:'source-a'}}),b=R.canonicalMatch({H:'Paris SG',A:'Lione',lg:'Ligue 1',o:{Source:'source-b'}});
 const o=R.mergeProvenance(a.o,b.o);assert.equal(o.ClubHomeSources.length,2);assert.equal(new Set(o.ClubHomeSources.map(x=>x.name)).size,2);
});
test('Same-identity opponents cannot enter the archive',()=>{assert.throws(()=>C.read(header+'F1,2024-08-01,PSG,Paris SG,1,0'),/stessa identità/)});
test('Membership normalization keeps declared year, source evidence and identity',()=>{
 const a=R.canonicalMembership({team:'Manchester United',league:'Championship',year:2024,evidenceDate:123});assert.equal(a.year,2024);assert.equal(a.evidenceDate,123);assert.equal(a.clubId,R.resolve('Man Utd','Premier League').id);
 const c=R.resolve('QA Province','Championship',{provider:'provider',sourceId:'123'});
 const ref=R.canonicalMembership({team:c.name,sourceName:c.original,identityName:c.identityName,provider:c.provider,country:c.country,sourceId:c.sourceId,clubId:c.id,year:2024,league:'Championship'});assert.equal(ref.clubId,c.id);assert.equal(ref.associationStatus,c.status);
});
test('Previous versions and score formula implementations remain byte identical',()=>{
 const root=path.resolve(__dirname,'../..'),baseline='b80ff664ff1ffe05045662ad43d22d5c2e9dd3fc';
 for(const name of ['Trading_Analytics_v0.2T_Recupero_Storici.html','Trading_Analytics_v0.2U-rc1_TA-CSV-001.html','ta-csv-import.js'])assert.deepEqual(fs.readFileSync(path.join(root,name)),cp.execFileSync('git',['show',baseline+':'+name],{cwd:root,maxBuffer:2e6}));
 const a=fs.readFileSync(path.join(root,'Trading_Analytics_v0.2U-rc1_TA-CSV-001.html'),'utf8'),b=fs.readFileSync(path.join(root,'Trading_Analytics_v0.2U-rc2_TA-DATA-002.html'),'utf8');
 for(const name of ['gradeMarket','scoreFromPrice','fraction','emptyScore','weightedHistorical','blendedRelative']){
  const block=s=>{const start=s.indexOf('function '+name+'('),end=s.indexOf('\nfunction ',start+1);assert.ok(start>=0);return s.slice(start,end)};
  assert.equal(block(a),block(b),name);
 }
 const inline=[...b.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(v=>v[1]).filter(v=>v.trim());assert.equal(inline.length,5);
 for(const text of inline)cp.execFileSync(process.execPath,['--check'],{input:text});
});
