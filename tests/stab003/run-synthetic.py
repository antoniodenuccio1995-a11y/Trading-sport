"""Run rc3 regressions against rc4; preserve assertions and record UI/path adaptations."""
from pathlib import Path
import subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'tests/data002b/browser.py').read_text().replace("ROOT=Path(__file__).resolve().parents[2]",f'ROOT=Path({str(ROOT)!r})').replace("qa/data002b/browser.json","qa/stab003/synthetic-browser.json").replace('qa/data002b/recovery.png','qa/stab003/synthetic-recovery.png')
for old,new in [('Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html','Trading_Analytics_v0.2U-rc4_TA-STAB-003.html'),('ta-clubs-v2.js','ta-clubs-v3.js'),('ta-json-recovery.js','ta-json-recovery-rc4.js'),('ta-data002b-ui.js','ta-stab003-ui.js'),('ta-csv-import-v02U-rc2.js','ta-csv-import-v02U-rc4.js')]:source=source.replace(old,new)
source=source.replace("p.evaluate('window.taRecoveryUIReady')","p.evaluate('window.taStabAreaReady')")
script=Path('/tmp/ta-stab003-synthetic.py');script.write_text(source)
subprocess.run(['python',str(script)],check=True)
(ROOT/'qa/stab003/synthetic-adaptations.json').write_text(json.dumps({'baselineScriptSHA256':hashlib.sha256((ROOT/'tests/data002b/browser.py').read_bytes()).hexdigest(),'adaptations':['Candidate, module and output paths','Wait for independent Area tecnica panels before interaction'],'assertionsRetained':True},indent=2)+'\n')
