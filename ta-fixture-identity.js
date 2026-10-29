/* TA-INT-004: sporting identity and context. Scores never establish identity. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TAFixtures=api})(globalThis,function(){
 'use strict';
 const text=x=>String(x??'').normalize('NFC').replace(/\s+/g,' ').trim();
 const fold=x=>text(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const aliases={'i1':'Serie A','italian serie a':'Serie A','italy serie a':'Serie A','i2':'Serie B','italian serie b':'Serie B','italy serie b':'Serie B','e0':'Premier League','english premier league':'Premier League','e1':'Championship','english championship':'Championship','e2':'League One','english league one':'League One','e3':'League Two','english league two':'League Two','f1':'Ligue 1','f2':'Ligue 2','d1':'Bundesliga','sp1':'La Liga','sp2':'Segunda División','n1':'Eredivisie','p1':'Primeira Liga'};
 const multi=new Set(['Superliga Danimarca','SuperLiga Romania','Jupiler Pro League','Champions League','1st Division Danimarca','Liga II Romania']);
 function competition(value){return Object.hasOwn(aliases,fold(value))?aliases[fold(value)]:text(value)}
 function season(r){const x=r.o?.CsvSeason??r.o?.Season;if(Number.isInteger(x))return x;if(/^\d{4}(?:\/\d{2,4})?$/.test(String(x)))return Number(String(x).slice(0,4));const d=new Date(r.d);return d.getUTCFullYear()-(d.getUTCMonth()<6?1:0)}
 function phase(r){
  const o=r.o||{},raw=text(o.Phase??o.Stage??o.PublishedRound??o.Round),p=fold(raw),lg=competition(r.lg),y=season(r);let stage='unknown',matchday=null,detail=r.o?.FixturePhaseDetail||null;
  const round=/^\d+$/.test(raw)?[raw,raw]:/^(?:(?:matchday|round|giornata)\s*(\d+)|(\d+)\.?\s*(?:round|giornata))$/i.exec(raw);
  if(['regular','playoff','playout','qualifying','relegation-group','championship-group','knockout','league-phase','group-stage'].includes(p))stage=p;
  else if(round){matchday=Number(round[1]||round[2]);if(!multi.has(lg))stage='regular';}
  else if(lg==='Champions League'&&/^league,?\s*matchday\s+\d+/.test(p)&&y>=2024){stage='league-phase';matchday=Number(p.match(/\d+/)[0]);}
  else if(/qualif|preliminary/.test(p))stage='qualifying';
  else if(/play.?out|relegation.?play.?off|spareggio salvezza/.test(p))stage='playout';
  else if(/play.?off/.test(p)){stage='playoff';detail=/semi/.test(p)?'semi-final':/quarter/.test(p)?'quarter-final':/(?:^|[ -])final(?:s)?$/.test(p)?'final':null;}
  else if(/relegation (?:group|round)|gruppo retrocessione/.test(p)&&multi.has(lg))stage='relegation-group';
  else if(/championship (?:group|round)|gruppo campionato/.test(p)&&multi.has(lg))stage='championship-group';
  else if(lg==='Champions League'&&/round of|last 16|quarter|semi|final/.test(p)){stage='knockout';detail=/round of 16|last 16/.test(p)?'round-16':/quarter/.test(p)?'quarter-final':/semi/.test(p)?'semi-final':'final';}
  else if(['Serie B','Championship','League One','League Two','Segunda División'].includes(lg)&&/^(?:finals?,\s*)?(?:semi|quarter)?finals?$/.test(p)){stage='playoff';detail=/semi/.test(p)?'semi-final':/quarter/.test(p)?'quarter-final':'final';}
  else if(lg==='Champions League'&&/league phase/.test(p)&&y>=2024)stage='league-phase';
  else if(/group|gruppe/.test(p)&&lg==='Champions League')stage='group-stage';
  else if(/^(?:regular|regular season|stagione regolare|campionato)$/.test(p))stage='regular';
  else if(p&&!['unknown','unclassified'].includes(p))stage='unresolved';
  const published=/^(?:(?:matchday|round|giornata)\s*(\d+)|(\d+)\.?\s*(?:round|giornata))$/i.exec(text(o.PublishedRound));if(matchday==null&&published)matchday=Number(published[1]||published[2]);
  if(o.Matchday!=null&&/^\d+$/.test(String(o.Matchday)))matchday=Number(o.Matchday);
  return {stage,matchday,detail,raw,model:multi.has(lg)?lg+'|'+y:'national-league|'+y};
 }
 function event(r){const o=r.o||{},provider=fold(o.FixtureProvider??o.Provider),id=o.MatchID??o.MatchId??o.EventID??o.EventId??o.FixtureID??o.FixtureId;return provider&&id!=null&&text(id)?{provider,id:text(id)}:null}
 function events(r){const main=event(r),all=[...(main?[main]:[]),...(Array.isArray(r.o?.FixtureEventSources)?r.o.FixtureEventSources:[])];return [...new Map(all.filter(x=>x&&text(x.provider)&&text(x.id)).map(x=>{const e={provider:fold(x.provider),id:text(x.id)};return [JSON.stringify(e),e]})).values()]}
 function instant(date,clock,zone,iso){
  if(iso&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text(iso))){const n=Date.parse(iso);if(Number.isFinite(n))return n;}
  if(!clock||!zone)return null;
  const z=text(zone).toUpperCase(),fixed={UTC:0,GMT:0,CET:60,CEST:120,BST:60},offset=/^([+-])(\d{2}):?(\d{2})$/.exec(z);
  const minutes=Object.hasOwn(fixed,z)?fixed[z]:offset&&+offset[2]<=14&&+offset[3]<60?(+offset[2]*60+ +offset[3])*(offset[1]==='-'?-1:1):null;
  return minutes==null?null:Date.parse(date+'T'+clock+':00Z')-minutes*60000;
 }
 const utcValue=o=>o.KickoffUTC??o.KickoffISO??o.kickoffISO??o.startTimeUTC;
 function timeSources(r){
  const o=r.o||{},saved=Array.isArray(o.FixtureTimeObservations)?o.FixtureTimeObservations.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)):[];
  const changed=['Time','SourceTime','TimeZone'].some(k=>text(o[k])&&!saved.some(v=>text(v[k])===text(o[k])))||(text(utcValue(o))&&!saved.some(v=>text(utcValue(v))===text(utcValue(o))));
  return saved.length&&!changed?saved:[o];
 }
 function timeSnapshot(o){return {Time:o.Time??null,SourceTime:o.SourceTime??null,KickoffUTC:utcValue(o)??null,TimeZone:o.TimeZone??null,source:o.Source??o.CsvSourceFile??o.source??null};}
 function clockObservations(r){
  const date=new Date(r.d).toISOString().slice(0,10);
  // A merged row's flat Time/TimeZone fields can come from different sources.
  // Retain each original pairing instead of manufacturing a new combined clock.
  const sources=timeSources(r),clocks=[];
  for(const v of sources){
   if(!v||typeof v!=='object')continue;
   const utc=utcValue(v);
   if(utc){const n=instant(date,null,null,utc);if(Number.isFinite(n))clocks.push({kickoff:null,timeZone:'UTC',instant:n});continue;}
   for(const value of [v.Time,v.SourceTime]){
    const m=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text(value));
    if(!m||+m[1]>=24||+m[2]>=60)continue;
    const kickoff=m[1].padStart(2,'0')+':'+m[2],timeZone=text(v.TimeZone)||null;
    clocks.push({kickoff,timeZone,instant:instant(date,kickoff,timeZone,null)});
   }
  }
  return [...new Map(clocks.map(c=>[JSON.stringify(c),c])).values()];
 }
 function clockCompatible(a,b){
  if(Number.isFinite(a.instant)&&Number.isFinite(b.instant))return a.instant===b.instant;
  return !!a.kickoff&&a.kickoff===b.kickoff&&(!a.timeZone||!b.timeZone||fold(a.timeZone)===fold(b.timeZone));
 }
 function clockDisagreement(a,b,requireRecordedClocks=false){
  if(!a.length||!b.length)return false;
  // A replay of an already recorded source observation is not a new conflict.
  // Mere overlap is insufficient: partial overlaps with new clocks stay blocked.
  const covered=(x,y)=>x.every(v=>y.some(w=>clockCompatible(v,w)));
  return requireRecordedClocks?!covered(b,a):!covered(a,b)&&!covered(b,a);
 }
 function context(r){
  const o=r.o||{},p=phase(r),date=new Date(r.d).toISOString().slice(0,10),utc=o.KickoffUTC??o.KickoffISO??o.kickoffISO??o.startTimeUTC,clock=text(utc??o.Time??o.SourceTime),time=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(clock),kickoff=time&&+time[1]<24&&+time[2]<60?time[1].padStart(2,'0')+':'+time[2]:null;
  const observations=clockObservations(r),known=observations.filter(v=>Number.isFinite(v.instant)),instants=new Set(known.map(v=>v.instant));
  const kickoffInstant=known.length===observations.length&&instants.size===1?known[0].instant:null;
  return {league:competition(r.lg),season:season(r),date,phase:p.stage,phaseDetail:p.detail,matchday:p.matchday,model:p.model,kickoff,timeZone:text(utc?'UTC':o.TimeZone)||null,kickoffInstant,clockObservations:observations,event:event(r)||events(r)[0]||null,events:events(r),instance:text(o.MatchInstance??o.ReplayNumber??o.ReplayOf),leg:o.Leg==null?null:text(o.Leg),status:fold(o.MatchStatus??o.Status),group:text(o.Group)||null};
 }
 function club(r,side,resolve){return r.o?.['Club'+side+'Id']||(resolve?resolve(r[side==='Home'?'H':'A'],competition(r.lg)).id:r[side==='Home'?'H':'A'])}
 function base(r,resolve){const c=context(r);return JSON.stringify([c.league,c.season,c.date,club(r,'Home',resolve),club(r,'Away',resolve)])}
 function key(r,resolve){const c=context(r);return JSON.stringify([base(r,resolve),c.instance,c.leg,c.event?.provider||null,c.event?.id||null])}
 function relation(a,b,options={}){
  const x=context(a),y=context(b);if(x.league!==y.league||x.season!==y.season||x.date!==y.date)return {kind:'different',reason:'competition-season-date'};
  if(x.instance!==y.instance&&(x.instance||y.instance))return {kind:'different',reason:'explicit-replay-instance'};
  if(x.leg&&y.leg&&x.leg!==y.leg)return {kind:'different',reason:'explicit-leg'};
  for(const e of x.events)for(const f of y.events)if(e.provider===f.provider&&e.id!==f.id)return {kind:'different',reason:'distinct-trusted-source-events'};
  const sameEvent=x.events.some(e=>y.events.some(f=>e.provider===f.provider&&e.id===f.id));
  if(clockDisagreement(x.clockObservations,y.clockObservations,options.requireRecordedClocks)&&!sameEvent&&!!a.up===!!b.up)return {kind:'conflict',reason:'kickoff-disagreement'};
  if(x.phase!=='unknown'&&y.phase!=='unknown'&&x.phase!==y.phase)return {kind:'conflict',reason:'sporting-phase-disagreement'};
  if(x.phaseDetail&&y.phaseDetail&&x.phaseDetail!==y.phaseDetail)return {kind:'conflict',reason:'sporting-round-disagreement'};
  for(const side of ['Home','Away']){const ao=a.o||{},bo=b.o||{},ap=fold(ao[side+'Provider']??ao.Provider??ao['Club'+side+'Provider']),bp=fold(bo[side+'Provider']??bo.Provider??bo['Club'+side+'Provider']),ai=ao[side+'TeamID']??ao[side+'ID']??ao['Club'+side+'SourceId'],bi=bo[side+'TeamID']??bo[side+'ID']??bo['Club'+side+'SourceId'];if(ap&&ap===bp&&ai!=null&&bi!=null&&text(ai)!==text(bi))return {kind:'conflict',reason:'club-source-identity-disagreement'};}
  if(x.group&&y.group&&x.group!==y.group)return {kind:'conflict',reason:'sporting-group-disagreement'};
  return {kind:'same',reason:sameEvent?'same-trusted-event':'same-canonical-fixture-context'};
 }
 function normalise(r){
  const o={...(r.o||{})},p=phase(r),lg=competition(r.lg),old={league:r.lg,phase:o.Phase??o.Stage??null,publishedRound:o.PublishedRound??null,source:o.Source??o.CsvSourceFile??null};
  const trace=o.FixtureSourceContexts||[],changed=lg!==r.lg||(old.phase&&p.stage!=='unknown'&&p.stage!=='unresolved'&&old.phase!==p.stage);if(changed&&!trace.some(x=>JSON.stringify(x)===JSON.stringify(old)))o.FixtureSourceContexts=[...trace,old];
  if(p.stage!=='unknown'&&p.stage!=='unresolved')o.Phase=p.stage;if(p.detail)o.FixturePhaseDetail=p.detail;if(p.matchday!=null)o.Matchday=p.matchday;
  if(!o.FixtureTimeObservations&&[o.Time,o.SourceTime,o.KickoffUTC??o.KickoffISO??o.kickoffISO??o.startTimeUTC].some(x=>text(x)))o.FixtureTimeObservations=[{Time:o.Time??null,SourceTime:o.SourceTime??null,KickoffUTC:o.KickoffUTC??o.KickoffISO??o.kickoffISO??o.startTimeUTC??null,TimeZone:o.TimeZone??null,source:o.Source??o.CsvSourceFile??null}];
  if(!o.FixtureEventSources&&event(r))o.FixtureEventSources=[{...event(r),declaredProvider:r.o?.FixtureProvider??r.o?.Provider,source:r.o?.Source??r.o?.CsvSourceFile??null}];
  o.FixtureIdentityVersion='TA-INT-004';return {...r,lg,o};
 }
 function usable(r){const status=context(r).status;return !/cancel|void|abandon|annull|postponed|suspend|sospes|rinviat/.test(status)&&!(r.up===false&&/not.started|scheduled|in.progress|live/.test(status))}
 return {competition,season,phase,context,base,key,relation,normalise,usable,timeSources,timeSnapshot,multiPhaseLeagues:[...multi]};
});
