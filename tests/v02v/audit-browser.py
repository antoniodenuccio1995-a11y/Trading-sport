"""Corrected AUDIT cases through real JSON upload, clicks and visible values.
Synthetic data only; expectations extend the auditor's immutable reproducer.
"""
from pathlib import Path
import datetime,functools,hashlib,http.server,json,os,sys,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/int004'))
from browser_environment import isolate
OUT=Path(os.environ.get('TA_V02V_OUT',ROOT/'qa/v02v'));OUT.mkdir(parents=True,exist_ok=True)
HTML='Trading_Analytics_v0.2V-rc1_TA-V02V-001.html'
report={'outcome':'FAIL','checks':[],'clockCases':[],'pageerrors':[],'consoleErrors':[],'syntheticDataOnly':True}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def row(date,h=1,a=0,lg='Serie B',**o):
 return {'d':int(datetime.datetime.fromisoformat(date).replace(tzinfo=datetime.timezone.utc).timestamp()*1000),'lg':lg,'H':'Pescara','A':'Cesena','h':h,'a':a,'ht':None,'hth':None,'hta':None,'shots':None,'up':h is None,'o':{'CsvSeason':2026,'Phase':'regular','Source':'Synthetic AUDIT regression','HomeCountry':'ITA','AwayCountry':'ITA',**o}}
def nav(p,workspace):p.locator(f'.workspace-nav [data-open-workspace="{workspace}"]').click()
def import_records(p,records):
 nav(p,'dati');p.locator('#taTechOpenAll').click()
 p.set_input_files('#taRecoveryFile',{'name':'audit-synthetic.json','mimeType':'application/json','buffer':json.dumps({'format':'TradingAnalyticsBackup','version':2,'records':records}).encode()})
 p.wait_for_function('!archiveBackupBusy && taPending');assert p.evaluate('taPending.report.safe')
 p.locator('#taRecoveryConfirm').click();p.wait_for_function('!archiveBackupBusy && taPending===null');assert p.evaluate('rows.length')==len(records)
def comparator(p):
 nav(p,'analisi');p.locator('#analisi [data-open-workspace="comparatore"]').click()
 p.locator('#vaCountry').select_option('ITA');p.locator('#vaCompetition').select_option('Serie B')
 name=next(x for x in p.locator('#vaClub option').all_text_contents() if 'Pescara' in x)
 p.locator('#vaClub').select_option(label=name);p.locator('#vaSeason').select_option('all')
def open_match(p,date):
 nav(p,'calendario');p.locator('#vCalReset').click();p.locator('#vCalFrom').fill(date);p.locator('#vCalTo').fill(date)
 assert p.locator('#vCalendarRows [data-v-match]').count()==1
 p.locator('#vCalendarRows [data-v-match]').click()
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);report['browser']=b.version
  def page(instant='2026-10-30T12:00:00+00:00',zone='Europe/Rome'):
   c=b.new_context(accept_downloads=True,timezone_id=zone,viewport={'width':1360,'height':1000});isolate(c,base,report)
   p=c.new_page();p.clock.set_fixed_time(datetime.datetime.fromisoformat(instant));p.on('pageerror',lambda e:report['pageerrors'].append(str(e)))
   p.on('dialog',lambda d:d.accept());p.set_default_timeout(90000);p.goto(base+HTML);p.evaluate('taVInitialized');return c,p
  c,p=page()
  played=[row('2026-10-'+str(i).zfill(2)) for i in range(1,7)]
  import_records(p,played+[row('2026-10-07',None,None),row('2026-10-08',None,None),row('2026-10-20',None,None)])
  before=p.evaluate('taFingerprint()');disk=p.evaluate('archiveDbGet().then(TARecovery.stable)');open_match(p,'2026-10-20')
  assert p.evaluate('taVMatch.h2h.n')==5
  assert 'Confronti diretti · 5 risultati disponibili' in p.locator('#vMatchPanel').inner_text()
  assert p.evaluate('taVMatch.h2h.timeline.map(x=>x.date)')==[f'2026-10-{i:02}' for i in range(2,7)]
  assert p.evaluate('taVMatch.h2h.quality.excludedFT')==2
  assert p.evaluate('taVMatch.h2h.ht.n')==0
  p.locator('#vMatchPanel').screenshot(path=str(OUT/'audit-h2h-fixed.png'))
  for limit in ['10','all']:
   p.locator('#vH2HLimit').select_option(limit);assert p.evaluate('taVMatch.h2h.n')==6
  assert p.evaluate('taFingerprint()')==before;assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==disk
  report['checks'].append({'id':'V02V-IND-01','outcome':'PASS','last5':5,'last10':6,'all':6,'excludedFT':2,'archiveUnchanged':True});c.close()
  clocks=[('2026-10-30T00:30:00+01:00','2026-10-30'),('2026-07-01T00:30:00+02:00','2026-07-01'),
    ('2026-03-29T03:01:00+02:00','2026-03-29'),('2026-10-25T02:30:00+01:00','2026-10-25'),('2027-01-01T00:30:00+01:00','2027-01-01')]
  for zone in ['Europe/Rome','America/New_York','Asia/Tokyo']:
   for instant,expected in clocks:
    c,p=page(instant,zone);today=datetime.date.fromisoformat(expected)
    yesterday=(today-datetime.timedelta(days=1)).isoformat();tomorrow=(today+datetime.timedelta(days=1)).isoformat();analysis=(today+datetime.timedelta(days=2)).isoformat()
    import_records(p,[row(yesterday),row(expected,9,9),row(tomorrow,8,8),row(analysis,None,None)])
    before=p.evaluate('taFingerprint()');comparator(p);assert p.evaluate('taVComparator.a.n')==1
    current=today.year-(today.month<7)
    assert 'attuale' in p.locator(f'#vaSeason option[value="{current}"]').inner_text()
    assert p.evaluate('taVComparator.a.gf')==1;assert 'Dati fino a ieri' in p.locator('#comparatore').inner_text()
    assert p.evaluate('new Date(TAV02V.day(Date.now())).toISOString().slice(0,10)')==expected
    if zone=='Europe/Rome' and expected=='2026-10-30':p.locator('#comparatore').screenshot(path=str(OUT/'audit-midnight-fixed.png'))
    nav(p,'calendario');p.locator('#vCalReset').click();p.locator('#vCalToday').click()
    assert p.locator('#vCalFrom').input_value()==expected and p.locator('#vCalTo').input_value()==expected
    assert p.locator('#vCalendarRows [data-v-match]').count()==1
    open_match(p,analysis);p.locator('#vH2HLimit').select_option('all')
    assert p.evaluate('taVMatch.h2h.n')==1
    assert p.evaluate('taVMatch.homeTotal.n')==1
    assert p.evaluate('taVSignals.markets.find(x=>x.market==="o25").league.n')==1
    assert p.evaluate('taFingerprint()')==before
    report['clockCases'].append({'instant':instant,'browserTimezone':zone,'expectedRomeDay':expected,'comparatorN':1,'h2hN':1,'signalLeagueN':1,'outcome':'PASS'});c.close()
  report['checks'].append({'id':'V02V-IND-02','outcome':'PASS','browserCases':len(report['clockCases']),'sameDayFutureExcluded':True})
  c,p=page();unknown=row('2026-10-02',lg='Coppa QA da verificare',CompetitionCountry='ITA',Phase='knockout')
  import_records(p,[row('2026-10-01'),unknown]);before=p.evaluate('taFingerprint()');comparator(p)
  assert p.evaluate('taVComparator.a.n')==1;p.locator('#vaScope').select_option('all');assert p.evaluate('taVComparator.a.n')==1
  classification=p.evaluate('TAV02V.competition(rows.find(r=>r.lg==="Coppa QA da verificare"))')
  assert classification['kind']=='cup' and classification['official'] is False
  p.locator('#comparatore').screenshot(path=str(OUT/'audit-official-fixed.png'))
  p.locator('#vaScope').select_option('competition');p.locator('#vaCompetition').select_option('Coppa QA da verificare')
  assert p.evaluate('taVComparator.a.n')==1
  nav(p,'calendario');p.locator('#vCalReset').click();p.locator('#vCalCompetition').select_option('Coppa QA da verificare')
  assert p.locator('#vCalendarRows tbody tr').count()==1;assert p.evaluate('rows.length')==2
  assert p.evaluate('taFingerprint()')==before
  report['checks'].append({'id':'V02V-IND-03','outcome':'PASS','allOfficialN':1,'unknownCompetitionOnlyN':1,'archiveUnchanged':True,'classification':classification});c.close()
  assert len(report['checks'])==3 and len(report['clockCases'])==15
  assert not report['pageerrors'] and not report['consoleErrors'];report['outcome']='PASS';b.close()
finally:
 s.shutdown();report['sourceSHA256']={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in [HTML,'ta-v02v-engine.js','ta-v02v-ui.js','ta-v02v.css']}
 (OUT/'audit-browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
