"""Private 28k benchmark, no screenshots/rows; same cold/warm sequence for rc2/rc1."""
from pathlib import Path
import hashlib,json,os,sys
R=Path(__file__).resolve().parents[2];O=Path(os.environ['TA_UX_OUT']);O.mkdir(parents=True,exist_ok=True)
f=R/'tests/v02v/performance-browser.py';original=f.read_text()
spy="window.qaUxPuts=[];const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){qaUxPuts.push({store:this.name,key:String(a[1])});return put.apply(this,a)};window.qaUxFrames=[];function frame(t){if(document.body){qaUxFrames.push({t,visible:[...document.querySelectorAll('main>section[id]')].filter(x=>x.getBoundingClientRect().height&&getComputedStyle(x).display!=='none'&&!document.body.classList.contains('ta-ux-loading')).map(x=>x.id)});}if(!window.taVReady)requestAnimationFrame(frame)};requestAnimationFrame(frame);"
for label,entry in [('rc2','Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html'),('rc1','Trading_Analytics_v0.2V-rc1_TA-V02V-001.html')]:
 out=O if label=='rc2' else O/'startup-baseline';out.mkdir(exist_ok=True);os.environ['TA_V02V_OUT']=str(out)
 s=original.replace('Trading_Analytics_v0.2V-rc1_TA-V02V-001.html',entry).replace('tbody tr','tbody tr:not(.ux-group)')
 s=s.replace('isolate(c,base,report);p=c.new_page()',f'isolate(c,base,report);c.add_init_script({spy!r});p=c.new_page()')
 needle="  report['h2hReal']=p.evaluate"
 assert needle in s
 extra="""  report['workerIndexEqualsSynchronous']=p.evaluate('''async()=>{
   const real=taStatRows(),all=man.length?TARecovery.reconcile([...real,...man]).usableRecords:real;
   const a=TARecovery.stable(taVIndex()),b=TARecovery.stable(TAV02V.createIndex(all));return a===b;
  }''')
  assert report['workerIndexEqualsSynchronous']
  report['warmReloads']=[]
  report['startupPhases']=p.evaluate('window.taUXStartup||null')
  for iteration in range(2):
   t=time.monotonic();p.reload();p.evaluate('taVInitialized');elapsed=round(time.monotonic()-t,3)
   assert p.evaluate('taFingerprint()')==before and p.evaluate('archiveDbGet().then(TARecovery.stable)')==disk
   assert not p.evaluate('qaUxPuts.some(x=>x.key===\"matches\"||x.store===\"sources\")')
   phases=p.evaluate('window.taUXStartup||null');frames=p.evaluate('qaUxFrames')
   if phases:
    assert phases['shell']<1500 and phases['shellFrame']<=phases['archiveStart']
    assert phases['worker']=='background'
    assert len(frames)>=10
    assert all(set(x['visible'])<={'dashboard'} for x in frames)
   report['warmReloads'].append({'seconds':elapsed,'phases':phases,'frames':frames,'archiveUnchanged':True,'startupWrites':0})
"""
 s=s.replace(needle,extra+needle)
 sys.path.insert(0,str(R/'tests/int004'));sys.argv[0]=str(f)
 exec(compile(s,str(f),'exec'),{'__file__':str(f),'__name__':'__main__'})
 new=json.loads((out/'performance-browser.json').read_text());new['benchmarkEntry']=entry;new['originalTestSHA256']=hashlib.sha256(original.encode()).hexdigest();new['assertionsRemoved']=0;(out/'performance-browser.json').write_text(json.dumps(new,indent=2)+'\n')
new=json.loads((O/'performance-browser.json').read_text());old=json.loads((O/'startup-baseline/performance-browser.json').read_text())
comparison={'outcome':'PASS','inputSameSHA256':new['sourceSHA256']==old['sourceSHA256'],'protocol':'Chromium/Linux/HTTP, separate profiles, same private input, first reload after import and two subsequent warm reloads; not OS cold startup','rc2':{'cold':new['timingsSeconds']['coldReload28k'],'warm':[x['seconds'] for x in new['warmReloads']]},'rc1':{'cold':old['timingsSeconds']['coldReload28k'],'warm':[x['seconds'] for x in old['warmReloads']]},'privateRowsPublished':False}
assert comparison['inputSameSHA256'];(O/'startup-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
