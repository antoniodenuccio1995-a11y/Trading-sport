"""Persist/reload the full private proposal, without publishing any of its rows."""
from pathlib import Path
import argparse,json,hashlib,functools,http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--proposal',type=Path,required=True);p.add_argument('--private-output',type=Path,required=True);a=p.parse_args();out=a.private_output.resolve();assert not out.is_relative_to(ROOT);out.mkdir(parents=True,exist_ok=True)
def preserves(new,old):
 return isinstance(new,dict) and all(k in new and preserves(new[k],v) for k,v in old.items()) if isinstance(old,dict) else new==old
doc=json.loads(a.proposal.read_bytes());sha=lambda x:hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest();report={'checks':[],'pageerrorCount':0,'personalRowsPublished':False}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(accept_downloads=True);c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());page=c.new_page();page.set_default_timeout(120000);page.on('dialog',lambda d:d.accept());page.on('pageerror',lambda _:report.update(pageerrorCount=report['pageerrorCount']+1))
  page.goto(base+'Trading_Analytics_v0.2U-rc4_TA-STAB-003.html');page.wait_for_function('archiveReady');page.evaluate('window.taStabAreaReady');page.locator('.workspace-nav button[data-open-workspace="dati"]').click();page.set_input_files('#taRecoveryFile',str(a.proposal));page.wait_for_function('!archiveBackupBusy && window.taLastMigration?.inputCount>0');r=page.evaluate('window.taLastMigration');assert r['safe'] and r['outputCount']==35022 and r['inputCount']==35022
  report['checks'].append('Full 35,022-match proposal produces a safe self-roundtrip preview with no extra consolidation');page.locator('#taRecoveryConfirm').click();page.wait_for_function("!archiveBackupBusy && window.taLastMigration.status==='salvata'");assert page.evaluate('rows.length')==35022;assert page.evaluate('man.length')==2
  def download():
   with page.expect_download() as d:page.locator('#archiveExportBackup').evaluate('(el)=>el.click()')
   return json.loads(Path(d.value.path()).read_text())
  first=download();assert sha(first['records'])==sha(doc['records']);assert len(first['manual'])==len(doc['manual']) and all(preserves(n,o) for n,o in zip(first['manual'],doc['manual']));page.reload();page.wait_for_function('archiveReady');page.evaluate('window.taStabAreaReady');again=download();assert sha(first['records'])==sha(again['records']) and first['manual']==again['manual'];report['checks'].append('Complete proposal persists atomically and exports exact compact records and manual data after reload')
  page.locator('.workspace-nav button[data-open-workspace="dati"]').click();page.locator('#taRecoveryUndo').evaluate('(el)=>el.click()');page.wait_for_function('!archiveBackupBusy');assert page.evaluate('rows.length')==0 and page.evaluate('man.length')==0;report['checks'].append('Full proposal rollback restores the preceding empty test archive');assert not report['pageerrorCount'];report.update(outcome='PASS',records=35022,manual=2,compactSHA256=sha(first['records']));c.close();b.close()
finally:
 s.shutdown();(out/'proposal-browser.json').write_text(json.dumps(report,indent=2));(ROOT/'qa/stab003/proposal-browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
