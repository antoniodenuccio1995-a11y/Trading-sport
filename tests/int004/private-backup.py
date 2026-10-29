"""T8 on the actual supplied backup; all detailed outputs stay outside Git."""
from pathlib import Path
import argparse,json,hashlib,functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_environment import isolate
ROOT=Path(__file__).resolve().parents[2]
SOURCES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html', 'ta-club-aliases-int004.js', 'ta-clubs-v4.js', 'ta-fixture-identity.js', 'ta-json-recovery-rc5.js', 'ta-csv-import-v02U-rc5.js', 'ta-history-coverage-rc5.js', 'ta-history-manifest-rc5.js', 'ta-int004-ui.js', 'ta-int004-area.js', 'ta-int004-app.js']
def source_hashes():return {f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in SOURCES}
TESTED_SOURCES=source_hashes()
a=argparse.ArgumentParser();a.add_argument('--backup',type=Path,required=True);a.add_argument('--private-output',type=Path,required=True);args=a.parse_args();out=args.private_output.resolve();assert not out.is_relative_to(ROOT);out.mkdir(parents=True,exist_ok=True)
original=args.backup.read_bytes();original_sha=hashlib.sha256(original).hexdigest();doc=json.loads(original);assert len(doc['records'])==28544
report={'inputRecords':28544,'sourceSHA256':original_sha,'personalRecordsPublished':False,'checks':[],'pageerrorCount':0}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def record(x):report['checks'].append(x);print('PASS',x,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(accept_downloads=True);isolate(c,base,report);p=c.new_page();p.set_default_timeout(180000);p.on('pageerror',lambda _:report.update(pageerrorCount=report['pageerrorCount']+1));p.on('dialog',lambda d:d.accept());p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');p.locator('.workspace-nav button[data-open-workspace="dati"]').click();p.set_input_files('#taRecoveryFile',str(args.backup));p.wait_for_function('!archiveBackupBusy && window.taLastMigration?.inputCount>0');r=p.evaluate('window.taLastMigration');(out/'real-preview.json').write_text(json.dumps(r))
  assert r['safe'] and r['allOriginalRecordsAccountedFor'];assert r['inputCount']==28544 and r['outputCount']==28302 and r['preservedUnresolved']==4;assert r['manualMigration']['assigned']==2;assert p.evaluate('rows.length')==0
  report.update(outputRecords=r['outputCount'],consolidatedCopies=r['identical']+r['compatible'],preservedUnresolved=r['preservedUnresolved']);record('T8: all original rows accounted for in a conservative preview, including four retained unresolved schedule observations')
  p.locator('#taRecoveryConfirm').evaluate('(el)=>el.click()');p.wait_for_function("!archiveBackupBusy && window.taLastMigration.status==='salvata'");assert p.evaluate('rows.length')==28302 and p.evaluate('man.length')==2
  def download():
   with p.expect_download() as d:p.locator('#archiveExportBackup').evaluate('(el)=>el.click()')
   return json.loads(Path(d.value.path()).read_text())
  exported=download();(out/'restored-rc5.json').write_text(json.dumps(exported,ensure_ascii=False));assert all(m['o']['LegacyManualOriginal']==old for m,old in zip(exported['manual'],doc['manual']));record('T8: actual atomic save and export retain both original manual payloads')
  compact_hash=hashlib.sha256(json.dumps(exported['records'],sort_keys=True).encode()).hexdigest();p.reload();p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');again=download();assert compact_hash==hashlib.sha256(json.dumps(again['records'],sort_keys=True).encode()).hexdigest();assert again['manual']==exported['manual'];record('T8: exact compact record and manual persistence after browser restart')
  p.locator('.workspace-nav button[data-open-workspace="dati"]').click();p.locator('#taRecoveryUndo').evaluate('(el)=>el.click()');p.wait_for_function('!archiveBackupBusy');assert p.evaluate('rows.length')==0 and p.evaluate('man.length')==0;record('T8: undo restores the empty test archive without editing the supplied backup')
  assert source_hashes()==TESTED_SOURCES;report['testedSourceSHA256']=TESTED_SOURCES;assert hashlib.sha256(args.backup.read_bytes()).hexdigest()==original_sha and not report['pageerrorCount'];assert not report.get('consoleErrors',[]),report.get('consoleErrors');report['outcome']='PASS';c.close();b.close()
finally:s.shutdown();(out/'private-browser.json').write_text(json.dumps(report,indent=2));(ROOT/'qa/int004/private-backup-summary.json').write_text(json.dumps(report,indent=2)+'\n')
