"""Real remote CSV from browser, no substituted response; availability is explicit."""
from pathlib import Path
import functools,http.server,json,os,threading
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=Path(os.environ['TA_UX_OUT']);O.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
r={'outcome':'NON ESEGUITO','source':'real Football-Data current season CSV','responsesSubstituted':False,'pageerrors':[],'consoleErrors':[],'requests':[],'archiveModified':False}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context();p=c.new_page();p.set_default_timeout(90000);p.on('pageerror',lambda e:r['pageerrors'].append(str(e)));p.on('console',lambda m:r['consoleErrors'].append(m.text) if m.type=='error' else None);p.on('dialog',lambda d:d.accept());p.on('request',lambda q:r['requests'].append(q.url) if not q.url.startswith(base) else None)
  p.goto(base+'Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html');p.evaluate('taVInitialized');assert not r['requests'],'No remote acquisition allowed at startup'
  p.locator('.workspace-nav [data-open-workspace="dati"]').click();p.locator('#taTechOpenAll').click();p.locator('#uxRefreshLeague').select_option('Serie A');p.locator('#uxRefreshMode').select_option('season');p.locator('#uxRefreshRun').click();p.wait_for_function('!document.querySelector("#uxRefreshRun").disabled');r['first']=p.evaluate('taUXRefreshReceipt');r['status']=p.locator('#uxRefreshStatus').inner_text()
  if all(x['outcome']=='PASS' for x in r['first']['receipts']):
   if p.evaluate('!!taPending && taPending.report.safe'):
    p.locator('#taRecoveryConfirm').click();p.wait_for_function('!archiveBackupBusy && !taPending');r['archiveModified']=True
    snapshot=p.evaluate('archiveDbGet().then(TARecovery.stable)')
    p.locator('#uxRefreshRun').click();p.wait_for_function('!document.querySelector("#uxRefreshRun").disabled');r['second']=p.evaluate('taUXRefreshReceipt');assert r['second']['proposedRows']==0;assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==snapshot
   r['outcome']='PASS';r['note']='Real source acquired and parsed; timing is this environment only, no general live performance claim'
  else:
   assert p.evaluate('rows.length')==0 and p.evaluate('archiveDbGet()') is None
   r['note']='Real browser acquisition attempted but remote source inaccessible (HTTP/CORS/network). Live import/idempotence NON ESEGUITO; manual CSV path and controlled-source tests provided.'
  assert not r['pageerrors'];c.close();b.close()
finally:s.shutdown();(O/'live-refresh.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
