"""Reconstruct findings from the mandate; these are NOT the missing independent audit tests."""
import functools,http.server,threading,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
results={}
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  c=b.new_context();c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort())
  page=c.new_page();page.goto(base+'Trading_Analytics_v0.2U-rc1_TA-CSV-001.html')
  page.wait_for_function("document.querySelector('#archiveStorageMode').textContent.includes('IndexedDB')")
  results['F-01']=page.evaluate('''()=>{const s='Div,Date,HomeTeam,AwayTeam,FTHG,FTAG\\nP1,2025-01-10,A,B,1,0\\nUNKNOWN,2025-01-11,C,D,2,0';const x=TACsv.read(s);return {reproduced:x.records[1].lg==='Primeira Liga',actual:x.records.map(r=>r.lg),expected:'unknown row must not inherit P1'}}''')
  results['F-02']=page.evaluate('''()=>{leaguePathRefs=[];const s='Div,Season,Date,HomeTeam,AwayTeam,FTHG,FTAG\\nE0,2024/25,01/07/2025,Alpha,Beta,1,0';pathImportReferenceCsv(s,'Premier League','sample.csv');return {reproduced:leaguePathRefs[0].year===2025,actual:leaguePathRefs[0].year,expected:2024}}''')
  results['F-03']=page.evaluate('''()=>{const s='div;season;date;home_team;away_team;home_goals;away_goals\\nE0;2024/25;2024-08-10;Alpha;Beta;1;0';let error='';const preview=smartInspect('sample.csv',s);try{pathImportReferenceCsv(s,'Premier League','sample.csv')}catch(e){error=e.message}return {reproduced:preview.validRows===1&&!!error,previewValidRows:preview.validRows,actualError:error,expected:'same normalized schema in reference and results import'}}''')
  results['F-04']=page.evaluate('''()=>{rows=[{d:Date.UTC(2024,1,1),lg:'Premier League',H:'Alpha',A:'Beta',h:1,a:0,up:false,o:{CsvSeason:2023}},{d:Date.UTC(2025,1,1),lg:'Premier League',H:'Alpha',A:'Gamma',h:9,a:0,up:false,o:{CsvSeason:2023}}];const out=standingsHistoryBySeason('Premier League','Alpha',[2023],2024,Date.UTC(2024,9,1));return {reproduced:out[0].played===2,actualPlayed:out[0].played,expected:1}}''')
  b.close()
finally:server.shutdown()
assert all(v['reproduced'] for v in results.values()),results
(root/'qa/data002/baseline-reproductions.json').write_text(json.dumps({'baseline':'73fc0e2','reconstruction_only':True,'findings':results},indent=2))
print(json.dumps(results,indent=2))
