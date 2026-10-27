"""Parse the published football.txt score grammar, keeping 90-minute FT distinct from ET/pens."""
import re,datetime
MONTHS={v:i+1 for i,v in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])}
def parse_text(text,year):
 result=[];issues=[];date=None;phase='regular';expected=None
 for lineno,line in enumerate(text.splitlines(),1):
  line=line.strip()
  m=re.match(r'# Matches\s+(\d+)',line)
  if m:expected=int(m[1])
  if line.startswith('▪'):
   phase=line.lstrip('▪ ').strip();continue
  m=re.match(r'(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?',line)
  if m:
   month=MONTHS.get(m[1]);day=int(m[2]);y=int(m[3]) if m[3] else year if month>=7 else year+1
   date=datetime.date(y,month,day).isoformat();continue
  if not date or not line or line.startswith(('#','=','▪')):continue
  body=re.sub(r'^\d{1,2}:\d{2}\s+','',line);home=away=None;tail=''
  if ' v ' in body:
   home,rest=body.split(' v ',1);m=re.search(r'\s+(\d+[-–]\d+)(?:\s|$)',rest)
   if m:away=rest[:m.start()].strip();tail=rest[m.start():].strip()
   else:away=re.split(r'\s+\[',rest)[0].strip()
  else:
   m=re.match(r'(.+?)\s+(\d+-\d+(?:\s+(?:a\.e\.t\.|pen\.))?(?:\s*\([^)]*\))?)\s+(.+)',body)
   if m:home,tail,away=m.groups()
  if not home or not away:continue
  # Remove explicit source country tags, retaining them separately.
  hc=re.search(r'\(([A-Z]{3})\)$',home);ac=re.search(r'\(([A-Z]{3})\)$',away)
  home=re.sub(r'\s+\([A-Z]{3}\)$','',home).strip();away=re.sub(r'\s+\([A-Z]{3}\)$','',away).strip()
  ft=ht=None;pairs=[list(map(int,x)) for x in re.findall(r'(\d+)[-–](\d+)',tail)]
  if pairs:
   if 'pen.' in tail:
    if len(pairs)>=4:ft,ht=pairs[2],pairs[3]
    else:issues.append({'line':lineno,'reason':'Penalty score without explicit 90-minute score; not imported as FT'})
   elif 'a.e.t.' in tail:
    if len(pairs)>=3:ft,ht=pairs[1],pairs[2]
    else:issues.append({'line':lineno,'reason':'Extra-time score without explicit 90-minute score; not imported as FT'})
   else:ft=pairs[0];ht=pairs[1] if len(pairs)>1 else None
  result.append({'date':date,'home':home,'away':away,'ft':ft,'ht':ht,'phase':phase,'scoreText':tail,'line':lineno,'homeCountry':hc[1] if hc else None,'awayCountry':ac[1] if ac else None})
 return {'matches':result,'issues':issues,'declaredMatches':expected}
