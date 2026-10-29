"""Isolated functional browser checks with observable console errors.
Only optional remote font CSS is replaced by an empty stylesheet. Existing cache
timestamps postpone automatic live refresh in these new test-only profiles.
All application HTML/JS/data are real local files; external requests are blocked.
"""
import csv,json
from pathlib import Path
def isolate(context,base,report):
 report.setdefault('consoleErrors',[])
 leagues=sorted({r['league'] for r in csv.DictReader((Path(__file__).resolve().parents[2]/'docs/int004/MATRICE_PACCHETTI.csv').open())})
 context.add_init_script('for (const league of '+json.dumps(leagues)+') for (const prefix of ["ta_sync_ok_","ta_fixture_sync_"]) localStorage.setItem(prefix+league,String(Date.now()));')
 report['networkMode']='isolated: optional font CSS empty; automatic live refresh postponed via existing cache timestamps in test profiles only'
 def instrument(page):
  if getattr(page,'_ta_console_checked',False):return
  page._ta_console_checked=True
  page.on('console',lambda msg:report['consoleErrors'].append(msg.text) if msg.type=='error' else None)
 context.on('page',instrument)
 for page in context.pages:instrument(page)
 def route(r):
  if r.request.url.startswith(base):r.continue_()
  elif r.request.url.startswith('https://fonts.googleapis.com/'):r.fulfill(status=200,content_type='text/css',body='/* isolated test: local fallback font */')
  else:r.abort()
 context.route('**/*',route)
