"""Build explicit, country-scoped aliases; do not infer identities by spelling similarity."""
from pathlib import Path
import json,re,hashlib,subprocess,collections
ROOT=Path(__file__).resolve().parents[2];SRC=Path('/tmp/ta-int004-public-sources')
seeds=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./ta-clubs-v3').seeds))"],cwd=ROOT,text=True));sources=json.loads((SRC/'clubs-sources.json').read_text());groups=[];omitted=[]
norm=lambda x:re.sub(r'\s+',' ',x.strip()).casefold()
for s in sources:
 raw=(SRC/(s['country']+'.clubs.txt')).read_bytes();assert hashlib.sha256(raw).hexdigest()==s['sha256'];current=None
 for number,line in enumerate(raw.decode('utf-8-sig').splitlines(),1):
  stripped=line.strip()
  if not stripped or stripped.startswith(('#','=')):continue
  if stripped.startswith('|'):
   if current is None:continue
   if re.search(r'old name|before season|formerly|until ',line,re.I):continue
   current['aliases'].extend(re.sub(r'\s*\[[^]]*\]\s*','',p).strip() for p in stripped.split('#')[0].split('|')[1:] if p.strip())
  elif not line[:1].isspace():
   name=stripped.split('#')[0].split(',')[0].strip();closed=re.search(r'\((?:\d{4})?\s*[-–]\s*\d{4}\)',name)
   if closed:omitted.append({'country':s['country'],'name':name,'reason':'Closed historical entity; successor identity not inferred'});current=None;continue
   current={'country':s['country'],'name':name,'aliases':[name],'evidence':s['url']+'#L'+str(number),'sha256':s['sha256']};groups.append(current)
# Modern Cesena FC is not the closed AC Cesena (1940–2018) entity in this catalogue.
groups.append({'country':'ITA','name':'Cesena','aliases':['Cesena','Cesena FC'],'evidence':'TA-INT-004 current-club example; Football-Data I2 / OpenFootball 2025-26 published participants. Does not include AC Cesena (1940–2018).','sha256':None,'minSeason':2021,'maxSeason':2026})
records=[]
for g in groups:
 g['aliases']=list(dict.fromkeys(a for a in g['aliases'] if a));
 if g['country']=='WAL' and g['name'] in ['Swansea City AFC','Cardiff City FC','Newport County AFC','Wrexham AFC']:g['associationCountries']=['ENG']
 known=[s for s in seeds if s['country'] in [g['country'],*g.get('associationCountries',[])] and set(map(norm,s['aliases']))&set(map(norm,g['aliases']))]
 if len(known)>1:omitted.append({'country':g['country'],'name':g['name'],'reason':'Overlaps more than one already verified identity'});continue
 slug=re.sub(r'[^a-z0-9]+','-',g['name'].lower()).strip('-')
 g['id']=known[0]['id'] if known else 'club:of:'+g['country']+':'+slug
 if known:g['name']=known[0]['name']
 records.append(g)
# Diacritic-only transliterations are explicit orthographic variants of the
# published alias, within the same country. They never strip legal club tokens.
import unicodedata
for g in records:
 for a in list(g['aliases']):
  plain=unicodedata.normalize('NFKD',a).encode('ascii','ignore').decode()
  if plain and plain not in g['aliases']:g['aliases'].append(plain)
# Admit source spelling variants only through the pinned provider's explicit
# dictionary and a unique country-scoped club record. Generic Paris is excluded.
provider=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./ta-source-evidence')))"],cwd=ROOT,text=True))
flat=lambda x:re.sub('[^a-z0-9]','',__import__('unicodedata').normalize('NFKD',x).encode('ascii','ignore').decode().lower())
country_by_league=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./ta-clubs-v3').countries))"],cwd=ROOT,text=True))
lookup=collections.defaultdict(list)
for g in records:
 for a in g['aliases']:lookup[(g['country'],flat(a))].append(g)
for packet in (ROOT/'histories/stab003').glob('*.json'):
 for r in json.loads(packet.read_text())['records']:
  for i,side in [(2,'Home'),(3,'Away')]:
   name=r[i];country=r[8].get(side+'Country') or country_by_league.get(r[1]);country={'POR':'PRT','DEN':'DNK','CRO':'HRV','ROM':'ROU'}.get(country,country);k=flat(name)
   if k in ['paris','sporting','manchester'] or k not in provider['aliases']:continue
   candidates={g['id']:g for g in lookup.get((country,flat(provider['aliases'][k])),[])};already={g['id'] for g in lookup.get((country,k),[])}
   if len(candidates)==1 and (not already or already==set(candidates)):
    g=next(iter(candidates.values()))
    if name not in g['aliases']:g['aliases'].append(name);g.setdefault('providerEvidence',[]).append({'alias':name,'url':'https://github.com/oladeeayo/open-matchday/blob/'+provider['revision']+'/builder.py'})
# Detect colliding aliases rather than merging records that share a label.
index=collections.defaultdict(set)
for g in records:
 for a in g['aliases']:index[(g['country'],norm(a))].add(g['id'])
ambiguous=[{'country':k[0],'alias':k[1],'ids':sorted(v)} for k,v in index.items() if len(v)>1]
result={'version':'TA-CLUB-CATALOG-INT004','scope':'Explicit public aliases; country context; historical successor identity is not inferred','records':records,'ambiguous':ambiguous,'sources':sources,'omitted':omitted}
(ROOT/'ta-club-aliases-int004.js').write_text('(function(root){const data='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';if(typeof module==="object"&&module.exports)module.exports=data;else root.TAClubAliasCatalog=data;})(globalThis);\n')
(ROOT/'qa/int004/club-catalog.json').write_text(json.dumps({'sources':sources,'clubs':len(records),'ambiguousAliases':ambiguous,'omitted':omitted},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'clubs':len(records),'ambiguousAliases':len(ambiguous),'omitted':len(omitted)}))
