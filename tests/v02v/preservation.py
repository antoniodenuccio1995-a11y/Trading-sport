"""The complete rc5 source tree is frozen; new entry is a documented derivation."""
from pathlib import Path
import hashlib,json,os,re,subprocess
R=Path(__file__).resolve().parents[2];BASE='bf2f0cc8558fa30ddecf1d969c1d84fba3a2da4a';files=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],cwd=R,text=True).splitlines()
# Generated legacy QA files are overwritten by test runs; all original app/test/docs/data immutable.
checked=[f for f in files if not f.startswith('qa/')]
for f in checked:assert (R/f).read_bytes()==subprocess.check_output(['git','show',BASE+':'+f],cwd=R),f
old=(R/'Trading_Analytics_v0.2U-rc5_TA-INT-004.html').read_text();new=(R/'Trading_Analytics_v0.2V-rc1_TA-V02V-001.html').read_text()
expected=old.replace('</head>','<link rel="stylesheet" href="ta-v02v.css"></head>').replace('v0.2U-rc5 · TA-INT-004 · CANDIDATA','v0.2V-rc1 · Match Center & Smart Analysis · CANDIDATA').replace('Candidata TA-INT-004 per collaudo indipendente.','Candidata TA-V02V-001 per collaudo indipendente.').replace("Provo a verificare il calendario online all'apertura.",'Aggiorna le fonti esplicitamente nell’Area tecnica.').replace('if(!snapshot)await archiveDbPut(archiveCompact(result));','// v0.2V: startup is read-only; saving or recovery requires an explicit user action.').replace('setTimeout(maybeAutoRefreshLeague,900);','// v0.2V: no automatic remote refresh; explicit update controls remain available.').replace('window.taAppInitialized=archiveInitialize().then(',"window.taAppInitialized=new Promise(resolve=>window.addEventListener('load',()=>resolve(archiveInitialize()),{once:true})).then(").replace('</body></html>','<script src="ta-v02v-engine.js"></script>\n<script src="ta-v02v-ui.js"></script>\n</body></html>')
assert expected==new,'Unexpected modification to protected inline source'
for script in re.findall(r'<script(?: [^>]*)?>(.*?)</script>',new,re.S):
 if script.strip():subprocess.run(['node','--check'],input=script,text=True,check=True)
for f in ['ta-v02v-ui.js','ta-v02v-engine.js']:subprocess.run(['node','--check',str(R/f)],check=True)
out=Path(os.environ.get('TA_V02V_OUT',R/'qa/v02v'));out.mkdir(parents=True,exist_ok=True);(out/'preservation.json').write_text(json.dumps({'outcome':'PASS','baseline':BASE,'frozenFiles':len(checked),'newHTMLOnlyWhitelistedChanges':True,'protectedFormulaTradeBacktestScannerStandingsUnchanged':True},indent=2)+'\n');print('PASS complete rc5 protected source preserved',len(checked))
