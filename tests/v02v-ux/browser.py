"""Issue #7 browser acceptance with independent Python numeric oracle."""
from pathlib import Path
import base64,csv,datetime,functools,hashlib,http.server,io,json,math,os,sys,threading
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];sys.path.insert(0,str(R/'tests/int004'));from browser_environment import isolate
O=Path(os.environ.get('TA_UX_OUT',R/'qa/v02v-ux'));O.mkdir(parents=True,exist_ok=True)
HTML='Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html'
report={'outcome':'FAIL','pageerrors':[],'consoleErrors':[],'checks':[],'resize':[],'P':{}}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def ok(n,t):report['P'][str(n)]={'outcome':'PASS','check':t};report['checks'].append(t);print('PASS',n,t,flush=True)
def row(day,H,A,h=None,a=None,season=2026,**extra):
 d=int(datetime.datetime.fromisoformat(day).replace(tzinfo=datetime.timezone.utc).timestamp()*1000)
 return {'d':d,'lg':extra.pop('lg','Serie A'),'H':H,'A':A,'h':h,'a':a,'ht':None,'hth':None,'hta':None,'up':h is None,'o':{'CsvSeason':season,'Phase':'regular','Source':'Synthetic UX acceptance',**extra}}
def nav(p,w):
 p.locator(f'.workspace-nav [data-open-workspace="{w}"]').click()
def load(p,records):
 nav(p,'dati');p.locator('#taTechOpenAll').click();p.set_input_files('#taRecoveryFile',{'name':'synthetic-ux.json','mimeType':'application/json','buffer':json.dumps({'format':'TradingAnalyticsBackup','version':2,'records':records}).encode()});p.wait_for_function('!archiveBackupBusy && taPending');assert p.evaluate('taPending.report.safe'),p.evaluate('taPending.report.errors');p.locator('#taRecoveryConfirm').click();p.wait_for_function('!archiveBackupBusy && taPending===null')
def oracle(records,club=None,venue=None):
 xs=[]
 for r in records:
  if club and club not in [r['H'],r['A']]:continue
  if club and venue=='home' and r['H']!=club:continue
  if club and venue=='away' and r['A']!=club:continue
  sides=[r['H']==club] if club else [True,False] if venue=='total' else [venue=='home']
  for home in sides:xs.append((r,home))
 n=len(xs);valid=[(r,h) for r,h in xs if isinstance(r.get('hth'),int) and isinstance(r.get('hta'),int) and 0<=r['hth']<=r['h'] and 0<=r['hta']<=r['a']];nv=len(valid)
 gf=lambda r,h:r['h'] if h else r['a'];ga=lambda r,h:r['a'] if h else r['h'];hf=lambda r,h:r['hth'] if h else r['hta'];ha=lambda r,h:r['hta'] if h else r['hth']
 avg=lambda f:sum(f(r,h) for r,h in xs)/n if n else None
 pct=lambda f:sum(f(r,h) for r,h in xs)*100/n if n else None
 htp=lambda f:sum(f(r,h) for r,h in valid)*100/nv if nv else None
 return {'n':n,'nv':nv,'gf':avg(gf),'ga':avg(ga),'total':avg(lambda r,h:r['h']+r['a']),'ppg':avg(lambda r,h:3 if gf(r,h)>ga(r,h) else 1 if gf(r,h)==ga(r,h) else 0),
 'scored':pct(lambda r,h:gf(r,h)>0),'conceded':pct(lambda r,h:ga(r,h)>0),'clean':pct(lambda r,h:ga(r,h)==0),'win':pct(lambda r,h:gf(r,h)>ga(r,h)),
 'winNil':pct(lambda r,h:gf(r,h)>ga(r,h) and ga(r,h)==0),'lossNil':pct(lambda r,h:gf(r,h)==0 and ga(r,h)>0),
 'bothScored':htp(lambda r,h:hf(r,h)>0 and gf(r,h)>hf(r,h)),'bothConceded':htp(lambda r,h:ha(r,h)>0 and ga(r,h)>ha(r,h)),
 'leadingHT':htp(lambda r,h:hf(r,h)>ha(r,h)),'trailingHT':htp(lambda r,h:hf(r,h)<ha(r,h)),'zeroHT':htp(lambda r,h:hf(r,h)+ha(r,h)==0),
 'halfGF':sum(hf(r,h) for r,h in valid)/nv if nv else None,'halfGA':sum(ha(r,h) for r,h in valid)/nv if nv else None}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(accept_downloads=True,timezone_id='Europe/Rome',viewport={'width':1920,'height':1080});isolate(c,base,report)
  c.add_init_script('window.uxFrames=[];function uxFrame(t){const v=[...document.querySelectorAll("main>section[id]")].filter(x=>x.getBoundingClientRect().height&&getComputedStyle(x).display!=="none"&&getComputedStyle(document.body).display!=="none"&&!document.body.classList.contains("ta-ux-loading")).map(x=>x.id);window.uxFrames.push({t,visible:v,boot:!!document.querySelector("#uxBoot:not([hidden])"),ready:!!window.taVReady});if(!window.taVReady)requestAnimationFrame(uxFrame)};requestAnimationFrame(uxFrame);window.uxWrites=0;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==="snapshots"&&a[1]==="matches")window.uxWrites++;return put.apply(this,a)};')
  p=c.new_page();p.set_default_timeout(90000);p.clock.set_fixed_time(datetime.datetime(2026,10,30,12,tzinfo=datetime.timezone.utc));p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept())
  cdp=c.new_cdp_session(p);frames=[]
  def frame(e):
   if len(frames)<30:frames.append(e['data'])
   cdp.send('Page.screencastFrameAck',{'sessionId':e['sessionId']})
  cdp.on('Page.screencastFrame',frame);cdp.send('Page.startScreencast',{'format':'jpeg','quality':70,'maxWidth':1280,'maxHeight':800,'everyNthFrame':1})
  p.goto(base+HTML);p.evaluate('taVInitialized');p.wait_for_timeout(150);cdp.send('Page.stopScreencast');report['startup']=p.evaluate('({times:taUXStartup,frames:uxFrames,writes:uxWrites})')
  assert report['startup']['writes']==0 and frames
  assert all(set(x['visible'])<={'dashboard'} for x in report['startup']['frames'])
  for n,data in enumerate(frames):(O/f'startup-frame-{n:02}.jpg').write_bytes(base64.b64decode(data))
  ok(3,'Shell/Dashboard before data readiness; actual screencast frames and DOM frame trace, no rc5 workspace or matches write')
  records=[]
  for year in [2025,2026]:
   for i in range(1,11):
    for club,other,in_home in [('Inter','Roma',bool(i%2)),('Milan','Napoli',not bool(i%2))]:
     g=(i%4)+1;lost=i%3;H,A,h,a=(club,other,g,lost) if in_home else (other,club,lost,g)
     r=row(f'{year}-10-{i:02}',H,A,h,a,season=year)
     if i%3:r.update(hth=h//2,hta=a//2,ht=h//2+a//2)
     records.append(r)
   for i in range(1,6):records.append(row(f'{year}-10-{i:02}','Juventus','Torino',i%3,(i+1)%3,season=year))
  records.append(row('2026-10-12','Inter','Milan',3,2,NeutralVenue=True))
  for i in range(12):
   records.append(row('2026-10-30','Inter' if i%2 else 'Roma','Milan' if i%2 else 'Napoli',None,None,lg='Serie A' if i<6 else 'Serie B',MatchID=f'ux{i}',FixtureProvider='QA',KickoffUTC=f'2026-10-30T{14+i%6:02}:00:00Z'))
  # Independent dates, never collapse two actual synthetic source events on same date.
  records += [row('2026-10-31','Inter','Milan'),row('2026-11-01','Inter','Milan'),row('2026-11-02','Inter','Milan'),row('2026-11-05','Inter','Milan'),row('2026-11-06','Inter','Milan'),row('2026-11-05','Inter','Roma',9,9),row('2026-11-10','Inter','Milan')]
  # Today unknown/past clocks must not be classified as certain future.
  records += [row('2026-10-30','Milan','Roma'),row('2026-10-30','Napoli','Milan',KickoffUTC='2026-10-30T10:00:00Z')]
  load(p,records);before=p.evaluate('taFingerprint()');disk=p.evaluate('archiveDbGet().then(TARecovery.stable)')
  nav(p,'dashboard');assert p.locator('#vDashboardUpcoming [data-v-match]').count()==14
  assert '14 partite di oggi' in p.locator('#uxTodayCount').inner_text()
  keys=p.locator('#vDashboardUpcoming [data-v-match]').evaluate_all('(xs)=>xs.map(x=>x.dataset.vMatch)')
  assert len(set(keys))==14
  dashboard_rows=p.evaluate('taVIndex().entries.filter(x=>x.r.d===Date.UTC(2026,9,30)).map(x=>({key:x.key,league:x.comp.name,t:TAFixtures.context(x.r).kickoffInstant}))');lookup={x['key']:x for x in dashboard_rows}
  expected=sorted(keys,key=lambda k:(lookup[k]['league'],lookup[k]['t'] if lookup[k]['t'] is not None else math.inf,k));assert keys==expected
  p.locator('#uxWeekTab').click();assert p.locator('#vDashboardUpcoming [data-v-match]').count()==6
  p.locator('#uxTodayTab').click();assert p.locator('#vDashboardUpcoming [data-v-match]').count()==14
  p.locator('#dashboard').screenshot(path=str(O/'dashboard-desktop.png'));ok(4,'Every one of 14 today fixtures shown full-width; ordered competition/verified time, next seven days separate')
  nav(p,'calendario');p.locator('#vCalFrom').fill('2026-11-10');p.locator('#vCalTo').fill('2026-11-10');p.locator('#vCalendarRows [data-v-match]').click()
  assert p.locator('#dd').input_value()=='2026-11-10' and p.locator('#analysisDate').input_value()=='2026-11-10'
  fixture_key=p.evaluate('taVMatch.key');grades=p.locator('#taMarketPanel').inner_text()
  p.evaluate('()=>{window.uxSavedRows=rows;rows=rows.filter(r=>!(r.d===Date.UTC(2026,10,5)&&!r.up));fill();comparisonOptions();}')
  p.evaluate('taVOpenMatch',fixture_key);assert p.locator('#taMarketPanel').inner_text()==grades
  p.evaluate('()=>{rows=window.uxSavedRows;delete window.uxSavedRows;fill();comparisonOptions();}');p.evaluate('taVOpenMatch',fixture_key)
  report['checks'].append('Canonical fixture date reaches legacy controls/market panels; future scored poison cannot alter any displayed rc5 market grade')
  assert p.locator('#vMatchOverview').is_visible();assert not p.locator('#vMatchPanel').is_visible();p.locator('#comparison [data-tab="confronti"]').click();assert p.locator('#vMatchPanel').is_visible()
  assert p.locator('#comparison [data-panel="confronti"] #vMatchPanel').count()==1
  assert 'Campioni completi del motore comune' not in p.locator('#analisi').inner_text()
  assert 'Dati utilizzati nel confronto' in p.locator('#vMatchPanel').inner_text();ok(7,'Sample wording is explicit with FT/HT, dates, scope and incomplete-coverage disclaimer');ok(8,'Existing Confronti contains H2H/form/new interpretation; brief overview above, original tabs preserved')
  reports={}
  for phase,year in [('now',2026),('old',2025)]:
   p.locator('#comparison .cmx-select').select_option(phase)
   raw=[r for r in records if not r['up'] and r['o']['CsvSeason']==year and r['d']<int(datetime.datetime(2026,10,30,tzinfo=datetime.timezone.utc).timestamp()*1000) and not r['o'].get('NeutralVenue')]
   expected={'home':oracle(raw,'Inter','home'),'homeTotal':oracle(raw,'Inter'),'away':oracle(raw,'Milan','away'),'awayTotal':oracle(raw,'Milan'),'leagueHome':oracle(raw,venue='home'),'leagueAway':oracle(raw,venue='away'),'leagueTotal':oracle(raw,venue='total')}
   actual=p.evaluate(f'taUXCompareData.{phase}')
   for role,values in expected.items():
    for key,val in values.items():
     assert (actual[role][key] is None and val is None) or abs(actual[role][key]-val)<1e-9,(phase,role,key,actual[role][key],val)
   assert actual['homeTotal']['n']==actual['home']['n']+5==10
   for role,league in [('home','leagueHome'),('homeTotal','leagueTotal'),('away','leagueAway'),('awayTotal','leagueTotal')]:
    for cell in p.locator(f'.cmx-phase.is-active [data-cmx-role="{role}"]').evaluate_all('(xs)=>xs.map(x=>({key:x.closest("[data-cmx-key]").dataset.cmxKey,val:x.dataset.value,benchmark:x.dataset.benchmark,text:x.querySelector("strong").textContent,n:+x.dataset.n,bar:!!x.querySelector(".cmx-mini-track i")}))'):
     k=cell['key'];assert cell['bar'];assert abs(float(cell['val'])-expected[role][k])<1e-9;assert abs(float(cell['benchmark'])-expected[league][k])<1e-9
     assert abs(float(cell['text'].replace('%',''))-expected[role][k])<=(.500001 if '%' in cell['text'] else .005001)
     assert cell['n']==expected[role]['nv' if k in ['halfGF','halfGA','bothScored','bothConceded','leadingHT','trailingHT','zeroHT'] else 'n']
   reports[phase]={'expected':expected,'observed':actual}
  report['comparisonOracle']=reports;p.locator('#comparison .cmx-select').select_option('now')
  p.locator('#comparison .cmx-board').first.screenshot(path=str(O/'confronti-board-desktop.png'));p.locator('#comparison [data-panel="confronti"]').screenshot(path=str(O/'confronti-desktop.png'));ok(9,'All 17 existing indicators, four columns and venue/total league benchmarks equal independent Python oracle; asymmetric 5+5, HT gaps, neutral and future excluded')
  # Every modified section resizes in both directions without a reload.
  sequence=[1920,360,768,1024,1440,1920]
  for section in ['dashboard','calendario','analisi','comparatore','scanner','dati']:
   if section=='comparatore':nav(p,'analisi');p.locator('#analisi [data-open-workspace="comparatore"]').click()
   else:nav(p,section)
   if section=='analisi':p.locator('#comparison [data-tab="confronti"]').click()
   for width in sequence:
    p.set_viewport_size({'width':width,'height':1000});p.wait_for_timeout(60)
    state=p.evaluate('({width:innerWidth,main:document.querySelector("main").getBoundingClientRect().width,scroll:document.documentElement.scrollWidth})');state['section']=section;report['resize'].append(state);assert state['scroll']<=width+2,state
    if section=='analisi':
     assert p.locator('.cmx-phase.is-active [data-cmx-role="homeTotal"]').first.is_visible();assert p.locator('.cmx-phase.is-active [data-cmx-role="awayTotal"]').first.is_visible()
     for role in ['home','homeTotal','away','awayTotal']:
      rect=p.locator(f'.cmx-phase.is-active [data-cmx-role="{role}"]').first.bounding_box();assert rect['x']>=0 and rect['x']+rect['width']<=width+2,(width,role,rect)
    if section=='analisi' and width==360:p.locator('#comparison .cmx-board').first.screenshot(path=str(O/'confronti-board-mobile.png'))
    if width in [360,1920]:p.locator('#'+section).screenshot(path=str(O/f'{section}-{width}.png'))
   widths=[x['main'] for x in report['resize'] if x['section']==section and x['width'] in [1440,1920]];assert widths[-1]>widths[-2]+300,(section,widths)
  ok(1,'1920→360→768→1024→1440→1920 on six sections, fluid main, no document overflow, all four comparison values visible')
  # Sidebar preference and accessible controls still work.
  country=p.locator('#sideLeagues details').first.get_attribute('data-v-country');p.locator(f'[data-v-country="{country}"] summary').click();p.locator(f'[data-v-pin="{country}"]').click();p.locator(f'[data-v-pin="{country}"]').focus();assert p.evaluate('document.activeElement.tagName')=='BUTTON';p.keyboard.press('Space');assert p.evaluate('document.activeElement.dataset.vPin')==country;assert p.locator('[data-v-country="INT"]').count()==1
  ok(2,'Compact country/league hierarchy retains pin/reorder/active semantics and keyboard-focusable controls')
  nav(p,'scanner');p.locator('#taScanLeague').select_option('');assert p.locator('#taScanPeriod').input_value()=='today'
  def scanner():return p.locator('#taScannerList [data-ta-scan-analyze]').evaluate_all('(xs)=>xs.map(x=>x.closest("article").innerText)')
  expected_counts={'today':12,'tomorrow':1,'3':14,'7':16}
  for period,expected_n in expected_counts.items():
   p.locator('#taScanPeriod').select_option(period);status=p.locator('#taScanStatus').inner_text();assert status.startswith(str(expected_n)+' gare'),(period,status)
   for text in scanner():
    dates=[d for d in ['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-05','2026-11-06'] if d in text]
    if period=='today':assert dates==['2026-10-30']
  p.locator('#taScanPeriod').select_option('custom');p.locator('#taScanFrom').fill('2026-10-31');p.locator('#taScanTo').fill('2026-11-02');assert p.locator('#taScanStatus').inner_text().startswith('3 gare')
  p.locator('#taScanTo').fill('2026-10-29');assert p.locator('#taScanStatus').inner_text().startswith('0 gare')
  p.locator('#taScanPeriod').select_option('7');p.locator('#taScanTeam').fill('Internazionale');assert 'Inter' in p.locator('#taScannerList').inner_text();assert 'Roma – Napoli' not in p.locator('#taScannerList').inner_text()
  p.locator('#taScanCountry').select_option('ENG');assert p.locator('#taScanStatus').inner_text().startswith('0 gare');ok(10,'Scanner defaults today; tomorrow/3/7/custom bounds, aliases/country, unknown/past today clocks excluded; ratings unchanged')
  nav(p,'calendario');p.locator('#vCalReset').click();assert p.locator('#vCalendarRows .ux-group').count()>0
  with p.expect_download() as dl:p.locator('#vCalExport').click()
  csvout=list(csv.reader(io.StringIO(Path(dl.value.path()).read_text(encoding='utf-8-sig'))));assert len(csvout)-1==p.evaluate('taVIndex().entries.length');ok(5,'Calendar day/league groups, sticky headings, textual status and complete CSV independent of grouping/page')
  assert p.evaluate('taFingerprint()')==before;assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==disk
  nav(p,'analisi');p.locator('#analisi [data-open-workspace="comparatore"]').click();p.locator('#vaCountry').select_option('ITA');p.locator('#vaCompetition').select_option('Serie A');p.locator('#vaClub').select_option(label='Inter');p.locator('#vaSeason').select_option('2026')
  nav(p,'dashboard');assert not p.locator('#uxResumeComparator').is_disabled();assert not p.locator('#uxResumeMatch').is_disabled();p.locator('#uxResumeMatch').click();assert p.evaluate('taVMatch.key')
  nav(p,'dashboard');p.locator('#uxResumeComparator').click();assert p.evaluate('document.body.dataset.workspace')=='comparatore' and p.locator('#vaClub').input_value();report['checks'].append('Both last match and last comparator independently resume, without archive changes')
  assert not report['pageerrors'] and not report['consoleErrors'];c.close();b.close();report['outcome']='PASS'
finally:
 s.shutdown();report['sourceSHA256']={f:hashlib.sha256((R/f).read_bytes()).hexdigest() for f in [HTML,'ta-v02v-ux-ui.js','ta-v02v-ux.css','ta-v02v-refresh.js']};(O/'browser-ux.json').write_text(json.dumps(report,indent=2)+'\n')
