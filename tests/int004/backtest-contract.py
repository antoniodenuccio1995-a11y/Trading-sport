"""Independent specification checks, retained from the initially failing rc4 run."""
from pathlib import Path
import json,functools,http.server,threading,datetime,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SOURCES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html','ta-club-aliases-int004.js','ta-clubs-v4.js','ta-fixture-identity.js','ta-json-recovery-rc5.js','ta-csv-import-v02U-rc5.js','ta-history-coverage-rc5.js','ta-history-manifest-rc5.js','ta-int004-ui.js','ta-int004-area.js','ta-int004-app.js']
hashes=lambda:{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in SOURCES}
tested=hashes()
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
# Golden observations come from primary Football-Data rows in the frozen public
# packet, independently of the new reconciler and of its canonical club IDs.
raw=json.loads((ROOT/'histories/stab003/I2_2025.json').read_text())['records'];primary=[x for x in raw if x[8].get('HistProvider')=='Football-Data' and not x[7]]
assert len(primary)==380
expected=[]
for r in sorted(primary,key=lambda x:x[0]):
 preceding=sorted((x for x in primary if x[0]<r[0] and x[2]==r[2]),key=lambda x:x[0])[-3:]
 if len(preceding)==3 and sum(x[4]+x[5]>2 for x in preceding)/3*100>=66:expected.append([r[0],r[2],r[3]])
report={'personalDataUsed':False,'publicSource':'frozen rc4 Football-Data I2 2025 primary observations','publicMatches':len(primary),'checks':[],'pageerrors':[]}
def record(name,expected,actual):report['checks'].append({'name':name,'status':'PASS' if actual==expected else 'FAIL','expected':expected,'actual':actual})
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);p=b.new_page();p.clock.set_fixed_time(datetime.datetime(2026,10,28,10,tzinfo=datetime.timezone.utc));p.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  report['marketOptionCount']=p.locator('#m option').count();record('Mercato select includes the existing supported markets',True,report['marketOptionCount']>=8)
  synthetic=p.evaluate("""()=>{const row=(d,H,A,h,a)=>({d:Date.UTC(2025,7,d),lg:'Serie B',H,A,h,a,up:false,ht:null,hth:null,hta:null,o:{CsvSeason:2025}});rows=[row(1,'QA Home','QA Opponent 1',2,1),row(8,'QA Home','QA Opponent 2',3,1),row(15,'QA Home','QA Away',2,0)];fill();$('#lg').value='Serie B';$('#se').value='';const S={m:'o25',t:'B',n:2,q:2,c:0,h:false,conds:[{s:'H',k:'o25',op:'>=',v:100}]};return run(S).bets.length;}""");record('Only-home condition does not require away-side history',1,synthetic)
  document={'format':'TradingAnalyticsBackup','version':2,'records':primary};actual=p.evaluate("""doc=>{rows=TAClubs.expandCompact(doc.records);fill();$('#lg').value='Serie B';$('#se').value='';const result=run({m:'o25',t:'B',n:3,q:2,c:0,h:false,conds:[{s:'H',k:'o25',op:'>=',v:66}]});return result.bets.map(b=>[b.r.d,b.r.o?.ClubHomeRaw??b.r.H,b.r.o?.ClubAwayRaw??b.r.A]);}""",document);record('Public home-only backtest matches independently calculated fixture selection',expected,actual)
  future=p.evaluate("""()=>{man=[canonicalMatch({d:Date.UTC(2026,9,29),lg:'Serie B',H:'Pescara',A:'Cesena',up:true,o:{}})];return run({m:'o25',t:'B',n:3,q:2,c:0,h:false,conds:[{s:'H',k:'o25',op:'>=',v:0}]}).next.filter(r=>r.d===Date.UTC(2026,9,29)).length;}""");record('Future manual fixture is included in strategy search',1,future)
  leakage=p.evaluate("""()=>{const d=Date.UTC(2026,9,29),r=(date,H,A,h,a)=>({d:date,lg:'Serie B',H,A,h,a,ht:null,up:false,o:{}});rows=[r(d-10*86400000,'QA Cutoff Home','QA P1',1,0),r(d-8*86400000,'QA Cutoff Home','QA P2',1,0),r(d-10*86400000,'QA P3','QA Cutoff Away',1,0),r(d-8*86400000,'QA P4','QA Cutoff Away',1,0),r(d+86400000,'QA Cutoff Home','QA P5',3,1),r(d+2*86400000,'QA Cutoff Home','QA P6',3,1),{d,lg:'Serie B',H:'QA Cutoff Home',A:'QA Cutoff Away',up:true,o:{}}];man=[];fill();$('#lg').value='Serie B';$('#se').value='';return run({m:'o25',t:'B',n:2,q:2,c:0,h:false,conds:[{s:'H',k:'o25',op:'>=',v:100}]}).next.length;}""");record('Future strategy qualification excludes observations after that fixture date',0,leakage)
  assert hashes()==tested;report['testedSourceSHA256']=tested
  report['outcome']='PASS' if all(x['status']=='PASS' for x in report['checks']) and not report['pageerrors'] else 'FAIL';report['requiresOperationalBaseline']=False;print(json.dumps({'outcome':report['outcome'],'checks':[{k:v for k,v in x.items() if k not in ['expected','actual']} for x in report['checks']],'expectedPublicSelections':len(expected),'actualPublicSelections':len(actual)}));b.close()
finally:s.shutdown();(ROOT/'qa/int004/backtest-contract.json').write_text(json.dumps(report,indent=2)+'\n')

if report.get('outcome')!='PASS':raise SystemExit(1)
