const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const R=path.resolve(__dirname,'../..'),V=require(R+'/ta-v02v-engine'),{input}=require('../v02v/neutrality.cjs');
const ui=fs.readFileSync(R+'/ta-v02v-ux-ui.js','utf8'),source=ui.slice(ui.indexOf('  function signalMeaning('),ui.indexOf('  function renderMatch('));
const c={};vm.createContext(c);vm.runInContext(source,c);const all=input(),out={outcome:'FAIL',rulePeriod:'2024/25',holdout:'2025/26',rulesFrozen:true,changes:'presentation only; original engine/rating/selection preserved',periods:{}};
for(const year of [2024,2025]){
 const table={};let fixtures=0;
 for(const f of all.filter(x=>x.o.CsvSeason===year)){
  fixtures++;const original=V.interpret(all.filter(x=>x.lg===f.lg&&x.d<f.d),f);
  for(const s of original.markets){const visible=c.signalMeaning(s),d=table[s.market]??={old:{},visible:{},events:{},positive:0,selectedPositive:0,selectedHit:0};
   d.old[s.state]=(d.old[s.state]||0)+1;d.visible[visible.state]=(d.visible[visible.state]||0)+1;
   const event=V.markets[s.market](f);const eventRow=d.events[visible.state]??={n:0,events:0};if(event!==null){eventRow.n++;eventRow.events+=Number(event)}
   if(s.state==='favorevole'){d.positive++;assert.equal(visible.state,'favorevole')}
   assert.equal(visible.h.n,s.h.n);assert.equal(visible.a.n,s.a.n);assert.equal(visible.league.p,s.league.p);
   if(original.top.includes(s)&&s.state==='favorevole'){d.selectedPositive++;d.selectedHit+=Number(event)}
   if(['debole','contrastante','insufficiente'].includes(visible.state))assert(!original.top.includes(s));
  }
 }
 out.periods[year]={fixtures,markets:table};assert.equal(fixtures,760);
}
assert.equal(out.periods[2025].markets.o25.old.contrastante,659);
assert.equal(out.periods[2025].markets.o25.positive,19);
assert.equal(out.periods[2025].markets.o25.selectedPositive,18);
assert.equal(out.periods[2025].markets.o25.selectedHit,9);
out.outcome='PASS';const O=process.env.TA_UX_OUT||R+'/qa/v02v-ux';fs.mkdirSync(O,{recursive:true});fs.writeFileSync(O+'/signals.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
