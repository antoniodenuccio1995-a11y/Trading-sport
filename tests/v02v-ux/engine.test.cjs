const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=path.resolve(__dirname,'../..'),V=require(R+'/ta-v02v-engine'),F=require(R+'/ta-fixture-identity'),Recent=require(R+'/ta-v02v-refresh');
const source=fs.readFileSync(R+'/Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html','utf8');
const stats=source.slice(source.indexOf('function comparisonTeamStats('),source.indexOf('function rankingsContext('));
const c={TAV02V:V,TAFixtures:F,window:{},se:r=>r.o.CsvSeason,e:s=>String(s)};vm.createContext(c);vm.runInContext(stats,c);
const mk=(n,H,A,h,a,extra={})=>({d:Date.UTC(2026,9,n),lg:'Serie A',H,A,h,a,hth:n%3?Math.floor(h/2):null,hta:n%3?Math.floor(a/2):null,up:false,o:{CsvSeason:2026,...extra}});
test('Existing comparisonTeamStats orients total GF/GA/HT by club, not raw fixture side',()=>{
 const rows=[mk(1,'A','X',4,1),mk(2,'X','A',0,3),mk(3,'A','X',2,2)];
 const actual=c.comparisonTeamStats(rows,'A');assert.equal(actual.n,3);assert.equal(actual.nv,2);
 assert.equal(actual.gf,3);assert.equal(actual.ga,1);assert.equal(actual.ppg,7/3);
 assert.equal(actual.halfGF,1.5);assert.equal(actual.halfGA,0);assert.equal(actual.win,200/3);
 assert.equal(actual.bothScored,100);assert.equal(actual.zeroHT,0);
});
test('Same cmx-board has four data columns, all 17 indicators and correct total/league denominators',()=>{
 const rows=[];for(let i=1;i<=10;i++){rows.push(i%2?mk(i,'A','X',4,1):mk(i,'X','A',0,3));rows.push(i%2?mk(i,'Y','B',2,0):mk(i,'B','Y',1,3))}
 rows.push(mk(11,'A','B',9,9,{NeutralVenue:true}),mk(12,'A','B',8,8,{ScoreScope:'extra-time'}));
 const before=JSON.stringify(rows),html=c.compactStatsRows('now','A','B',2026,rows,'now'),p=c.window.taUXCompareData.now;
 assert.equal(p.home.n,5);assert.equal(p.away.n,5);assert.equal(p.homeTotal.n,10);assert.equal(p.awayTotal.n,10);
 assert.equal(p.homeTotal.gf,3.5);assert.equal(p.homeTotal.ga,.5);assert.equal(p.leagueTotal.n,40);assert.equal(p.excludedNeutral,1);
 assert.equal((html.match(/data-cmx-key=/g)||[]).length,17);
 for(const role of ['home','homeTotal','away','awayTotal'])assert.equal((html.match(new RegExp(`data-cmx-role="${role}"`,'g'))||[]).length,17);
 assert(html.includes('Media lega totale:'));assert.equal(JSON.stringify(rows),before);
});
test('Current/history separation and no future/invalid FT in the expanded comparison',()=>{
 const a=mk(1,'A','B',2,0),old={...mk(1,'B','A',0,3),o:{CsvSeason:2025}},future={...a,d:Date.now()+3*V.DAY,h:9,a:9};
 c.compactStatsRows('now','A','B',2026,[a,old,future],'now');assert.equal(c.window.taUXCompareData.now.homeTotal.n,1);
 c.compactStatsRows('old','A','B',2026,[a,old,future],'old');assert.equal(c.window.taUXCompareData.old.homeTotal.gf,3);
});
test('Refresh delta only proposes new/integrable data and preserves inputs, recent/new scopes compose',()=>{
 const today=Date.UTC(2026,9,30),key=r=>[r.d,r.H,r.A].join('|'),existing=[mk(10,'A','B',2,0),mk(29,'A','B',1,0)],incoming=[...existing.map(r=>({...r,o:{...r.o,Source:'new URL',AcquisitionSourceSHA256:'changed'}})),mk(30,'C','D',2,1),mk(31,'C','D',9,9)];
 const before=JSON.stringify([existing,incoming]);assert.equal(Recent.delta(incoming,existing,{today,key}).length,1);
 const enriched={...incoming[1],ht:1,hth:1,hta:0};assert.equal(Recent.delta([enriched],existing,{today,key,mode:'recent'}).length,1);
 assert.equal(Recent.delta([enriched],existing,{today,key,mode:'new'}).length,0);
 assert.equal(Recent.delta([mk(10,'C','D',2,1)],existing,{today,key,mode:'recent'}).length,0);
 assert.equal(JSON.stringify([existing,incoming]),before);
});
test('New disagreeing results, clock or odds must reach conservative preview, never become an unnoticed no-op',()=>{
 const old=mk(29,'A','B',1,0);old.o.Time='18:00';old.o.B365H='2.1';const key=r=>String(r.d);
 for(const change of [{h:2},{ht:1},{o:{...old.o,Time:'20:00'}},{o:{...old.o,B365H:'3.1'}}])assert.equal(Recent.delta([{...old,...change}],[old],{today:Date.UTC(2026,9,30),key}).length,1);
});
