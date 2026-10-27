/* Coverage is diagnostic. It never supplies observations to statistical models. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./ta-history-manifest'):root.TAHistoryManifest);if(typeof module==='object'&&module.exports)module.exports=api;else root.TAHistory=api})(globalThis,function(manifest){
 'use strict';
 const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function identity(name){let k=norm(name);if(manifest.seedAliases[k])return manifest.seedAliases[k];k=manifest.aliases[k]||k;return manifest.seedAliases[k]||k;}
 const key=r=>[r.d,identity(r.H),identity(r.A)].join('|');
 const season=r=>Number.isInteger(r.o?.CsvSeason)?r.o.CsvSeason:new Date(r.d).getUTCFullYear()-(new Date(r.d).getUTCMonth()<6?1:0);
 function compare(records,asOf=Date.now()){
  const groups=new Map();for(const r of records){const group=r.lg+'|'+season(r);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(r);}
  return manifest.rows.map(ref=>{
   const input=groups.get(ref.league+'|'+ref.season)||[],map=new Map(),duplicates=[],conflicting=[];
   for(const [index,r] of input.entries()){const id=key(r),old=map.get(id);if(!old)map.set(id,r);else{duplicates.push({index,key:id});if(!old.up&&!r.up&&(old.h!==r.h||old.a!==r.a))conflicting.push(id);else if(old.up&&!r.up)map.set(id,r);}}
   const refs=new Map(ref.references.map(r=>[key(r),r])),missing=[],missingFT=[],unreconciledReference=[],differentFT=[],availableHT=[],unmatched=[],futureScored=[];
   const known=new Set(input.flatMap(r=>[identity(r.H),identity(r.A)])),pairs=new Set(input.map(r=>[identity(r.H),identity(r.A)].join('|')));
   for(const [id,r] of refs){const old=map.get(id);if(!old)missing.push(r);if(!r.up&&r.d<asOf){if(!old){const h=identity(r.H),a=identity(r.A);if(!input.length||(known.has(h)&&known.has(a)&&!pairs.has(h+'|'+a)))missingFT.push(r);else unreconciledReference.push(r);}else if(old.up)missingFT.push(r);else if(old.h!==r.h||old.a!==r.a)differentFT.push({archive:old,reference:r});if(old&&!old.up&&old.h===r.h&&old.a===r.a&&old.ht==null&&r.ht!=null)availableHT.push(r);}}
   for(const [id,r] of map){if(!refs.has(id))unmatched.push(r);if(!r.up&&r.d>=asOf)futureScored.push(r);}
   const all=[...map.values()],ft=all.filter(r=>!r.up),ht=ft.filter(r=>Number.isInteger(r.ht)),regularFT=ft.filter(r=>refs.get(key(r))?.phase==='regular').length;
   const regularRefs=[...refs.values()].filter(r=>r.phase==='regular'),regularTeams=new Set(regularRefs.flatMap(r=>[identity(r.H),identity(r.A)])),regularPairs=new Set(regularRefs.map(r=>identity(r.H)+'|'+identity(r.A)));
   const regularStructure=ref.expectedRegular!=null&&regularTeams.size*(regularTeams.size-1)===ref.expectedRegular&&regularPairs.size===ref.expectedRegular&&regularRefs.length===ref.expectedRegular;
   const graphRequired=ref.expectedRegular!=null&&['I1','I2','E0','E1','E2','E3','D1','F1','F2','SP1','SP2','N1','P1'].includes(ref.code);
   const afterSeason=ref.season<new Date(asOf).getUTCFullYear()-(new Date(asOf).getUTCMonth()<6?1:0);
   const complete=afterSeason&&ref.expectedFull!=null&&ft.length===ref.expectedFull&&ref.referenceFT===ref.expectedFull&&!missingFT.length&&!unreconciledReference.length&&!differentFT.length&&!duplicates.length&&!unmatched.length&&!ref.sourceConflicts&&!futureScored.length&&(!graphRequired||regularStructure);
   const status=complete?'completo verificato':!ref.referenceCount?'non verificabile':'parziale';
   return {code:ref.code,league:ref.league,season:ref.season,runtime:ref.runtime,status,present:all.length,inputRows:input.length,ft:ft.length,ht:ht.length,missingHT:ft.length-ht.length,htExact:ft.filter(r=>Number.isInteger(r.hth)&&Number.isInteger(r.hta)).length,fixtures:all.length-ft.length,duplicates:duplicates.length,conflicts:conflicting.length,differentFT:differentFT.length,missingFromReference:missing.length,missingResults:missingFT.length,unreconciledReference:unreconciledReference.length,availableHT:availableHT.length,unmatchedArchive:unmatched.length,futureScored:futureScored.length,expectedRegular:ref.expectedRegular,expectedFull:ref.expectedFull,regularFT,regularStructureVerified:regularStructure,regularComplete:afterSeason&&ref.expectedRegular!=null&&regularFT===ref.expectedRegular,referenceFT:ref.referenceFT,referenceCount:ref.referenceCount,sourceConflicts:ref.sourceConflicts,sourceWarnings:ref.parserWarnings,scope:ref.scope,reliability:ref.reliability,sources:ref.sources,path:ref.path,sha256:ref.sha256,details:{missing,missingFT,unreconciledReference,differentFT,availableHT,unmatched,duplicates,conflicting,futureScored}};
  });
 }
 function align(incoming,existing){
  const exact=x=>String(x??'').normalize('NFC').replace(/\s+/g,' ').trim().toLowerCase(),country=x=>({POR:'PRT',DEN:'DNK',CRO:'HRV',ROM:'ROU',GRE:'GRC',SUI:'CHE'}[x]||x);
  const compatible=(r,side,old,from)=>{const a=country(r.o?.[side+'Country']),b=country(old.o?.['Club'+from+'Country']);if(!a||!b||['INT','UNSPECIFIED'].includes(a)||['INT','UNSPECIFIED'].includes(b))return true;return a===b||identity(r[side==='Home'?'H':'A'])==='club:fra-monaco'&&['MCO','FRA'].includes(a)&&['MCO','FRA'].includes(b);};
  const index=new Map(),clubs=new Map(),groups=new Map();for(const r of existing){const group=r.lg+'|'+season(r);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(r);const k=r.lg+'|'+key(r);if(!index.has(k))index.set(k,[]);index.get(k).push(r);for(const [side,name] of [['Home',r.H],['Away',r.A]]){const clubKey=r.lg+'|'+identity(name);if(!clubs.has(clubKey))clubs.set(clubKey,new Map());const id=r.o?.['Club'+side+'Id'];if(id){const map=clubs.get(clubKey);if(!map.has(id))map.set(id,[]);map.get(id).push({row:r,side,name});}}}
  return incoming.map(r=>{
   const found=(index.get(r.lg+'|'+key(r))||[]).filter(x=>compatible(r,'Home',x,'Home')&&compatible(r,'Away',x,'Away'));
   if(found?.length!==1){const next={...r,o:{...r.o,HistOriginalHome:r.o?.ClubHomeRaw??r.H,HistOriginalAway:r.o?.ClubAwayRaw??r.A}};
    if(!found.length&&r.o?.HistSources?.length){
     const group=groups.get(r.lg+'|'+season(r))||[],ref=manifest.rows.find(x=>x.league===r.lg&&x.season===season(r));
     const sameDate=group.filter(x=>x.d===r.d),possibleDuplicate=sameDate.some(x=>identity(x.H)===identity(r.H)||identity(x.A)===identity(r.A));
     const alreadyFull=r.o.Phase==='regular'&&ref?.expectedRegular&&group.filter(x=>!x.up&&(!x.o?.Phase||x.o.Phase==='regular')).length>=ref.expectedRegular;
     if(possibleDuplicate||alreadyFull){next.o.HistIdentityAmbiguity=possibleDuplicate?'Possibile doppione: avversario da riconciliare nella stessa data':'La stagione ha già il numero atteso di gare regolari: riconciliare nomi/date prima di aggiungere';return next;}
    }
    for(const [side,field] of [['Home','H'],['Away','A']]){const all=clubs.get(r.lg+'|'+identity(r[field]));if(!all?.size)continue;
     let candidates=[...all].map(([id,observations])=>[id,observations.filter(v=>compatible(r,side,v.row,v.side))]).filter(([,v])=>v.length);
     if(!candidates.length)continue;const seasonal=candidates.filter(([,v])=>v.some(x=>season(x.row)===season(r)));
     if(seasonal.length===1)candidates=seasonal;
     else{const literal=candidates.filter(([,v])=>v.some(x=>[x.name,x.row.o?.['Club'+x.side+'Raw'],x.row.o?.['Club'+x.side+'IdentityName']].some(n=>exact(n)===exact(r.o?.['Club'+side+'Raw']??r[field]))));if(literal.length===1)candidates=literal;}
     if(candidates.length>1){next.o.HistIdentityAmbiguity='Più ID correnti per la denominazione '+r[field];continue;}
     const observations=candidates[0][1],selected=observations.find(x=>season(x.row)===season(r))||observations[0];next[field]=selected.name;
     for(const [k,v] of Object.entries(selected.row.o||{}))if(k.startsWith('Club'+selected.side)&&!k.endsWith('Resolution'))next.o[k.replace('Club'+selected.side,'Club'+side)]=v;
     const selectedId=selected.row.o['Club'+selected.side+'Id'],rawIdentity=manifest.seedAliases[norm(selected.name)]===selectedId?selected.name:(selected.row.o['Club'+selected.side+'IdentityName']||selected.name);
     next.o['Club'+side+'Raw']=rawIdentity;next.o['Club'+side+'IdentityName']=rawIdentity;next.o[side+'Country']=selected.row.o['Club'+selected.side+'Country'];
     next.o['Club'+side+'Sources']=[...(next.o['Club'+side+'Sources']||[]),{name:r.o?.['Club'+side+'Raw']??r[field],source:'Riferimento storico pubblico; alias esplicito',sources:r.o?.HistSources||[]}];
    }next.o.HistIdentityBridge='documented-public-alias';return next;}
   const old=found[0],o={...r.o,HistOriginalHome:r.o?.ClubHomeRaw??r.H,HistOriginalAway:r.o?.ClubAwayRaw??r.A};if(old.o?.Source)o.Source=old.o.Source;
   // Explicit public aliases are used only for this exact dated fixture. Preserve
   // the permanent archive IDs and its denomination; no fuzzy name joining.
   for(const side of ['Home','Away']){for(const [k,v] of Object.entries(old.o||{}))if(k.startsWith('Club'+side))o[k]=v;if(old.o?.['Club'+side+'Country'])o[side+'Country']=old.o['Club'+side+'Country'];}
   o.HistIdentityBridge='documented-public-alias';
   return {...r,H:old.H,A:old.A,o};
  });
 }
 return {identity,key,season,compare,align,manifest};
});
