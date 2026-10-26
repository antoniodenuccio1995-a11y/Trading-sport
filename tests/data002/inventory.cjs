const fs=require('node:fs'),path=require('node:path'),R=require('../../ta-clubs-v1');
const root=path.resolve(__dirname,'../..'),sources=process.argv[2]||'/tmp/ta-data002-sources';
const input=JSON.parse(fs.readFileSync(path.join(sources,'name-observations.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(sources,'complete-manifest.json'),'utf8'));
const countryCodes={POR:'PRT',CRO:'HRV',DEN:'DNK',ROM:'ROU'};
const observations=input.map(x=>{const c=R.resolve(x.name,x.league,{source:x.source,sourceId:x.sourceId,country:countryCodes[x.sourceCountry]||x.sourceCountry||undefined});return {...x,clubId:c.id,canonicalName:c.name,status:c.status,associationCountry:c.country};});
const diagnostic=R.diagnostics(),runtime=['Serie A','Serie B','Premier League','Championship','League One','Champions League','Bundesliga','Ligue 1','Eredivisie','La Liga','Segunda División','Primeira Liga','Liga Portugal 2','Ligue 2','Superliga Danimarca','1st Division Danimarca','HNL Croazia','Prva NL Croazia','SuperLiga Romania','Liga II Romania'];
const coverage=runtime.map(league=>{const rows=observations.filter(x=>x.league===league);return {league,sourceFiles:[...new Set(rows.map(x=>x.source))],names:[...new Set(rows.map(x=>x.name))].length,identities:[...new Set(rows.map(x=>x.clubId))].length,scope:!rows.length?'not_verified_no_historical_csv_configured_or_provided':league==='HNL Croazia'?'current_2026_27_only':'available_histories_in_manifest'};});
// Suggestion keys are NEVER used by resolve(), resultIdentity(), or any application join.
const groupKey=s=>R.key(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\p{P}\p{S}]/gu,' ').replace(/\b(fc|afc|cf|ac|as|bc|ssc|ss|football|club|calcio)\b/g,' ').replace(/\s+/g,' ').trim();
const groups=new Map();for(const x of observations){const k=groupKey(x.name);if(!groups.has(k))groups.set(k,new Map());groups.get(k).set(x.clubId+'|'+x.name,{name:x.name,clubId:x.clubId,country:x.associationCountry,status:x.status});}
const possibleDuplicates=[...groups].filter(([,v])=>new Set([...v.values()].map(x=>x.clubId)).size>1).map(([diagnosticKey,v])=>({diagnosticKey,status:'review_only_no_merge',variants:[...v.values()]}));
const tokenGroups=new Map(),stop=new Set(['football','united','sporting','deportivo','olympique','universitatea']);
for(const x of observations){for(const token of groupKey(x.name).split(' ').filter(t=>t.length>=5&&!stop.has(t))){const k=x.associationCountry+'|'+token;if(!tokenGroups.has(k))tokenGroups.set(k,new Map());tokenGroups.get(k).set(x.clubId,{name:x.name,clubId:x.clubId,status:x.status});}}
const similarNames=[...tokenGroups].filter(([,v])=>v.size>1&&[...v.values()].some(x=>x.status!=='verificata')).map(([token,v])=>({sharedToken:token,status:'review_only_similarity_is_not_identity',clubs:[...v.values()]}));
const out=path.join(root,'qa/data002');fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');
write('sources-inventory.json',manifest);write('club-registry.json',{version:R.VERSION,verifiedAliasDefinitions:R.seeds,observedIdentities:diagnostic.clubs,sourceObservations:observations,coverage});
write('unresolved-clubs.json',{version:R.VERSION,pending:diagnostic.clubs.filter(c=>c.status==='da_verificare'),ambiguous:diagnostic.clubs.filter(c=>c.status==='ambigua'),ambiguityRules:R.ambiguityRules,possibleDuplicates,similarNames,policy:'Suggestions are diagnostic only; no similarity key is used for identity assignment.'});
write('reviewed-aliases.json',diagnostic.clubs.filter(c=>c.status==='verificata'&&c.aliases.length>1).map(c=>({id:c.id,canonicalName:c.name,observedAlternativeNames:c.aliases,evidence:R.seeds.find(s=>s.id===c.id)?.evidence,sources:c.sources})));
const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(out,'club-aliases.csv'),[['league','season','source_name','canonical_name','club_id','status','source_file','source_id','occurrences'],...observations.map(x=>[x.league,x.season,x.name,x.canonicalName,x.clubId,x.status,x.source,x.sourceId,x.occurrences])].map(row=>row.map(csvCell).join(',')).join('\n')+'\n');
const summary={sourceFiles:manifest.filter(x=>x.status==='downloaded').length,observations:observations.length,identities:diagnostic.clubs.length,verifiedObserved:diagnostic.verified,pending:diagnostic.pending,ambiguous:diagnostic.ambiguous,possibleDuplicateGroups:possibleDuplicates.length,similarNameGroups:similarNames.length,coverage};write('inventory-summary.json',summary);console.log(JSON.stringify(summary,null,2));
