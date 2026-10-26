"""Inventory exact source denominations; no matching or alias inference here."""
from pathlib import Path
import csv,io,re,json,hashlib,subprocess,urllib.request,collections,argparse
p=argparse.ArgumentParser();p.add_argument('--sources',type=Path,default=Path('/tmp/ta-data002-sources'));p.add_argument('--champions',type=Path,default=Path('/tmp/ta-data002-champions'));a=p.parse_args()
leagues={'I1':'Serie A','I2':'Serie B','E0':'Premier League','E1':'Championship','E2':'League One','E3':'League Two','D1':'Bundesliga','F1':'Ligue 1','F2':'Ligue 2','SP1':'La Liga','SP2':'Segunda División','N1':'Eredivisie','P1':'Primeira Liga','T1':'Süper Lig','B1':'Jupiler Pro League','ROU':'SuperLiga Romania','DNK':'Superliga Danimarca'}
observations=collections.Counter();manifest=json.loads((a.sources/'manifest.json').read_text())
for entry in manifest:
 if entry['status']!='downloaded':continue
 raw=(a.sources/entry['file']).read_bytes()
 try:text=raw.decode('utf-8-sig')
 except UnicodeDecodeError:text=raw.decode('cp1252')
 league=leagues[entry['file'].split('_')[0].split('.')[0]]
 for row in csv.DictReader(io.StringIO(text)):
  for field in ['HomeTeam','AwayTeam','Home','Away']:
   if row.get(field):observations[(league,row[field],entry['file'],'',row.get('Season') or entry['file'].split('_')[-1].split('.')[0])]+=1
revision=subprocess.check_output(['git','-C',str(a.champions),'rev-parse','HEAD'],text=True).strip()
for year in range(2021,2026):
 name=f'{year}-{str(year+1)[2:]}/cl.txt';file=a.champions/name
 if not file.exists():manifest.append({'file':name,'status':'unavailable','source':'OpenFootball','revision':revision});continue
 raw=file.read_bytes();entry={'file':'champions/'+name,'url':f'https://raw.githubusercontent.com/openfootball/champions-league/{revision}/{name}','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'status':'downloaded','source':'OpenFootball','revision':revision};manifest.append(entry)
 (a.sources/'champions'/Path(name).parent).mkdir(parents=True,exist_ok=True);(a.sources/'champions'/name).write_bytes(raw)
 count=0
 for line in raw.decode('utf-8-sig').splitlines():
  m=re.match(r'^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s+\(([A-Z]{3})\)\s+v\s+(.+?)\s+\(([A-Z]{3})\)',line)
  if m:
   count+=1
   for team,country in [(m[1],m[2]),(m[3],m[4])]:observations[('Champions League',team.strip(),entry['file'],country,f'{year}/{str(year+1)[2:]}')]+=1
 entry['name_rows_parsed']=count
# The runtime registry supplies a community source for Croatian top-flight results.
url='https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/CRO_1_hnl/results_2627.csv'
try:
 with urllib.request.urlopen(url,timeout=20) as r:raw=r.read()
 text=raw.decode('utf-8-sig');rows=list(csv.DictReader(io.StringIO(text)))
 assert rows and ('home' in rows[0] or 'HomeTeam' in rows[0])
 name='CRO_current.csv';(a.sources/name).write_bytes(raw)
 manifest.append({'file':name,'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'status':'downloaded','scope':'current source only, not full histories'})
 for row in rows:
  for field in ['home','away','HomeTeam','AwayTeam']:
   if row.get(field):observations[('HNL Croazia',row[field],name,'HRV','2026/27')]+=1
except Exception as e:manifest.append({'file':'CRO_current.csv','url':url,'status':'unavailable','error':str(e)})
items=[{'league':league,'name':name,'source':source,'sourceCountry':country or None,'sourceId':None,'season':season,'occurrences':count} for (league,name,source,country,season),count in sorted(observations.items())]
(a.sources/'name-observations.json').write_text(json.dumps(items,ensure_ascii=False,indent=2))
(a.sources/'complete-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Source observations:',len(items),'exact names:',len({(v['league'],v['name']) for v in items}),'source entries:',len(manifest))
