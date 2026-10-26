"""Only synthetic fixtures. No uploaded personal archives are consumed by this test."""
from pathlib import Path
import json,functools,http.server,threading,datetime,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/data002b/browser.json'
def source_hashes():return {f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in ['Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html','ta-clubs-v2.js','ta-json-recovery.js','ta-data002b-ui.js','ta-csv-import-v02U-rc2.js']}
report={'checks':[],'pageerrors':[],'personalDataUsed':False,'testedSourceSHA256':source_hashes()}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
def row(day=10,**kw):
 r={'d':int(datetime.datetime(2024,8,day,tzinfo=datetime.timezone.utc).timestamp()*1000),'lg':'Ligue 1','H':'PSG','A':'Lyon','h':2,'a':1,'ht':None,'up':False,'o':{},'hth':None,'hta':None,'shots':None};r.update(kw);return r
def doc(records,**kw):
 return {'format':'TradingAnalyticsBackup','version':2,'records':[[r[k] for k in ['d','lg','H','A','h','a','ht','up','o','hth','hta','shots']] for r in records],**kw}
def strategy(name,**extra):return {'name':name,'m':'o25','t':'B','n':10,'q':2,'c':0,'h':False,'conds':[],**extra}
def ready(p):p.wait_for_function('archiveReady && window.taRecoveryUIReady');p.evaluate('window.taRecoveryUIReady')
def upload(p,data,selector='#taRecoveryFile'):
 if p.evaluate('document.body.dataset.workspace')!='dati':p.locator('.workspace-nav button[data-open-workspace="dati"]').click()
 p.set_input_files(selector,{'name':'synthetic.json','mimeType':'application/json','buffer':json.dumps(data).encode()});p.wait_for_function('!archiveBackupBusy && window.taLastMigration');
def click(p,selector):p.locator(selector).evaluate('(e)=>e.click()')
def confirm(p):click(p,'#taRecoveryConfirm');p.wait_for_function('!archiveBackupBusy')
def export(p,selector):
 with p.expect_download() as d:click(p,selector)
 return json.loads(Path(d.value.path()).read_text())
def check(s):report['checks'].append(s);print('PASS',s,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  c=b.new_context(accept_downloads=True);c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
  p=c.new_page();p.set_default_timeout(16000);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept())
  p.goto(base+'Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html');ready(p)
  p.locator('.workspace-nav button[data-open-workspace="dati"]').click()
  assert p.evaluate('rows.length')==0
  data=doc([row(),row(H='Paris SG'),row(11),row(11,h=4),row(12,H='Paris FC'),row(13,d='invalid')],
   memberships=[{'year':2024,'league':'Premier League','team':'Man Utd','source':'Synthetic reference','date':1723248000000}],manual=[row(20,up=True,h=None,a=None)],strategies=[strategy('Synthetic saved strategy')],goalEvents=[{'key':'synthetic-events','d':row()['d'],'H':'PSG','A':'Lyon','lg':'Ligue 1','goals':[{'side':'H','min':'10'},{'side':'H','min':'20'},{'side':'A','min':'60'}]}])
  before=p.evaluate('async()=>JSON.stringify(await archiveDbGet())');upload(p,data)
  r=p.evaluate('window.taLastMigration');assert r['inputCount']==6 and r['importable']==3 and r['problematic']==3 and r['canPartial']
  assert p.locator('#taRecoveryConfirm').is_disabled() and p.evaluate('rows.length')==0
  assert p.evaluate('async()=>JSON.stringify(await archiveDbGet())')==before
  assert len(export(p,'#taClubIntegrityExport')['collisions'])==2
  check('Preview classifies identical, conflicting and invalid rows without writes; failed diagnostics can be exported')
  p.reload();ready(p);assert p.evaluate('window.taLastMigration.inputCount')==6 and p.locator('#taRecoveryConfirm').is_disabled()
  check('Failed simulation and all row details persist after reload; stale previews cannot be confirmed')
  upload(p,data);p.locator('#taPartialConsent').check();confirm(p)
  assert p.evaluate('rows.length')==2 and p.evaluate('man.length')==1 and p.evaluate('gs().length')==1 and p.evaluate('leaguePathRefs.length')==1
  assert p.evaluate('rows.every(r=>r.h===2)')
  assert p.evaluate('goalTimeStats(rows,true).n')==1
  saved=export(p,'#archiveExportBackup');assert len(saved['records'])==2 and len(saved['records'][0][8]['ClubHomeSources'])==2
  p.reload();ready(p);assert p.evaluate('rows.length')==2 and p.evaluate('man.length')==1 and p.evaluate('gs().length')==1
  check('Explicit partial import preserves safe records and auxiliary data; atomic bundle survives reload and backup export')
  click(p,'#taRecoveryUndo');p.wait_for_function('!archiveBackupBusy');assert p.evaluate('rows.length')==0 and p.evaluate('man.length')==0 and p.evaluate('gs().length')==0
  p.reload();ready(p);assert p.evaluate('rows.length')==0
  check('One-step rollback restores all previous rows and auxiliary sections and persists')
  upload(p,doc([row()]));confirm(p);assert p.evaluate('rows.length')==1
  stable=p.evaluate('async()=>JSON.stringify(await archiveDbGet())');undo=p.evaluate("async()=>JSON.stringify(await taStoreGet('recoveryUndo'))")
  upload(p,doc([row(15,H='Paris FC')]))
  p.evaluate("""()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){const req=put.call(this,v,k);if(k==='matches'){IDBObjectStore.prototype.put=put;req.addEventListener('success',()=>this.transaction.abort());}return req;};}""")
  confirm(p);assert p.evaluate('rows.length')==1
  assert p.evaluate('async()=>JSON.stringify(await archiveDbGet())')==stable
  assert p.evaluate("async()=>JSON.stringify(await taStoreGet('recoveryUndo'))")==undo
  assert 'interrotta' in p.locator('#taRecoveryStatus').inner_text()
  p.reload();ready(p);assert p.evaluate('rows.length')==1
  check('Aborted IDB transaction commits neither rows nor auxiliary data nor undo pointer; failure report persists')
  upload(p,doc([row(15,H='Paris FC')]))
  p.evaluate("async()=>{await archiveDbPut(archiveCompact(rows));}")
  confirm(p);assert p.evaluate('rows.length')==1 and 'altra operazione' in p.locator('#taRecoveryStatus').inner_text()
  p.evaluate("async()=>{const updated=rows.map(r=>({...r,o:{...r.o,OtherTab:'unseen edit'}}));await archiveDbPut(archiveCompact(updated));}")
  upload(p,doc([row(15,H='Paris FC')]));assert p.evaluate('window.taLastMigration.safe') is False
  assert 'Ricarica' in p.evaluate('window.taLastMigration.errors[0].error')
  p.reload();ready(p);assert p.evaluate("rows[0].o.OtherTab")=='unseen edit'
  check('Storage revision check prevents stale preview from overwriting a concurrent writer')
  # Simulate localStorage quota denial: the JSON bundle does not depend on separate local writes.
  upload(p,doc([row(15,H='Paris FC')],strategies=[strategy('Synthetic quota-safe strategy')]))
  p.evaluate("()=>{window.oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('synthetic quota denial')};}")
  confirm(p);assert p.evaluate('rows.length')==2 and p.evaluate('gs().length')==1
  p.evaluate('()=>{Storage.prototype.setItem=window.oldSet;}');p.reload();ready(p);assert p.evaluate('rows.length')==2 and p.evaluate('gs().length')==1
  check('Atomic recovery with auxiliary data succeeds despite localStorage quota denial, with correct reload')
  # Ambiguous identity can be resolved before importing without editing the JSON.
  upload(p,doc([row(16,H='Paris')]))
  assert p.evaluate('window.taLastMigration.safe') is False
  p.evaluate("taSelectClub(TAClubs.resolve('Paris','Ligue 1').id)")
  p.locator('#taClubTarget').select_option('club:fra-psg');p.locator('#taClubEvidence').fill('Synthetic explicit owner verification')
  click(p,'#taClubPreview');p.wait_for_function("taPending?.kind==='identità' && window.taLastMigration.safe")
  assert p.evaluate('rows.length')==2
  confirm(p);assert p.evaluate('rows.length')==3 and p.evaluate('TAClubs.rules().length')==1
  assert p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,16)).o.ClubHomeId")=='club:fra-psg'
  p.reload();ready(p);assert p.evaluate('TAClubs.rules().length')==1
  upload(p,doc([row(16,H='Paris')]),'#archiveImportLegacy');confirm(p);assert p.evaluate('rows.length')==3
  check('Operational identity UI resolves an ambiguous alias, previews consequences and preserves IDs across future legacy imports')
  # Correction of a mistaken association uses the original raw source denomination.
  p.evaluate("taSelectClub('club:fra-psg')");p.locator('#taClubAlias').fill('Paris');p.locator('#taClubCountry').fill('FRA');p.locator('#taClubTarget').select_option('club:fra-paris-fc');p.locator('#taClubEvidence').fill('Synthetic correction after reviewing original source')
  click(p,'#taClubPreview');p.wait_for_function("taPending?.kind==='identità' && window.taLastMigration.safe");confirm(p)
  assert p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,16)).o.ClubHomeId")=='club:fra-paris-fc'
  check('Incorrect alias can be explicitly corrected, with raw names retained and no result changes')
  # Distinct club decision remains stable after reload.
  p.evaluate("taSelectClub('club:fra-paris-fc')");p.locator('#taClubAction').select_option('distinct');p.locator('#taClubScope').select_option('identity');p.locator('#taClubDistinctName').fill('Synthetic distinct Paris club');p.locator('#taClubEvidence').fill('Synthetic evidence of a distinct society')
  click(p,'#taClubPreview');p.wait_for_function("taPending?.kind==='identità'")
  # An overlapping alias decision is diagnosed instead of arbitrary precedence.
  assert p.evaluate('window.taLastMigration.safe') is False
  check('Conflicting user decisions are visible and cannot arbitrarily merge or separate clubs')
  # A different pending team can be marked distinct without overlapping rules.
  upload(p,doc([row(18,H='QA Distinct')]))
  p.locator('#taClubAction').select_option('associate');p.locator('#taClubScope').select_option('alias');confirm(p)
  p.evaluate("taSelectClub(rows.find(r=>r.d===Date.UTC(2024,7,18)).o.ClubHomeId)");p.locator('#taClubAction').select_option('distinct');p.locator('#taClubDistinctName').fill('QA Distinct');p.locator('#taClubEvidence').fill('Synthetic separate source evidence')
  click(p,'#taClubPreview');p.wait_for_function("taPending?.kind==='identità' && window.taLastMigration.safe");confirm(p)
  distinct=p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,18)).o.ClubHomeId");assert distinct.startswith('club:user:')
  p.reload();ready(p);assert p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,18)).o.ClubHomeId")==distinct
  assert p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,18)).o.ClubHomeStatus")=='verificata'
  check('Explicit distinct-club decision receives a permanent ID that survives reloading')
  snapshot=p.evaluate('async()=>JSON.stringify(await archiveDbGet())')
  upload(p,{'version':'TA-CLUBS-1','clubs':[]});assert 'rapporto anagrafico' in p.evaluate('window.taLastMigration.errors[0].error')
  assert p.evaluate('async()=>JSON.stringify(await archiveDbGet())')==snapshot
  check('Uploading an anagrafica report gives actionable Italian instructions and leaves the archive unchanged')
  click(p,'#taRecoveryClear');p.wait_for_function('window.taLastMigration===null');p.reload();ready(p);assert p.evaluate('window.taLastMigration') is None
  check('Simulation remains until explicit deletion or replacement and can be cleared without deleting matches')
  # Synthetic frozen journal roundtrip: candidate recovery never writes these stores.
  journal={'format':'TradingAnalyticsTradeJournal','version':1,'items':[{'id':'TA002B-QA-FROZEN','league':'Ligue 1','H':'PSG','A':'Lyon','createdAt':'2026-10-26T10:00:00Z','marketKey':'o25','marketName':'Over 2.5','side':'back','odds':2.25,'stake':10,'fee':5,'risk':10,'kind':'simulated','grade':{'score':61,'reason':'FROZEN SYNTHETIC'},'operationScore':58,'managementScore':None,'model':'synthetic','events':[]}],'quotes':[]}
  p.set_input_files('#taImportTrades',{'name':'synthetic-trades.json','mimeType':'application/json','buffer':json.dumps(journal).encode()});p.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Importati e verificati 1')")
  frozen=export(p,'#taExportTrades');upload(p,doc([row(19,H='Paris FC')]));confirm(p);after=export(p,'#taExportTrades');assert frozen['items']==after['items'] and frozen['quotes']==after['quotes']
  check('Frozen synthetic trade scores, events and quotes remain exact across JSON recovery')
  full=export(p,'#archiveExportBackup');c2=b.new_context(accept_downloads=True);c2.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
  p2=c2.new_page();p2.on('dialog',lambda d:d.accept());p2.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p2.goto(base+'Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html');ready(p2)
  upload(p2,full);assert p2.evaluate('window.taLastMigration.backupRulesAvailable')==len(full['clubRules'])
  p2.locator('#taUseBackupRules').check();p2.wait_for_function('window.taLastMigration.safe');confirm(p2)
  assert p2.evaluate('rows.length')==len(full['records']) and p2.evaluate('TAClubs.rules().length')==len(full['clubRules'])
  p2.reload();ready(p2);assert p2.evaluate('rows.length')==len(full['records'])
  check('Complete JSON and verified club-rule roundtrip to a new browser profile requires explicit rule consent and survives reload')
  c2.close()
  snapshot=p.evaluate('async()=>JSON.stringify(await archiveDbGet())')
  upload(p,doc([row(21,H='Paris FC')],strategies=[strategy('Synthetic quota-safe strategy',q=3)]))
  assert p.evaluate('window.taLastMigration.safe') is False and p.evaluate('window.taLastMigration.canPartial') is False
  assert p.evaluate('async()=>JSON.stringify(await archiveDbGet())')==snapshot
  assert 'ausiliari' in p.evaluate('window.taLastMigration.errors[0].section')
  check('Conflicting auxiliary sections block the entire operation before any row write')
  old=c.new_page();old.on('dialog',lambda d:d.accept());old.goto(base+'Trading_Analytics_v0.2U-rc2_TA-DATA-002.html');old.wait_for_function('archiveReady')
  old.evaluate('async r=>{if(!await archiveQueueWrite([r]))throw Error("seed failed");rows=[r];}',row())
  old_state=old.evaluate('async()=>JSON.stringify(await archiveDbGet())')
  upload(p,doc([row(22,H='Paris FC')]));confirm(p)
  assert p.evaluate('window.taLastMigration.status')=='salvata' and not p.evaluate('window.taLastMigration.refreshError')
  assert old.evaluate('async()=>JSON.stringify(await archiveDbGet())')==old_state
  check('Recovery in rc3 leaves the preceding rc2 archive byte-equivalent in the same origin')
  old.close()
  p.evaluate("taSelectClub('club:fra-paris-fc')");p.locator('#taClubAlias').fill('Paris');p.locator('#taClubCountry').fill('FRA');p.locator('#taClubAction').select_option('distinct');p.locator('#taClubScope').select_option('alias');p.locator('#taClubDistinctName').fill('QA Separate Paris');p.locator('#taClubEvidence').fill('Synthetic correction of only one mistaken alias')
  click(p,'#taClubPreview');p.wait_for_function("!archiveBackupBusy && window.taLastMigration.safe");confirm(p)
  split=p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,16)).o.ClubHomeId")
  assert split.startswith('club:user:') and p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,15)).o.ClubHomeId")=='club:fra-paris-fc'
  p.reload();ready(p);assert p.evaluate("rows.find(r=>r.d===Date.UTC(2024,7,16)).o.ClubHomeId")==split
  check('Only one mistaken alias can be separated from a club while the other matches retain their original IDs')
  aliases={'version':'TA-CLUBS-1','clubs':[{'id':'club:qa-unspecified','name':'QA Context Club','identityName':'QA Context Club','country':'UNSPECIFIED','status':'da_verificare','aliases':['QA Context Club'],'sources':[]},{'id':'club:qa-fra','name':'QA Context Club','identityName':'QA Context Club','country':'FRA','status':'da_verificare','aliases':['QA Context Club'],'sources':[]}]}
  p.locator('.workspace-nav button[data-open-workspace="dati"]').click()
  p.set_input_files('#taClubReadReport',{'name':'synthetic-anagrafica.json','mimeType':'application/json','buffer':json.dumps(aliases).encode()});p.wait_for_function('taExternalClubs.length===2')
  disk=p.evaluate('async()=>JSON.stringify(await archiveDbGet())');click(p,'#taClubBatch');assert p.evaluate('async()=>JSON.stringify(await archiveDbGet())')==disk
  p.locator('#taClubSuggestions').evaluate('(el)=>{el.closest("details").open=true;}');p.locator('#taClubBatchConsent').check();click(p,'#taClubBatch');p.wait_for_function('!archiveBackupBusy && window.taLastMigration.safe');confirm(p)
  assert p.evaluate("TAClubs.resolve('QA Context Club','Ligue 1').id")=='club:qa-fra'
  p.reload();ready(p);assert p.evaluate("TAClubs.resolve('QA Context Club','Ligue 1').id")=='club:qa-fra'
  check('Country-context batch proposals require explicit verification and preserve the confirmed ID for future imports')
  goals={'key':'old-format-key','d':row()['d'],'H':'PSG','A':'Lyon','lg':'Ligue 1','goals':[{'side':'H','min':'10'},{'side':'H','min':'20'},{'side':'A','min':'60'}]}
  upload(p,doc([row()],goalEvents=[goals]));confirm(p);assert p.evaluate('storedGoalEvents.length')==1
  upload(p,doc([row()],goalEvents=[dict(goals,key='new-format-key')]));confirm(p)
  assert p.evaluate('storedGoalEvents.length')==1 and p.evaluate('storedGoalEvents[0].RecoverySourceKeys.length')==2
  assert p.evaluate('goalTimeStats(rows,true).n')==1
  check('Goal events use competition context, retain old source keys and do not duplicate identical event sequences')
  fallback_context=b.new_context(accept_downloads=True);fallback_context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
  pf=fallback_context.new_page();pf.on('pageerror',lambda e:report['pageerrors'].append(str(e)));pf.goto(base+'Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html');ready(pf)
  pf.evaluate('async r=>{await archiveFallbackPut(archiveCompact([canonicalMatch(r)]));}',row())
  fallback_context.add_init_script("IDBFactory.prototype.open=function(){throw Error('Synthetic IndexedDB unavailable')};")
  pf.reload();ready(pf);assert pf.evaluate('rows.length')==1 and pf.evaluate('archiveMode') in ['compressed','localStorage']
  upload(pf,doc([row(23,H='Paris FC')]));assert pf.evaluate('window.taLastMigration.inputCount')==1 and pf.locator('#taRecoveryConfirm').is_disabled()
  assert export(pf,'#taClubIntegrityExport')['inputCount']==1
  assert pf.evaluate('rows.length')==1
  check('Existing fallback remains readable without IndexedDB; JSON can be diagnosed and exported while atomic import is disabled')
  fallback_context.close()
  bundle=export(p,'#archiveExportBackup');bc=b.new_context(accept_downloads=True);bc.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());pb=bc.new_page();pb.on('dialog',lambda d:d.accept());pb.on('pageerror',lambda e:report['pageerrors'].append(str(e)));pb.goto(base+'Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html');ready(pb)
  upload(pb,bundle);pb.locator('#taUseBackupRules').check();pb.wait_for_function('!archiveBackupBusy && window.taLastMigration.safe');confirm(pb)
  pb.evaluate('async r=>{await archiveFallbackPut(archiveCompact([...rows,canonicalMatch(r)]));}',row(26,H='Paris FC'))
  pb.reload();ready(pb);assert pb.evaluate('rows.length')==len(bundle['records'])+1
  assert pb.evaluate('TAClubs.rules().length')==len(bundle['clubRules']) and pb.evaluate('gs().length')==len(bundle['strategies'])
  assert pb.evaluate('storedGoalEvents.length')==len(bundle['goalEvents'])
  check('A newer match fallback retains the atomic bundle club decisions and auxiliary sections after reload')
  bc.close()
  p.locator('.workspace-nav button[data-open-workspace="dati"]').click();p.locator('#taRecovery').scroll_into_view_if_needed();p.screenshot(path=str(ROOT/'qa/data002b/recovery.png'),full_page=False)
  assert report['pageerrors']==[],report['pageerrors']
  assert source_hashes()==report['testedSourceSHA256'],'Sources changed during the test'
  report['outcome']='PASS'
  c.close();b.close()
finally:
 server.shutdown();OUT.write_text(json.dumps(report,indent=2,ensure_ascii=False))
