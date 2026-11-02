from pathlib import Path
import sys,functools,http.server,threading,json,datetime,time,hashlib
from playwright.sync_api import sync_playwright
B=Path('/workspace/scratch/f0027330b816');R=next((B/'zip-source').iterdir());O=B/'evidence'
sys.path.insert(0,str(R/'tests/int004'));from browser_environment import isolate
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/';out={'pageerrors':[],'consoleErrors':[],'resize':[],'syntheticDataOnly':True}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/workspace/scratch/1b6754163016/v02v_audit/runtime/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1920,'height':1080},timezone_id='Pacific/Honolulu');isolate(c,base,out);p=c.new_page();p.on('pageerror',lambda e:out['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept());p.clock.set_fixed_time(datetime.datetime.fromisoformat('2028-03-01T00:01:00+01:00'));p.goto(base+'Trading_Analytics_v0.2V-rc1_TA-V02V-001.html');p.evaluate('taVInitialized')
  out['browser']=b.version;out['servedEngineSHA256']=hashlib.sha256(p.request.get(base+'ta-v02v-engine.js').body()).hexdigest()
  for w in [1920,360,768,1024,1440,1920]:
   p.set_viewport_size({'width':w,'height':1080});p.wait_for_timeout(100);out['resize'].append(p.evaluate('({viewport:innerWidth,main:document.querySelector("main").getBoundingClientRect().width,max:getComputedStyle(document.querySelector("main")).maxWidth,scroll:document.documentElement.scrollWidth})'))
  p.screenshot(path=str(O/'resize-1920.png'))
  def row(d,h=1,a=0):return {'d':int(datetime.datetime.fromisoformat(d).replace(tzinfo=datetime.timezone.utc).timestamp()*1000),'lg':'Serie B','H':'Pescara','A':'Cesena','h':h,'a':a,'up':h is None,'ht':None,'o':{'CsvSeason':2027,'Source':'Independent leap-year fixture'}}
  nav=lambda w:p.locator(f'.workspace-nav [data-open-workspace="{w}"]').click()
  nav('dati');p.locator('#taTechOpenAll').click();p.set_input_files('#taRecoveryFile',{'name':'leap.json','mimeType':'application/json','buffer':json.dumps({'format':'TradingAnalyticsBackup','version':2,'records':[row('2028-02-28'),row('2028-02-29',2,0),row('2028-03-01',9,9),row('2028-03-02',None,None)]}).encode()});p.wait_for_function('!archiveBackupBusy && taPending');assert p.evaluate('taPending.report.safe');p.locator('#taRecoveryConfirm').click();p.wait_for_function('!archiveBackupBusy && !taPending');before=p.evaluate('taFingerprint()')
  nav('analisi');p.locator('#analisi [data-open-workspace="comparatore"]').click();p.locator('#vaCountry').select_option('ITA');p.locator('#vaCompetition').select_option('Serie B');p.locator('#vaClub').select_option(label='Pescara');p.locator('#vaSeason').select_option('all');assert p.evaluate('taVComparator.a.n')==2
  nav('calendario');p.locator('#vCalToday').click();assert p.locator('#vCalFrom').input_value()=='2028-03-01';p.locator('#vCalFrom').fill('2028-03-02');p.locator('#vCalTo').fill('2028-03-02');p.locator('#vCalendarRows [data-v-match]').click();assert p.evaluate('taVMatch.h2h.n')==2;assert p.evaluate('taVMatch.homeTotal.gf')==3;assert p.evaluate('taFingerprint()')==before
  out['leapBrowser']={'outcome':'PASS','timezone':'Pacific/Honolulu','RomeDay':'2028-03-01','comparatorN':2,'h2hN':2,'GF':3,'archiveUnchanged':True}
  out['terminologyPresent']='Campioni completi del motore comune' in p.locator('#vMatchPanel').inner_text();out['panelBeforeExistingAnalysis']=p.evaluate('!!document.querySelector("#vMatchPanel")');p.locator('#vMatchPanel').screenshot(path=str(O/'independent-leap.png'))
  assert not out['pageerrors'] and not out['consoleErrors'];out['outcome']='PASS technical ZIP boot and leap test; UX findings separately';b.close()
finally:s.shutdown();(O/'zip-browser-ux.json').write_text(json.dumps(out,indent=2))
