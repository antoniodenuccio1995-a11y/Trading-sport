"""One complete gate on immutable final SHA; legacy reference and new rc2 verified separately."""
from pathlib import Path
import argparse,concurrent.futures,datetime,hashlib,json,os,subprocess,threading,time
R=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--real-backup',type=Path,required=True);p.add_argument('--original-backup',type=Path,required=True);p.add_argument('--operational-root',type=Path,required=True);p.add_argument('--run-dir',type=Path,required=True);p.add_argument('--require-clean',action='store_true');a=p.parse_args();O=a.run_dir.resolve();assert not O.is_relative_to(R);O.mkdir(parents=True,exist_ok=True);U=O/'ux';U.mkdir(exist_ok=True);private=O/'private';private.mkdir(exist_ok=True)
def git(*args):return subprocess.check_output(['git',*args],cwd=R,text=True).rstrip('\n')
head=git('rev-parse','HEAD');assert not a.require_clean or not git('status','--porcelain')
# Verify actual fixture identities before starting; never substitute the auditor's 13,536-row file.
for f,count,sha in [(a.original_backup,28544,'809d7ecce6bcf8bbc39812107e29052689520a075304bf7c743f17bc1dd31f2a'),(a.real_backup,28402,'0fc4859c8176a75b0c6bbc7f4bf11c8c7f6f19cad0cfba6b02b95d10201aad2d')]:
 assert hashlib.sha256(f.read_bytes()).hexdigest()==sha and len(json.loads(f.read_text())['records'])==count
files=[f for f in git('ls-files').splitlines() if not f.startswith('qa/')]
def manifest():return {f:hashlib.sha256((R/f).read_bytes()).hexdigest() for f in files}
source=manifest();clock=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();report={'outcome':'FAIL','testedCommit':head if a.require_clean else None,'stage':'exact-commit' if a.require_clean else 'preflight','startedAtUTC':clock(),'sourceManifest':source,'jobs':[],'blockingFailures':None,'nativeWindows':'NON ESEGUITO','fileProtocol':'NON ESEGUITO','personalJournal':'NON ESEGUITO','readyForStableRelease':False};lock=threading.Lock();stop=threading.Event();env={**os.environ,'TA_UX_OUT':str(U),'TA_V02V_OUT':str(U)}
legacy=O/'rc5-source';subprocess.run(['git','clone','--quiet','--no-hardlinks',str(R),str(legacy)],check=True);subprocess.run(['git','checkout','--quiet',head],cwd=legacy,check=True)
def job(name,cmd,cwd=R,public=None):
 if stop.is_set():return
 t=time.monotonic();print('START',name,flush=True)
 with (O/(name+'.log')).open('w') as f:q=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 d={'name':name,'outcome':'PASS' if q.returncode==0 else 'FAIL','exitCode':q.returncode,'seconds':round(time.monotonic()-t,3),'command':public or ' '.join(cmd),'finishedAtUTC':clock(),'logSHA256':hashlib.sha256((O/(name+'.log')).read_bytes()).hexdigest()}
 with lock:report['jobs'].append(d)
 print(d['outcome'],name,d['seconds'],flush=True)
 if q.returncode:stop.set()
def reference():job('rc5-complete-reference',['python','tests/int004/run-consolidated-qa.py','--real-backup',str(a.real_backup),'--original-backup',str(a.original_backup),'--operational-root',str(a.operational_root),'--run-dir',str(O/'rc5-final'),'--require-clean'],cwd=legacy,public='python tests/int004/run-consolidated-qa.py --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" --operational-root "$OPERATIONAL_ROOT" --run-dir "$RUN_DIR/rc5-final" --require-clean')
def features():
 job('unit-engines',['node','--test','tests/v02v/engine.test.cjs','tests/v02v/audit-regressions.test.cjs','tests/v02v-ux/engine.test.cjs'])
 job('AUDIT-IND01-03-original',['node','tests/v02v/audit-repro.cjs',str(R)])
 job('AUDIT-NEW01-03-original',['node','tests/v02v-ux/independent-new.cjs',str(R)])
 job('preservation',['python','tests/v02v-ux/preservation.py'])
 job('ux-browser-ten-requirements',['python','tests/v02v-ux/browser.py'])
 job('incremental-refresh',['python','tests/v02v-ux/refresh-browser.py'])
 job('live-source-availability',['python','tests/v02v-ux/live-refresh.py'])
 job('interpretation-holdout',['node','tests/v02v-ux/signals.cjs'])
 job('CMP01-12',['python','tests/v02v-ux/run-adapted.py','v02v/browser.py'])
 job('AUDIT-browser-15-clocks',['python','tests/v02v-ux/run-adapted.py','v02v/audit-browser.py'])
 job('AUDIT-NEW04-browser',['python','tests/v02v-ux/run-independent-browser.py'])
 for n in ['browser','public-browser','consultation-browser','backtest-contract','today-backtest-browser','operational-browser']:job('rc2-regression-'+n,['python','tests/v02v-ux/run-adapted.py','int004/'+n+'.py'])
def recovery():
 job('rc2-real-reimport-x3',['python','tests/v02v-ux/run-adapted.py','int004/reimport-browser.py','--real-backup',str(a.real_backup),'--original-backup',str(a.original_backup),'--private-output',str(private)],public='python tests/v02v-ux/run-adapted.py int004/reimport-browser.py --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" --private-output "$PRIVATE_OUTPUT"')
 for name,src,export,receipt in [('original',a.original_backup,'original-first.json','private-integrity'),('recovered',a.real_backup,'rc4Recovered-first.json','private-recovered-integrity')]:
  job('private-values-'+name,['node','tests/int004/verify-private.cjs',str(src),str(private/export),str(private),receipt],public=f'node tests/int004/verify-private.cjs "$INPUT_{name.upper()}" "$PRIVATE_OUTPUT/{export}" "$PRIVATE_OUTPUT" {receipt}')
  if not stop.is_set():(U/(receipt+'.json')).write_bytes((R/'qa/int004'/f'{receipt}.json').read_bytes())
try:
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for f in [pool.submit(fn) for fn in [reference,features,recovery]]:f.result()
 assert not stop.is_set(),'Blocking FAIL: fix, freeze a new commit and repeat the whole gate'
 # Sequential baseline/new performance measurement after other suites have finished.
 job('startup-and-real-28k',['python','tests/v02v-ux/performance-browser.py','--real-backup',str(a.real_backup)],public='python tests/v02v-ux/performance-browser.py --real-backup "$REAL_BACKUP"')
 assert not stop.is_set() and len(report['jobs'])==22,len(report['jobs'])
 assert json.loads((O/'rc5-final/readiness.json').read_text())['testedCommit']==head
 ux=json.loads((U/'browser.json').read_text());assert ux['outcome']=='PASS' and len(ux['CMP'])==12 # original CMP receipt has its own numeric acceptance
 own=json.loads((U/'browser-ux.json').read_text()) if (U/'browser-ux.json').exists() else None
 assert own and own['outcome']=='PASS' and set(own['P'])=={'1','2','3','4','5','7','8','9','10'}
 for n in ['private-integrity','private-recovered-integrity']:
  d=json.loads((U/(n+'.json')).read_text());assert d['errorCount']==0 and d['nonemptyQuoteValuesChecked']==172964 and d['manualPayloadsPreserved']==2
 for d in json.loads((U/'ux-reimport-browser.json').read_text())['datasets']:assert d['sourceReimports']==3 and d['sourceUnchanged']
 live=json.loads((U/'live-refresh.json').read_text());assert not live['pageerrors'];report['liveResultImport']=live['outcome']
 for f in U.glob('*.json'):
  if f.name=='live-refresh.json':continue
  d=json.loads(f.read_text());assert not d.get('pageerrors') and not d.get('pageerrorCount') and not d.get('consoleErrors'),f.name
 assert manifest()==source,'Source changed during gate'
 assert not [line for line in git('status','--porcelain').splitlines() if line[3:] and not line[3:].startswith('qa/')]
 report.update(outcome='PASS',blockingFailures=0,readyForIndependentAudit=True)
finally:
 report['finishedAtUTC']=clock()
 if report['blockingFailures'] is None:report['blockingFailures']=sum(j['exitCode']!=0 for j in report['jobs']) or 1
 (O/'readiness.json').write_text(json.dumps(report,indent=2)+'\n');print('CONSOLIDATED UX',report['outcome'],len(report['jobs']),'groups',flush=True)
if report['outcome']!='PASS':raise SystemExit(1)
