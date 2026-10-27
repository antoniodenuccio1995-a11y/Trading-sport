const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../ta-clubs-v3.js'),R=require('../../ta-json-recovery-rc4.js');
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
test('legacy manual d/H/A format migrates from an exact dated fixture and retains the entire original payload',()=>{
 const original={d:row().d,H:'PSG',A:'Lyon',extra:'preserve'},doc={...backup([row()]),manual:[original]},before=JSON.stringify(doc),p=R.plan(doc);
 assert.equal(p.report.safe,true);assert.equal(p.metadata.manual.length,1);assert.equal(p.metadata.manual[0].lg,'Ligue 1');assert.deepEqual(p.metadata.manual[0].o.LegacyManualOriginal,original);assert.equal(JSON.stringify(doc),before);
});
test('unresolved manual context is retained without guessing a league or blocking the match archive',()=>{
 const original={d:row().d+123,H:'Unknown one',A:'Unknown two'},p=R.plan({...backup([row()]),manual:[original]});assert.equal(p.report.safe,true);assert.deepEqual(p.metadata.manualUnassigned,[original]);assert.equal(p.metadata.manual.length,0);
});
test('an auxiliary-only previous backup can be recovered without creating played matches',()=>{
 const p=R.plan({...backup([]),manual:[{d:row().d,H:'A','A':'B'}]});assert.equal(p.report.safe,true);assert.equal(p.records.length,0);assert.equal(p.metadata.manualUnassigned.length,1);
});
test('INT is not a country disambiguation tag and repeated canonicalization is stable',()=>{
 const a=C.canonicalMatch(row({lg:'Champions League',H:'QA International Club',o:{}})),b=C.canonicalMatch(a);assert.deepEqual(a,b);assert.ok(!b.H.includes('[INT]'));
});
test('source-scoped Paris is resolved by exact fixture evidence and never globally aliased',()=>{
 const e=require('../../ta-source-evidence'),f=e.fixtures.find(x=>x.lg==='Ligue 1'&&x.home==='Paris FC'),d=Date.parse(f.date+'T00:00:00Z');
 const p=R.plan([row({d,lg:'Ligue 1',H:'Paris',A:f.away,up:true,h:null,a:null,o:{Source:'Open Matchday (comunità)'}})]);assert.equal(p.report.safe,true);assert.equal(p.records[0].o.ClubHomeId,'club:fra-paris-fc');assert.ok(p.records[0].o.ClubHomeResolution.sha256);
 assert.equal(C.resolve('Paris','Ligue 1').status,'ambigua');assert.notEqual(C.resolve('Paris FC','Ligue 1').id,C.resolve('PSG','Ligue 1').id);
});
test('chronological recovery remaps coverage indices instead of invalidating reload/rollback',()=>{
 const later=row({d:row().d+86400000}),p=R.plan([later,row()]);assert.ok(p.records[0].d<p.records[1].d);assert.equal(p.report.coverage.find(v=>v.inputs.some(x=>x.index===0)).outputIndex,1);
});
test('public reference comparison distinguishes missing matches from unresolved names and HT missingness',()=>{
 const H=require('../../ta-history-coverage'),r=H.manifest.rows.find(x=>x.code==='I1'&&x.season===2024),one=r.references[0];
 const unknown=row({d:one.d,lg:'Serie A',H:'Unmapped home',A:'Unmapped away',h:one.h,a:one.a,o:{CsvSeason:2024}}),c=H.compare([unknown],Date.UTC(2026,9,28)).find(x=>x.code==='I1'&&x.season===2024);
 assert.ok(c.unreconciledReference>0);assert.equal(c.missingResults,0);assert.equal(c.status,'parziale');assert.equal(c.missingHT,1);
});
test('Serie A 2022/23 reference includes the independently sourced relegation playoff',()=>{
 const H=require('../../ta-history-coverage'),ref=H.manifest.rows.find(x=>x.code==='I1'&&x.season===2022);assert.equal(ref.expectedRegular,380);assert.equal(ref.expectedFull,381);assert.equal(ref.referenceCount,381);assert.equal(ref.references.filter(r=>r.phase==='relegation-playoff').length,1);assert.ok(ref.sources.some(s=>s.kind==='espn'));
});
test('League One regular-only file cannot certify the season without the five promotion playoffs',()=>{
 const ref=require('../../ta-history-coverage').manifest.rows.find(x=>x.code==='E2'&&x.season===2024);assert.equal(ref.expectedRegular,552);assert.equal(ref.expectedFull,557);
});
test('community home_shots/home_target headers preserve supplied shot data',()=>{
 const csv=require('../../ta-csv-import-v02U-rc4'),p=csv.read('date,home,away,ft_home,ft_away,ht_home,ht_away,home_shots,away_shots,home_target,away_target\n2026-10-20,A,B,1,0,0,0,10,7,4,2',{league:'Serie A',season:2026});assert.deepEqual(p.records[0].shots,[10,7,4,2]);
});
test('unplayed zero placeholders cannot become an invented halftime result when FT arrives',()=>{
 const p=R.plan([row({up:true,h:0,a:0,ht:0,hth:0,hta:0,o:{HTHG:'0',HTAG:'0'}}),row({ht:1,hth:1,hta:0})]);assert.equal(p.report.safe,true);assert.equal(p.records[0].ht,1);assert.equal(p.records[0].hth,1);assert.equal(p.records[0].o.RecoveryFixtureEvidence[0].values.ht,0);
 const unknown=R.plan([row({up:true,ht:0,hth:0,hta:0}),row()]);assert.equal(unknown.records[0].ht,null);
});
test('reimporting a fixture never fills unknown played HT with an unplayed zero',()=>{
 const p=R.plan([row(),row({up:true,h:0,a:0,ht:0,hth:0,hta:0})]);assert.equal(p.report.safe,true);assert.equal(p.records[0].up,false);assert.equal(p.records[0].ht,null);
});
test('history bridge prefers a documented exact name when alias IDs differ across seasons',()=>{
 const H=require('../../ta-history-coverage'),old=C.canonicalMatch(row({lg:'Serie A',H:'Verona',o:{CsvSeason:2021}})),variant=C.canonicalMatch(row({lg:'Serie A',H:'Hellas Verona',d:row().d+86400000,o:{CsvSeason:2025}}));
 const incoming=row({lg:'Serie A',H:'Verona',d:row().d+2*86400000,o:{CsvSeason:2022}}),p=H.align([incoming],[old,variant])[0];assert.equal(p.o.ClubHomeId,old.o.ClubHomeId);assert.ok(!p.o.HistIdentityAmbiguity);
});
test('history bridge does not merge continental homonyms with conflicting known countries',()=>{
 const H=require('../../ta-history-coverage'),old=C.canonicalMatch(row({lg:'Champions League',H:'QA Same',o:{HomeCountry:'ENG'}}));
 const incoming=row({lg:'Champions League',H:'QA Same',o:{HomeCountry:'ITA'}}),p=H.align([incoming],[old])[0];assert.notEqual(p.o.ClubHomeId,old.o.ClubHomeId);assert.equal(p.o.HomeCountry,'ITA');
});
test('stored pending display names remain stable when a continental match precedes national data',()=>{
 const original=C.canonicalMatch(row({lg:'Serie A',H:'QA Stable'}));const continental={...original,lg:'Champions League',o:{...original.o,HomeCountry:'ITA'}};C.configure([]);assert.equal(C.canonicalMatch(continental).H,original.H);
});

test('documented national aliases consolidate the exact dated fixture while preserving original IDs and provenance',()=>{
 const a=row({lg:'League One',H:'Oxford United',A:'MK Dons'}),b=row({lg:'League One',H:'Oxford',A:'Milton Keynes Dons',ht:1});
 const old=C.canonicalMatch(b),p=R.plan([a,b]);assert.equal(p.report.safe,true);assert.equal(p.records.length,1);assert.equal(p.report.documentedFixtureAliases,1);assert.equal(p.records[0].ht,1);assert.ok(p.records[0].o.ClubHomeLegacyIds.includes(old.o.ClubHomeId));assert.equal(p.records[0].o.ClubHomeSources.length,2);
 assert.equal(R.plan(p.records).report.safe,true);assert.equal(R.plan([b],p.records).records.length,1);
});
test('documented aliases cannot overwrite conflicting results or merge different dates or countries',()=>{
 const a=row({lg:'League One',H:'Oxford United',A:'MK Dons'}),b=row({lg:'League One',H:'Oxford',A:'Milton Keynes Dons'});
 assert.equal(R.plan([a,{...b,h:9}]).report.safe,false);
 assert.equal(R.plan([a,{...b,d:b.d+86400000}]).records.length,2);
 assert.equal(R.plan([a,{...b,o:{HomeCountry:'ITA',AwayCountry:'ITA'}}]).records.length,2);
});
test('provider IDs are not consolidated through a public name dictionary',()=>{
 const a=row({lg:'League One',H:'Oxford United',A:'MK Dons',o:{Provider:'qa',HomeTeamID:'a',AwayTeamID:'b'}}),b=row({lg:'League One',H:'Oxford',A:'Milton Keynes Dons',o:{Provider:'qa',HomeTeamID:'c',AwayTeamID:'d'}});
 assert.equal(R.plan([a,b]).records.length,2);
});
test('Spurs is a documented Tottenham alias in the English national context',()=>{assert.equal(C.resolve('Spurs','Premier League').id,C.resolve('Tottenham Hotspur','Premier League').id)});

test('disputed public observations require review and cannot alter an existing result',()=>{const old=C.canonicalMatch(row()),p=R.plan([row({o:{HistSourceConflict:true}})],[old]);assert.equal(p.report.safe,false);assert.deepEqual(p.records,[old]);assert.match(p.report.errors[0].error,/Fonti pubbliche discordanti/)});
