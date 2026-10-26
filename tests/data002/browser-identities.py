"""New identity/migration regressions, only synthetic archives and temporary profiles."""
from pathlib import Path
import datetime as dt
import functools,http.server,threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'qa/data002/identity-browser.json'
report={'checks':[],'pageerrors':[],'integrity':[]}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
OLD='Trading_Analytics_v0.2U-rc1_TA-CSV-001.html';NEW='Trading_Analytics_v0.2U-rc2_TA-DATA-002.html'
def ready(p):p.wait_for_function('archiveReady')
def data(p):
 if p.evaluate('document.body.dataset.workspace')!='dati':p.locator('.workspace-nav button[data-open-workspace="dati"]').click()
def queue(p,text,name='neutral.csv'):
 data(p)
 if not p.locator('#taRHistoric').evaluate('(el)=>el.open'):p.locator('#taRHistoric > summary').click()
 p.set_input_files('#smartHistoricFiles',{'name':name,'mimeType':'text/csv','buffer':text.encode()})
 p.wait_for_function('!smartImportBusy&&smartQueue.length===1')
def confirm(p):
 p.locator('#smartImportConfirm').click();p.wait_for_function("!smartImportBusy&&document.querySelector('#smartImportStatus').textContent.startsWith('Importazione completata:')")
def export(p,selector='#archiveExportBackup'):
 with p.expect_download() as dl:p.locator(selector).evaluate('(el)=>el.click()')
 return json.loads(Path(dl.value.path()).read_text())
def upload(p,selector,payload,name='synthetic.json'):
 p.set_input_files(selector,{'name':name,'mimeType':'application/json','buffer':json.dumps(payload).encode()})
def check(name):report['checks'].append(name);print('PASS',name,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  def context():
   c=b.new_context(accept_downloads=True);c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());return c
  def page(c,file):
   p=c.new_page();p.set_default_timeout(12000);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.goto(base+file);ready(p);return p
  c=context();old=page(c,OLD);old.on('dialog',lambda d:d.accept())
  source='Div,Season,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG,HS,AS,HST,AST,B365H\nF1,2024/25,2024-08-10,PSG,Olympique Lyonnais,2,1,0,0,10,8,3,2,2.25'
  queue(old,source,'F1_2425.csv');confirm(old);backup=export(old)
  old_disk=old.evaluate('async()=>JSON.stringify(await archiveDbGet())')
  # A frozen old-format trade snapshot must not be rewritten by club normalization.
  trade={'id':'DATA002-SYNTHETIC-OLD','league':'Ligue 1','H':'PSG','A':'Olympique Lyonnais','createdAt':'2026-10-26T10:00:00Z','marketKey':'o25','marketName':'Over 2.5','side':'back','odds':2.25,'stake':10,'fee':5,'risk':10,'kind':'simulated','grade':{'score':61,'reason':'FROZEN SYNTHETIC'},'operationScore':58,'managementScore':None,'model':'synthetic','events':[]}
  journal={'format':'TradingAnalyticsTradeJournal','version':1,'items':[trade],'quotes':[]}
  upload(old,'#taImportTrades',journal);old.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Importati e verificati 1')")
  old_trade_disk=export(old,'#taExportTrades')['items']
  p=page(c,NEW);data(p)
  assert p.evaluate('rows.length')==0 and p.evaluate('leaguePathRefs.length')==0
  assert export(p,'#taExportTrades')['items']==[]
  check('No implicit migration: old same-origin archive/journal remain separate')
  decision={'accept':False}
  p.on('dialog',lambda d:d.accept() if decision['accept'] else d.dismiss())
  upload(p,'#archiveImportBackup',backup)
  p.wait_for_function('window.taLastMigration && !archiveBackupBusy')
  assert p.evaluate('rows.length')==0
  simulation=p.evaluate('window.taLastMigration');assert simulation['safe'] and simulation['changedNames']==1
  report['integrity'].append({'case':'old_backup_simulation_before_accept','report':simulation})
  check('Migration dry-run appears before confirmation; cancellation writes no matches')
  decision['accept']=True
  upload(p,'#archiveImportBackup',backup);p.wait_for_function("document.querySelector('#archiveStorageStatus').textContent.includes('Backup ripristinato')")
  migrated=export(p)['records'][0];original=backup['records'][0]
  assert migrated[0:2]==original[0:2] and migrated[4:8]==original[4:8] and migrated[9:]==original[9:]
  assert all(migrated[8][k]==v for k,v in original[8].items())
  assert migrated[2:4]==['Paris SG','Lyon'] and migrated[8]['ClubHomeRaw']=='PSG'
  assert migrated[8]['ClubHomeId']=='club:fra-psg'
  check('Migration applies names/IDs only; all original FT/HT/shots/odds metadata preserved')
  collision=dict(backup,records=[original,list(original)])
  collision['records'][1][2]='Paris SG';collision['records'][1][4]=9
  state=p.evaluate('JSON.stringify(archiveCompact(rows))');upload(p,'#archiveImportBackup',collision)
  p.wait_for_function("document.querySelector('#archiveStorageStatus').textContent.includes('Simulazione migrazione bloccata')")
  assert p.evaluate('JSON.stringify(archiveCompact(rows))')==state
  report['integrity'].append({'case':'identity_collision_blocks_write','report':p.evaluate('window.taLastMigration')})
  check('Colliding alias identities block migration and preserve the existing candidate snapshot')
  upload(p,'#taImportTrades',journal);p.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Importati e verificati 1')")
  assert export(p,'#taExportTrades')['items']==old_trade_disk
  queue(p,source.replace('PSG','Paris Saint-Germain').replace('Olympique Lyonnais','Lione'),'F1_2425.csv');confirm(p)
  assert p.evaluate('rows.length')==1
  assert export(p,'#taExportTrades')['items']==old_trade_disk
  check('Reimported aliases do not duplicate fixtures or retroactively rename/regrade frozen trades')
  p.reload();ready(p);assert p.evaluate('rows.length')==1
  assert export(p)['records'][0][8]['ClubHomeId']=='club:fra-psg'
  assert len(export(p)['records'][0][8]['ClubHomeSources'])>=2
  check('IDs, source denominations and provenance persist after reload and JSON export')
  # Verify both legacy stores through the old page, after rc2 writes in the same origin.
  assert old.evaluate('async()=>JSON.stringify(await archiveDbGet())')==old_disk
  assert export(old,'#taExportTrades')['items']==old_trade_disk
  check('Same-origin old archive and frozen journal remain byte-equivalent after rc2 activity')
  data(p)
  mixed='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG\nF1,2024-09-01,Known A,Known B,1,0\nUNKNOWN,2024-09-02,Unknown C,Unknown D,2,0'
  queue(p,mixed);p.locator('#smartImportConfirm').click();p.wait_for_function("document.querySelector('#smartImportStatus').textContent.includes('non risolto')")
  assert p.evaluate('rows.length')==1
  p.locator('[data-smart-resolve="0"]').check();confirm(p)
  assert p.evaluate("rows.find(r=>r.H==='Unknown C').o.CsvLeagueResolution.method")=='explicit-user-confirmation'
  check('Mixed unknown league rows require a separate explicit confirmation and retain original code evidence')
  # Show ambiguity in the application, without silently joining either known Paris club.
  queue(p,'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG\nF1,2024-09-03,Paris,Paris FC,1,0','F1.csv');confirm(p)
  assert p.evaluate("rows.find(r=>r.H==='Paris').o.ClubHomeStatus")=='ambigua'
  assert 'ambigue' in p.locator('[data-club-counts]').inner_text()
  assert p.evaluate("rows.find(r=>r.H==='Paris').o.ClubHomeId !== rows.find(r=>r.H==='Paris').o.ClubAwayId")
  check('Ambiguous clubs are diagnosed and kept separate from known similar names')
  c.close()
  c=context();p=page(c,NEW)
  tomorrow_test=dt.datetime.now(dt.timezone.utc).date()+dt.timedelta(days=1)
  same_names=f'Div,Date,HomeTeam,AwayTeam,Provider,HomeTeamID,AwayTeamID\nE0,{tomorrow_test},QA United,QA United,provider,11,22'
  queue(p,same_names,'E0.csv');confirm(p)
  names=p.evaluate('[rows[0].H,rows[0].A]');assert names[0]!=names[1]
  p.evaluate("([H,A])=>{$('#lg').value='';$('#mh').value=H;$('#ma').value=A;$('#mb').click()}",names)
  assert p.evaluate('man.length')==0 and 'campionato' in p.locator('#mm').inner_text()
  p.evaluate("([date,H,A])=>{$('#lg').value='Premier League';onLeagueSelectionChanged(true);$('#dd').value=date;$('#mh').value=H;$('#ma').value=A;$('#mb').click()}",[str(tomorrow_test),*names])
  assert p.evaluate('man.length')==1
  assert p.evaluate('resultIdentity(man[0])===resultIdentity(rows[0])')
  assert p.evaluate('shownFixtures.length')==1
  p.evaluate("([H,A])=>{const r=rows[0];rows.push({...r,d:r.d+86400000,o:{...r.o,ClubHomeId:'synthetic-conflicting-id'}});$('#mh').value=H;$('#ma').value=A;$('#mb').click()}",names)
  assert 'ambigua' in p.locator('#mm').inner_text()
  assert p.evaluate('man.length')==1
  p.reload();ready(p)
  assert p.evaluate('resultIdentity(man[0])===resultIdentity(rows[0])')
  check('Same-name clubs with different provider IDs remain distinct; manual calendar selection retains their permanent IDs')
  c.close()
  c=context();p=page(c,NEW);p.on('dialog',lambda d:d.accept())
  today=dt.datetime.now(dt.timezone.utc).date();tomorrow=today+dt.timedelta(days=1)
  body='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG\n'
  for i in range(42):body+=f'F1,{today-dt.timedelta(days=60-i)},PSG,Olympique Lyonnais,{i%4},{i%2},0,0\n'
  queue(p,body,'F1.csv');confirm(p)
  fixture=f'Div,Date,Time,HomeTeam,AwayTeam\nF1,{tomorrow},18:00,Paris Saint-Germain,Lione\n'
  queue(p,fixture,'F1_fixtures.csv');confirm(p)
  assert p.evaluate('rows.length')==43
  cutoff=int(dt.datetime.combine(tomorrow,dt.time(),tzinfo=dt.timezone.utc).timestamp()*1000)
  p.evaluate("([cutoff,date])=>{$('#lg').value='Ligue 1';onLeagueSelectionChanged(true);$('#dd').value=date;today();compareMatch('PSG','Olympique Lyonnais',cutoff)}",[cutoff,str(tomorrow)])
  assert 'Paris SG' in p.locator('#dt').inner_text() and 'Lyon' in p.locator('#dt').inner_text()
  analysis=p.evaluate("cutoff=>buildMatchAnalysis('PSG','Olympique Lyonnais',cutoff,'Ligue 1')",cutoff)
  assert len(analysis)>1000 and 'Paris SG' in analysis
  p.locator('.workspace-nav button[data-open-workspace="scanner"]').click()
  p.locator('#taScanLeague').select_option('Ligue 1');p.locator('#taScanRefresh').click()
  assert p.locator('#taScannerList .ta-fixture-card').count()==1
  scanner=p.locator('#taScannerList').inner_text()
  assert 'Paris SG' in scanner and 'Lyon' in scanner
  stats=p.evaluate("()=>({count:standingsCompute('Ligue 1',se(rows[0])).games.length,goals:leagueGoalProfile(rows.filter(r=>!r.up))})")
  queue(p,body.replace('PSG','Paris SG').replace('Olympique Lyonnais','Lyon'),'F1.csv');confirm(p)
  assert p.evaluate('rows.length')==43
  assert p.evaluate("()=>({count:standingsCompute('Ligue 1',se(rows[0])).games.length,goals:leagueGoalProfile(rows.filter(r=>!r.up))})")==stats
  assert p.evaluate("cutoff=>buildMatchAnalysis('Paris SG','Lyon',cutoff,'Ligue 1')",cutoff)==analysis
  p.locator('.workspace-nav button[data-open-workspace="scanner"]').click();p.locator('#taScanRefresh').click()
  assert p.locator('#taScannerList').inner_text()==scanner
  check('Calendar, analysis, standings, statistics and scanner agree before/after alias reimport (42 played + 1 fixture)')
  # Metadata alone must never make a later result available to historical charts.
  before=p.evaluate("cutoff=>buildMatchAnalysis('Paris SG','Lyon',cutoff,'Ligue 1')",cutoff)
  p.evaluate("async cutoff=>{await mergeImported([{d:cutoff+86400000,lg:'Ligue 1',H:'Paris SG',A:'Lyon',h:99,a:98,ht:0,hth:0,hta:0,up:false,o:{CsvSeason:se(rows[0])-1}}])}",cutoff)
  assert p.evaluate("cutoff=>buildMatchAnalysis('Paris SG','Lyon',cutoff,'Ligue 1')",cutoff)==before
  hist=p.evaluate("cutoff=>standingsHistoryBySeason('Ligue 1','Paris SG',[se(rows[0])-1],se(rows[0]),cutoff)",cutoff)
  assert hist[0]['games']==0
  check('Future results do not affect analysis or multiyear history even when tagged as a prior season')
  # No future-derived league/country memberships in the historical origin fallback.
  origin=p.evaluate("cutoff=>{rows=[canonicalMatch({d:cutoff+86400000,lg:'Championship',H:'Man Utd',A:'QPR',h:2,a:0,up:false,o:{CsvSeason:2024}})];leaguePathRefs=[];return pathMembership('Premier League','Manchester United',2024,cutoff)}",cutoff)
  assert origin is None
  check('Historical membership fallback also excludes evidence dated after cutoff')
  data(p);p.screenshot(path=str(ROOT/'qa/data002/diagnostics.png'))
  c.close();b.close()
 assert not report['pageerrors'],report['pageerrors']
 report['outcome']='PASS'
finally:
 server.shutdown();OUT.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print('PASS',len(report['checks']),'identity/migration browser checks')
