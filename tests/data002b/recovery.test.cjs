const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../ta-clubs-v2.js'),R=require('../../ta-json-recovery.js');
const row=(extra={})=>({d:Date.UTC(2024,7,10),lg:'Ligue 1',H:'PSG',A:'Lyon',h:2,a:1,ht:null,up:false,o:{},hth:null,hta:null,shots:null,...extra});
const backup=records=>({format:'TradingAnalyticsBackup',version:2,records:records.map(r=>[r.d,r.lg,r.H,r.A,r.h,r.a,r.ht,r.up?1:0,r.o,r.hth,r.hta,r.shots])});
const rule=(extra={})=>({alias:'Paris',country:'FRA',targetId:'club:fra-psg',targetName:'Paris SG',targetCountry:'FRA',evidence:'Explicit synthetic test verification',scope:'alias',...extra});
test.beforeEach(()=>C.configure([]));
test('automatic recognition of compact v2, v1, legacy arrays and rows',()=>{
 for(const doc of [backup([row()]),{...backup([row()]),version:1},[row()],{rows:[row()]},{format:'TradingAnalyticsLegacyTransfer',records:[row()]}])assert.equal(R.plan(doc).report.safe,true);
});
test('diagnostic exports are clearly distinguished from backups',()=>{
 for(const doc of [{version:'TA-CLUBS-1',clubs:[]},{status:'nessuna simulazione'},{collisions:[]}]){const p=R.plan(doc);assert.equal(p.report.safe,false);assert.match(p.report.errors[0].error,/rapporto/);}
});
test('malformed JSON and unsupported version retain an exportable report',()=>{for(const doc of ['{bad',{...backup([row()]),version:99}])assert.equal(R.plan(doc).report.errors.length,1)});
test('exact duplicate consolidated without false identity conflict',()=>{const p=R.plan([row(),row()]);assert.equal(p.report.safe,true);assert.equal(p.records.length,1);assert.equal(p.report.identical,1);assert.equal(p.report.collisions[0].kind,'identici')});
test('alias copies consolidate with both raw provenances',()=>{
 const p=R.plan([row(),row({H:'Paris Saint-Germain',A:'Olympique Lyonnais'})]);assert.equal(p.report.safe,true);assert.equal(p.records.length,1);assert.deepEqual(p.records[0].o.ClubHomeSources.map(s=>s.name),['PSG','Paris Saint-Germain']);
});
test('compatible fields enrich without losing odds or metadata',()=>{
 const p=R.plan([row({o:{B365H:2,custom:{x:1}}}),row({hth:1,hta:0,ht:1,shots:[8,6,3,2],o:{AvgH:2.1}})]);
 assert.equal(p.report.safe,true);assert.equal(p.report.compatible,1);assert.equal(p.records[0].o.B365H,2);assert.deepEqual(p.records[0].o.custom,{x:1});assert.equal(p.records[0].hth,1);
});
test('disagreeing final results always blocked and recorded',()=>{
 const p=R.plan([row(),row({h:3})]);assert.equal(p.report.safe,false);assert.equal(p.report.canPartial,false);assert.equal(p.report.problematic,2);assert.equal(p.report.collisions[0].kind,'risultati_discordanti');assert.deepEqual(p.report.collisions[0].records.map(r=>r.result),['2–1','3–1']);
});
test('HT, shots, odds and season disagreements cannot overwrite each other',()=>{
 const pairs=[ [{hth:0,hta:0,ht:0},{hth:1,hta:0,ht:1}], [{shots:[1,2,3,4]},{shots:[2,3,4,5]}], [{o:{B365H:2}},{o:{B365H:3}}], [{o:{CsvSeason:2024}},{o:{CsvSeason:2025}}] ];
 for(const [a,b] of pairs){const p=R.plan([row(a),row(b)]);assert.equal(p.report.safe,false);assert.equal(p.report.collisions[0].kind,'dati_incompatibili');}
});
test('distinct provider evidence is preserved rather than mislabeled as incompatible',()=>{
 const p=R.plan([row({o:{Source:'public A',HomeTeam:'PSG'}}),row({H:'Paris SG',o:{Source:'public B',HomeTeam:'Paris SG'}})]);assert.equal(p.report.safe,true);assert.equal(p.records[0].o.Source,'public A');assert.equal(p.records[0].o.RecoveryEvidence.length,2);
});
test('safe partial plan excludes entire conflicting input group and preserves current rows exactly',()=>{
 const base=[C.canonicalMatch(row())],before=JSON.stringify(base);
 const p=R.plan([row({h:4}),row({d:Date.UTC(2024,7,11),H:'Paris FC'})],base);
 assert.equal(p.report.canPartial,true);assert.equal(p.report.problematic,1);assert.equal(p.report.importable,1);assert.equal(p.records.length,2);assert.equal(JSON.stringify(p.records[0]),before.slice(1,-1));
});
test('invalid rows remain in diagnostic report and cannot pass as a complete import',()=>{
 const p=R.plan([row(),row({d:NaN}),row({h:-1})]);assert.equal(p.report.canPartial,true);assert.equal(p.report.problematic,2);assert.equal(p.report.excluded.length,2);
});
test('ambiguous labels are blocked while unknown distinct labels do not require alias verification',()=>{
 assert.equal(R.plan([row({H:'Paris'})]).report.safe,false);assert.equal(R.plan([row({H:'Synthetic Unlisted Club'})]).report.safe,true);
});
test('existing inconsistent groups cannot be partially reclassified by mirroring them into a file',()=>{
 const base=[row(),row({h:5})],p=R.plan([...base,row({d:Date.UTC(2024,7,11)})],base);assert.equal(p.report.canPartial,false);assert.equal(p.report.safe,false);
});
test('fixtures and completed results combine safely',()=>{
 const p=R.plan([row({up:true,h:null,a:null}),row()]);assert.equal(p.report.safe,true);assert.equal(p.records[0].up,false);assert.equal(p.records[0].h,2);
});
test('planning does not mutate input, observations or user rules',()=>{
 C.resolve('Existing Club','Serie A');const before=JSON.stringify(C.diagnostics()),input=backup([row(),row()]),snapshot=JSON.stringify(input);R.plan(input);assert.equal(JSON.stringify(input),snapshot);assert.equal(JSON.stringify(C.diagnostics()),before);assert.deepEqual(C.rules(),[]);
});
test('40 synthetic former key collisions now classified, not claimed as real user records',()=>{
 const input=[];for(let i=0;i<40;i++){input.push(row({d:Date.UTC(2024,7,10+i)}));input.push(row({d:Date.UTC(2024,7,10+i),H:'Paris SG'}));}
 const p=R.plan(input);assert.equal(p.report.safe,true);assert.equal(p.report.identical,40);assert.equal(p.report.collisions.length,40);assert.equal(p.records.length,40);
});
test('confirmation rules persist IDs across subsequent imports and raw aliases are retained',()=>{
 C.configure([rule()]);const a=C.canonicalMatch(row({H:'Paris'})),b=C.canonicalMatch(a);assert.equal(a.o.ClubHomeId,'club:fra-psg');assert.equal(b.o.ClubHomeId,a.o.ClubHomeId);assert.equal(b.o.ClubHomeRaw,'Paris');assert.equal(R.plan([row({H:'Paris'})]).report.safe,true);
});
test('correcting an erroneous alias association uses raw source name instead of stale canonical name',()=>{
 C.configure([rule()]);const a=C.canonicalMatch(row({H:'Paris'}));C.configure([rule({targetId:'club:fra-paris-fc',targetName:'Paris FC'})]);const b=C.canonicalMatch(a);assert.equal(b.o.ClubHomeId,'club:fra-paris-fc');assert.equal(b.o.ClubHomeRaw,'Paris');
});
test('distinct club decision is stable on reload and does not join similarly named clubs',()=>{
 const a=C.canonicalMatch(row({H:'Test United'}));const rules=[rule({alias:'Test United',fromId:a.o.ClubHomeId,scope:'identity',targetId:'club:user:synthetic',targetName:'Test United [FRA · QA]'})];C.configure(rules);const b=C.canonicalMatch(a);C.configure(rules);const c=C.canonicalMatch(b);assert.equal(c.o.ClubHomeId,'club:user:synthetic');assert.equal(c.o.ClubHomeStatus,'verificata');assert.notEqual(C.resolve('Test United','Premier League').id,c.o.ClubHomeId);
});
test('same provider and source ID keep one identity despite changed source names',()=>{
 const a=C.resolve('Raw A','Ligue 1',{provider:'official',sourceId:10}),b=C.resolve('Raw B','Ligue 1',{provider:'official',sourceId:10});assert.equal(a.id,b.id);assert.notEqual(a.id,C.resolve('Raw A','Ligue 1',{provider:'other',sourceId:10}).id);
});
test('unscoped UI queries do not pollute registry with UNSPECIFIED clubs',()=>{
 C.resolve('Monza','Serie A');for(let i=0;i<10;i++)C.resolve('Monza');C.resolve('not observed');assert.equal(C.diagnostics().clubs.length,1);assert.equal(C.diagnostics().clubs[0].country,'ITA');
});
test('UNSPECIFIED proposals need confirmation and reuse country scoped ID afterwards',()=>{
 const d={clubs:[{id:'unknown',name:'Example',country:'UNSPECIFIED',aliases:['Example']},{id:'country',name:'Example',country:'ITA',aliases:['Example']}]};const s=R.suggestions(d);assert.equal(s.length,1);assert.equal(s[0].requiresConfirmation,true);
 C.configure([rule({alias:'Example',country:'UNSPECIFIED',targetId:'country',targetName:'Example',targetCountry:'ITA'})]);assert.equal(C.resolve('Example','Serie A').id,'country');
});
test('Paris FC and PSG; Manchester City and United; FCSB and CSA remain separate',()=>{
 for(const [lg,a,b] of [['Ligue 1','Paris FC','PSG'],['Premier League','Man City','Man Utd'],['SuperLiga Romania','FCSB','CSA Steaua']])assert.notEqual(C.resolve(a,lg).id,C.resolve(b,lg).id);
});
test('cross country user rules and contradictory duplicate rules rejected',()=>{
 assert.throws(()=>C.configure([rule({targetCountry:'ENG'})]),/Paesi/);assert.throws(()=>C.configure([rule(),rule({targetId:'different'})]),/Due regole/);
});
test('malformed auxiliary data is diagnosed before any import',()=>{
 for(const key of ['manual','memberships','strategies','goalEvents'])assert.equal(R.plan({...backup([row()]),[key]:'invalid'}).report.safe,false);
 assert.equal(R.plan({...backup([row()]),manual:[{H:'bad'}]}).report.safe,false);
});
test('coverage maps every safely consolidated source row',()=>{
 const p=R.plan([row(),row(),row({d:Date.UTC(2024,7,11)})]);assert.equal(p.report.coverage.flatMap(x=>x.inputs).length,3);assert.equal(p.report.outputCount,2);
});
test('membership correction follows preserved raw alias instead of stale display name',()=>{
 C.configure([rule()]);const a=C.canonicalMembership({year:2024,league:'Ligue 1',team:'Paris'});
 C.configure([rule({targetId:'club:fra-paris-fc',targetName:'Paris FC'})]);assert.equal(C.canonicalMembership(a).clubId,'club:fra-paris-fc');
});
test('same user alias in different countries is scoped, and contextless queries stay ambiguous',()=>{
 C.configure([rule({alias:'QA United'}),rule({alias:'QA United',country:'ENG',targetCountry:'ENG',targetId:'club:eng-man-united',targetName:'Man United'})]);
 assert.equal(C.resolve('QA United','Ligue 1').id,'club:fra-psg');assert.equal(C.resolve('QA United','Premier League').id,'club:eng-man-united');assert.equal(C.resolve('QA United').status,'ambigua');
});
test('invalid dates outside JS range and malformed strategies produce diagnostic errors',()=>{
 assert.equal(R.plan([row({d:1e20})]).report.safe,false);assert.equal(R.plan({...backup([row()]),strategies:[{name:'broken'}]}).report.safe,false);
});
test('malformed goal events cannot be saved as valid auxiliary data',()=>{
 assert.equal(R.plan({...backup([row()]),goalEvents:[{key:'bad',goals:[]}]}).report.safe,false);
});
test('equivalent numeric representations are consolidated with both originals retained as evidence',()=>{
 const p=R.plan([row({o:{B365H:'2.10',FTHG:'2'}}),row({o:{B365H:2.1,FTHG:2}})]);assert.equal(p.report.safe,true);assert.equal(p.records[0].o.B365H,'2.10');assert.equal(p.records[0].o.RecoveryEvidence.length,2);
 assert.equal(R.plan([row({o:{B365H:'2.10'}}),row({o:{B365H:2.2}})]).report.safe,false);
});
