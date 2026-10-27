"""Fetch public sources only. Uploaded archives never enter this directory."""
from pathlib import Path
import argparse,concurrent.futures,json,urllib.request,hashlib,datetime
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path('/tmp/ta-stab003-sources'));a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
jobs=[]
codes=['I1','I2','E0','E1','E2','E3','D1','F1','F2','SP1','SP2','N1','P1','T1','B1']
for y in range(2021,2027):
 for code in codes:jobs.append({'file':f'fd/{code}_{y}.csv','url':f'https://www.football-data.co.uk/mmz4281/{y%100:02}{(y+1)%100:02}/{code}.csv','kind':'fd','code':code,'season':y})
for code in ['DNK','ROU']:jobs.append({'file':f'fd/{code}.csv','url':f'https://www.football-data.co.uk/new/{code}.csv','kind':'extra','code':code})
for y in range(2021,2027):
 season=f'{y}-{(y+1)%100:02}'
 for code,file in [('I1','1-seriea.txt'),('I2','2-serieb.txt')]:jobs.append({'file':f'openfootball/{code}_{y}.txt','url':f'https://raw.githubusercontent.com/openfootball/italy/master/{season}/{file}','kind':'footballtxt','code':code,'season':y})
 for code,file in [('E0','1-premierleague.txt'),('E1','2-championship.txt'),('E2','3-league1.txt'),('E3','4-league2.txt')]:jobs.append({'file':f'openfootball/{code}_{y}.txt','url':f'https://raw.githubusercontent.com/openfootball/england/master/{season}/{file}','kind':'footballtxt','code':code,'season':y})
 for phase,file in [('main','cl.txt'),('qualifying','clq.txt')]:jobs.append({'file':f'openfootball/CL_{phase}_{y}.txt','url':f'https://raw.githubusercontent.com/openfootball/champions-league/master/{season}/{file}','kind':'footballtxt','code':'CL','season':y,'phase':phase})
# Secondary JSON references: independently inspect full fixture sets; no assumed playoff coverage.
for y in range(2021,2027):
 for code,file in [('SP1','es.1'),('SP2','es.2'),('F1','fr.1'),('F2','fr.2'),('P1','pt.1'),('N1','nl.1'),('D1','de.1')]:jobs.append({'file':f'json/{code}_{y}.json','url':f'https://raw.githubusercontent.com/openfootball/football.json/master/{y}-{(y+1)%100:02}/{file}.json','kind':'footballjson','code':code,'season':y})
jobs.append({'file':'espn-seriea-playout-2022.json','url':'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard?dates=20230611','kind':'espn','code':'I1','season':2022})
def fetch(job):
 try:
  with urllib.request.urlopen(job['url'],timeout=20) as r:raw=r.read();final=r.url
  if b'<html' in raw[:200].lower():raise ValueError('Unexpected HTML')
  file=a.output/job['file'];file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(raw)
  return {**job,'status':'downloaded','finalURL':final,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 except Exception as e:return {**job,'status':'unavailable','error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 result=list(pool.map(fetch,jobs))
(a.output/'manifest.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'requested':len(result),'downloaded':sum(r['status']=='downloaded' for r in result),'unavailable':sum(r['status']!='downloaded' for r in result)}))
