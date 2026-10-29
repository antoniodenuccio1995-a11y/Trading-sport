"""Real upload/preview/commit/export/reload/reimport/Undo cycles, no private rows published."""
from pathlib import Path
import argparse,datetime,functools,hashlib,http.server,json,threading
from playwright.sync_api import sync_playwright
from browser_environment import isolate
ROOT=Path(__file__).resolve().parents[2]
FILES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html','ta-club-aliases-int004.js','ta-clubs-v4.js','ta-fixture-identity.js','ta-json-recovery-rc5.js','ta-csv-import-v02U-rc5.js','ta-history-coverage-rc5.js','ta-history-manifest-rc5.js','ta-int004-ui.js','ta-int004-area.js','ta-int004-app.js']
hashes=lambda:{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES}
tested=hashes();a=argparse.ArgumentParser();a.add_argument('--real-backup',type=Path,required=True);a.add_argument('--original-backup',type=Path,required=True);a.add_argument('--private-output',type=Path,required=True);args=a.parse_args();private=args.private_output.resolve();assert not private.is_relative_to(ROOT);private.mkdir(parents=True,exist_ok=True)
report={'outcome':'FAIL','checks':[],'datasets':[],'pageerrors':[],'consoleErrors':[],'personalRowsPublished':False,'testedSourceSHA256':tested}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def digest(doc):return hashlib.sha256(json.dumps({k:v for k,v in doc.items() if k!='exportedAt'},sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def passed(text):report['checks'].append(text);print('PASS',text,flush=True)
d=1755820800000
calendar={'d':d,'lg':'Serie B','H':'Pescara','A':'Cesena','up':True,'h':None,'a':None,'ht':None,'hth':None,'hta':None,'shots':None,'o':{'CsvSeason':2025,'Time':'15:30','Source':'Synthetic schedule'}}
result={**calendar,'up':False,'h':1,'a':3,'ht':1,'hth':0,'hta':1,'o':{'CsvSeason':2025,'SourceTime':'14:30','Source':'Synthetic result','B365H':'2.75'}}
synthetic={'format':'TradingAnalyticsBackup','version':2,'exportedAt':'2026-10-29T08:00:00Z','records':[calendar,result]}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for name,source,expected in [('synthetic',None,1),('rc4Recovered',args.real_backup,28300),('original',args.original_backup,28302)]:
   original=source.read_bytes() if source else json.dumps(synthetic).encode();source_hash=hashlib.sha256(original).hexdigest();doc=json.loads(original)
   c=b.new_context(accept_downloads=True,timezone_id='Europe/Rome');isolate(c,base,report);p=c.new_page();p.set_default_timeout(240000);p.clock.set_fixed_time(datetime.datetime(2026,10,29,10,tzinfo=datetime.timezone.utc));p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda dialog:dialog.accept())
   p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
   def data_area():
    p.locator('.workspace-nav button[data-open-workspace="dati"]').click();p.locator('#taTechOpenAll').click()
   def current():return p.evaluate('JSON.stringify({rows:archiveCompact(rows),aux:taAux(),rules:TAClubs.rules()})')
   def preview(payload):
    before=current();p.set_input_files('#taRecoveryFile',{'name':'test-backup.json','mimeType':'application/json','buffer':payload});p.wait_for_function('!archiveBackupBusy && taPending!==null')
    info=p.evaluate('({safe:taPending.report.safe,input:taPending.report.inputCount,output:taPending.records.length,problems:taPending.report.problematic,archiveReview:taPending.report.archiveNeedsReconciliation||0})')
    assert current()==before,'preview modified durable or auxiliary data'
    assert info['safe'] and info['output']==expected and not p.locator('#taRecoveryConfirm').is_disabled(),(name,info)
    return info
   def confirm():
    p.locator('#taRecoveryConfirm').click();p.wait_for_function("!archiveBackupBusy && taPending===null && window.taLastMigration?.status==='salvata'")
   def export():
    with p.expect_download() as dl:p.locator('#taRecoveryExportBefore').click()
    return json.loads(Path(dl.value.path()).read_text())
   def reopen():
    p.reload();p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');data_area()
   data_area();empty=current();first_info=preview(original);assert p.evaluate('rows.length')==0;confirm();first=export();assert len(first['records'])==expected
   first_digest=digest(first);(private/(name+'-first.json')).write_text(json.dumps(first,ensure_ascii=False));passed(name+': real upload, safe preview without writes, confirmation and full JSON export')
   reopen();assert digest(export())==first_digest;passed(name+': all exported sections identical after reload')
   iterations=[]
   for i in range(3):
    info=preview(original);confirm();exported=export();assert digest(exported)==first_digest,(name,'original reimport changed data',i)
    reopen();assert digest(export())==first_digest;iterations.append(info)
   passed(name+': three actual reimports of the same source, each committed/reloaded, preserve every record and auxiliary section exactly')
   own=json.dumps(first,ensure_ascii=False).encode();info=preview(own);confirm();assert digest(export())==first_digest;reopen();assert digest(export())==first_digest
   passed(name+': reimport of the new export is also an exact no-op')
   p.locator('#taRecoveryUndo').click();p.wait_for_function('!archiveBackupBusy');assert digest(export())==first_digest;reopen();assert digest(export())==first_digest
   passed(name+': Undo of a reimport restores the exact preceding complete archive')
   # A separate empty profile proves undo of the initial recovery, not only no-op imports.
   c.close();c=b.new_context(accept_downloads=True);isolate(c,base,report);p=c.new_page();p.set_default_timeout(240000);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda dialog:dialog.accept());p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');data_area();empty=current();preview(original);confirm();p.locator('#taRecoveryUndo').click();p.wait_for_function('!archiveBackupBusy');reopen();assert current()==empty
   passed(name+': Undo of the first import restores the genuinely empty isolated profile')
   if source:assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
   else:
    # A new clock and changed quote must still be rejected after the accepted replay.
    preview(original);confirm();bad={**result,'o':{**result['o'],'SourceTime':'16:30'}};before=current();p.set_input_files('#taRecoveryFile',{'name':'new-conflict.json','mimeType':'application/json','buffer':json.dumps([bad]).encode()});p.wait_for_function('!archiveBackupBusy && taPending!==null');assert p.locator('#taRecoveryConfirm').is_disabled() and not p.evaluate('taPending.report.safe');assert current()==before
    p.locator('#taRecovery').screenshot(path=str(ROOT/'qa/int004/reimport-new-conflict.png'));passed('synthetic: a genuinely new clock still blocks confirmation without changing the archive')
   report['datasets'].append({'name':name,'inputRows':len(doc['records']),'sourceSHA256':source_hash,'outputRows':expected,'fullExportDigest':first_digest,'sourceReimports':len(iterations),'initialPreview':first_info,'rounds':iterations,'sourceUnchanged':True});c.close()
  b.close()
 assert hashes()==tested and not report['pageerrors'] and not report['consoleErrors'],report['consoleErrors']
 report['outcome']='PASS'
finally:s.shutdown();(ROOT/'qa/int004/reimport-browser.json').write_text(json.dumps(report,indent=2)+'\n')
