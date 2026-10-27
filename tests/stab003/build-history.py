"""Build public recovery packets and a reproducible coverage catalogue. No private input."""
from pathlib import Path
import json,hashlib,subprocess,importlib.util,datetime,re,csv,unicodedata,collections
ROOT=Path(__file__).resolve().parents[2];SRC=Path('/tmp/ta-stab003-sources');OUT=ROOT/'histories/stab003';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('football',Path(__file__).with_name('parse-football.py'));football=importlib.util.module_from_spec(spec);spec.loader.exec_module(football)
configs=[('I1','Serie A','ITA',380),('I2','Serie B','ITA',380),('E0','Premier League','ENG',380),('E1','Championship','ENG',552),('E2','League One','ENG',552),('E3','League Two','ENG',552),('D1','Bundesliga','GER',306),('F1','Ligue 1','FRA',None),('F2','Ligue 2','FRA',None),('SP1','La Liga','ESP',380),('SP2','Segunda División','ESP',462),('N1','Eredivisie','NED',306),('P1','Primeira Liga','PRT',306),('T1','Süper Lig','TUR',None),('B1','Jupiler Pro League','BEL',None),('DNK','Superliga Danimarca','DNK',132),('ROU','SuperLiga Romania','ROU',240),('P2','Liga Portugal 2','PRT',None),('DK2','1st Division Danimarca','DNK',None),('HR1','HNL Croazia','HRV',180),('HR2','Prva NL Croazia','HRV',None),('RO2','Liga II Romania','ROU',None),('CL','Champions League','INT',None)]
bycode={c[0]:c for c in configs};manifest=json.loads((SRC/'manifest.json').read_text());groups=collections.defaultdict(list);source_info=collections.defaultdict(list);notes=collections.defaultdict(list);declared={};qualifying_declared={}
source_data=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./ta-source-evidence')))"],cwd=ROOT,text=True));seeds=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./ta-clubs-v3').seeds))"],cwd=ROOT,text=True))
norm=lambda x:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',str(x)).encode('ascii','ignore').decode().lower())
seed_alias={norm(a):s['id'] for s in seeds for a in [s['name'],*s['aliases']]};aliases={k:norm(v) for k,v in source_data['aliases'].items()};aliases.update(source_data['opponentAliases']);aliases.update({'brest':'stadebrestois29','leman':'lemansfc'})
# Exact provider aliases inherit an already verified seed ID in either direction.
for _ in range(4):
 for a,b in aliases.items():
  ids={seed_alias[k] for k in [a,b] if k in seed_alias}
  if len(ids)==1:
   target=next(iter(ids));seed_alias[a]=target;seed_alias[b]=target

def ident(name):
 k=norm(name)
 if k in seed_alias:return seed_alias[k]
 k=aliases.get(k,k)
 return seed_alias.get(k,k)
def stamp(value):return int(datetime.datetime.fromisoformat(value).replace(tzinfo=datetime.timezone.utc).timestamp()*1000)
def add(code,y,r,source):
 if y not in range(2021,2027):return
 r=dict(r);r['lg']=bycode[code][1];
 if source.get('kind') not in ['fd','extra'] and code!='CL' and r.get('o',{}).get('Phase','regular')=='regular':
  primary=[x for x in groups[(code,y)] if x.get('o',{}).get('HistProvider')=='Football-Data']
  if primary and not any(x['d']==r['d'] and ident(x['H'])==ident(r['H']) and ident(x['A'])==ident(r['A']) for x in primary):
   if not (source.get('kind')=='community' and r.get('up') and r['d']>=stamp('2026-10-27')):
    notes[(code,y)].append({'reason':'Unmatched secondary regular fixture not added without identity/date corroboration','date':r['d'],'home':r['H'],'away':r['A'],'source':source['url']});return
 r.setdefault('o',{})
 if code in ['DNK','ROU','B1'] and source.get('kind') in ['fd','extra']:r['o']['Phase']='unclassified'
 r['o'].update({'CsvSeason':y,'HistSources':[{'url':source['url'],'sha256':source['sha256']}],'Source':r['o'].get('Source') or 'Riferimenti storici pubblici TA-STAB-003'});groups[(code,y)].append(r)
def record(m,code,y):
 countries={'POR':'PRT','DEN':'DNK','CRO':'HRV','ROM':'ROU','GRE':'GRC','SUI':'CHE'}
 m=dict(m);m['homeCountry']=countries.get(m.get('homeCountry'),m.get('homeCountry'));m['awayCountry']=countries.get(m.get('awayCountry'),m.get('awayCountry'))
 ft=m.get('ft');ht=m.get('ht');return {'d':stamp(m['date']),'H':m['home'],'A':m['away'],'h':ft[0] if ft else None,'a':ft[1] if ft else None,'up':not bool(ft),'ht':sum(ht) if ht else None,'hth':ht[0] if ht else None,'hta':ht[1] if ht else None,'shots':None,'o':{'Phase':m.get('phase','regular'),'HomeCountry':m.get('homeCountry') or bycode[code][2],'AwayCountry':m.get('awayCountry') or bycode[code][2]}}
for file in json.loads((SRC/'fd-parsed.json').read_text()):
 f=file['source'];code=f['code']
 for r in file['records']:
  y=r['o'].get('CsvSeason');add(code,y,r,f)
 for y in range(2021,2027):
  if any(r['o'].get('CsvSeason')==y for r in file['records']):source_info[(code,y)].append(f)
for f in manifest:
 if f['status']!='downloaded' or f['kind'] not in ['footballtxt','footballjson']:continue
 code,y=f['code'],f['season'];raw=(SRC/f['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==f['sha256'];text=raw.decode('utf-8-sig');source_info[(code,y)].append(f)
 if f['kind']=='footballtxt':
  parsed=football.parse_text(text,y);matches=parsed['matches'];notes[(code,y)].extend(parsed['issues'])
  if f.get('phase')!='qualifying' and parsed['declaredMatches']:declared[(code,y)]=parsed['declaredMatches']
  if f.get('phase')=='qualifying' and parsed['declaredMatches']:qualifying_declared[(code,y)]=parsed['declaredMatches']
  for m in matches:
   # Keep full phase names as evidence, but use a stable regular flag.
   phase=m['phase'];m['phase']='qualifying' if f.get('phase')=='qualifying' else 'regular' if re.search('Regular|Matchday',phase,re.I) and not re.search('Playoff|Final|League,',phase,re.I) else phase
   r=record(m,code,y);r['o']['PublishedRound']=phase
   if 'a.e.t.' in m['scoreText'] or 'pen.' in m['scoreText']:r['o']['CupScoreEvidence']=m['scoreText']
   add(code,y,r,f)
 else:
  parsed=json.loads(text)
  for m in parsed.get('matches',[]):
   if not m.get('date'):continue
   score=m.get('score',{});ft=score if isinstance(score,list) else score.get('ft');ht=None if isinstance(score,list) else score.get('ht');r=record({'date':m['date'],'home':m['team1'],'away':m['team2'],'ft':ft,'ht':ht,'phase':'regular'},code,y);add(code,y,r,f)
for f in manifest:
 if f['kind']!='espn' or f['status']!='downloaded':continue
 data=json.loads((SRC/f['file']).read_text());source_info[('I1',2022)].append(f)
 for event in data.get('events',[]):
  if not event.get('status',{}).get('type',{}).get('completed'):continue
  comp=event['competitions'][0];teams={c['homeAway']:c for c in comp['competitors']}
  m={'date':event['date'][:10],'home':teams['home']['team']['displayName'],'away':teams['away']['team']['displayName'],'ft':[int(teams['home']['score']),int(teams['away']['score'])],'ht':None,'phase':'relegation-playoff'}
  add('I1',2022,record(m,'I1',2022),f)
# Pinned current community snapshot, including competitions without historical CSVs.
folders={'I1':'ITA_1_serie-a','I2':'ITA_2_serie-b','E0':'ENG_1_premier-league','E1':'ENG_2_championship','E2':'ENG_3_league-one','E3':'ENG_4_league-two','D1':'GER_1_bundesliga','F1':'FRA_1_ligue-1','F2':'FRA_2_ligue-2','SP1':'ESP_1_la-liga','SP2':'ESP_2_segunda-division','N1':'NED_1_eredivisie','P1':'POR_1_primeira-liga','DNK':'DEN_1_superliga','ROU':'ROU_1_liga-1','HR1':'CRO_1_hnl','CL':'UEFA_1_champions-league'}
for code,folder in folders.items():
 for kind in ['results','fixtures']:
  file=Path('/tmp/ta-stab003-matchday/data')/folder/(kind+'_2627.csv')
  if not file.exists():continue
  f={'url':f"https://raw.githubusercontent.com/oladeeayo/open-matchday/{source_data['revision']}/data/{folder}/{kind}_2627.csv",'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'kind':'community','status':'downloaded'};source_info[(code,2026)].append(f)
  for m in csv.DictReader(file.open(encoding='utf-8-sig')):
   if not m.get('date'):continue
   ft=[int(m['ft_home']),int(m['ft_away'])] if m.get('ft_home','').isdigit() and m.get('ft_away','').isdigit() else None;ht=[int(m['ht_home']),int(m['ht_away'])] if m.get('ht_home','').isdigit() and m.get('ht_away','').isdigit() else None
   r=record({'date':m['date'],'home':m['home'],'away':m['away'],'ft':ft,'ht':ht,'phase':'regular'},code,2026);r['o']['Source']='Open Matchday (riferimento pubblico)';add(code,2026,r,f)
rows=[];allissues=[]
for code,lg,country,regular in configs:
 for y in range(2021,2027):
  source=groups[(code,y)];merged={};conflicts=[]
  for r in source:
   key=f"{r['d']}|{ident(r['H'])}|{ident(r['A'])}"
   if key not in merged:merged[key]=r;continue
   old=merged[key]
   if not old['up'] and not r['up'] and (old['h'],old['a'])!=(r['h'],r['a']):conflicts.append({'key':key,'fields':['FT'],'sources':old['o']['HistSources']+r['o']['HistSources']});continue
   if old['up'] and not r['up']:old.update({k:r[k] for k in ['h','a','up','ht','hth','hta']})
   if old.get('hth') is None and r.get('hth') is not None:old.update({k:r[k] for k in ['hth','hta','ht']})
   elif old.get('hth') is not None and r.get('hth') is not None and (old['hth'],old['hta'])!=(r['hth'],r['hta']):conflicts.append({'key':key,'fields':['HT'],'sources':old['o']['HistSources']+r['o']['HistSources']})
   old['o']['HistSources']=list({json.dumps(x,sort_keys=True):x for x in old['o']['HistSources']+r['o']['HistSources']}.values())
  values=list(merged.values());reg=regular
  if code=='F1':reg=380 if y<=2022 else 306
  if code=='F2':reg=380 if y<=2023 else 306
  if code=='T1':reg={2021:380,2022:342,2023:380,2024:342,2025:306,2026:306}.get(y)
  if code=='B1':reg=306 if y<=2022 else 240
  full=declared.get((code,y));scope='campionato e fasi pubblicate'
  if code in ['E1','E2','E3']:full=557 if y<2026 else None
  if code=='I2' and (full is None or full<388):full=None
  if code=='CL':full=(125 if y<=2023 else 189)+qualifying_declared[(code,y)] if (code,y) in qualifying_declared else None;scope='fase principale'+(' e qualificazioni pubblicate' if any(r['o'].get('Phase')=='qualifying' for r in values) else '; qualificazioni non disponibili')
  elif code in ['E0','SP1']:full=reg;scope='campionato completo, senza spareggi'
  elif code=='I1':full=381 if y==2022 else 380;scope='campionato e spareggio salvezza quando previsto'
  elif code=='SP2':full=468;scope='stagione regolare e playoff promozione'
  elif code in ['DNK','ROU','B1','D1','P1','N1','F1','F2']:scope='stagione regolare; fasi/spareggi ulteriori da verificare'
  # Conflicting public references are preserved for diagnosis and excluded from automatic recovery.
  bad={x['key'] for x in conflicts};packet_values=list(merged.values())
  for k in bad:merged[k]['o']['HistSourceConflict']=True
  compact=lambda r:[r['d'],r['lg'],r['H'],r['A'],r['h'],r['a'],r.get('ht'),int(r['up']),r['o'],r.get('hth'),r.get('hta'),r.get('shots')]
  packet={'format':'TradingAnalyticsBackup','version':2,'records':[compact(r) for r in packet_values]}
  path=f'histories/stab003/{code}_{y}.json';data=json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode();(ROOT/path).write_bytes(data)
  refs=[{'d':r['d'],'H':r['H'],'A':r['A'],'h':r['h'],'a':r['a'],'up':r['up'],'ht':r.get('ht'),'phase':r['o'].get('Phase','regular')} for r in packet_values]
  sources=source_info[(code,y)];entry={'code':code,'league':lg,'country':country,'season':y,'runtime':code not in ['E3','T1','B1'],'expectedRegular':reg,'expectedFull':full,'scope':scope,'current':y==2026,'path':path,'sha256':hashlib.sha256(data).hexdigest(),'referenceCount':len(refs),'referenceFT':sum(not r['up'] for r in refs),'referenceHT':sum(not r['up'] and r['ht'] is not None for r in refs),'sourceConflicts':len(bad),'parserWarnings':len(notes[(code,y)]),'sources':[{'url':f['url'],'sha256':f['sha256'],'kind':f.get('kind')} for f in sources],'reliability':'incrocio di aggregatori statistici' if len({f.get('kind') for f in sources})>1 else 'aggregatore statistico' if sources and sources[0].get('kind')!='community' else 'comunitaria, non certificata' if sources else 'nessuna fonte acquisita','references':refs}
  rows.append(entry);allissues.append({'code':code,'season':y,'conflicts':conflicts,'parserWarnings':notes[(code,y)]})
catalogue={'version':'TA-HISTORY-1','asOf':'2026-10-27','aliases':aliases,'seedAliases':seed_alias,'rows':rows,'notes':'Source packet is public-only. Missing and conflicting values are not invented. References may be partial, and season status must also compare archive identities, fixture coverage, phases and current cutoff.'}
(ROOT/'ta-history-manifest.js').write_text('(function(root){const data='+json.dumps(catalogue,ensure_ascii=False,separators=(',',':'))+";if(typeof module==='object'&&module.exports)module.exports=data;else root.TAHistoryManifest=data;})(globalThis);\n")
(ROOT/'qa/stab003/public-sources.json').write_text(json.dumps(manifest,indent=2)+'\n');(ROOT/'qa/stab003/public-source-issues.json').write_text(json.dumps(allissues,indent=2)+'\n')
print(json.dumps({'combinations':len(rows),'referenceRecords':sum(x['referenceCount'] for x in rows),'withoutSource':sum(not x['sources'] for x in rows),'sourceConflictKeys':sum(x['sourceConflicts'] for x in rows),'parserWarnings':sum(x['parserWarnings'] for x in rows)}))
