"""Real private-archive upload; publish timings/counts only, never rows/screenshots."""
from pathlib import Path
import argparse,functools,hashlib,http.server,json,os,sys,threading,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/int004'))
from browser_environment import isolate
ap=argparse.ArgumentParser();ap.add_argument('--real-backup',type=Path,required=True);a=ap.parse_args();OUT=Path(os.environ.get('TA_V02V_OUT',ROOT/'qa/v02v'));OUT.mkdir(parents=True,exist_ok=True);original=hashlib.sha256(a.real_backup.read_bytes()).hexdigest();report={'outcome':'FAIL','checks':[],'pageerrors':[],'consoleErrors':[],'sourceSHA256':original,'privateRowsPublished':False,'browser':'Chromium Linux HTTP','timingsSeconds':{}}
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/'
def ok(t):report['checks'].append(t);print('PASS',t,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(accept_downloads=True);isolate(c,base,report);p=c.new_page();p.set_default_timeout(240000);p.on('pageerror',lambda e:report['pageerrors'].append(str(e)));p.on('dialog',lambda d:d.accept());p.goto(base+'Trading_Analytics_v0.2V-rc1_TA-V02V-001.html');p.evaluate('taVInitialized');p.locator('.workspace-nav [data-open-workspace="dati"]').click();p.locator('#taTechOpenAll').click();t=time.monotonic();p.set_input_files('#taRecoveryFile',str(a.real_backup));p.wait_for_function('!archiveBackupBusy && taPending');assert p.evaluate('taPending.report.safe');p.locator('#taRecoveryConfirm').click();p.wait_for_function('!archiveBackupBusy');assert p.evaluate('taPending===null'),p.evaluate('({saveError:taPending?.report.saveError,status:window.taLastMigration?.status,message:document.querySelector("#taRecoveryStatus").textContent})');report['timingsSeconds']['import']=round(time.monotonic()-t,3);assert p.evaluate('rows.length')==28300;ok('Actual private backup import confirms 28,300 conservative records')
  before=p.evaluate('taFingerprint()');disk=p.evaluate('archiveDbGet().then(TARecovery.stable)');t=time.monotonic();p.reload();p.evaluate('taVInitialized');report['timingsSeconds']['coldReload28k']=round(time.monotonic()-t,3);assert report['timingsSeconds']['coldReload28k']<30;assert p.evaluate('taFingerprint()')==before;assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==disk;assert p.evaluate('document.body.dataset.workspace')=='dashboard';ok('Cold Dashboard with 28k restores without archive/auxiliary writes, under 30s blocking budget')
  t=time.monotonic();p.locator('.workspace-nav [data-open-workspace="calendario"]').click();p.locator('#vCalTeam').fill('Inter');report['timingsSeconds']['calendarAndAliasFilter28k']=round(time.monotonic()-t,3);assert report['timingsSeconds']['calendarAndAliasFilter28k']<10;assert p.locator('#vCalendarRows tbody tr').count()<=50;ok('28k calendar is paginated and alias-filtered under 10s budget')
  p.locator('.workspace-nav [data-open-workspace="analisi"]').click();p.locator('#analisi [data-open-workspace="comparatore"]').click();p.locator('#vaCountry').select_option('ITA');p.locator('#vaCompetition').select_option('Serie A');p.locator('#vaClub').select_option(label='Inter');p.locator('#vaSeason').select_option('all');t=time.monotonic();p.locator('#vCmpRun').click();report['timingsSeconds']['comparator28k']=round(time.monotonic()-t,3);assert report['timingsSeconds']['comparator28k']<10;assert p.evaluate('taVComparator.a.n')>100;assert p.evaluate('taFingerprint()')==before;assert p.evaluate('archiveDbGet().then(TARecovery.stable)')==disk;ok('Historic comparator on private archive leaves every stored section unchanged')
  report['h2hReal']=p.evaluate('''()=>{
   const i=taVIndex(),now=Date.parse('2026-10-30T12:00:00Z'),cutoff=Date.parse('2026-10-30T00:00:00Z'),groups=new Map();
   const playable=r=>!r.up&&Number.isInteger(r.h)&&r.h>=0&&Number.isInteger(r.a)&&r.a>=0&&!/extra|penalt|aet|shootout/i.test(String(r.o?.ScoreScope??r.o?.ResultScope??''));
   for(const x of i.entries){if(x.r.d>=cutoff||!x.comp.official||!TAFixtures.usable(x.r))continue;
    const ids=[x.ids.H,x.ids.A].sort(),k=JSON.stringify(ids);if(!groups.has(k))groups.set(k,{ids,entries:[]});groups.get(k).entries.push(x);}
   let affected=0,comparisons=0,errors=0;
   for(const {ids,entries} of groups.values()){
    entries.sort((a,b)=>a.r.d-b.r.d);const played=entries.filter(x=>playable(x.r));
    if(played.length>=5&&entries.slice(-5).filter(x=>playable(x.r)).length<5)affected++;
    for(const limit of [5,10,'all']){
     const expected=limit==='all'?played:played.slice(-limit),actual=TAV02V.h2h(i,...ids,cutoff,limit,null,now);
     comparisons++;if(actual.n!==expected.length||actual.timeline.map(x=>x.key).join('|')!==expected.map(x=>x.key).join('|'))errors++;
    }
   }
   return {outcome:errors?'FAIL':'PASS',cutoff:'2026-10-30',pairGroups:groups.size,comparisons,groupsExposedToPreviousBug:affected,errors,privateDetailsPublished:false};
  }''')
  assert report['h2hReal']['outcome']=='PASS' and report['h2hReal']['groupsExposedToPreviousBug']>0,report['h2hReal']
  assert p.evaluate('taFingerprint()')==before and p.evaluate('archiveDbGet().then(TARecovery.stable)')==disk
  ok('Every real H2H pair checked at 5/10/all against an independent FT-first oracle; no archive writes')
  assert not report['pageerrors'] and not report['consoleErrors'];assert hashlib.sha256(a.real_backup.read_bytes()).hexdigest()==original;report['outcome']='PASS';c.close();b.close()
finally:s.shutdown();(OUT/'performance-browser.json').write_text(json.dumps(report,indent=2)+'\n')
