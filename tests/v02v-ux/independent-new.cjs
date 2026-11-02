const assert=require('node:assert/strict'),path=require('path');
const V=require(path.resolve(process.argv[2]||'repo','ta-v02v-engine.js'));
const day=s=>Date.parse(s+'T00:00:00Z'),now=Date.parse('2026-10-30T00:30:00+01:00');
const row=(d,h,a,reverse=false,o={})=>({d:day(d),lg:'Serie B',H:reverse?'Cesena':'Pescara',A:reverse?'Pescara':'Cesena',h,a,up:h==null,ht:null,o:{CsvSeason:2026,ClubHomeId:reverse?'B':'A',ClubAwayId:reverse?'A':'B',...o}});
let checks=[];
// Original oracle: alternate venues, shuffled input, cutoff drops newer valid FT;
// A's expected goals across Oct 2..6 are 2+3+4+5+6=20 and GA=5.
let rows=Array.from({length:8},(_,i)=>row(`2026-10-0${i+1}`,i%2?1:i+1,i%2?i+1:1,!!(i%2)));
rows.push(row('2026-10-09',null,null),row('2026-10-10',5,5,false,{ResultScope:'shootout'}));
rows=rows.reverse();let before=JSON.stringify(rows),index=V.createIndex(rows);
let h=V.h2h(index,'A','B',day('2026-10-07'),5,null,now);
assert.equal(h.n,5);assert.equal(h.gf,20);assert.equal(h.ga,5);assert.equal(h.ht.n,0);
assert.deepEqual(h.timeline.map(x=>x.date),[2,3,4,5,6].map(x=>`2026-10-0${x}`));
let rev=V.h2h(index,'B','A',day('2026-10-07'),5,null,now);assert.equal(rev.gf,5);assert.equal(rev.ga,20);assert.equal(JSON.stringify(rows),before);
checks.push({id:'NEW-01',outcome:'PASS',case:'H2H shuffled/reverse venue/historical cutoff/HT null',n:5,gf:20,ga:5});
// Leap-year boundary plus strict historical cutoff, no dependence on host zone.
const leapNow=Date.parse('2028-03-01T00:01:00+01:00');let leap=V.createIndex([row('2028-02-28',1,0),row('2028-02-29',2,0),row('2028-03-01',9,9)]);
assert.equal(V.day(leapNow),day('2028-03-01'));assert.equal(V.profile(leap,{club:'A',competition:'Serie B'},leapNow).n,2);
let p=V.profile(leap,{club:'A',competition:'Serie B',to:'2028-02-28',cutoff:day('2028-03-02')},leapNow);assert.equal(p.n,1);assert.equal(p.restDays,1);
checks.push({id:'NEW-02',outcome:'PASS',case:'Leap day/current boundary/earliest cutoff',allPrior:2,historical:1});
// Mixed per-record qualification same unknown competition; reorder must not promote others.
let mixed=[row('2026-10-01',1,0,false,{Official:true}),row('2026-10-02',2,0,false,{Official:false}),row('2026-10-03',3,0),row('2026-10-04',4,0,false,{Official:'true'})].map(r=>({...r,lg:'Coupe Indipendente'}));
for(let input of [mixed,[...mixed].reverse()]){let i=V.createIndex(input);assert.equal(V.profile(i,{club:'A',scope:'all'},now).n,1);assert.equal(V.profile(i,{club:'A',competition:'Coupe Indipendente'},now).n,4);assert.equal(V.h2h(i,'A','B',Infinity,'all',null,now).n,1);}
checks.push({id:'NEW-03',outcome:'PASS',case:'Mixed qualification in same competition independent of record order',official:1,individual:4});
console.log(JSON.stringify({checks},null,2));
