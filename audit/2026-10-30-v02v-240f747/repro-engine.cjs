// Independent acceptance checks. Usage: node repro-engine.cjs /path/to/candidate
const path=require('path'),V=require(path.join(path.resolve(process.argv[2]||process.cwd()),'ta-v02v-engine.js'));
const date=s=>Date.parse(s+'T00:00:00Z');
const row=(day,h=1,a=0,extra={})=>({d:date(day),lg:'Serie A',H:'QA A',A:'QA B',h,a,up:h===null,o:{CsvSeason:2026,ClubHomeId:'QA:A',ClubAwayId:'QA:B',...extra}});
const now=date('2026-10-30')+12*3600000;
const played=Array.from({length:6},(_,n)=>row('2026-10-'+String(n+1).padStart(2,'0')));
const pending=[row('2026-10-07',null,null),row('2026-10-08',null,null)];
const index=V.createIndex([...played,...pending]);
const last5=V.h2h(index,'QA:A','QA:B',date('2026-10-20'),5,null,now).n;
const midnight=V.profile(V.createIndex([row('2026-10-29')]),{club:'QA:A',competition:'Serie A'},Date.parse('2026-10-30T00:30:00+01:00')).n;
const unknownCup={...row('2026-10-02'),lg:'Coppa QA da verificare',o:{...row('2026-10-02').o,CompetitionCountry:'ITA'}};
const official=V.profile(V.createIndex([row('2026-10-01'),unknownCup]),{club:'QA:A',scope:'all'},now).n;
const checks=[{id:'V02V-IND-01',expected:5,observed:last5},{id:'V02V-IND-02',expected:1,observed:midnight},{id:'V02V-IND-03',expected:1,observed:official}].map(x=>({...x,outcome:x.expected===x.observed?'PASS':'FAIL'}));
console.log(JSON.stringify({checks},null,2));if(checks.some(x=>x.outcome==='FAIL'))process.exitCode=1;
