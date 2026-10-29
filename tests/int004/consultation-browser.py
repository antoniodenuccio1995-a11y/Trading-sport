"""Calendar/scanner physical events and missing-HT observation contracts."""
from pathlib import Path
import json,hashlib,functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_environment import isolate
ROOT=Path(__file__).resolve().parents[2];FILES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html','ta-fixture-identity.js','ta-clubs-v4.js','ta-json-recovery-rc5.js'];hashes=lambda:{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES};tested=hashes();report={'checks':[],'pageerrors':[],'personalDataUsed':False}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def passed(x):report['checks'].append(x);print('PASS',x,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);p=b.new_page();isolate(p.context,base,report);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  p.evaluate("""()=>{const now=new Date(),d=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())+86400000,a={d,lg:'Serie B',H:'Pescara',A:'Cesena',up:true,h:null,a:null,ht:null,o:{Provider:'qa',MatchID:'one'}};rows=[a,{...a,o:{Provider:'qa',MatchID:'two'}}];man=[];fill();$('#lg').value='Serie B';$('#dd').value=new Date(d).toISOString().slice(0,10);today();renderFixtureBoard();}""");assert p.evaluate('shownFixtures.length')==2;assert p.locator('#fixtureCounter').inner_text().startswith('2 ');p.evaluate("openWorkspace('scanner')");assert p.locator('#taScanStatus').inner_text().startswith('2 gare');passed('A: two genuinely distinct trusted events remain two in daily calendar, upcoming board and scanner')
  p.evaluate("""()=>{rows=rows.slice(0,1);man=[{...rows[0],H:'Delfino Pescara',A:'Cesena FC',o:{},manual:true}];today();renderFixtureBoard()}""");assert p.evaluate('shownFixtures.length')==1;assert p.locator('#fixtureCounter').inner_text().startswith('1 ');assert p.locator('#taScanStatus').inner_text().startswith('1 gare');passed('A/B: one official fixture and a manual alias copy appear once across future consultations')
  p.evaluate("""()=>{const now=new Date(),d=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());rows=[{d,lg:'Serie B',H:'Pescara',A:'Cesena',up:true,o:{KickoffUTC:new Date(Date.now()+600000).toISOString()}}];man=[];renderFixtureBoard()}""");assert p.locator('#taScanStatus').inner_text().startswith('1 gare');passed('A/F: scanner uses the shared explicit UTC kickoff for a verified future fixture today')
  p.evaluate("""()=>{rows=[null,1,0].map((ht,i)=>({d:Date.UTC(2025,7,1+i),lg:'Serie B',H:'QA Sample',A:'QA Guest '+i,h:2,a:1,ht,up:false,o:{CsvSeason:2025}}));fill();$('#lg').value='Serie B';$('#tp').value='R';$('#tv').value='H';$('#tn').value='10';teams();}""")
  cell=lambda:p.evaluate("[...document.querySelectorAll('#tt tr')].find(r=>r.cells[0]?.textContent==='QA Sample').cells[5].textContent")
  assert cell()=='50%',cell();passed('F: halftime frequency uses two known observations, not a missing HT as a third negative result')
  p.evaluate('()=>{rows=rows.map(r=>({...r,ht:null}));teams()}');assert cell()=='—',cell();passed('F: absent halftime observations display unavailable instead of an invented 0%')
  assert not report['pageerrors'],report['pageerrors'];assert hashes()==tested;assert not report.get('consoleErrors',[]),report.get('consoleErrors');report.update(outcome='PASS',testedSourceSHA256=tested);b.close()
finally:s.shutdown();(ROOT/'qa/int004/consultation-browser.json').write_text(json.dumps(report,indent=2)+'\n')
