const test=require('node:test'),assert=require('node:assert/strict'),C=require('../../ta-clubs-v4'),F=require('../../ta-fixture-identity'),R=require('../../ta-json-recovery-rc5');
const row=(extra={})=>({d:Date.UTC(2025,7,22),lg:'Serie B',H:'Pescara',A:'Cesena',h:1,a:3,ht:null,hth:null,hta:null,shots:null,up:false,o:{CsvSeason:2025,Phase:'regular'},...extra});
const copy=extra=>row({H:'Delfino Pescara',A:'Cesena FC',o:{CsvSeason:2025,Phase:'1. Round',Source:'secondary'},...extra});
test.beforeEach(()=>C.configure([]));
test('T1: audit pair has one match, two clubs, original names and phase evidence',()=>{const p=R.plan([row(),copy()]);assert.equal(p.report.safe,true);assert.equal(p.records.length,1);assert.equal(new Set(p.records.flatMap(r=>[r.o.ClubHomeId,r.o.ClubAwayId])).size,2);assert.deepEqual(p.records[0].o.ClubHomeSources.map(s=>s.name),['Pescara','Delfino Pescara']);assert.ok(p.records[0].o.FixtureSourceContexts.some(x=>x.phase==='1. Round'));assert.equal(p.records[0].o.Matchday,1);assert.equal(p.records[0].o.Phase,'regular')});
test('T2: repeated imports are idempotent',()=>{const once=R.plan([row(),copy()]),twice=R.plan([row(),copy()],once.records);assert.equal(twice.report.safe,true);assert.equal(twice.records.length,1);assert.deepEqual(twice.records,once.records)});
test('T3: conflicting FT cannot overwrite the previous record',()=>{const existing=[C.canonicalMatch(row())],p=R.plan([copy({h:9})],existing);assert.equal(p.report.safe,false);assert.deepEqual(p.records,existing);assert.equal(p.report.collisions[0].kind,'risultati_discordanti')});
test('statistics and odds disagreements are conflicts; missing observations integrate',()=>{for(const pair of [[{ht:1,hth:1,hta:0},{ht:2,hth:1,hta:1}],[{o:{B365H:2}},{o:{B365H:3}}],[{shots:[1,2,1,1]},{shots:[2,2,1,1]}]])assert.equal(R.plan([row(pair[0]),copy(pair[1])]).report.safe,false);const p=R.plan([row(),copy({ht:1,hth:1,hta:0,shots:[10,8,3,2]})]);assert.equal(p.report.safe,true);assert.equal(p.records[0].ht,1)});
test('T4: genuinely additional playoff, playout and replay games survive',()=>{const playoff=row({d:Date.UTC(2026,4,22),o:{CsvSeason:2025,Phase:'Playoff, Final'}}),playout=row({d:Date.UTC(2026,4,25),o:{CsvSeason:2025,Phase:'Playout, Final'}});assert.equal(R.plan([row(),playoff,playout]).records.length,3);const r=R.plan([row(),row({o:{CsvSeason:2025,ReplayNumber:1}})]);assert.equal(r.report.safe,true);assert.equal(r.records.length,2)});
test('round numbers are independent of phases and multiphase rounds remain uncertain',()=>{for(const raw of ['1. Round','2. Round','Matchday 3','Round 4','Giornata 5']){assert.equal(F.phase(row({o:{Phase:raw}})).stage,'regular');assert.ok(F.phase(row({o:{Phase:raw}})).matchday)}assert.equal(F.phase(row({lg:'SuperLiga Romania',o:{Phase:'1. Round'}})).stage,'unknown');assert.equal(F.phase(row({lg:'SuperLiga Romania',o:{Phase:'Relegation Round'}})).stage,'relegation-group');assert.equal(F.phase(row({lg:'Champions League',o:{CsvSeason:2025,Phase:'League, Matchday 1'}})).stage,'league-phase')});
test('different competitions and explicit seasons never join',()=>{assert.equal(R.plan([row(),row({lg:'Serie A'})]).records.length,2);assert.equal(R.plan([row(),row({o:{CsvSeason:2024}})]).records.length,2)});
test('explicit competition codes share the canonical fixture identity',()=>{assert.equal(R.plan([row(),copy({lg:'I2'})]).records.length,1)});
test('two distinct trusted events survive; an unqualified third row is ambiguous',()=>{const a=row({o:{CsvSeason:2025,Provider:'qa',MatchID:'one'}}),b=row({o:{CsvSeason:2025,Provider:'qa',MatchID:'two'}});const p=R.plan([a,b]);assert.equal(p.records.length,2);assert.equal(p.report.safe,true);const unknown=R.plan([row()],p.records);assert.equal(unknown.report.safe,false);assert.deepEqual(unknown.records,p.records)});
test('inconsistent kickoff or sporting context is reviewable rather than a second counted fixture',()=>{for(const o of [{Time:'21:00'},{Phase:'playoff'}]){const p=R.plan([row({o:{CsvSeason:2025,Phase:'regular',Time:'18:00'}}),copy({o:{CsvSeason:2025,Phase:'regular',Time:'18:00',...o}})]);assert.equal(p.report.safe,false);assert.equal(p.report.collisions[0].kind,'contesto_incontro_discordante')}});
test('same trusted event with different clock observations remains identifiable and preserves both',()=>{const a=row({o:{Provider:'qa',MatchID:7,Time:'18:00'}}),b=copy({o:{Provider:'qa',MatchID:7,Time:'19:00'}});assert.equal(F.relation(a,b).kind,'same');const p=R.plan([a,b]);assert.equal(p.records.length,1);assert.ok(p.records[0].o.RecoveryEvidence.some(e=>e.field==='Time'))});
test('closed AC Cesena is not automatically the modern Cesena FC identity',()=>{const modern=C.canonicalMatch(row()),old=C.canonicalMatch(row({H:'AC Cesena',A:'Parma',d:Date.UTC(2016,7,22),o:{CsvSeason:2016}}));assert.notEqual(old.o.ClubHomeId,modern.o.ClubAwayId);const oldLabel=C.canonicalMatch(row({H:'Cesena',A:'Parma',d:Date.UTC(2016,7,22),o:{CsvSeason:2016}}));assert.notEqual(oldLabel.o.ClubHomeId,modern.o.ClubAwayId)});
test('explicit generated alias IDs migrate with old identifiers retained, provider IDs are protected',()=>{const a=row({o:{ClubHomeId:'club:da_verificare:ITA:name:pescara'}}),next=C.canonicalMatch(a);assert.equal(next.o.ClubHomeStatus,'verificata');assert.ok(next.o.ClubHomeLegacyIds.includes(a.o.ClubHomeId));const protectedRow=C.canonicalMatch(row({o:{ClubHomeId:'club:qa:provider:other'}}));assert.equal(protectedRow.o.ClubHomeId,'club:qa:provider:other');assert.equal(protectedRow.o.ClubHomeStatus,'ambigua')});
test('normalisation is stable after repeated serialization and retains FT/HT/quote values',()=>{const a=copy({hth:1,hta:0,ht:1,o:{CsvSeason:2025,Phase:'1. Round',B365H:'2.50'}}),b=C.canonicalMatch(a);assert.deepEqual(C.canonicalMatch(JSON.parse(JSON.stringify(b))),b);for(const key of ['h','a','ht','hth','hta'])assert.equal(a[key],b[key]);assert.equal(b.o.B365H,'2.50')});

test('E: archive reconciliation retains every unresolved record unchanged and conserves coverage',()=>{const a=row(),b=copy(),conflicting=row({d:a.d+86400000,h:5}),disagree=row({d:a.d+86400000,h:9});const input=[a,b,conflicting,disagree],p=R.reconcile(input);assert.equal(p.records.length,3);assert.equal(p.report.preservedUnresolved,2);assert.equal(p.usableRecords.length,1);assert.ok(p.records.some(r=>JSON.stringify(r)===JSON.stringify(conflicting)));assert.ok(p.records.some(r=>JSON.stringify(r)===JSON.stringify(disagree)));assert.equal(new Set(p.report.coverage.flatMap(c=>c.inputs.map(i=>i.index))).size,4);assert.deepEqual(input,[a,b,conflicting,disagree])});
test('T5: the analysis projection excludes cancelled games and unresolved conflicts without editing raw data',()=>{const input=[row(),copy(),row({d:Date.UTC(2025,8,1),o:{Status:'cancelled'}})];const p=R.reconcile(input);assert.equal(input.length,3);assert.equal(p.records.length,2);assert.equal(p.usableRecords.length,1)});

test('historical VfB Leipzig is not mapped to RB Leipzig through a shared city alias',()=>{assert.notEqual(C.resolve('VfB Leipzig (-2004)','Bundesliga').id,C.resolve('RB Leipzig','Bundesliga').id)});

test('a prior unplayed schedule can become a played result despite a revised clock, retaining both observations',()=>{const a=row({up:true,h:null,a:null,o:{Time:'15:30'}}),b=copy({o:{SourceTime:'14:30'}}),p=R.plan([a,b]);assert.equal(p.report.safe,true);assert.equal(p.records.length,1);assert.equal(p.records[0].up,false);assert.equal(p.records[0].o.Time,'15:30');assert.equal(p.records[0].o.SourceTime,'14:30')});

test('AUDIT 29/10: schedule/result clocks remain idempotent through repeated imports, serialization and source order',()=>{
 const calendar=row({up:true,h:null,a:null,o:{CsvSeason:2025,Time:'15:30',Source:'Synthetic schedule'}}),result=row({o:{CsvSeason:2025,SourceTime:'14:30',Source:'Synthetic result',B365H:'2.75'},ht:1,hth:0,hta:1});
 for(const input of [[calendar,result],[result,calendar]]){
  const first=R.plan(input);assert.equal(first.report.safe,true);assert.equal(first.records.length,1);
  for(let n=0;n<5;n++){const again=R.plan(JSON.parse(JSON.stringify(input)),JSON.parse(JSON.stringify(first.records)));assert.equal(again.report.safe,true);assert.deepEqual(again.records,first.records);}
  assert.equal(R.plan(first.records,first.records).report.safe,true);
  assert.equal(first.records[0].o.FixtureTimeObservations.length,2);assert.equal(first.records[0].o.Time,'15:30');assert.equal(first.records[0].o.SourceTime,'14:30');assert.equal(first.records[0].o.B365H,'2.75');assert.equal(first.records[0].ht,1);
 }
});
test('previous observations never waive a truly new clock, timezone, score or quote conflict',()=>{
 const first=R.plan([row({up:true,h:null,a:null,o:{Time:'15:30'}}),row({o:{SourceTime:'14:30',B365H:'2.75'}})]);
 for(const other of [row({o:{Time:'16:30'}}),row({h:8,o:{SourceTime:'14:30'}}),row({o:{SourceTime:'14:30',B365H:'3.25'}})]){
  const p=R.plan([other],first.records);assert.equal(p.report.safe,false);assert.deepEqual(p.records,first.records);
 }
 const known=R.plan([row({o:{Time:'16:30',TimeZone:'+02:00'}}),row({o:{Time:'14:30',TimeZone:'UTC'}})]);
 assert.equal(R.plan([row({o:{Time:'16:30',TimeZone:'UTC'}})],known.records).report.safe,false);
});
test('partially overlapping clock histories do not create a transitive merge',()=>{
 const left=R.plan([row({up:true,h:null,a:null,o:{Time:'15:30'}}),row({o:{SourceTime:'14:30'}})]),right=R.plan([row({up:true,h:null,a:null,o:{Time:'15:30'}}),row({o:{SourceTime:'16:30'}})]);
 assert.equal(R.plan(right.records,left.records).report.safe,false);
});
test('incoming history cannot smuggle a new clock into an existing archive by retaining one old clock',()=>{
 const old=R.plan([row({o:{Time:'14:30'}})]),richer=R.plan([row({up:true,h:null,a:null,o:{Time:'15:30'}}),row({o:{SourceTime:'14:30'}})]);
 const update=R.plan(richer.records,old.records);assert.equal(update.report.safe,false);assert.deepEqual(update.records,old.records);
 assert.equal(R.plan([row({o:{SourceTime:'14:30'}})],richer.records).report.safe,true);
});
test('merged clocks never manufacture UTC certainty from different original field/zone pairings',()=>{
 const first=R.plan([row({up:true,h:null,a:null,o:{Time:'15:30'}}),row({o:{SourceTime:'14:30',TimeZone:'UTC'}})]);
 assert.equal(first.report.safe,true);assert.equal(F.context(first.records[0]).kickoffInstant,null);
 assert.equal(R.plan([row({o:{SourceTime:'14:30',TimeZone:'UTC'}})],first.records).report.safe,true);
});
test('a fresh explicit UTC clock is authoritative within its own source, never fabricated from another source',()=>{
 const a=row({o:{KickoffUTC:'2025-08-22T14:30:00Z',Time:'16:30'}});
 assert.equal(F.context(a).kickoffInstant,Date.UTC(2025,7,22,14,30));
 assert.equal(F.context(row({o:{KickoffUTC:'invalid',Time:'16:30',TimeZone:'UTC'}})).kickoffInstant,null);
 const original=R.plan([row({up:true,h:null,a:null,o:{Time:'15:30'}}),row({o:{SourceTime:'14:30'}})]);
 const changed=JSON.parse(JSON.stringify(original.records[0]));changed.o.Time='16:30';
 assert.equal(R.plan([changed],original.records).report.safe,false);
 assert.equal(R.plan([row({o:{FixtureTimeObservations:[null]}})]).report.safe,false);
});
test('an exact replay of previously retained unresolved rows is a no-op, never a silent reconciliation',()=>{
 const old=[row({o:{Time:'18:00'}}),row({o:{Time:'21:00'}})],p=R.plan(old,old);
 assert.equal(p.report.safe,true);assert.deepEqual(p.records,old);assert.equal(p.report.archiveNeedsReconciliation,2);
 const changed=R.plan([row({h:9,o:{Time:'18:00'}})],old);assert.equal(changed.report.safe,false);assert.deepEqual(changed.records,old);
});
test('a clock disagreement is not waived by equal event codes belonging to different providers',()=>{
 const a=row({o:{Provider:'primary',MatchID:'7',Time:'16:30',TimeZone:'UTC'}}),b=row({o:{Provider:'secondary',MatchID:'7',Time:'17:30',TimeZone:'UTC'}});
 assert.equal(R.plan([a,b]).report.safe,false);
 const same=row({o:{Provider:'secondary',MatchID:'7',Time:'18:30',TimeZone:'+02:00'}}),p=R.plan([a,same]);
 assert.equal(p.report.safe,true);assert.equal(p.records[0].o.FixtureEventSources.length,2);assert.equal(R.plan([a,same],p.records).report.safe,true);
});
test('the actual FA Cup Crystal Palace/Everton replay remains two independently dated fixtures',()=>{
 const data=require('./fixtures/fa-cup-replay-2023-24.json');
 const records=data.matches.map(m=>({d:Date.parse(m.date+'T00:00:00Z'),lg:'FA Cup',H:m.H,A:m.A,h:m.h,a:m.a,ht:m.ht,hth:m.hth,hta:m.hta,shots:null,up:false,o:{CsvSeason:2023,Phase:'knockout',ReplayNumber:m.replay,HomeCountry:'ENG',AwayCountry:'ENG',Source:data.url,HistSourceSHA256:data.sha256}}));
 const first=R.plan(records);assert.equal(first.report.safe,true);assert.equal(first.records.length,2);assert.deepEqual(first.records.map(r=>[r.h,r.a]),[[0,0],[1,0]]);assert.equal(first.records[1].o.ReplayNumber,1);
 const again=R.plan(records,first.records);assert.equal(again.report.safe,true);assert.deepEqual(again.records,first.records);
});

test('new unrelated imports do not silently consolidate or remove existing duplicate archive rows',()=>{const old=[row(),copy()],incoming=row({d:Date.UTC(2025,8,2)}),p=R.plan([incoming],old);assert.equal(p.report.safe,true);assert.equal(p.records.length,3);assert.deepEqual(p.records.slice(0,2),old);assert.equal(p.report.archiveNeedsReconciliation,2)});

test('unrelated imports preserve all original fields and IDs of existing singleton records',()=>{const old=copy(),p=R.plan([row({d:Date.UTC(2025,8,2)})],[old]);assert.deepEqual(p.records[0],old)});

test('country contradictions are blocked while documented Welsh association membership remains valid',()=>{assert.throws(()=>C.canonicalMatch(row({o:{HomeCountry:'ENG'}})),/Paese dichiarato/);assert.equal(C.resolve('Newport County','League Two',{country:'WAL'}).id,C.resolve('Newport County AFC','League Two',{country:'ENG'}).id);assert.equal(C.resolve('Cardiff','Championship',{country:'WAL'}).id,C.resolve('Cardiff City','Championship').id)});

test('reused trusted event IDs with incompatible dates are reviewed instead of becoming two counted fixtures',()=>{const a=row({o:{Provider:'QA',MatchID:1}}),b=row({d:a.d+86400000,o:{Provider:'qa',MatchID:1}}),p=R.plan([a,b]);assert.equal(p.report.safe,false);assert.equal(p.report.collisions[0].kind,'contesto_incontro_discordante');assert.equal(R.reconcile([a,b]).usableRecords.length,0)});
test('inconsistent club IDs from one provider are not fused by the shared display alias',()=>{const a=row({o:{Provider:'qa',HomeTeamID:1}}),b=copy({o:{Provider:'QA',HomeTeamID:2}});assert.equal(R.plan([a,b]).report.safe,false)});

test('documented English and Italian final-stage headings stay playoffs rather than being treated as regular rounds',()=>{for(const lg of ['Championship','League One','Serie B'])for(const phase of ['Finals, Semifinals','Finals, Final'])assert.equal(F.phase(row({lg,o:{CsvSeason:2024,Phase:phase}})).stage,'playoff')});

test('legacy generated IDs for another documented alias migrate without losing the original ID',()=>{const r=C.canonicalMatch(row({H:'Delfino Pescara',o:{ClubHomeId:'club:da_verificare:ITA:name:pescara',ClubHomeRaw:'Delfino Pescara'}}));assert.equal(r.o.ClubHomeStatus,'verificata');assert.ok(r.o.ClubHomeLegacyIds.includes('club:da_verificare:ITA:name:pescara'))});

test('one provider ID cannot silently overwrite the documented identity of a different real club',()=>{C.resolve('Pescara','Serie B',{provider:'qa',sourceId:17});assert.throws(()=>C.resolve('Cesena','Serie B',{provider:'qa',sourceId:17}),/Identificativo della fonte in conflitto/)});

test('CSV source identifiers, round headers and replay context reach the shared identity engine',()=>{const CSV=require('../../ta-csv-import-v02U-rc5');const text='Div,Season,Date,HomeTeam,AwayTeam,FTHG,FTAG,Phase,Round,match_id,fixture_provider,replay_number\nI2,2025/26,22/08/2025,Pescara,Cesena,1,3,regular,1. Round,17,qa,\nI2,2025/26,22/08/2025,Delfino Pescara,Cesena FC,1,3,regular,1. Round,17,qa,\n';const rows=CSV.read(text).records;assert.equal(rows[0].o.MatchID,'17');assert.equal(rows[0].o.Matchday,1);assert.equal(R.plan(rows).records.length,1);assert.equal(F.context(rows[0]).event.provider,'qa')});

test('explicit UTC offsets identify equivalent kickoff instants while preserving both source clocks',()=>{const a=row({o:{Time:'16:30',TimeZone:'+02:00'}}),b=copy({o:{Time:'14:30',TimeZone:'UTC'}}),p=R.plan([a,b]);assert.equal(p.report.safe,true);assert.equal(p.records.length,1);assert.equal(p.records[0].o.FixtureTimeObservations.length,2)});
test('different known UTC instants remain a conflict even if clock text is the same',()=>{const a=row({o:{Time:'16:30',TimeZone:'+02:00'}}),b=copy({o:{Time:'16:30',TimeZone:'UTC'}});assert.equal(R.plan([a,b]).report.safe,false)});

test('unknown competition text and malformed derived metadata do not become object-prototype identities',()=>{assert.equal(F.competition('constructor'),'constructor');assert.equal(typeof C.canonicalMatch(row({lg:'constructor'})).lg,'string');assert.equal(R.plan([row({o:{FixtureTimeObservations:'bad'}})]).report.safe,false)});

test('qualified identifiers from every original source survive merging and remain usable for future identity checks',()=>{const a=row({o:{Provider:'primary',MatchID:11}}),b=copy({o:{Provider:'secondary',MatchID:22}}),p=R.plan([a,b]);assert.equal(p.report.safe,true);assert.equal(p.records[0].o.FixtureEventSources.length,2);const other=R.plan([row({o:{Provider:'secondary',MatchID:23}})],p.records);assert.equal(other.records.length,2);const same=R.plan([row({o:{Provider:'secondary',MatchID:22}})],p.records);assert.equal(same.records.length,1)});

test('explicit replays or different legs are preserved when a provider qualifies its event code with that context',()=>{const a=row({o:{Provider:'qa',MatchID:'tie',Leg:1}}),b=row({d:a.d+86400000,o:{Provider:'qa',MatchID:'tie',Leg:2}});assert.equal(R.plan([a,b]).records.length,2);assert.equal(R.plan([a,b]).report.safe,true);const replay=row({d:a.d+2*86400000,o:{Provider:'qa',MatchID:'tie',ReplayNumber:1}});assert.equal(R.plan([row({o:{Provider:'qa',MatchID:'tie'}}),replay]).report.safe,true)});
test('explicitly suspended or nonfinal games cannot become played statistical observations',()=>{for(const status of ['sospesa','rinviata','suspended','live','not started'])assert.equal(R.reconcile([row({o:{Status:status}})]).usableRecords.length,0)});
