"""Consolidated exact-commit gate, with independent rc5 and v0.2V clean checkouts.
Run once after freezing code; any FAIL requires fixing and rerunning ALL gates.
Private exports/logs stay outside Git and public artifacts are explicitly selected.
"""
from pathlib import Path
import argparse,concurrent.futures,datetime,hashlib,json,os,subprocess,threading,time
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--real-backup',type=Path,required=True);a.add_argument('--original-backup',type=Path,required=True);a.add_argument('--operational-root',type=Path,required=True);a.add_argument('--run-dir',type=Path,required=True);a.add_argument('--require-clean',action='store_true');args=a.parse_args();OUT=args.run_dir.resolve();assert not OUT.is_relative_to(ROOT);OUT.mkdir(parents=True,exist_ok=True);private=OUT/'private';private.mkdir(exist_ok=True);uiout=OUT/'v02v';uiout.mkdir(exist_ok=True)
def git(*cmd):return subprocess.check_output(['git',*cmd],cwd=ROOT,text=True).rstrip('\n')
head=git('rev-parse','HEAD');dirty=git('status','--porcelain');assert not args.require_clean or not dirty,'Final run requires a completely clean checkout'
files=[f for f in git('ls-files').splitlines() if not f.startswith('qa/')];manifest=lambda:{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files};source=manifest();clock=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
report={'outcome':'FAIL','testedCommit':head if args.require_clean else None,'stage':'exact-commit' if args.require_clean else 'preflight','startedAtUTC':clock(),'sourceManifest':source,'jobs':[],'blockingFailures':None,'environment':{'browser':subprocess.check_output(['/usr/bin/chromium','--version'],text=True).strip(),'platform':'Linux','protocol':'HTTP','nativeWindows':'NON ESEGUITO','fileProtocol':'NON ESEGUITO','liveRefresh':'NON ESEGUITO'},'privateRowsPublished':False}
stop=threading.Event();lock=threading.Lock();env={**os.environ,'TA_V02V_OUT':str(uiout)}
# A second clean checkout prevents the legacy/adapted receipt names from colliding.
legacy=OUT/'rc5-source';subprocess.run(['git','clone','--quiet','--no-hardlinks',str(ROOT),str(legacy)],check=True);subprocess.run(['git','checkout','--quiet',head],cwd=legacy,check=True)
def job(name,cmd,public=None,cwd=ROOT,extraenv=None):
 if stop.is_set():return
 t=time.monotonic();start=clock();print('START',name,flush=True)
 with (OUT/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,env=extraenv or env,stdout=f,stderr=subprocess.STDOUT)
 j={'name':name,'command':public or ' '.join(cmd),'outcome':'PASS' if r.returncode==0 else 'FAIL','exitCode':r.returncode,'seconds':round(time.monotonic()-t,3),'startedAtUTC':start,'finishedAtUTC':clock(),'logSHA256':hashlib.sha256((OUT/(name+'.log')).read_bytes()).hexdigest()}
 with lock:report['jobs'].append(j)
 print(j['outcome'],name,j['seconds'],flush=True)
 if r.returncode:stop.set()
def baseline():job('rc5-full-regression',['python','tests/int004/run-consolidated-qa.py','--real-backup',str(args.real_backup),'--original-backup',str(args.original_backup),'--operational-root',str(args.operational_root),'--run-dir',str(OUT/'rc5-final'),'--require-clean'],public='python tests/int004/run-consolidated-qa.py --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" --operational-root "$OPERATIONAL_ROOT" --run-dir "$RUN_DIR/rc5-final" --require-clean',cwd=legacy)
def features():
 job('engine-unit',['node','--test','--test-reporter=tap','tests/v02v/engine.test.cjs','tests/v02v/audit-regressions.test.cjs'])
 job('audit-original-reproducer',['node','tests/v02v/audit-repro.cjs',str(ROOT)])
 job('audit-browser-IND01-03',['python','tests/v02v/audit-browser.py'])
 job('neutrality-holdout',['node','tests/v02v/neutrality.cjs'])
 if not stop.is_set():(uiout/'neutrality.json').write_bytes((ROOT/'qa/v02v/neutrality.json').read_bytes())
 job('v02v-preservation',['python','tests/v02v/preservation.py'])
 job('v02v-browser-CMP01-12',['python','tests/v02v/browser.py'])
 for name in ['browser.py','public-browser.py','consultation-browser.py','backtest-contract.py','today-backtest-browser.py','operational-browser.py']:job('v02v-rc5-'+name[:-3],['python','tests/v02v/run-rc5-on-v02v.py',name])
 job('v02v-performance-28k',['python','tests/v02v/performance-browser.py','--real-backup',str(args.real_backup)],public='python tests/v02v/performance-browser.py --real-backup "$REAL_BACKUP"')
def recovery():
 job('v02v-real-reimport-x3',['python','tests/v02v/run-rc5-on-v02v.py','reimport-browser.py','--real-backup',str(args.real_backup),'--original-backup',str(args.original_backup),'--private-output',str(private)],public='python tests/v02v/run-rc5-on-v02v.py reimport-browser.py --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" --private-output "$PRIVATE_OUTPUT"')
 for name,src,export,receipt in [('original',args.original_backup,'original-first.json','private-integrity'),('recovered',args.real_backup,'rc4Recovered-first.json','private-recovered-integrity')]:
  job('v02v-private-values-'+name,['node','tests/int004/verify-private.cjs',str(src),str(private/export),str(private),receipt],public='node tests/int004/verify-private.cjs "$'+('ORIGINAL_BACKUP' if name=='original' else 'REAL_BACKUP')+'" "$PRIVATE_OUTPUT/'+export+'" "$PRIVATE_OUTPUT" '+receipt)
  if not stop.is_set():(uiout/(receipt+'.json')).write_bytes((ROOT/'qa/int004'/f'{receipt}.json').read_bytes())
try:
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for result in [pool.submit(f) for f in [baseline,features,recovery]]:result.result()
 assert not stop.is_set(),'At least one blocker failed: fix, freeze a new SHA and rerun the complete gate'
 assert len(report['jobs'])==17,len(report['jobs'])
 assert manifest()==source,'Tracked source changed during testing'
 assert json.loads((OUT/'rc5-final/readiness.json').read_text())['testedCommit']==head
 receipt=json.loads((uiout/'browser.json').read_text());assert receipt['outcome']=='PASS' and len(receipt['CMP'])==12
 audit=json.loads((uiout/'audit-browser.json').read_text());assert len(audit['checks'])==3 and len(audit['clockCases'])==15
 for f in [uiout/'browser.json',uiout/'audit-browser.json',uiout/'performance-browser.json',*uiout.glob('v02v-*.json')]:
  data=json.loads(f.read_text());assert data.get('outcome')=='PASS',f.name;assert not data.get('pageerrors') and not data.get('pageerrorCount') and not data.get('consoleErrors'),f.name
  for field in ['sourceSHA256','testedSourceSHA256']:
   if isinstance(data.get(field),dict):
    for p,h in data[field].items():assert source[p]==h,(f.name,p)
 for n in ['private-integrity','private-recovered-integrity']:
  v=json.loads((uiout/(n+'.json')).read_text());assert v['errorCount']==0 and v['nonemptyQuoteValuesChecked']==172964 and v['manualPayloadsPreserved']==2
 for d in json.loads((uiout/'v02v-reimport-browser.json').read_text())['datasets']:assert d['sourceReimports']==3 and d['sourceUnchanged']
 assert not [line for line in git('status','--porcelain').splitlines() if line[3:] and not line[3:].startswith('qa/')], 'Unexpected files outside generated QA'
 report.update(outcome='PASS',blockingFailures=0,readyForIndependentAudit=True,readyForStableRelease=False)
finally:
 report['finishedAtUTC']=clock()
 if report['blockingFailures'] is None:report['blockingFailures']=sum(j['exitCode']!=0 for j in report['jobs']) or 1
 (OUT/'readiness.json').write_text(json.dumps(report,indent=2)+'\n');print('CONSOLIDATED V02V',report['outcome'],len(report['jobs']),'jobs',flush=True)
if report['outcome']!='PASS':raise SystemExit(1)
