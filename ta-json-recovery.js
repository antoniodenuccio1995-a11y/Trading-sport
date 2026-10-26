/* TA-DATA-002B: pure recovery planning. No storage, no implicit fuzzy matches. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ta-clubs-v2.js'));else root.TARecovery=factory(root.TAClubs)})(globalThis,function(clubs){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const put=(object,key,value)=>Object.defineProperty(object,key,{value,writable:true,enumerable:true,configurable:true});
 const empty=x=>x===null||x===undefined||x==='';
 const stable=x=>JSON.stringify(x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable(x[k])??'null')])):Array.isArray(x)?x.map(v=>JSON.parse(stable(v)??'null')):x);
 const equal=(a,b)=>stable(a)===stable(b);
 const union=(a,b)=>[...new Map([...a,...b].map(v=>[stable(v),v])).values()];
 function parse(content){
  let doc;try{doc=typeof content==='string'?JSON.parse(content):clone(content)}catch(ex){throw Error('Il file non è un JSON valido. Scegli il backup originale senza modificarlo. Dettaglio: '+ex.message);}
  if(doc&&typeof doc==='object'&&!Array.isArray(doc)&&!Array.isArray(doc.records)&&!Array.isArray(doc.rows)){
   if(Array.isArray(doc.clubs))throw Error('Questo file è un rapporto anagrafico, non il backup delle partite. Esporta il backup JSON dalla vecchia versione.');
   if(doc.collisions||doc.status)throw Error('Questo file è un rapporto di integrità, non contiene le partite da recuperare. Esporta il backup JSON dalla vecchia versione.');
  }
  let source,format,version=null;
  if(Array.isArray(doc)){source=doc;format='Elenco partite precedente';}
  else if(doc&&Array.isArray(doc.records)&&(!doc.format||['TradingAnalyticsBackup','TradingAnalyticsLegacyTransfer'].includes(doc.format))){
   if(doc.version!=null&&![1,2].includes(doc.version))throw Error('Versione del backup non supportata: '+doc.version);
   source=doc.records;format=doc.format||'Archivio precedente';version=doc.version??null;
  }else if(doc&&Array.isArray(doc.rows)&&!doc.format){source=doc.rows;format='Archivio rows precedente';}
  else throw Error('Formato JSON non riconosciuto: scegli il backup delle partite.');
  if(!source.length)throw Error('Il file contiene zero partite. Nessuna importazione necessaria.');
  if(source.length>250000)throw Error('Il file supera 250.000 partite: dividerlo con assistenza tecnica.');
  const records=source.map(r=>Array.isArray(r)?(r.length>=8?clubs.expandCompact([r])[0]:null):(r&&typeof r==='object'?{...r,up:!!r.up,o:r.o??{}}:null));
  const metadata=Array.isArray(doc)?{}:doc;
  for(const k of ['memberships','manual','strategies','goalEvents','clubRules'])if(metadata[k]!==undefined&&!Array.isArray(metadata[k]))throw Error('Sezione '+k+' non valida: deve essere un elenco.');
  // Validate each section before any write. Journal fields are never consumed.
  for(const m of metadata.memberships||[])if(!m||!Number.isInteger(m.year)||!m.league||!m.team)throw Error('Associazione squadra/campionato non valida nel backup.');
  for(const m of metadata.manual||[])validate(m);
  for(const g of metadata.goalEvents||[])validateGoal(g);
  for(const s of metadata.strategies||[])if(!s||typeof s.name!=='string'||!['o15','o25','u25','btts','ht','draw','home','away'].includes(s.m)||!Array.isArray(s.conds))throw Error('Strategia salvata non compatibile: sono richiesti nome, mercato e condizioni. Nessuna sezione verrà sovrascritta.');
  if(metadata.clubRules)clubs.isolated(()=>{const saved=clubs.rules();try{clubs.configure(metadata.clubRules)}finally{clubs.configure(saved)}});
  return {records,metadata,format,version};
 }
 function validateGoal(g){
  if(!g||typeof g.key!=='string'||!Number.isFinite(g.d)||g.d<=0||typeof g.H!=='string'||!g.H.trim()||typeof g.A!=='string'||!g.A.trim()||typeof g.lg!=='string'||!g.lg||!Array.isArray(g.goals))throw Error('Eventi gol non compatibili: mancano incontro, campionato o reti.');
  for(const goal of g.goals){const m=/^(\d{1,2})(?:\+(\d{1,2}))?$/.exec(String(goal?.min??''));if(!['H','A'].includes(goal?.side)||!m||+m[1]<1||+m[1]>90||+(m[2]||0)>30||(m[2]&&!['45','90'].includes(m[1])))throw Error('Eventi gol non compatibili: minuto o lato non valido.');}
 }
 function validate(r){
  if(!r||!Number.isFinite(r.d)||r.d<=0||r.d>8640000000000000||typeof r.lg!=='string'||!r.lg.trim()||!clubs.clean(r.H)||!clubs.clean(r.A))throw Error('Data, campionato o squadre mancanti/non validi');
  if(typeof r.H!=='string'||typeof r.A!=='string')throw Error('Nome squadra non testuale');
  if(!r.up&&(!Number.isInteger(r.h)||!Number.isInteger(r.a)||r.h<0||r.a<0))throw Error('Risultato finale mancante o non valido');
  if(r.o===null||typeof r.o!=='object'||Array.isArray(r.o))throw Error('Metadati non validi');
  for(const side of ['Home','Away']){
   if(r.o['Club'+side+'Id']!=null&&typeof r.o['Club'+side+'Id']!=='string')throw Error('Identificativo squadra non valido');
   if(r.o['Club'+side+'Sources']!=null&&!Array.isArray(r.o['Club'+side+'Sources']))throw Error('Provenienze squadra non valide');
  }
  if(r.o.RecoveryEvidence!=null&&!Array.isArray(r.o.RecoveryEvidence))throw Error('Provenienze di recupero non valide');
  if(r.o.CsvSeason!==undefined&&(!Number.isInteger(r.o.CsvSeason)||r.o.CsvSeason<1900||r.o.CsvSeason>2099))throw Error('Stagione non valida');
  for(const k of ['ht','hth','hta'])if(!empty(r[k])&&(!Number.isInteger(r[k])||r[k]<0))throw Error('Risultato primo tempo non valido');
  if(!empty(r.hth)&&!empty(r.hta)&&!empty(r.ht)&&r.ht!==r.hth+r.hta)throw Error('Primo tempo incoerente');
  if(!empty(r.shots)&&(!Array.isArray(r.shots)||r.shots.length!==4||r.shots.some(v=>!empty(v)&&(!Number.isFinite(v)||v<0))))throw Error('Tiri non validi');
 }
 function describe(r,index,origin){return {index,origin,date:r&&Number.isFinite(r.d)&&Math.abs(r.d)<=8640000000000000?new Date(r.d).toISOString().slice(0,10):null,league:r?.lg??null,home:r?.H??null,away:r?.A??null,result:r?.up?'in programma':r?String(r.h)+'–'+String(r.a):'non disponibile',homeId:r?.o?.ClubHomeId??null,awayId:r?.o?.ClubAwayId??null,record:r?clone(r):null};}
 function merge(a,b){
  const fields=[];let changed=false;
  if(!a.up&&!b.up&&(a.h!==b.h||a.a!==b.a))return {conflict:'risultati_discordanti',fields:['h','a']};
  const out=clone(a);
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
   if(['H','A','o','up'].includes(k))continue;
   if(['h','a'].includes(k)&&(a.up||b.up))continue;
   if(empty(a[k])){if(!empty(b[k])){put(out,k,clone(b[k]));changed=true;}}
   else if(!empty(b[k])&&!equal(a[k],b[k]))fields.push(k);
  }
  if(a.up&&!b.up){out.up=false;out.h=b.h;out.a=b.a;changed=true;}
  out.o=clone(a.o||{});
  const sourceFields=new Set(['HomeTeam','AwayTeam','Date','Time','Source','SourceTime','CsvSourceFile','Provider','HomeProvider','AwayProvider','HomeTeamID','AwayTeamID','HomeID','AwayID','RecoveryEvidence']);
  for(const [k,v] of Object.entries(b.o||{})){
   if(k==='RecoveryEvidence'){out.o[k]=union(out.o[k]||[],v||[]);continue;}
   if(k.startsWith('Club')){
    if(k.endsWith('Sources'))out.o[k]=union(out.o[k]||[],v||[]);
    else if(empty(out.o[k]))out.o[k]=clone(v);
    continue;
   }
   if(empty(out.o[k])){if(!empty(v)){put(out.o,k,clone(v));changed=true;}}
   else if(!empty(v)&&!equal(out.o[k],v)){
    const numericField=['FTHG','FTAG','HTHG','HTAG','HS','AS','HST','AST','HF','AF','HC','AC','HY','AY','HR','AR'].includes(k)||/^(B365|Avg|Max|Min|PS|P|BW|BF|BMGM|BV|CL|LB|AH)/.test(k);
    const numeric=x=>(typeof x==='number'&&Number.isFinite(x))||(typeof x==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(x));
    if(sourceFields.has(k)||(numericField&&numeric(out.o[k])&&numeric(v)&&Number(out.o[k])===Number(v)))out.o.RecoveryEvidence=union(out.o.RecoveryEvidence||[],[{field:k,values:[out.o[k],v]}]);
    else fields.push('o.'+k);
   }
  }
  // Preserve original source names even when two aliases collapse to one fixture.
  for(const side of ['Home','Away'])out.o['Club'+side+'Sources']=union(a.o?.['Club'+side+'Sources']||[],b.o?.['Club'+side+'Sources']||[]);
  if(fields.length)return {conflict:'dati_incompatibili',fields};
  return {record:out,kind:changed?'integrabili':'identici'};
 }
 function plan(content,existing=[]){return clubs.isolated(()=>{
  const report={version:'TA-RECOVERY-1',createdAt:new Date().toISOString(),status:'simulazione',format:null,sourceVersion:null,inputCount:0,existingCount:existing.length,outputCount:existing.length,importable:0,problematic:0,identical:0,compatible:0,added:0,changedNames:0,changes:[],collisions:[],errors:[],leagues:[],seasons:[],safe:false,canPartial:false,excluded:[],coverage:[],protectedFieldsUnchanged:true};
  let parsed;
  try{parsed=parse(content);report.format=parsed.format;report.sourceVersion=parsed.version;report.inputCount=parsed.records.length;}
  catch(ex){report.status='bloccata';report.errors.push({error:ex.message});return {report,records:clone(existing),metadata:{}};}
  const groups=new Map(),invalid=[],normalized=[];
  function add(r,index,origin){
   try{validate(r);const next=clubs.canonicalMatch(r);normalized.push({row:next,index,origin});const id=clubs.matchId(next);if(!groups.has(id))groups.set(id,[]);groups.get(id).push({row:next,index,origin});
    if(origin==='file'&&(r.H!==next.H||r.A!==next.A)){report.changedNames++;report.changes.push({index,before:[r.H,r.A],after:[next.H,next.A]});}
   }catch(ex){const detail={...describe(r,index,origin),error:ex.message};report.errors.push(detail);invalid.push(detail);}
  }
  existing.forEach((r,i)=>add(r,i,'archivio'));parsed.records.forEach((r,i)=>add(r,i,'file'));
  report.leagues=[...new Set(parsed.records.filter(Boolean).map(r=>r.lg).filter(Boolean))].sort();
  report.seasons=[...new Set(parsed.records.filter(r=>r&&Number.isFinite(r.d)).map(r=>Number.isInteger(r.o?.CsvSeason)?r.o.CsvSeason:(new Date(r.d).getUTCFullYear()-(new Date(r.d).getUTCMonth()<6?1:0))))].sort();
  const records=[];let existingProblem=invalid.some(v=>v.origin==='archivio');
  for(const [id,entries] of groups){
   const incoming=entries.filter(v=>v.origin==='file'),base=entries.filter(v=>v.origin==='archivio');
   let combined=clone(entries[0].row),kind='identici',cause=null,fields=[];
   if(entries.some(v=>['Home','Away'].some(s=>v.row.o?.['Club'+s+'Status']==='ambigua'))){cause='identita_ambigua';fields=['identità club'];}
   for(let i=1;i<entries.length&&!cause;i++){
    const result=merge(combined,entries[i].row);
    if(result.conflict){cause=result.conflict;fields=result.fields;break;}
    combined=result.record;if(result.kind==='integrabili')kind='integrabili';
   }
   if(cause){
    if(!incoming.length||base.length>1||base.some(v=>['Home','Away'].some(s=>v.row.o?.['Club'+s+'Status']==='ambigua')))existingProblem=true;
    const diagnostic={id,kind:cause,fields,records:entries.map(v=>describe(v.row,v.index,v.origin)),treatment:'Bloccato. Nessun risultato sovrascritto. Risolvere l’identità o verificare la fonte; in alternativa escludere esplicitamente le sole righe del file.'};
    report.collisions.push(diagnostic);report.problematic+=incoming.length;report.excluded.push(...incoming.map(v=>describe(v.row,v.index,v.origin)));
    // Keep the existing archive EXACTLY as it was for excluded groups.
    records.push(...base.map(v=>clone(existing[v.index])));
    continue;
   }
   records.push(combined);report.importable+=incoming.length;
   if(!base.length&&incoming.length)report.added++;
   if(entries.length>1){const duplicateCount=base.length?incoming.length:incoming.length-1;report[kind==='integrabili'?'compatible':'identical']+=duplicateCount;
    report.collisions.push({id,kind,fields:[],records:entries.map(v=>{const detail=describe(v.row,v.index,v.origin);delete detail.record;return detail;}),treatment:kind==='identici'?'Consolidamento delle copie identiche; provenienze conservate.':'Integrazione dei campi mancanti; nessun valore discordante sovrascritto.'});}
   report.coverage.push({outputIndex:records.length-1,inputs:entries.map(v=>({index:v.index,origin:v.origin}))});
  }
  for(const d of invalid){if(d.origin==='file'){report.problematic++;report.excluded.push(d);}else records.push(clone(existing[d.index]));}
  report.outputCount=records.length;report.safe=!existingProblem&&!report.problematic&&!report.errors.length;
  report.canPartial=!existingProblem&&report.problematic>0&&report.importable>0;
  report.status=report.safe?'pronta':report.canPartial?'parziale_disponibile':'bloccata';
  report.protectedFieldsUnchanged=!existingProblem;
  return {report,records,metadata:parsed.metadata};
 });}
 function suggestions(diagnostics){
  const all=diagnostics.clubs||[],suggestions=[];
  for(const c of all){
   const candidates=all.filter(x=>x.id!==c.id&&((c.country==='UNSPECIFIED'&&x.country!=='UNSPECIFIED'&&clubs.key(c.identityName||c.name)===clubs.key(x.identityName||x.name))||(c.provider&&c.sourceId!=null&&c.provider===x.provider&&String(c.sourceId)===String(x.sourceId))));
   for(const s of clubs.seeds)if(s.id!==c.id&&(c.country===s.country||c.country==='UNSPECIFIED'||c.country==='INT')&&s.aliases.some(a=>clubs.key(a)===clubs.key(c.identityName||c.name)))candidates.push(s);
   const unique=[...new Map(candidates.map(x=>[x.id,x])).values()];
   if(unique.length)suggestions.push({fromId:c.id,alias:c.identityName||c.name,country:c.country,provider:c.provider||null,sourceId:c.sourceId??null,candidates:unique.map(x=>({id:x.id,name:x.name,country:x.country})),reason:c.country==='UNSPECIFIED'?'Stesso nome, contesto del Paese disponibile: conferma necessaria':'Alias documentato o identificativo della stessa fonte',requiresConfirmation:true});
  }
  return suggestions;
 }
 function impact(before,after){
  function summarize(rows){const map=new Map();for(const r of rows)for(const [side,name,goals,against] of [['Home',r.H,r.h,r.a],['Away',r.A,r.a,r.h]]){
   const id=r.o?.['Club'+side+'Id']||clubs.resolve(name,r.lg).id,k=JSON.stringify([r.lg,id]);
   if(!map.has(k))map.set(k,{league:r.lg,id,name,played:0,fixtures:0,gf:0,ga:0,wins:0,draws:0,losses:0});
   const s=map.get(k);if(r.up){s.fixtures++;continue;}s.played++;s.gf+=goals;s.ga+=against;if(goals>against)s.wins++;else if(goals===against)s.draws++;else s.losses++;
  }return map;}
  return clubs.isolated(()=>{const a=summarize(before),b=summarize(after);return [...new Set([...a.keys(),...b.keys()])].filter(k=>!equal(a.get(k),b.get(k))).map(k=>({before:a.get(k)||null,after:b.get(k)||null}));});
 }
 return {parse,validate,validateGoal,merge,plan,suggestions,impact,equal,stable,clone,describe};
});
