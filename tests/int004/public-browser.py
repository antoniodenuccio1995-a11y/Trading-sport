"""Public source import, genuine final phases and temporal leakage contracts."""
from pathlib import Path
import hashlib,json,functools,http.server,threading
from playwright.sync_api import sync_playwright
from browser_environment import isolate
ROOT=Path(__file__).resolve().parents[2]
SOURCES=['Trading_Analytics_v0.2U-rc5_TA-INT-004.html', 'ta-club-aliases-int004.js', 'ta-clubs-v4.js', 'ta-fixture-identity.js', 'ta-json-recovery-rc5.js', 'ta-csv-import-v02U-rc5.js', 'ta-history-coverage-rc5.js', 'ta-history-manifest-rc5.js', 'ta-int004-ui.js', 'ta-int004-area.js', 'ta-int004-app.js']
def source_hashes():return {f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in SOURCES}
TESTED_SOURCES=source_hashes()
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/';report={'checks':[],'pageerrors':[],'personalDataUsed':False}
def passed(x):report['checks'].append(x);print('PASS',x,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context();isolate(c,base,report);p=c.new_page();p.set_default_timeout(120000);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept());p.goto(base+'Trading_Analytics_v0.2U-rc5_TA-INT-004.html');p.wait_for_function('archiveReady');p.evaluate('window.taStabAreaReady')
  packet=json.loads((ROOT/'histories/int004/I2_2025.json').read_text());assert len(packet['records'])==380
  p.evaluate('async doc=>await mergeImported(TAClubs.expandCompact(doc.records))',packet);assert p.evaluate('rows.length')==380;p.evaluate('async doc=>await mergeImported(TAClubs.expandCompact(doc.records))',packet);assert p.evaluate('rows.length')==380;passed('T2/T5: reconciled I2_2025 imports and reimports as 380 distinct regular encounters')
  primary=[r for r in json.loads((ROOT/'histories/stab003/I2_2025.json').read_text())['records'] if r[8].get('HistProvider')=='Football-Data'];expected=sum(r[4]+r[5]>2 for r in primary)/len(primary)
  actual=p.evaluate('taStatRows().filter(r=>r.lg==="Serie B"&&r.h+r.a>2).length/taStatRows().filter(r=>r.lg==="Serie B").length');assert abs(actual-expected)<1e-12;report['publicFrequencyExpected']=expected;report['publicFrequencyActual']=actual;passed('T5: observed Over 2.5 frequency matches an independent primary-source calculation without duplicates')
  playoffs=json.loads((ROOT/'histories/int004/E1_2024.json').read_text());assert len(playoffs['records'])==557;p.evaluate('async doc=>await mergeImported(TAClubs.expandCompact(doc.records))',playoffs);assert p.evaluate('rows.filter(r=>r.lg==="Championship").length')==557;assert p.evaluate('standingsCompute("Championship",2024,Date.UTC(2026,6,1)).games.length')==552;passed('T4: genuine Championship playoff games remain archived while regular standings use 552 games')
  playout=json.loads((ROOT/'histories/int004/I1_2022.json').read_text());assert len(playout['records'])==381;p.evaluate('async doc=>await mergeImported(TAClubs.expandCompact(doc.records))',playout);assert p.evaluate('standingsCompute("Serie A",2022,Date.UTC(2024,6,1)).games.length')==380;assert p.evaluate('taStatRows().filter(r=>r.lg==="Serie A"&&r.o.CsvSeason===2022&&TAFixtures.phase(r).stage==="playout").length')==1;passed('T4: actual 2022/23 Spezia-Verona playout remains archived while regular standings use 380 games')
  temporal=p.evaluate("""()=>{const fixture=taStatRows().find(r=>r.lg==='Championship'),cutoff=Date.UTC(2025,4,1),H=fixture.H,A=fixture.A;const before=JSON.stringify(buildMatchAnalysis(H,A,cutoff,'Championship')),stand=JSON.stringify(standingsCompute('Championship',2024,cutoff));rows=[...rows,{d:cutoff+86400000,lg:'Championship',H,A,h:99,a:98,ht:50,hth:25,hta:25,up:false,o:{CsvSeason:2023}}];return {analysisUnchanged:before===JSON.stringify(buildMatchAnalysis(H,A,cutoff,'Championship')),standingsUnchanged:stand===JSON.stringify(standingsCompute('Championship',2024,cutoff))}}""");assert all(temporal.values());passed('T5/F: match analysis and standings exclude later observations even with a poisoned previous-season label')
  assert source_hashes()==TESTED_SOURCES;report['testedSourceSHA256']=TESTED_SOURCES;assert not report['pageerrors'];assert not report.get('consoleErrors',[]),report.get('consoleErrors');report['outcome']='PASS';c.close();b.close()
finally:s.shutdown();(ROOT/'qa/int004/public-browser.json').write_text(json.dumps(report,indent=2)+'\n')
