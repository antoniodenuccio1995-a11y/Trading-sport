from pathlib import Path
import argparse,hashlib,json,os,sys
p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();R=a.repo;O=a.out;O.mkdir(parents=True,exist_ok=True)
f=R/'tests/v02v-ux/browser.py';original=f.read_text();needle="g=(i%4)+1;lost=i%3;H,A,h,a=";replacement="g=(i%4)+1+(1 if club=='Milan' else 0);lost=(i*2+1)%4 if club=='Milan' else i%3;H,A,h,a=";assert original.count(needle)==1;s=original.replace(needle,replacement)
os.environ['TA_UX_OUT']=str(O);sys.path.insert(0,str(R/'tests/int004'))
r={'outcome':'FAIL','originalTestSHA256':hashlib.sha256(original.encode()).hexdigest(),'executedSHA256':hashlib.sha256(s.encode()).hexdigest(),'adaptation':'Only stronger synthetic fixture: different score distributions for A and B; all original assertions and independent Python numeric oracle retained','assertionsRemoved':0}
try:exec(compile(s,str(f),'exec'),{'__file__':str(f),'__name__':'__main__'});r['outcome']='PASS'
finally:(O/'supplement-adapter.json').write_text(json.dumps(r,indent=2)+'\n')
