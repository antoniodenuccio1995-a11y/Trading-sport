"""Validate a complete GitHub ZIP against HEAD and smoke-test the actual extraction."""
from pathlib import Path,PurePosixPath
import argparse,functools,hashlib,http.server,json,subprocess,tempfile,threading,zipfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];a=argparse.ArgumentParser();a.add_argument('--archive',type=Path,required=True);a.add_argument('--output',type=Path,required=True);args=a.parse_args()
assert not args.output.resolve().is_relative_to(ROOT)
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();expected=subprocess.check_output(['git','ls-tree','-r','--name-only',head],cwd=ROOT,text=True).splitlines();report={'commit':head,'archiveSHA256':hashlib.sha256(args.archive.read_bytes()).hexdigest(),'personalDataUsed':False,'pageerrors':[]}
with tempfile.TemporaryDirectory(prefix='ta-int004-delivery-') as temp:
 dest=Path(temp)
 with zipfile.ZipFile(args.archive) as z:
  entries=[x for x in z.infolist() if not x.is_dir()];prefix=PurePosixPath(entries[0].filename).parts[0];actual={}
  for x in entries:
   parts=PurePosixPath(x.filename).parts;assert parts[0]==prefix and '..' not in parts
   name='/'.join(parts[1:]);assert name and not any(t in name for t in ['private-ta-','attachments/','backup_trading_analytics_','PROPOSTA_backup_integrato_'])
   actual[name]=x
  assert set(actual)==set(expected),'archive membership differs from the reviewed commit'
  for name in expected:
   data=z.read(actual[name]);assert data==subprocess.check_output(['git','show',head+':'+name],cwd=ROOT),name
   out=dest/name;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(data)
 class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(dest)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
 try:
  with sync_playwright() as pw:
   b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context();c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());p=c.new_page();p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');assert p.locator('#m option').count()==8 and p.locator('#taQuickFrom').count()==1
   pair=p.evaluate("""()=>{const a={d:Date.UTC(2025,7,22),lg:'Serie B',H:'Pescara',A:'Cesena',h:1,a:3,up:false,ht:null,o:{CsvSeason:2025,Phase:'regular'}};return TARecovery.plan([a,{...a,H:'Delfino Pescara',A:'Cesena FC',o:{CsvSeason:2025,Phase:'1. Round'}}]).records.length}""");assert pair==1
   assert not report['pageerrors'];c.close();b.close()
 finally:s.shutdown()
report.update(outcome='PASS',allCommitFilesExact=len(expected),extractedHTTPAppReady=True,marketOptions=8,simplifiedAliasesPresent=True,auditPairDistinct=1,privateBackupFilesAbsent=True)
args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
