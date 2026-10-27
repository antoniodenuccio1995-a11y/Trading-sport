"""Adapt ONLY paths, candidate filename, Chromium executable and output locations."""
import argparse,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--candidate',default='Trading_Analytics_v0.2U-rc4_TA-STAB-003.html');p.add_argument('--label',required=True);p.add_argument('--expect-baseline-failures',action='store_true');args=p.parse_args()
run=Path('/tmp/ta-stab003-independent')/args.label
(run/'independent_review/logs').mkdir(parents=True,exist_ok=True)
out=root/'qa/stab003'/args.label;out.mkdir(parents=True,exist_ok=True)
for name in ['adversarial.cjs','roundtrip.cjs']:
 source=(root/'tests/data002/independent'/name).read_text()
 source=source.replace("path.join(root,'review_repo')",json.dumps(str(root)))
 source=source.replace("path.join(root,'independent_review/runtime/bin/chromium')","'/usr/bin/chromium'")
 source=source.replace('Trading_Analytics_v0.2U-rc1_TA-CSV-001.html',args.candidate)
 source=source.replace("await p.waitForFunction(()=>archiveReady)","await p.waitForFunction(()=>archiveReady);await p.evaluate(()=>window.taStabAreaReady)")
 source=source.replace("await p.click('#smartImportConfirm')","await p.locator('#taRLeagueCard').evaluate(el=>el.open=true);await p.click('#smartImportConfirm')")
 script=run/name;script.write_text(source)
 result=subprocess.run(['node',str(script)],cwd=run,text=True)
 assert result.returncode==0,(name,result.returncode)
for name in ['independent-browser.json','independent-roundtrip.json']:
 source=run/'independent_review/logs'/name
 (out/name).write_bytes(source.read_bytes())
x=json.loads((out/'independent-browser.json').read_text());f={t['id']:t for t in x['tests']}
required=['IND-01','IND-02','IND-03','IND-05']
expected='FAIL' if args.expect_baseline_failures else 'PASS'
assert all(f[k]['status']==expected for k in required),[(k,f[k]['status']) for k in required]
assert all(f[k]['status']=='PASS' for k in ['IND-04','IND-06']),f
r=json.loads((out/'independent-roundtrip.json').read_text());assert all(v['status']=='PASS' for v in r['checks']),r
assert not x.get('errors') and not r.get('errors'),(x.get('errors'),r.get('errors'))
print('Mandatory findings:',{k:f[k]['status'] for k in required},flush=True)
print('Optional file protocol:',f['IND-07']['status'],'(administrator policy may block it)',flush=True)
