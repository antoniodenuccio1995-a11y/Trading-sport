"""Run every blocking suite afresh; any failed job prevents a delivery claim.
Run again from a clean clone/extraction of the final commit, without editing it.
Detailed private exports and raw logs stay outside the checkout.
"""
from pathlib import Path
import argparse,concurrent.futures,datetime,hashlib,json,os,subprocess,threading,time
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--real-backup',type=Path,required=True);a.add_argument('--original-backup',type=Path,required=True);a.add_argument('--operational-root',type=Path,required=True);a.add_argument('--run-dir',type=Path,required=True);a.add_argument('--require-clean',action='store_true');args=a.parse_args();out=args.run_dir.resolve();assert not out.is_relative_to(ROOT);out.mkdir(parents=True,exist_ok=True);private=out/'private';private.mkdir(exist_ok=True)
clock=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def git(*cmd):return subprocess.check_output(['git',*cmd],cwd=ROOT,text=True).strip()
tracked=git('ls-files').splitlines();source_files=[f for f in tracked if not f.startswith(('qa/','docs/')) and Path(f).suffix in ['.js','.html','.py','.cjs','.json','.csv']]+[str(p.relative_to(ROOT)) for p in (ROOT/'tests/int004').glob('*') if p.is_file() and p.suffix in ['.py','.cjs'] and str(p.relative_to(ROOT)) not in tracked]
def sources():return {f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in sorted(set(source_files))}
manifest=sources();dirty=git('status','--porcelain');head=git('rev-parse','HEAD');assert not args.require_clean or not dirty,'Final QA requires a clean exact commit'
report={'outcome':'FAIL','stage':'exact-commit' if args.require_clean else 'working-tree-preflight','testedCommit':head if args.require_clean else None,'baseCommit':head,'startedAtUTC':clock(),'environment':{'browser':subprocess.check_output(['/usr/bin/chromium','--version'],text=True).strip()+' / Linux','protocol':'local HTTP','timezone':'Europe/Rome when clock-sensitive','python':os.sys.version.split()[0],'node':subprocess.check_output(['node','--version'],text=True).strip()},'sourceManifest':manifest,'jobs':[],'blockingFailures':None,'liveDownloadTests':'NON ESEGUITO: live refresh postponed by existing cache timestamps only in isolated test profiles; frozen public inputs used','nativeWindows':'NON ESEGUITO','personalRowsPublished':False}
lock=threading.Lock();stop=threading.Event()
def record(name,cmd,public_cmd,artifact=None):
 if stop.is_set():return
 started=clock();t=time.monotonic();log=out/(name+'.log')
 print('START',name,flush=True)
 with log.open('w') as f:r=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT)
 if artifact:(ROOT/artifact).write_bytes(log.read_bytes())
 job={'name':name,'command':public_cmd,'startedAtUTC':started,'finishedAtUTC':clock(),'seconds':round(time.monotonic()-t,3),'exitCode':r.returncode,'outcome':'PASS' if r.returncode==0 else 'FAIL','logSHA256':hashlib.sha256(log.read_bytes()).hexdigest()}
 with lock:report['jobs'].append(job)
 print(job['outcome'],name,'seconds',job['seconds'],flush=True)
 if r.returncode:stop.set()
def job(name,cmd,artifact=None,public=None):record(name,cmd,public or ' '.join(cmd),artifact)
def static():
 job('all-unit',['node','--test','--test-reporter=tap','tests/csv-import.test.cjs','tests/data002/core.test.cjs','tests/data002b/recovery.test.cjs','tests/stab003/core.test.cjs','tests/int004/identity.test.cjs'],'qa/int004/all-unit.txt')
 job('identity-unit',['node','--test','--test-reporter=tap','tests/int004/identity.test.cjs'],'qa/int004/identity-unit.txt')
 job('csv-current',['node','-r','./tests/int004/load-rc5.cjs','--test','--test-reporter=tap','tests/csv-import.test.cjs'],'qa/int004/csv-parser-unit.txt')
 job('all-public-packets',['node','tests/int004/packet-contract.cjs'])
 job('protected-files',['python','tests/int004/preservation.py'])
 job('audited-input',['python','tests/int004/operational-input-reproduction.py','--operational-root',str(args.operational_root)],public='python tests/int004/operational-input-reproduction.py --operational-root "$OPERATIONAL_ROOT"')
def ui():
 for name,script in [('archive-browser','browser.py'),('public-browser','public-browser.py'),('consultation','consultation-browser.py'),('backtest-contract','backtest-contract.py'),('today-backtest','today-backtest-browser.py'),('operational-browser','operational-browser.py')]:job(name,['python','tests/int004/'+script])
def real():
 job('reimport-e2e',['python','tests/int004/reimport-browser.py','--real-backup',str(args.real_backup),'--original-backup',str(args.original_backup),'--private-output',str(private)],public='python tests/int004/reimport-browser.py --real-backup "$REAL_BACKUP" --original-backup "$ORIGINAL_BACKUP" --private-output "$PRIVATE_OUTPUT"')
 job('original-recovery',['python','tests/int004/private-backup.py','--backup',str(args.original_backup),'--private-output',str(private)],public='python tests/int004/private-backup.py --backup "$ORIGINAL_BACKUP" --private-output "$PRIVATE_OUTPUT"')
 for name,src,export,receipt in [('original-values',args.original_backup,'original-first.json','private-integrity'),('recovered-values',args.real_backup,'rc4Recovered-first.json','private-recovered-integrity')]:job(name,['node','tests/int004/verify-private.cjs',str(src),str(private/export),str(private),receipt],public='node tests/int004/verify-private.cjs "$'+('ORIGINAL_BACKUP' if name=='original-values' else 'REAL_BACKUP')+'" "$PRIVATE_OUTPUT/'+export+'" "$PRIVATE_OUTPUT" '+receipt)
try:
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  futures=[pool.submit(f) for f in [static,ui,real]]
  for future in futures:future.result()
 assert sources()==manifest,'Source or test code changed during the full run'
 assert not stop.is_set(),'At least one blocking suite failed; inspect private run logs and rerun the entire smoke after correction'
 assert len(report['jobs'])==16,len(report['jobs'])
 # All app receipts are freshly overwritten by this run, with console checks.
 names=['browser','public-browser','consultation-browser','backtest-contract','today-backtest-browser','operational-browser','reimport-browser','private-backup-summary','private-integrity','private-recovered-integrity','packet-contract','preservation','operational-input-reproduction']
 for name in names:
  receipt=json.loads((ROOT/'qa/int004'/f'{name}.json').read_text());assert receipt['outcome']=='PASS',name
  assert not receipt.get('pageerrors') and not receipt.get('pageerrorCount') and not receipt.get('consoleErrors'),name
  for f,h in receipt.get('testedSourceSHA256',{}).items():assert manifest[f]==h,(name,f)
 report['outcome']='PASS';report['blockingFailures']=0
finally:
 report['finishedAtUTC']=clock()
 if report['blockingFailures'] is None:report['blockingFailures']=sum(j['outcome']=='FAIL' for j in report['jobs']) or 1
 (out/'consolidated-run.json').write_text(json.dumps(report,indent=2)+'\n');(ROOT/'qa/int004/consolidated-run.json').write_text(json.dumps(report,indent=2)+'\n')
 print('FULL QA',report['outcome'],'jobs',len(report['jobs']),'stage',report['stage'],flush=True)
if report['outcome']=='PASS' and args.require_clean:
 job('final-readiness',['node','tests/int004/check-readiness.cjs','--evidence-out',str(out/'readiness.json')],public='node tests/int004/check-readiness.cjs --evidence-out "$RUN_DIR/readiness.json"')
 if stop.is_set():report['outcome']='FAIL';report['blockingFailures']=1
 report['finishedAtUTC']=clock()
 (out/'consolidated-run.json').write_text(json.dumps(report,indent=2)+'\n');(ROOT/'qa/int004/consolidated-run.json').write_text(json.dumps(report,indent=2)+'\n')
 print('EXACT-COMMIT FINAL GATE',report['outcome'],flush=True)
if report['outcome']!='PASS':raise SystemExit(1)
