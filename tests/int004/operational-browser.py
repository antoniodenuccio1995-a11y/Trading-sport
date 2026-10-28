"""Selective Windows port: independent backtest oracles and actual UI/alias flows.
All fixtures are synthetic or public; downloads never contain personal rows.
"""
from pathlib import Path
import csv,datetime,functools,hashlib,http.server,io,json,threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
FILES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html','ta-club-aliases-int004.js','ta-clubs-v4.js','ta-fixture-identity.js','ta-json-recovery-rc5.js','ta-csv-import-v02U-rc5.js','ta-history-coverage-rc5.js','ta-history-manifest-rc5.js','ta-int004-ui.js','ta-int004-area.js','ta-int004-app.js']
hashes=lambda:{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES}
tested=hashes();report={'checks':[],'pageerrors':[],'personalDataUsed':False,'publicComparisons':[]}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def passed(text):report['checks'].append(text);print('PASS',text,flush=True)
def oracle(rows,sides,market,season=None):
 result=[]
 for r in sorted(rows,key=lambda x:x[0]):
  if season is not None and r[8]['CsvSeason']!=season:continue
  qualify=True
  for side in sides:
   k=2 if side=='H' else 3
   sample=sorted((x for x in rows if x[0]<r[0] and x[k]==r[k]),key=lambda x:x[0])[-3:]
   if len(sample)<3 or sum(x[4]+x[5]>2 for x in sample)/3*100<60:qualify=False
  if not qualify or market=='ht' and r[6] is None:continue
  h,a=r[4],r[5]
  event={'o15':h+a>1,'o25':h+a>2,'u25':h+a<3,'btts':h>0 and a>0,'ht':r[6] is not None and r[6]>0,'draw':h==a,'home':h>a,'away':a>h}[market]
  result.append([r[0],r[2],r[3],event])
 return result
def preset_oracle(rows,strategy):
 selected=[]
 for r in sorted(rows,key=lambda x:x[0]):
  ok=True
  for c in strategy['conds']:
   side=2 if c['s']=='H' else 3
   sample=sorted((x for x in rows if x[0]<r[0] and x[side]==r[side]),key=lambda x:x[0])[-strategy['n']:]
   if len(sample)<strategy['n'] or c['k']=='ht' and any(x[6] is None for x in sample):ok=False;break
   event=lambda x:{'o25':x[4]+x[5]>2,'o15':x[4]+x[5]>1,'btts':x[4]>0 and x[5]>0,'ht':x[6] is not None and x[6]>0,'dr':x[4]==x[5]}[c['k']]
   frequency=sum(event(x) for x in sample)/len(sample)*100
   if not (frequency>=c['v'] if c['op']=='>=' else frequency<=c['v']):ok=False;break
  if ok and not (strategy['m']=='ht' and r[6] is None):selected.append([r[0],r[2],r[3]])
 return selected
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  c=b.new_context(accept_downloads=True);c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());p=c.new_page();p.set_default_timeout(120000)
  p.clock.set_fixed_time(datetime.datetime(2026,10,28,10,tzinfo=datetime.timezone.utc));p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept())
  p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  assert p.locator('#m option').evaluate_all('(xs)=>xs.map(x=>x.value)')==['o15','o25','u25','btts','ht','draw','home','away']
  p.evaluate("openWorkspace('strategie')");p.locator('#strategie details.workspace-drawer').evaluate('(el)=>el.open=true')
  for i in range(1,p.locator('#pr option').count()):
   p.locator('#pr').select_option(index=i);assert p.evaluate('state().m===PR[+$("#pr").value].m')
  passed('Mercato exposes eight supported markets and every preset selects its original market')
  # Retain an unsupported saved strategy without breaking the supported ones.
  p.evaluate("async()=>{await archiveAuxSet('gp_strats',JSON.stringify([{name:'QA obsolete',m:'obsolete',t:'B',conds:[]},{name:'QA valid',m:'o25',t:'B',conds:[]}]));drawS()}")
  assert p.locator('#sl').inner_text().count('QA ')==2 and 'Mercato non supportato' in p.locator('#sl').inner_text()
  p.evaluate("async()=>{await archiveAuxSet('gp_strats','[]');drawS()}")
  passed('An obsolete saved market does not prevent rendering other strategies')
  fixtures={}
  for code,league in [('I1','Serie A'),('SP1','La Liga')]:
   public=[]
   for year in [2024,2025]:
    public += [x for x in json.loads((ROOT/f'histories/stab003/{code}_{year}.json').read_text())['records'] if x[8].get('HistProvider')=='Football-Data' and not x[7]]
   assert len(public)==760;fixtures[code]=public
   p.evaluate("doc=>{rows=TAClubs.expandCompact(doc);man=[];fill();$('#lg').value=rows[0].lg;$('#se').value=''}",public)
   for sides in [['H'],['A'],['H','A']]:
    for market in ['o15','o25','u25','btts','ht','draw','home','away']:
     for year in [None,2024,2025]:
      actual=p.evaluate("""({sides,market,year})=>{$('#se').value=year==null?'':String(year);return run({m:market,t:'B',n:3,q:2,c:0,h:false,conds:sides.map(s=>({s,k:'o25',op:'>=',v:60}))}).bets.map(b=>[b.r.d,b.r.o.ClubHomeRaw,b.r.o.ClubAwayRaw,b.ev])}""",{'sides':sides,'market':market,'year':year})
      expected=oracle(public,sides,market,year);assert actual==expected,(code,sides,market,year,len(expected),len(actual))
      report['publicComparisons'].append({'league':league,'sides':sides,'market':market,'season':year,'selected':len(actual)})
   passed(f'{league}: 72 independent comparisons of all markets, home/away/both conditions and two season filters')
  p.evaluate("doc=>{rows=TAClubs.expandCompact(doc);man=[];fill();$('#lg').value='Serie A';$('#se').value=''}",fixtures['I1'])
  report['presetComparisons']=[]
  for strategy in p.evaluate('PR'):
   expected=preset_oracle(fixtures['I1'],strategy)
   actual=p.evaluate("S=>run(S).bets.map(b=>[b.r.d,b.r.o.ClubHomeRaw,b.r.o.ClubAwayRaw])",strategy)
   assert actual==expected,strategy['name']
   report['presetComparisons'].append({'name':strategy['name'],'selected':len(actual)})
  assert [x['selected'] for x in report['presetComparisons'][:3]]==[158,98,51]
  passed('All six actual presets match independent public oracles; original audit counts 158 HT / 98 Over 1.5 / 51 Over 2.5 retained')
  p.locator('#taBtLeague').select_option('La Liga');assert p.evaluate("$('#lg').value")== 'La Liga'
  payout=p.evaluate("""()=>{$('#lg').value=rows[0].lg;const S={m:'o25',n:3,q:2.5,c:5,h:false,conds:[{s:'H',k:'o25',op:'>=',v:0}]};return ['B','L'].map(t=>({t,bets:run({...S,t}).bets.map(b=>[b.ev,b.p,b.risk,b.q,b.real])}))}""")
  for group in payout:
   assert group['bets']
   for ev,profit,risk,quote,real in group['bets']:
    expected=(1.5*.95 if ev else -1) if group['t']=='B' else (-1.5 if ev else .95)
    assert abs(profit-expected)<1e-12 and risk==(1 if group['t']=='B' else 1.5) and quote==2.5 and real is False
  passed('Contextual league selector works; original back/lay payout, commission and hypothetical-quote arithmetic are preserved')
  p.evaluate("""doc=>{rows=TAClubs.expandCompact(doc);man=[];fill();$('#lg').value='Serie A';$('#se').value='';setState({name:'QA all operations',m:'o25',t:'B',n:3,q:2,c:5,h:false,conds:[{s:'H',k:'o25',op:'>=',v:0}]})}""",fixtures['I1'])
  p.locator('#go').click();p.wait_for_function("taBtLast?.S.name==='QA all operations' && !$('#go').disabled")
  count=p.evaluate('taBtLast.bets.length');assert count>50 and p.locator('#taBtRows tr').count()==50
  first=p.locator('#taBtRows').inner_text();p.locator('#taBtNext').click();assert p.locator('#taBtRows').inner_text()!=first
  p.locator('#taBtSearch').fill('Inter');assert p.evaluate('taBtPage')==0
  assert all('Inter' in x for x in p.locator('#taBtRows tr').all_text_contents())
  with p.expect_download() as download:p.locator('#taBtExport').click()
  values=list(csv.reader(io.StringIO(Path(download.value.path()).read_text(encoding='utf-8-sig'))));assert len(values)==count+1
  assert {r[7] for r in values[1:]}=={'o25'} and {r[9] for r in values[1:]}=={'no'}
  assert p.locator('#out svg').count()==1 and 'Perché alcune partite' in p.locator('#out').inner_text()
  p.locator('#out').screenshot(path=str(ROOT/'qa/int004/backtest-complete.png'))
  passed('Actual Backtest click renders the complete paginated list, search, graph, exclusion diagnostics and unfiltered full CSV export')
  # One original and one documented alias must not change the backtest sample.
  duplicate=p.evaluate("""()=>{const before=run(state()).bets.map(b=>[b.r.d,b.r.H,b.r.A]);const one=rows.find(r=>r.H==='Inter');rows=[...rows,{...one,H:'Internazionale',o:{...one.o,ClubHomeId:undefined,ClubHomeRaw:'Internazionale',ClubHomeSources:undefined}}];return JSON.stringify(before)===JSON.stringify(run(state()).bets.map(b=>[b.r.d,b.r.H,b.r.A]))}""");assert duplicate
  passed('A compatible alias duplicate changes neither the public backtest selection nor its chronology')
  time=p.evaluate("""()=>{const d=Date.UTC(2026,9,29),r=(date,A,h,a)=>({d:date,lg:'Serie B',H:'QA Same Day',A,h,a,ht:null,up:false,o:{}});rows=[r(d-2*864e5,'QA Old 1',1,0),r(d-864e5,'QA Old 2',1,0),r(d,'QA Poison 1',4,1),r(d,'QA Poison 2',4,1)];man=[{d,lg:'Serie B',H:'QA Same Day',A:'QA Future',up:true,o:{}}];fill();$('#lg').value='Serie B';$('#se').value='';return run({m:'o25',t:'B',n:2,q:2,c:0,h:false,conds:[{s:'H',k:'o25',op:'>=',v:100}]}).next.length}""");assert time==0
  passed('A future manual fixture excludes both later and same-day results from qualification')
  # Use two archive names unknown to the catalogue, explicitly verified by a test user.
  p.evaluate("""async()=>{rows=[];man=[];taPending=null;taSourceText=null;await archiveQueueWrite([]);const r=(d,H,A)=>({d:Date.UTC(2025,7,d),lg:'Serie B',H,A,h:2,a:1,ht:1,hth:1,hta:0,up:false,o:{CsvSeason:2025}});await mergeImported([r(1,'QA Wrong Name','QA Other'),r(8,'QA Correct Name','QA Other')]);renderClubDiagnostics()}""")
  p.evaluate("openWorkspace('dati')");p.locator('#taRClubsCard').evaluate('(el)=>el.open=true')
  before=p.evaluate('JSON.stringify(rows)');rules_before=p.evaluate('JSON.stringify(TAClubs.rules())')
  p.locator('#taQuickFrom').fill('QA Wrong Name · ITA');p.locator('#taQuickTo').fill('QA Correct Name · ITA');p.locator('#taQuickSimulate').click()
  assert 'Devi verificare' in p.locator('#taQuickStatus').inner_text() and p.locator('#taQuickApply').is_disabled()
  p.locator('#taQuickConsent').check();p.locator('#taQuickSimulate').click();p.wait_for_function('!archiveBackupBusy && taPending?.kind==="identità"')
  assert p.evaluate('JSON.stringify(rows)')==before and p.evaluate('JSON.stringify(TAClubs.rules())')==rules_before
  assert not p.locator('#taQuickApply').is_disabled(),p.locator('#taRecoverySummary').inner_text()
  # Collapsing a section retains pending inputs without closing JSON recovery.
  p.locator('#taRClubsCard').evaluate('(el)=>el.open=false');assert p.locator('#taQuickFrom').input_value()=='QA Wrong Name · ITA'
  p.locator('#taRClubsCard').evaluate('(el)=>el.open=true');p.locator('#taQuickApply').click();p.wait_for_function('!archiveBackupBusy && taPending===null')
  assert p.evaluate("rows.every(r=>r.H==='QA Correct Name')") and p.evaluate('TAClubs.rules().length')==1
  expected=p.evaluate('JSON.stringify(archiveCompact(rows))');p.reload();p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');assert p.evaluate('JSON.stringify(archiveCompact(rows))')==expected
  p.locator('#taRecoveryUndo').evaluate('(el)=>el.click()');p.wait_for_function('!archiveBackupBusy');assert p.evaluate('JSON.stringify(rows)')==before and p.evaluate('JSON.stringify(TAClubs.rules())')==rules_before
  passed('Simplified alias flow requires consent, previews without writes, survives panel closing, commits atomically, persists and undoes')
  # Cross-country quick correction is blocked before creating a preview.
  p.evaluate("openWorkspace('dati')");p.locator('#taRClubsCard').evaluate('(el)=>el.open=true')
  target=p.locator('#taQuickToOptions option').evaluate_all("xs=>xs.map(x=>x.value).find(x=>x.endsWith(' · FRA'))")
  p.locator('#taQuickFrom').fill('Inter · ITA');p.locator('#taQuickTo').fill(target);p.locator('#taQuickConsent').check();p.locator('#taQuickSimulate').evaluate('(el)=>el.click()')
  assert 'Paesi diversi' in p.locator('#taQuickStatus').inner_text(),p.locator('#taQuickStatus').inner_text()
  passed('Simplified aliases preserve the cross-country guard and advanced options')
  assert not report['pageerrors'],report['pageerrors'];assert hashes()==tested
  report.update(outcome='PASS',testedSourceSHA256=tested);c.close();b.close()
finally:
 s.shutdown();(ROOT/'qa/int004/operational-browser.json').write_text(json.dumps(report,indent=2)+'\n')
