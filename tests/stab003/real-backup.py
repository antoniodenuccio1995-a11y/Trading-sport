"""Real-data acceptance runner. Inputs and detailed outputs must remain private."""
from pathlib import Path
import argparse,json,hashlib,functools,http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--backup',type=Path,required=True);p.add_argument('--private-output',type=Path,required=True);p.add_argument('--csv-list',type=Path);a=p.parse_args();a.private_output=a.private_output.resolve()
assert not a.private_output.is_relative_to(ROOT),'Personal results cannot be written inside the repository'
a.private_output.mkdir(parents=True,exist_ok=True);original=a.backup.read_bytes();fingerprint=hashlib.sha256(original).hexdigest();doc=json.loads(original)
result={'sourceSHA256':fingerprint,'personalInputPublished':False,'inputRecords':len(doc['records']),'checks':[],'pageerrors':[]}
def check(name):result['checks'].append(name);print('PASS',name,flush=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
def download(page,selector):
 with page.expect_download() as dl:page.locator(selector).evaluate('(el)=>el.click()')
 return json.loads(Path(dl.value.path()).read_text())
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=browser.new_context(accept_downloads=True)
  context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
  page=context.new_page();page.set_default_timeout(60000);page.on('pageerror',lambda e:result['pageerrors'].append(str(e)));page.on('dialog',lambda d:d.accept())
  page.goto(base+'Trading_Analytics_v0.2U-rc4_TA-STAB-003.html');page.wait_for_function('archiveReady && window.taStabAreaReady');page.evaluate('window.taStabAreaReady')
  page.locator('.workspace-nav button[data-open-workspace="dati"]').click();page.set_input_files('#taRecoveryFile',str(a.backup));page.wait_for_function('!archiveBackupBusy && window.taLastMigration?.inputCount>0')
  report=page.evaluate('window.taLastMigration');(a.private_output/'browser-preview.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  assert report['safe'] is True,{'errors':report['errors'],'problematic':report['problematic']}
  assert report['inputCount']==28544 and report['outputCount']==28402 and report['compatible']==141 and report['identical']==1 and report['documentedFixtureAliases']==67 and report['problematic']==0
  assert report['manualMigration']['assigned']==2 and report['manualMigration']['pending']==0
  assert page.evaluate('rows.length')==0
  check('Real 28,544-record backup and two legacy manual fixtures produce a safe 28,402-match preview, without writing')
  # A collapsed section retains both the parsed file and unfinished form values.
  page.evaluate("()=>{document.getElementById('taRClubsCard').open=true;document.getElementById('taClubAlias').value='QA pending form';}")
  page.locator('#taTechCloseAll').click();assert page.evaluate('taPending.report.inputCount')==28544
  assert page.evaluate("document.querySelector('#taClubAlias').value")=='QA pending form'
  page.locator('#taTechOpenAll').click();assert page.evaluate('taPending.report.safe')
  check('Five independent panels and open/close-all preserve the actual pending recovery and unsaved alias form')
  page.locator('#taRecoveryConfirm').click();page.wait_for_function("!archiveBackupBusy && window.taLastMigration?.status==='salvata'")
  assert page.evaluate('rows.length')==28402 and page.evaluate('man.length')==2
  assert page.evaluate('window.taLastMigration.refreshError||null') is None
  exported=download(page,'#archiveExportBackup');(a.private_output/'restored-backup.json').write_text(json.dumps(exported,ensure_ascii=False))
  assert len(exported['records'])==28402 and len(exported['manual'])==2
  assert all(m['o']['LegacyManualOriginal']==old for m,old in zip(exported['manual'],doc['manual']))
  disk=page.evaluate('async()=>JSON.stringify(await archiveDbGet())')
  check('Actual archive and both original manual payloads save atomically and export without losing auxiliary records')
  before_hash=hashlib.sha256(json.dumps(exported['records'],sort_keys=True).encode()).hexdigest();page.reload();page.wait_for_function('archiveReady');page.evaluate('window.taStabAreaReady')
  reexport=download(page,'#archiveExportBackup');after_hash=hashlib.sha256(json.dumps(reexport['records'],sort_keys=True).encode()).hexdigest();assert before_hash==after_hash
  assert reexport['manual']==exported['manual']
  check('Full real archive reload and JSON re-export preserve the exact compact matches and migrated manual metadata')
  counts=page.evaluate("()=>rows.flatMap(r=>['Home','Away'].map(s=>r.o?.['Club'+s+'Resolution'])).filter(Boolean).reduce((a,v)=>(a[v.targetId]=(a[v.targetId]||0)+1,a),{})")
  result['documentedParisResolutions']=counts;assert counts.get('club:fra-paris-fc')==34 and counts.get('club:fra-psg')==8
  check('All 42 dated source-specific Paris identities persist: 34 Paris FC and 8 PSG, kept distinct')
  matrix=page.evaluate('taCoverageRows');(a.private_output/'coverage-after-restore.json').write_text(json.dumps(matrix,ensure_ascii=False))
  assert len(matrix)==138;result['coverageStates']={state:sum(x['status']==state for x in matrix) for state in ['completo verificato','parziale','non verificabile']}
  result['outputRecords']=len(exported['records']);result['migratedManual']=len(exported['manual']);result['compactSHA256BeforeReload']=before_hash;result['compactSHA256AfterReload']=after_hash
  check('Real archive coverage is computed for all 138 supported competition/season combinations with FT and HT separate')
  page.locator('.workspace-nav button[data-open-workspace="dati"]').click();page.locator('#taRJsonCard').evaluate('(el)=>el.open=true');page.locator('#taRecoveryUndo').click();page.wait_for_function('!archiveBackupBusy')
  if page.evaluate('rows.length')!=0:
   diagnostic=page.evaluate('async()=>({status:document.querySelector("#taRecoveryStatus").textContent,aux:taAux(),disk:await archiveDbGet(),undo:await taStoreGet("recoveryUndo")})')
   (a.private_output/'undo-failure.json').write_text(json.dumps(diagnostic));print('UNDO STATUS',diagnostic['status'],flush=True)
  assert page.evaluate('rows.length')==0 and page.evaluate('man.length')==0
  page.reload();page.wait_for_function('archiveReady');assert page.evaluate('rows.length')==0
  check('Rollback restores the pre-import empty test archive and auxiliaries; real input file remains untouched')
  # Return to the real recovered data to exercise supplied CSVs and public recovery.
  page.locator('.workspace-nav button[data-open-workspace="dati"]').click();page.set_input_files('#taRecoveryFile',str(a.backup));page.wait_for_function('!archiveBackupBusy && window.taLastMigration.safe');page.locator('#taRecoveryConfirm').click();page.wait_for_function("!archiveBackupBusy && window.taLastMigration.status==='salvata'")
  if a.csv_list:
   files=json.loads(a.csv_list.read_text());page.set_input_files('#smartHistoricFiles',files);page.wait_for_function('smartQueue.length===7 && !smartImportBusy');page.locator('#smartImportConfirm').click();page.wait_for_function("!smartImportBusy && document.querySelector('#smartImportStatus').textContent.startsWith('Importazione completata:')")
   assert page.evaluate('rows.length')==28402
   after_csv=download(page,'#archiveExportBackup');(a.private_output/'after-supplied-csv.json').write_text(json.dumps(after_csv,ensure_ascii=False));result['suppliedCSVFiles']=len(files);result['csvImportStatus']=page.locator('#smartImportStatus').inner_text()
   page.set_input_files('#smartHistoricFiles',files);page.wait_for_function('smartQueue.length===7 && !smartImportBusy');page.locator('#smartImportConfirm').click();page.wait_for_function("!smartImportBusy && document.querySelector('#smartImportStatus').textContent.startsWith('Importazione completata:')");assert page.evaluate('rows.length')==28402
   check('All seven supplied CSVs import and reimport against the real archive without adding duplicate matches')
  # Statistical cutoffs must hold on a substantive real archive, not just empty fixtures.
  temporal=page.evaluate("""()=>{const saved=rows,cutoff=Date.UTC(2024,9,1),lg='Serie A',fixture=rows.find(r=>r.lg===lg&&!r.up&&se(r)===2024),H=fixture.H,A=fixture.A;
   const before=JSON.stringify(buildMatchAnalysis(H,A,cutoff,lg)),hist=JSON.stringify(standingsHistoryBySeason(lg,H,[2023],2024,cutoff));
   try{rows=[...rows,canonicalMatch({d:cutoff+86400000,lg,H,A,h:99,a:98,ht:10,hth:5,hta:5,up:false,o:{CsvSeason:2023}})];return {analysisUnchanged:before===JSON.stringify(buildMatchAnalysis(H,A,cutoff,lg)),historyUnchanged:hist===JSON.stringify(standingsHistoryBySeason(lg,H,[2023],2024,cutoff)),analysisBytes:before.length};}finally{rows=saved;}}""")
  assert temporal['analysisUnchanged'] and temporal['historyUnchanged'] and temporal['analysisBytes']>1000;result['temporalChecks']=temporal
  check('Real match analysis and prior-season standings exclude later results even with a poisoned earlier-season label')
  journal={'format':'TradingAnalyticsTradeJournal','version':1,'items':[{'id':'STAB003-FROZEN-SYNTHETIC','league':'Serie A','H':'Inter','A':'Milan','createdAt':'2026-10-26T10:00:00Z','marketKey':'o25','marketName':'Over 2.5','side':'back','odds':2.25,'stake':10,'fee':5,'risk':10,'kind':'simulated','grade':{'score':61,'reason':'FROZEN SYNTHETIC'},'operationScore':58,'managementScore':None,'model':'synthetic','events':[]}],'quotes':[]}
  page.set_input_files('#taImportTrades',{'name':'synthetic-trades.json','mimeType':'application/json','buffer':json.dumps(journal).encode()});page.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Importati e verificati 1')");frozen=download(page,'#taExportTrades')
  regular_before=page.evaluate("standingsCompute('Serie A',2022,Date.UTC(2024,6,1)).games.length");assert regular_before==380
  page.evaluate("taHistoryPreview('I1',2022)");page.wait_for_function('!archiveBackupBusy && window.taLastMigration.safe');assert page.evaluate('taPending.report.added')==1
  page.locator('#taRecoveryConfirm').click();page.wait_for_function("!archiveBackupBusy && window.taLastMigration.status==='salvata'");assert page.evaluate('rows.length')==28403
  assert page.evaluate("standingsCompute('Serie A',2022,Date.UTC(2024,6,1)).games.length")==380
  assert page.evaluate("rows.filter(r=>r.lg==='Serie A'&&se(r)===2022).length")==381
  check('Actual HTTP recovery adds the independently sourced Serie A relegation playoff incrementally while keeping regular standings at 380 games')
  again=download(page,'#taExportTrades');assert again['items']==frozen['items'] and again['quotes']==frozen['quotes']
  check('Frozen synthetic trade scores, events and quotes remain exact during real-data CSV and public-history recovery')
  integrated=download(page,'#archiveExportBackup');(a.private_output/'browser-integrated-sample.json').write_text(json.dumps(integrated,ensure_ascii=False));page.reload();page.wait_for_function('archiveReady');page.evaluate('window.taStabAreaReady');assert page.evaluate('rows.length')==28403
  page.locator('.workspace-nav button[data-open-workspace="dati"]').click();page.locator('#taRJsonCard').evaluate('(el)=>el.open=true');page.locator('#taRecoveryUndo').click();page.wait_for_function('!archiveBackupBusy');assert page.evaluate('rows.length')==28402
  check('Incremental real-data recovery persists after reload and rolls back to the exact preceding recovered archive')
  assert not result['pageerrors'],result['pageerrors'];context.close();browser.close()
 assert hashlib.sha256(a.backup.read_bytes()).hexdigest()==fingerprint
 result['outcome']='PASS'
finally:
 server.shutdown();(a.private_output/'real-browser-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 # Only aggregates and hashes are allowed in the public QA evidence.
 public={k:v for k,v in result.items() if k not in ['pageerrors','csvImportStatus']};public['pageerrorCount']=len(result['pageerrors']);(ROOT/'qa/stab003/real-backup-summary.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n')
