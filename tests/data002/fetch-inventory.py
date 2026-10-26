"""Public source inventory for all available national CSV histories, 2021/22–2025/26."""
import argparse,concurrent.futures,hashlib,json,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path('/tmp/ta-data002-sources'));a=p.parse_args();a.output.mkdir(exist_ok=True)
urls=[(f'{c}_{y}.csv',f'https://www.football-data.co.uk/mmz4281/{str(y)[2:]}{str(y+1)[2:]}/{c}.csv') for c in ['I1','I2','E0','E1','E2','E3','D1','F1','F2','SP1','SP2','N1','P1','T1','B1'] for y in range(2021,2026)]
urls += [(c+'.csv',f'https://www.football-data.co.uk/new/{c}.csv') for c in ['ROU','DNK']]
def fetch(t):
 name,url=t
 try:
  with urllib.request.urlopen(url,timeout=25) as r:data=r.read();final=r.url
  if b'Date,' not in data[:500]:raise ValueError('unexpected non CSV schema')
  (a.output/name).write_bytes(data)
  print('OK',name,len(data),flush=True)
  return {'file':name,'url':url,'final_url':final,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'status':'downloaded'}
 except Exception as e:
  print('UNAVAILABLE',name,str(e),flush=True)
  return {'file':name,'url':url,'status':'unavailable','error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:manifest=list(pool.map(fetch,urls))
(a.output/'manifest.json').write_text(json.dumps(manifest,indent=2))
