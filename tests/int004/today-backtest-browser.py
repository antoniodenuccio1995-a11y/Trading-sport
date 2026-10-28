"""Real Backtest click with today's clocks: detects the rc5 lexical-scope defect.
Uses public history and synthetic calendars, never a personal JSON archive.
"""
from pathlib import Path
import csv,datetime,functools,hashlib,http.server,io,json,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
FILES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html','ta-fixture-identity.js','ta-clubs-v4.js','ta-json-recovery-rc5.js']
hashes=lambda:{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES}
tested=hashes();report={'checks':[],'pageerrors':[],'personalDataUsed':False,'browser':'Chromium Linux HTTP','fixedTimeUTC':'2026-10-28T10:00:00Z'}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def passed(text):report['checks'].append(text);print('PASS',text,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(accept_downloads=True,timezone_id='Europe/Rome');c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());p=c.new_page();p.set_default_timeout(60000);p.clock.set_fixed_time(datetime.datetime(2026,10,28,10,tzinfo=datetime.timezone.utc));p.on('pageerror',lambda e:report['pageerrors'].append(str(e)))
  p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  history=[]
  for year in [2024,2025]:history += [r for r in json.loads((ROOT/f'histories/stab003/I1_{year}.json').read_text())['records'] if r[8].get('HistProvider')=='Football-Data' and not r[7]]
  p.evaluate("""doc=>{rows=TAClubs.expandCompact(doc);man=[];fill();$('#lg').value='Serie A';$('#se').value='';setState({name:'QA Today cutoff',m:'o25',t:'B',n:3,q:2,c:5,h:false,conds:[{s:'H',k:'o25',op:'>=',v:0}]});}""",history)
  p.evaluate("openWorkspace('strategie')");p.locator('#strategie details.workspace-drawer').evaluate('(el)=>el.open=true')
  p.locator('#go').click();p.wait_for_function("!$('#go').disabled")
  assert p.locator('#out').inner_text().startswith('Backtest eseguito.'),p.locator('#out').inner_text()
  original=p.evaluate('taBtLast.bets.map(b=>[b.r.d,b.r.H,b.r.A,b.ev,b.p,b.q])');assert len(original)>50
  # Same club and different opponents avoid any arbitrary event fusion.
  p.evaluate("""()=>{const d=Date.UTC(2026,9,28),up=(A,date,o)=>({d:date,lg:'Serie A',H:'Inter',A,h:null,a:null,ht:null,up:true,o:{CsvSeason:2026,...o}});rows=[...rows,up('QA Today UTC Future',d,{KickoffUTC:'2026-10-28T12:00:00Z'}),up('QA Today UTC Past',d,{KickoffUTC:'2026-10-28T08:00:00Z'}),up('QA Today Exact Now',d,{KickoffUTC:'2026-10-28T10:00:00Z'}),up('QA Today No Clock',d,{}),up('QA Today Unzoned',d,{Time:'23:59'}),up('QA Today Offset Future',d,{Time:'12:30',TimeZone:'CEST'}),up('QA Today Malformed',d,{Time:'n.d.',TimeZone:'UTC'}),up('QA Tomorrow No Clock',d+864e5,{}),up('QA Yesterday',d-864e5,{Time:'23:59',TimeZone:'UTC'})];man=[up('QA Today Manual Future',d,{KickoffUTC:'2026-10-28T13:00:00Z'}),up('QA Today Manual Unknown',d,{})];}""")
  p.locator('#go').click();p.wait_for_function("!$('#go').disabled")
  output=p.locator('#out').inner_text();report['observedClickPrefix']=output[:160]
  assert output.startswith('Backtest eseguito.'),output[:250]
  selected=p.evaluate('run(state()).next.map(r=>r.A).sort()')
  expected=sorted(['QA Today UTC Future','QA Today Offset Future','QA Tomorrow No Clock','QA Today Manual Future'])
  report.update(expectedFuture=expected,actualFuture=selected)
  assert selected==expected,selected
  assert all(name in output for name in expected)
  assert all(name not in output for name in ['QA Today UTC Past','QA Today Exact Now','QA Today No Clock','QA Today Unzoned','QA Today Malformed','QA Today Manual Unknown','QA Yesterday'])
  assert p.evaluate('taBtLast.bets.map(b=>[b.r.d,b.r.H,b.r.A,b.ev,b.p,b.q])')==original
  passed('Actual Backtest click accepts verified future clocks today and tomorrow, excludes elapsed/equal/missing/unzoned/malformed clocks today, and leaves every historical operation exact')
  assert p.evaluate('typeof safeKickoffFuture')=='function'
  text=(ROOT/FILES[0]).read_text();assert text.count('function safeKickoffFuture(')==1
  passed('Backtest and Scanner resolve the single shared clock function without duplicate implementations')
  p.evaluate("openWorkspace('scanner')");p.locator('#taScanLeague').select_option('Serie A');p.locator('#taScanRefresh').click()
  status=p.locator('#taScanStatus').inner_text();report['scannerStatus']=status;assert status.startswith('4 gare'),status
  passed('Actual Scanner refresh applies the same conservative clock policy to the same four eligible fixtures')
  p.evaluate("openWorkspace('strategie')")
  for i in range(1,p.locator('#pr option').count()):
   p.locator('#pr').select_option(index=i);p.locator('#go').click();p.wait_for_function("!$('#go').disabled")
   assert p.locator('#out').inner_text().startswith('Backtest eseguito.')
   actual=p.evaluate('taBtLast.bets.length');assert actual==p.evaluate('run(PR[+$("#pr").value]).bets.length')
  passed('All six presets execute through the actual Backtest button with current-day fixtures present')
  p.evaluate("setState({name:'QA Today cutoff',m:'o25',t:'B',n:3,q:2,c:5,h:false,conds:[{s:'H',k:'o25',op:'>=',v:0}]})");p.locator('#go').click();p.wait_for_function("!$('#go').disabled")
  p.locator('#taBtSearch').fill('Inter');assert all('Inter' in x for x in p.locator('#taBtRows tr').all_text_contents())
  with p.expect_download() as download:p.locator('#taBtExport').click()
  values=list(csv.reader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8-sig'))));assert len(values)==len(original)+1
  p.locator('#out').screenshot(path=str(ROOT/'qa/int004/today-backtest.png'))
  passed('Search and complete CSV download work after current-day Backtest execution')
  assert hashes()==tested and not report['pageerrors'];report.update(outcome='PASS',testedSourceSHA256=tested);c.close();b.close()
finally:s.shutdown();(ROOT/'qa/int004/today-backtest-browser.json').write_text(json.dumps(report,indent=2)+'\n')
