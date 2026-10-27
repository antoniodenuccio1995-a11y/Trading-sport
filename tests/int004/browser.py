"""Public synthetic integration contract; no personal data in outputs."""
from pathlib import Path
import hashlib,json,functools,http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SOURCES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html', 'ta-club-aliases-int004.js', 'ta-clubs-v4.js', 'ta-fixture-identity.js', 'ta-json-recovery-rc5.js', 'ta-csv-import-v02U-rc5.js', 'ta-history-coverage-rc5.js', 'ta-history-manifest-rc5.js', 'ta-int004-ui.js', 'ta-int004-area.js', 'ta-int004-app.js']
def source_hashes():return {f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in SOURCES}
TESTED_SOURCES=source_hashes()
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
report={'checks':[],'pageerrors':[],'personalDataUsed':False}
def passed(x):report['checks'].append(x);print('PASS',x,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(accept_downloads=True);c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());p=c.new_page();p.set_default_timeout(60000);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept());p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  pair=p.evaluate("""()=>{const a={d:Date.UTC(2025,7,22),lg:'Serie B',H:'Pescara',A:'Cesena',h:1,a:3,ht:null,hth:null,hta:null,shots:null,up:false,o:{CsvSeason:2025,Phase:'regular',Source:'Independent primary fixture'}};return [a,{...a,H:'Delfino Pescara',A:'Cesena FC',o:{CsvSeason:2025,Phase:'1. Round',Source:'Independent secondary fixture'}}]}""")
  p.evaluate('async a=>{const saved=await mergeImported(a);if(!saved.ok)throw Error("save failed")}',pair);assert p.evaluate('rows.length')==1;assert p.evaluate('new Set(rows.flatMap(r=>[r.H,r.A])).size')==2;passed('T1: audit pair imports as one encounter and two clubs through the application')
  p.evaluate('async a=>await mergeImported(a)',pair);assert p.evaluate('rows.length')==1;passed('T2: repeated application import preserves the encounter count')
  p.evaluate("()=>{$('#lg').value='Serie B';$('#se').value='';}");assert p.evaluate("standingsCompute('Serie B',2025,Date.UTC(2026,6,1)).games.length")==1;assert p.evaluate("standingsCompute('Serie B',2025,Date.UTC(2026,6,1)).table.length")==2;passed('T5: standings consume one game and two clubs')
  journal={'format':'TradingAnalyticsTradeJournal','version':1,'items':[{'id':'INT004-FROZEN-SYNTHETIC','league':'Serie A','H':'Inter','A':'Milan','createdAt':'2026-10-26T10:00:00Z','marketKey':'o25','marketName':'Over 2.5','side':'back','odds':2.25,'stake':10,'fee':5,'risk':10,'kind':'simulated','grade':{'score':61,'reason':'FROZEN SYNTHETIC'},'operationScore':58,'managementScore':None,'model':'synthetic','events':[]}],'quotes':[]}
  p.set_input_files('#taImportTrades',{'name':'synthetic-trades.json','mimeType':'application/json','buffer':json.dumps(journal).encode()});p.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Importati e verificati 1')")
  with p.expect_download() as frozen_dl:p.locator('#taExportTrades').evaluate('(el)=>el.click()')
  frozen=json.loads(Path(frozen_dl.value.path()).read_text())
  # Simulate a previously saved faulty archive; projection must not mutate it.
  p.evaluate('async a=>{await archiveQueueWrite(a);rows=a}',pair);assert p.evaluate('taStatRows().length')==1 and p.evaluate('rows.length')==2;passed('T5: previously duplicated raw archive remains intact while statistical projection uses a distinct fixture')
  disk_before=p.evaluate('async()=>JSON.stringify((await archiveDbGet()).rows)');p.reload();p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');assert p.evaluate('rows.length')==2 and p.evaluate('async()=>JSON.stringify((await archiveDbGet()).rows)')==disk_before;passed('E: startup preserves the previously saved raw duplicates byte-for-byte until explicit repair')
  p.locator('.workspace-nav button[data-open-workspace="dati"]').click();p.locator('#taReconcileArchive').evaluate('(el)=>el.click()');p.wait_for_function('!archiveBackupBusy && taPending?.kind==="riconciliazione archivio"');assert p.evaluate('rows.length')==2;assert p.locator('#taRecoveryConfirm').is_disabled();passed('E: reconciliation preview writes nothing and cannot commit before backup generation');p.locator('#taRecovery').screenshot(path=str(ROOT/'qa/int004/reconciliation-preview.png'))
  with p.expect_download() as before:p.locator('#taRecoveryExportBefore').evaluate('(el)=>el.click()')
  original=json.loads(Path(before.value.path()).read_text());assert len(original['records'])==2;assert p.locator('#taRecoveryConfirm').is_disabled();p.locator('#taRepairBackupAck').check()
  p.locator('#taRecoveryConfirm').evaluate('(el)=>el.click()');p.wait_for_function('!archiveBackupBusy');assert p.evaluate('rows.length')==1;passed('E: explicit reconciliation after backup consolidates the saved duplicate')
  p.reload();p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');assert p.evaluate('rows.length')==1
  with p.expect_download() as after:p.locator('#archiveExportBackup').evaluate('(el)=>el.click()')
  exported=json.loads(Path(after.value.path()).read_text());assert len(exported['records'])==1;passed('T7: reconciled archive persists and exports its single encounter')
  p.locator('.workspace-nav button[data-open-workspace="dati"]').click();p.locator('#taRecoveryUndo').evaluate('(el)=>el.click()');p.wait_for_function('!archiveBackupBusy');assert p.evaluate('rows.length')==2;passed('T7: undo restores both original raw records after reload')
  with p.expect_download() as after_trades:p.locator('#taExportTrades').evaluate('(el)=>el.click()')
  trades_after=json.loads(Path(after_trades.value.path()).read_text());assert trades_after['items']==frozen['items'] and trades_after['quotes']==frozen['quotes'];passed('Trade journal frozen scores, events and quotes remain exact across reconciliation, reload and undo')
  assert source_hashes()==TESTED_SOURCES;report['testedSourceSHA256']=TESTED_SOURCES;assert not report['pageerrors'],report['pageerrors'];report['outcome']='PASS';c.close();b.close()
finally:s.shutdown();(ROOT/'qa/int004/browser.json').write_text(json.dumps(report,indent=2)+'\n')
