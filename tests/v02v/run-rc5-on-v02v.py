"""Execute an unchanged rc5 test body against the new HTML entry point.
The ONLY adaptation is the entry filename. No assertions, clicks, fixtures,
clock or expected values are removed/changed. Original source SHA is recorded.
"""
from pathlib import Path
import hashlib,json,os,sys
ROOT=Path(__file__).resolve().parents[2];old='Trading_Analytics_v0.2U-rc5_TA-INT-004.html';new='Trading_Analytics_v0.2V-rc1_TA-V02V-001.html'
name=sys.argv.pop(1);assert name in ['browser.py','public-browser.py','consultation-browser.py','backtest-contract.py','today-backtest-browser.py','operational-browser.py','reimport-browser.py','private-backup.py']
source=ROOT/'tests/int004'/name;original=source.read_text();adapted=original.replace(old,new);assert adapted!=original
out=Path(os.environ['TA_V02V_OUT']);out.mkdir(parents=True,exist_ok=True)
receipt={'originalTest':str(source.relative_to(ROOT)),'originalTestSHA256':hashlib.sha256(original.encode()).hexdigest(),'adaptation':'ONLY replace rc5 HTML entry filename with v0.2V HTML entry filename','adaptedSHA256':hashlib.sha256(adapted.encode()).hexdigest(),'entrySHA256':hashlib.sha256((ROOT/new).read_bytes()).hexdigest()}
sys.path.insert(0,str(source.parent));sys.argv[0]=str(source)
try:exec(compile(adapted,str(source),'exec'),{'__file__':str(source),'__name__':'__main__'})
finally:
 # Copy exact receipts/screenshots written by the selected test, not prior PASS files.
 names={'browser.py':['browser.json','reconciliation-preview.png'],'public-browser.py':['public-browser.json'],'consultation-browser.py':['consultation-browser.json'],'backtest-contract.py':['backtest-contract.json'],'today-backtest-browser.py':['today-backtest-browser.json','today-backtest.png'],'operational-browser.py':['operational-browser.json'],'reimport-browser.py':['reimport-browser.json','reimport-new-conflict.png'],'private-backup.py':['private-backup-summary.json']}[name]
 for f in names:
  p=ROOT/'qa/int004'/f
  if p.exists():(out/('v02v-'+f)).write_bytes(p.read_bytes())
 (out/(name+'.adapter.json')).write_text(json.dumps(receipt,indent=2)+'\n')
