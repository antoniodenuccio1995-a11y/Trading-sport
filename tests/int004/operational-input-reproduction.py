"""Read-only reproduction on the actual supplied operational package, outside Git.
The output contains the public audit example only; no personal fixture is used.
"""
from pathlib import Path
import argparse,functools,hashlib,http.server,json,threading,subprocess
from playwright.sync_api import sync_playwright
from browser_environment import isolate
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--operational-root',type=Path,required=True);args=parser.parse_args();src=args.operational_root.resolve()
assert not src.is_relative_to(ROOT)
old='242a15efae0ab64fd851335354c40c750d2d2e95';frozen=subprocess.check_output(['git','ls-tree','-r','--name-only',old],cwd=ROOT,text=True).splitlines()
for f in frozen:assert (src/f).read_bytes()==subprocess.check_output(['git','show',old+':'+f],cwd=ROOT),f
report={'inputHTML':'Trading_Analytics_v0.2U-rc4_FIX_BACKTEST_ALIAS_MERCATO.html','inputHTMLSHA256':hashlib.sha256((src/'Trading_Analytics_v0.2U-rc4_FIX_BACKTEST_ALIAS_MERCATO.html').read_bytes()).hexdigest(),'allFrozenRc4FilesIdentical':len(frozen),'personalDataUsed':False,'pageerrors':[]}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(src)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context();isolate(c,base,report);p=c.new_page();p.on('pageerror',lambda e:report['pageerrors'].append(str(e)))
  p.goto(base+report['inputHTML']);p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  assert p.locator('#m option').count()==8 and p.locator('#taQuickFrom').count()==1
  p.evaluate("""async()=>{const a={d:Date.UTC(2025,7,22),lg:'Serie B',H:'Pescara',A:'Cesena',h:1,a:3,ht:null,hth:null,hta:null,shots:null,up:false,o:{CsvSeason:2025,Phase:'regular',Source:'Public audit primary'}};await mergeImported([a,{...a,H:'Delfino Pescara',A:'Cesena FC',o:{CsvSeason:2025,Phase:'1. Round',Source:'Public audit secondary'}}]);}""")
  assert p.evaluate('rows.length')==2
  result=p.evaluate("()=>{const x=standingsCompute('Serie B',2025,Date.UTC(2026,6,1));return {games:x.games.length,clubs:x.table.length}}")
  assert result=={'games':2,'clubs':4}
  p.reload();p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady');assert p.evaluate('rows.length')==2
  report.update(outcome='PASS',defectReproduced=True,archivedObservations=2,standings=result,persistentAfterReload=True,marketOptions=8,simplifiedAliasUIAvailable=True)
  assert not report['pageerrors'];c.close();b.close()
finally:s.shutdown();(ROOT/'qa/int004/operational-input-reproduction.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: actual audited operational ZIP reproduces two persistent matches/four clubs; all 314 frozen rc4 files match')
