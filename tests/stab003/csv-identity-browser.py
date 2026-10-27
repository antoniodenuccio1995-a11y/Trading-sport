from pathlib import Path
import json,functools,http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);p=b.new_page();p.goto(f'http://127.0.0.1:{s.server_port}/Trading_Analytics_v0.2U-rc4_TA-STAB-003.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  r=p.evaluate("""()=>{const d=Date.UTC(2025,7,1),row=(H,d,o={})=>canonicalMatch({d,lg:'League One',H,A:'MK Dons',h:2,a:1,up:false,ht:null,hth:null,hta:null,shots:null,o});
   TAHistoryManifest.aliases.qaoxfordalias='oxfordunited';const a=row('Oxford United',d),b=row('Oxford',d+86400000),incoming=row('QA Oxford Alias',d+2*86400000),ambiguous=smartMergeRecords([incoming],[a,b]);
   const disputed=smartMergeRecords([row('QA Disputed',d,{HistSourceConflict:true})],[a]);
   return {ambiguousSkipped:ambiguous.records.length===2&&ambiguous.stats.conflict===1,disputedSkipped:disputed.records.length===1&&disputed.stats.conflict===1,existingUnchanged:JSON.stringify(ambiguous.records)===JSON.stringify([a,b])};}""")
  assert all(r.values()),r;r['outcome']='PASS';(ROOT/'qa/stab003/csv-identity-browser.json').write_text(json.dumps(r,indent=2)+'\n');print(r);b.close()
finally:s.shutdown()
