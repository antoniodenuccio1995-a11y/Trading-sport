"""Actual browser fetch/304/content hashes, preview, commit and conflict; controlled source."""
from pathlib import Path
import datetime,functools,hashlib,http.server,json,os,sys,threading
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];sys.path.insert(0,str(R/'tests/int004'));from browser_environment import isolate
O=Path(os.environ.get('TA_UX_OUT',R/'qa/v02v-ux'));O.mkdir(parents=True,exist_ok=True)
report={'outcome':'FAIL','pageerrors':[],'consoleErrors':[],'checks':[],'requests':[],'receipts':[],'networkKind':'controlled HTTP source through real fetch, not live performance'}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def body(score=1,extra=0):
 lines=['Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR','I1,28/10/2026,Inter,Milan,'+str(score)+',0,H,0,0,D','I1,29/10/2026,Roma,Napoli,2,1,H,1,0,H']
 if extra:lines.append('I1,30/10/2026,Juventus,Torino,0,0,D,0,0,D')
 lines.append('I1,03/11/2026,Inter,Roma,9,9,D,1,1,D')
 return '\n'.join(lines)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context(accept_downloads=True);isolate(c,base,report)
  state={'version':1,'kind':'200','body':body()}
  def route(r):
   report['requests'].append({'url':r.request.url,'headers':{k:v for k,v in r.request.headers.items() if k in ['if-none-match','if-modified-since']}})
   assert '/mmz4281/2627/I1.csv' in r.request.url
   if state['kind']=='304':r.fulfill(status=304,headers={'ETag':'v1','Access-Control-Allow-Origin':'*'})
   else:r.fulfill(status=int(state['kind']),body=state['body'],headers={'Content-Type':'text/csv','ETag':'v'+str(state['version']),'Access-Control-Expose-Headers':'ETag','Access-Control-Allow-Origin':'*'})
  c.route('https://www.football-data.co.uk/**',route)
  p=c.new_page();p.set_default_timeout(120000);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept());p.clock.set_fixed_time(datetime.datetime(2026,10,30,12,tzinfo=datetime.timezone.utc))
  p.goto(base+'Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html');p.evaluate('taVInitialized');assert not report['requests'];p.locator('.workspace-nav [data-open-workspace="dati"]').click();p.locator('#taTechOpenAll').click();p.locator('#uxRefreshLeague').select_option('Serie A');p.locator('#uxRefreshMode').select_option('season')
  def run():
   count=len(report['requests']);p.locator('#uxRefreshRun').click();p.wait_for_function('!document.querySelector("#uxRefreshRun").disabled');assert len(report['requests'])==count+1
   receipt=p.evaluate('taUXRefreshReceipt');report['receipts'].append(receipt);return receipt
  initial=p.evaluate('taFingerprint()');r=run();assert r['proposedRows']==2 and r['receipts'][0]['parseMs']>=0 and r['historicalSourcesFetched']==0
  assert p.evaluate('taFingerprint()')==initial and p.evaluate('rows.length')==0;assert p.evaluate('taPending.report.safe')
  p.locator('#taRecoveryConfirm').click();p.wait_for_function('!archiveBackupBusy && !taPending');assert p.evaluate('rows.length')==2
  p.wait_for_function('taUXRefreshReceipt.persistenceMs!==null');report['confirmedPersistence']=p.evaluate('taUXRefreshReceipt.persistenceMs')
  original=p.evaluate('archiveDbGet().then(TARecovery.stable)');raw=p.evaluate('rows.map(r=>TARecovery.stable(r))');report['checks'].append('New current results preview without writes; explicit atomic confirmation, future scored rows excluded')
  state['kind']='304';r=run();assert r['proposedRows']==0 and r['receipts'][0]['cache']=='HTTP 304' and r['receipts'][0]['parseMs']==0
  assert p.evaluate('taPending') is None;assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==original
  state['kind']='200';r=run();assert r['proposedRows']==0 and r['receipts'][0]['cache']=='contenuto invariato' and r['receipts'][0]['parseMs']==0
  report['checks'].append('HTTP 304 and same-body SHA avoid parsing, merge, archive persistence; no historical URL')
  state.update(version=2,body=body(extra=1));r=run();assert r['proposedRows']==1 and p.evaluate('taPending.report.safe')
  p.locator('#taRecoveryConfirm').click();p.wait_for_function('!archiveBackupBusy && !taPending');assert p.evaluate('rows.length')==3
  assert p.evaluate('rows.slice(0,2).map(r=>TARecovery.stable(r))')==raw
  original=p.evaluate('archiveDbGet().then(TARecovery.stable)');report['checks'].append('Changed source proposes only one genuinely new row; first two records byte-equivalent in stable representation')
  state.update(version=3,body=body(score=5,extra=1));r=run();assert r['proposedRows']==1
  assert p.evaluate('!taPending.report.safe') and p.locator('#taRecoveryConfirm').is_disabled();assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==original
  p.locator('#taRecoveryClear').click();p.wait_for_function('taPending===null');report['checks'].append('New conflicting FT is visible and blocked; existing result and snapshot remain unchanged')
  # Cache survives reload; no cache/database write occurs merely to reopen Dashboard.
  p.reload();p.evaluate('taVInitialized');p.locator('.workspace-nav [data-open-workspace="dati"]').click();p.locator('#taTechOpenAll').click();p.locator('#uxRefreshLeague').select_option('Serie A')
  state['kind']='304';r=run();assert r['receipts'][0]['cache']=='HTTP 304';assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==original
  report['checks'].append('Source cache survives reload, kept separate from archive; source change still requires review')
  p.locator('#taRecoveryClear').click();p.wait_for_function('taPending===null')
  state.update(kind='200',body='<html>Source unavailable</html>');r=run()
  assert r['receipts'][0]['outcome'].startswith('FAIL') and p.evaluate('taPending') is None
  assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==original
  report['checks'].append('Non-CSV source response handled visibly, no proposal/cache promotion or archive change; manual import remains available')
  assert not report['pageerrors'] and not report['consoleErrors'];assert all('/2627/' in x['url'] for x in report['requests']);report['outcome']='PASS';p.locator('#uxRefresh').screenshot(path=str(O/'refresh-preview.png'));c.close();b.close()
finally:
 s.shutdown();(O/'refresh-browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
