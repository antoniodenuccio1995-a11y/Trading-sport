from pathlib import Path
import hashlib,json,os,sys
R=Path(__file__).resolve().parents[2];O=Path(os.environ['TA_UX_OUT'])/'independent';O.mkdir(parents=True,exist_ok=True)
f=R/'tests/v02v-ux/audit/zip-browser-ux.py';original=f.read_text();s=original
old="B=Path('/workspace/scratch/f0027330b816');R=next((B/'zip-source').iterdir());O=B/'evidence'"
assert old in s;s=s.replace(old,f"B=Path({str(R.parent)!r});R=Path({str(R)!r});O=Path({str(O)!r})")
s=s.replace("'/workspace/scratch/1b6754163016/v02v_audit/runtime/bin/chromium'","'/usr/bin/chromium'").replace('Trading_Analytics_v0.2V-rc1_TA-V02V-001.html','Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html')
s=s.replace("p.locator('#vMatchPanel').screenshot","p.locator('#comparison [data-tab=\"confronti\"]').click();p.locator('#vMatchPanel').screenshot")
sys.path.insert(0,str(R/'tests/int004'));receipt={'originalSHA256':hashlib.sha256(original.encode()).hexdigest(),'adaptedSHA256':hashlib.sha256(s.encode()).hexdigest(),'changes':'Only paths/browser/entry and Confronti navigation for screenshot; no assertion or expected value changed','outcome':'FAIL'}
try:exec(compile(s,str(f),'exec'),{'__file__':str(f),'__name__':'__main__'});receipt['outcome']='PASS'
finally:(O/'adapter.json').write_text(json.dumps(receipt,indent=2)+'\n')
