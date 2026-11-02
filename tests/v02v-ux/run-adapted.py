"""Preserve acceptance assertions; adapt entry, required navigation and grouping selectors only."""
from pathlib import Path
import hashlib,json,os,sys,time
R=Path(__file__).resolve().parents[2];name=sys.argv.pop(1)
allowed=['v02v/browser.py','v02v/audit-browser.py','v02v/performance-browser.py',*[f'int004/{x}.py' for x in ['browser','public-browser','consultation-browser','backtest-contract','today-backtest-browser','operational-browser','reimport-browser']]]
assert name in allowed,name
source=R/'tests'/name;original=source.read_text();s=original
for old in ['Trading_Analytics_v0.2U-rc5_TA-INT-004.html','Trading_Analytics_v0.2V-rc1_TA-V02V-001.html']:s=s.replace(old,'Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html')
s=s.replace("'ta-v02v-ui.js'","'ta-v02v-ux-ui.js'").replace("'ta-v02v.css'","'ta-v02v-ux.css'")
# Group rows are visual headings, not additional fixtures. All numeric assertions stay.
s=s.replace('tbody tr','tbody tr:not(.ux-group)')
for control in ['vH2HLimit','vMatchScope']:
 needle=f"p.locator('#{control}').select_option"
 s=s.replace(needle,"p.locator('#comparison [data-tab=\"confronti\"]').click();"+needle)
s=s.replace("p.locator('#vMatchPanel').screenshot", "p.locator('#comparison [data-tab=\"confronti\"]').click();p.locator('#vMatchPanel').screenshot")
# Old scanner contract explicitly used its old multi-day window. New default is
# tested as TODAY in the new suite; old sample is retested with explicit 7 days.
s=s.replace('p.evaluate("openWorkspace(\'scanner\')")','p.evaluate("openWorkspace(\'scanner\')");p.locator(\'#taScanPeriod\').select_option(\'7\')')
# The index is now lazy: fixture filters populate through actual navigation.
O=Path(os.environ['TA_UX_OUT']);O.mkdir(parents=True,exist_ok=True);os.environ['TA_V02V_OUT']=str(O)
sys.path.insert(0,str(R/'tests/int004'));sys.argv[0]=str(source)
receipt={'originalTest':name,'originalSHA256':hashlib.sha256(original.encode()).hexdigest(),'adaptedSHA256':hashlib.sha256(s.encode()).hexdigest(),'adaptations':['rc2 entry and source-hash filenames','Confronti click before H2H/scope control or screenshot','group header rows excluded from fixture-row selector','explicit seven-day Scanner for legacy multi-day sample; TODAY tested separately'],'assertionsRemoved':0,'outcome':'FAIL'}
start=time.time()
try:
 exec(compile(s,str(source),'exec'),{'__file__':str(source),'__name__':'__main__'});receipt['outcome']='PASS'
finally:
 if name.startswith('int004/'):
  for f in (R/'qa/int004').iterdir():
   if f.is_file() and f.stat().st_mtime>=start and f.suffix in ['.json','.png']:(O/('ux-'+f.name)).write_bytes(f.read_bytes())
 (O/(name.replace('/','-')+'.adapter.json')).write_text(json.dumps(receipt,indent=2)+'\n')
