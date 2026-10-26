/* TA-DATA-002: explicit club identities. Similarity is diagnostic, never a join. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TAClubs=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const VERSION='TA-CLUBS-1';
 const clean=v=>String(v??'').normalize('NFC').replace(/\s+/g,' ').trim();
 const key=v=>clean(v).toLocaleLowerCase('en');
 const countries={'Serie A':'ITA','Serie B':'ITA','Premier League':'ENG','Championship':'ENG','League One':'ENG','League Two':'ENG','La Liga':'ESP','Segunda División':'ESP','Ligue 1':'FRA','Ligue 2':'FRA','Bundesliga':'GER','Eredivisie':'NED','Primeira Liga':'PRT','Liga Portugal 2':'PRT','Superliga Danimarca':'DNK','1st Division Danimarca':'DNK','SuperLiga Romania':'ROU','Liga II Romania':'ROU','HNL Croazia':'HRV','Prva NL Croazia':'HRV','Süper Lig':'TUR','Jupiler Pro League':'BEL','Champions League':'INT'};
 const seeds=[
  ['fra-psg','FRA','Paris SG',['PSG','Paris SG','Paris Saint-Germain','Paris Saint Germain','Paris Saint-Germain FC'],'TA-DATA-002 §3.1; OpenFootball 2024/25'],
  ['fra-lyon','FRA','Lyon',['Lione','Lyon','Olympique Lyonnais'],'TA-DATA-002 §3.1'],
  ['ita-inter','ITA','Inter',['Inter','Internazionale','Internazionale Milano','Inter Milan','FC Internazionale Milano'],'TA-DATA-002 §3.1 / baseline; OpenFootball 2024/25'],
  ['eng-man-united','ENG','Man United',['Manchester United','Man Utd','Manchester Utd','Man United','Manchester United FC'],'TA-DATA-002 §3.1 / baseline'],
  ['prt-sporting-cp','PRT','Sporting Lisbon',['Sporting CP','Sporting Lisbon','Sporting Clube de Portugal'],'TA-DATA-002 §3.1'],
  ['fra-paris-fc','FRA','Paris FC',['Paris FC'],'explicit distinct club'],
  ['eng-man-city','ENG','Man City',['Manchester City','Man City','Manchester City FC'],'baseline explicit alias; OpenFootball 2024/25'],
  ['eng-qpr','ENG','QPR',['Queens Park Rangers','QPR'],'baseline explicit alias'],
  ['eng-west-ham','ENG','West Ham',['West Ham United','West Ham','West Ham United FC'],'baseline explicit alias'],
  ['eng-lincoln','ENG','Lincoln',['Lincoln City','Lincoln'],'baseline explicit alias'],
  ['eng-wolves','ENG','Wolves',['Wolverhampton Wanderers','Wolverhampton','Wolves','Wolves FC'],'baseline explicit alias'],
  ['eng-blackburn','ENG','Blackburn',['Blackburn Rovers','Blackburn'],'baseline explicit alias'],
  ['eng-bolton','ENG','Bolton',['Bolton Wanderers','Bolton'],'baseline explicit alias'],
  ['eng-preston','ENG','Preston',['Preston North End','Preston'],'baseline explicit alias'],
  ['eng-charlton','ENG','Charlton',['Charlton Athletic','Charlton'],'baseline explicit alias'],
  ['eng-derby','ENG','Derby',['Derby County','Derby'],'baseline explicit alias'],
  ['eng-swansea','ENG','Swansea',['Swansea City','Swansea'],'baseline explicit alias'],
  ['eng-west-brom','ENG','West Brom',['West Bromwich Albion','West Brom'],'baseline explicit alias'],
  ['eng-sheffield-weds','ENG','Sheffield Weds',['Sheffield Wednesday','Sheffield Weds'],'baseline explicit alias'],
  ['eng-ipswich','ENG','Ipswich',['Ipswich Town','Ipswich'],'baseline explicit alias'],
  ['eng-birmingham','ENG','Birmingham',['Birmingham City','Birmingham'],'baseline explicit alias'],
  ['eng-leicester','ENG','Leicester',['Leicester City','Leicester'],'baseline explicit alias'],
  ['eng-norwich','ENG','Norwich',['Norwich City','Norwich'],'baseline explicit alias'],
  ['eng-stoke','ENG','Stoke',['Stoke City','Stoke'],'baseline explicit alias'],
  ['eng-cardiff','ENG','Cardiff',['Cardiff City','Cardiff'],'baseline explicit alias'],
  ['eng-huddersfield','ENG','Huddersfield',['Huddersfield Town','Huddersfield'],'baseline explicit alias'],
  ['eng-plymouth','ENG','Plymouth',['Plymouth Argyle','Plymouth'],'baseline explicit alias'],
  ['eng-nottingham','ENG',"Nott'm Forest",['Nottingham Forest',"Nott'm Forest",'Nott m Forest'],'baseline explicit alias'],
  ['eng-burnley','ENG','Burnley',['Burnley','Burnley FC'],'baseline membership alias'],
  ['ned-ajax','NED','Ajax',['Ajax','AFC Ajax'],'explicit club name, source Football-Data/OpenFootball'],
  ['ned-psv','NED','PSV',['PSV','PSV Eindhoven'],'explicit club name, source Football-Data/OpenFootball'],
  ['ita-milan','ITA','Milan',['Milan','AC Milan'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['ita-juventus','ITA','Juventus',['Juventus','Juventus FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['ita-atalanta','ITA','Atalanta',['Atalanta','Atalanta BC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['ita-lazio','ITA','Lazio',['Lazio','SS Lazio'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['ita-napoli','ITA','Napoli',['Napoli','SSC Napoli'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['fra-monaco','FRA','Monaco',['Monaco','AS Monaco','AS Monaco FC'],'Explicit Monaco club identity; French league and MCO country tag in OpenFootball',['MCO']],
  ['eng-arsenal','ENG','Arsenal',['Arsenal','Arsenal FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['eng-aston-villa','ENG','Aston Villa',['Aston Villa','Aston Villa FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['eng-chelsea','ENG','Chelsea',['Chelsea','Chelsea FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['eng-liverpool','ENG','Liverpool',['Liverpool','Liverpool FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['eng-tottenham','ENG','Tottenham',['Tottenham','Tottenham Hotspur','Tottenham Hotspur FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['esp-barcelona','ESP','Barcelona',['Barcelona','FC Barcelona'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['esp-real-madrid','ESP','Real Madrid',['Real Madrid','Real Madrid CF'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['esp-sevilla','ESP','Sevilla',['Sevilla','Sevilla FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['esp-villarreal','ESP','Villarreal',['Villarreal','Villarreal CF'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['esp-girona','ESP','Girona',['Girona','Girona FC'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['esp-atletico-madrid','ESP','Ath Madrid',['Ath Madrid','Atletico Madrid','Atlético Madrid','Club Atlético de Madrid'],'Explicit club identity, not a similarity rule'],
  ['ger-bayern','GER','Bayern Munich',['Bayern Munich','Bayern München','FC Bayern München'],'Explicit multilingual club identity, Football-Data / OpenFootball'],
  ['ger-dortmund','GER','Dortmund',['Dortmund','Borussia Dortmund'],'Explicit club identity, Football-Data / OpenFootball'],
  ['ger-leverkusen','GER','Leverkusen',['Leverkusen','Bayer Leverkusen','Bayer 04 Leverkusen'],'Explicit club identity, Football-Data / OpenFootball'],
  ['ger-leipzig','GER','RB Leipzig',['RB Leipzig','Leipzig'],'Explicit club identity, Football-Data / OpenFootball'],
  ['prt-porto','PRT','Porto',['Porto','FC Porto'],'Explicit review: Football-Data / OpenFootball 2021–2025'],
  ['prt-benfica','PRT','Benfica',['Benfica','Sport Lisboa e Benfica'],'Explicit club identity, Football-Data / OpenFootball'],
  ['prt-braga','PRT','Sp Braga',['Sp Braga','Braga','Sporting Braga','SC Braga'],'Explicit club identity; distinct from Sporting CP'],
  ['tur-besiktas','TUR','Besiktas',['Besiktas','Beşiktaş'],'Explicit Turkish club identity; exact listed accent variants'],
  ['ned-feyenoord','NED','Feyenoord',['Feyenoord','Feyenoord Rotterdam'],'Explicit club identity, Football-Data / OpenFootball'],
  ['hrv-dinamo-zagreb','HRV','Dinamo Zagreb',['Dinamo Zagreb','GNK Dinamo Zagreb'],'Explicit club identity; no merge with other Dinamo clubs']
 ];
 const catalog=new Map(),aliases=new Map(),observations=new Map();
 for(const [slug,country,name,names,evidence,alsoCountries=[]] of seeds){const id='club:'+slug,record={id,country,countries:[country,...alsoCountries],name,aliases:[...new Set([name,...names])],status:'verificata',evidence};catalog.set(id,record);for(const n of record.aliases){const k=key(n);if(!aliases.has(k))aliases.set(k,[]);aliases.get(k).push(record);}}
 // Deliberately unresolved labels that can denote more than one distinct club.
 const ambiguous={'manchester':['club:eng-man-united','club:eng-man-city'],'paris':['club:fra-psg','club:fra-paris-fc'],'sporting':['club:prt-sporting-cp','club:prt-braga']};
 function resolve(original,league='',options={}){
  const raw=String(original??''),scope=countries[league]||'UNSPECIFIED',country=(scope==='INT'||scope==='UNSPECIFIED')?(clean(options.country).toUpperCase()||scope):scope,k=key(raw);
  if(!k)throw Error('Nome squadra vuoto');
  const possible=(aliases.get(k)||[]).filter(c=>country==='INT'||country==='UNSPECIFIED'||c.countries.includes(country));
  const uncertain=(ambiguous[k]||[]).map(id=>catalog.get(id)).filter(c=>country==='INT'||country==='UNSPECIFIED'||c.countries.includes(country));
  const candidates=[...new Map([...possible,...uncertain].map(c=>[c.id,c])).values()];
  // Exact lookup of our own disambiguated display labels is not text similarity.
  if(!candidates.length&&options.sourceId==null&&!options.storedId&&clean(raw).endsWith(']')){
   const labels=[...observations.values()].filter(c=>key(c.name)===k&&(country==='INT'||country==='UNSPECIFIED'||c.country===country)&&(c.sourceId!=null||clean(c.identityName)!==c.name));
   if(labels.length===1){const c=labels[0];if(options.source){const trace=JSON.stringify([c.id,league,raw,options.source,c.sourceId]);if(!c.aliases.includes(raw))c.aliases.push(raw);if(!c.sources.some(s=>s.key===trace))c.sources.push({key:trace,league,name:raw,source:options.source,sourceId:c.sourceId});}return {id:c.id,name:c.name,country:c.country,status:c.status,original:raw,identityName:c.identityName,provider:c.provider,sourceId:c.sourceId,candidates:c.candidates,reason:'Etichetta esatta già emessa dal registro'};}
  }
  let id,name,status,reason;
  if(candidates.length===1){({id,name,status}=candidates[0]);reason=candidates[0].evidence;}
  else {
   status=candidates.length?'ambigua':'da_verificare';
   const sourceKey=options.sourceId!=null?(options.provider?'provider:'+encodeURIComponent(key(options.provider))+':'+encodeURIComponent(String(options.sourceId)):'unscoped-source:'+encodeURIComponent(String(options.sourceId))+':'+encodeURIComponent(k)):'name:'+encodeURIComponent(k);
   const countryLabel=scope==='INT'&&options.country?' ['+country+']':'',codeLabel=options.sourceId!=null?' ['+(options.provider?clean(options.provider)+':':'ID ')+String(options.sourceId)+']':'';
   id='club:'+status+':'+country+':'+sourceKey;name=clean(raw)+(countryLabel&&!clean(raw).includes(countryLabel)?countryLabel:'')+(codeLabel&&!clean(raw).endsWith(codeLabel)?codeLabel:'');reason=candidates.length?'Più identità possibili: nessuna fusione':'Nessun alias esplicito verificato';
  }
  // Already assigned IDs are permanent. A registry conflict is diagnostic, not a rewrite.
  if(options.storedId&&options.storedId!==id){id=options.storedId;name=options.storedName||clean(raw);status='ambigua';reason='ID salvato diverso dal registro corrente: necessaria revisione';}
  const resolvedCountry=candidates.length===1?candidates[0].country:country;
  const observationKey=JSON.stringify([id,league,raw,options.source||'',options.sourceId??null]);
  const prior=observations.get(id);
  if(prior&&status==='da_verificare')name=prior.name;
  if(!prior)observations.set(id,{id,country:resolvedCountry,name,status,identityName:raw,provider:options.provider??null,sourceId:options.sourceId??null,aliases:[],sources:[],candidates:candidates.map(c=>c.id),reason});
  const observed=observations.get(id);
  if(status==='ambigua'){observed.status=status;observed.reason=reason;observed.candidates=candidates.map(c=>c.id);}
  if(!observed.aliases.includes(raw))observed.aliases.push(raw);
  if(!observed.sources.some(v=>v.key===observationKey))observed.sources.push({key:observationKey,league,name:raw,source:options.source||'non dichiarata',sourceId:options.sourceId??null});
  return {id,name,country:resolvedCountry,status,original:raw,identityName:raw,provider:options.provider??null,sourceId:options.sourceId??null,candidates:candidates.map(c=>c.id),reason};
 }
 function provenance(o,side,r){
  const old=Array.isArray(o['Club'+side+'Sources'])?o['Club'+side+'Sources']:[];
  const source={name:r.original,source:o.Source||o.CsvSourceFile||'CSV / archivio importato',sourceId:r.sourceId};
  return [...new Map([...old,source].map(v=>[JSON.stringify(v),v])).values()];
 }
 function canonicalMatch(row){
  const o={...(row.o||{})};
  const homeProvider=o.HomeProvider||o.Provider||o.ClubHomeProvider,awayProvider=o.AwayProvider||o.Provider||o.ClubAwayProvider;
  const homeRaw=o.ClubHomeRaw??o.HomeTeam??row.H,awayRaw=o.ClubAwayRaw??o.AwayTeam??row.A;
  const home=resolve(o.ClubHomeIdentityName??homeRaw,row.lg,{provider:homeProvider,country:o.HomeCountry||o.ClubHomeCountry,source:o.Source||o.CsvSourceFile,sourceId:o.HomeTeamID??o.HomeID??o.ClubHomeSourceId,storedId:o.ClubHomeId,storedName:row.H});
  const away=resolve(o.ClubAwayIdentityName??awayRaw,row.lg,{provider:awayProvider,country:o.AwayCountry||o.ClubAwayCountry,source:o.Source||o.CsvSourceFile,sourceId:o.AwayTeamID??o.AwayID??o.ClubAwaySourceId,storedId:o.ClubAwayId,storedName:row.A});
  home.original=String(homeRaw);away.original=String(awayRaw);
  if(home.id===away.id)throw Error('Squadre casa/ospite associate alla stessa identità: incontro bloccato');
  for(const [side,club] of [['Home',home],['Away',away]]){
   o['Club'+side+'Id']=club.id;o['Club'+side+'Raw']=club.original;o['Club'+side+'Status']=club.status;
   o['Club'+side+'SourceId']=club.sourceId;o['Club'+side+'Sources']=provenance(o,side,club);
   o['Club'+side+'Country']=club.country;
   o['Club'+side+'IdentityName']=club.identityName;
  }
  o.ClubRegistryVersion=VERSION;
  if(homeProvider||home.provider)o.ClubHomeProvider=homeProvider||home.provider;if(awayProvider||away.provider)o.ClubAwayProvider=awayProvider||away.provider;
  return {...row,H:home.name,A:away.name,o};
 }
 function mergeProvenance(old={},incoming={}){
  const out={};for(const side of ['Home','Away'])out['Club'+side+'Sources']=[...new Map([...(old['Club'+side+'Sources']||[]),...(incoming['Club'+side+'Sources']||[])].map(x=>[JSON.stringify(x),x])).values()];return out;
 }
 function canonicalMembership(entry){
  if(!entry||!Number.isInteger(entry.year)||!entry.league||!entry.team)throw Error('Associazione squadra/categoria non valida');
  const club=resolve(entry.identityName??entry.sourceName??entry.team,entry.league,{provider:entry.provider,country:entry.country,source:entry.source||'Backup provenienza',sourceId:entry.sourceId,storedId:entry.clubId,storedName:entry.team});
  return {...entry,team:club.name,clubId:club.id,sourceName:entry.sourceName??club.original,identityName:club.identityName,provider:club.provider,country:club.country,sourceId:club.sourceId,associationStatus:club.status};
 }
 function matchId(r){return JSON.stringify([r.d,r.lg,r.o?.ClubHomeId||resolve(r.H,r.lg).id,r.o?.ClubAwayId||resolve(r.A,r.lg).id]);}
 function expandCompact(records){return records.map(r=>({d:r[0],lg:r[1],H:r[2],A:r[3],h:r[4],a:r[5],ht:r[6],up:!!r[7],o:r[8]||{},hth:r[9]??null,hta:r[10]??null,shots:r[11]??null}));}
 function protectedValue(r){const o=Object.fromEntries(Object.entries(r.o||{}).filter(([k])=>!k.startsWith('Club')).sort(([a],[b])=>a.localeCompare(b)));return JSON.stringify([r.d,r.lg,r.h,r.a,r.ht,r.hth??null,r.hta??null,r.shots??null,!!r.up,o]);}
 function plan(records){
  const previousObservations=[...observations].map(([id,value])=>[id,JSON.parse(JSON.stringify(value))]);
  const normalized=[],changes=[],errors=[],identities=new Map(),collisions=[];
  for(const [i,row] of records.entries()){
   try{
    if(!row||!Number.isFinite(row.d)||typeof row.lg!=='string'||!row.lg||typeof row.H!=='string'||typeof row.A!=='string'||!clean(row.H)||!clean(row.A))throw Error('Data, campionato o nomi non validi');
    if(!row.up&&(!Number.isInteger(row.h)||!Number.isInteger(row.a)||row.h<0||row.a<0))throw Error('Risultato finale non valido');
    if(row.o&&(typeof row.o!=='object'||Array.isArray(row.o)))throw Error('Metadati non validi');
    if(row.o?.CsvSeason!==undefined&&(!Number.isInteger(row.o.CsvSeason)||row.o.CsvSeason<1900||row.o.CsvSeason>2099))throw Error('Metadato CsvSeason non valido');
    const next=canonicalMatch(row);if(protectedValue(row)!==protectedValue(next))throw Error('Modifica di un campo protetto');
    if(row.H!==next.H||row.A!==next.A)changes.push({index:i,before:[row.H,row.A],after:[next.H,next.A]});
    const id=matchId(next);if(identities.has(id))collisions.push({first:identities.get(id),second:i,id});else identities.set(id,i);
    normalized.push(next);
   }catch(e){errors.push({index:i,error:e.message});}
  }
  const report={registryVersion:VERSION,inputCount:records.length,outputCount:normalized.length,changedNames:changes.length,changedRecords:changes.length,changedNameFields:changes.reduce((n,c)=>n+Number(c.before[0]!==c.after[0])+Number(c.before[1]!==c.after[1]),0),changes,collisions,errors,protectedFieldsUnchanged:errors.length===0,safe:errors.length===0&&collisions.length===0&&normalized.length===records.length};
  observations.clear();for(const [id,value] of previousObservations)observations.set(id,value);
  return {records:normalized,report};
 }
 function diagnostics(){const clubs=[...observations.values()].map(v=>({...v,sources:v.sources.map(({key,...x})=>x)}));return {version:VERSION,verified:clubs.filter(v=>v.status==='verificata').length,pending:clubs.filter(v=>v.status==='da_verificare').length,ambiguous:clubs.filter(v=>v.status==='ambigua').length,clubs};}
 return {VERSION,countries,ambiguityRules:ambiguous,seeds:seeds.map(v=>({id:'club:'+v[0],country:v[1],associationCountries:[v[1],...(v[5]||[])],name:v[2],aliases:v[3],evidence:v[4],status:'verificata'})),clean,key,resolve,canonicalMatch,canonicalMembership,mergeProvenance,matchId,expandCompact,protectedValue,plan,diagnostics};
});
