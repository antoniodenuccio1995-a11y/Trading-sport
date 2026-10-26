from pathlib import Path
import subprocess,hashlib,json,re
ROOT=Path(__file__).resolve().parents[2];BASE='fb0ad33ddff2e5494c1c3af02bf45042e37c0796'
old=ROOT/'Trading_Analytics_v0.2U-rc2_TA-DATA-002.html';new=ROOT/'Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html'
frozen=['Trading_Analytics_v0.2T_Recupero_Storici.html','Trading_Analytics_v0.2U-rc1_TA-CSV-001.html',old.name,'ta-csv-import.js','ta-csv-import-v02U-rc2.js','ta-clubs-v1.js']
hashes={}
for f in frozen:
 data=(ROOT/f).read_bytes();assert data==subprocess.check_output(['git','show',BASE+':'+f],cwd=ROOT);hashes[f]=hashlib.sha256(data).hexdigest()
a=old.read_text();b=new.read_text();formulas={}
for name in ['gradeMarket','scoreFromPrice','fraction','emptyScore','weightedHistorical','blendedRelative']:
 def block(s):
  start=s.index('function '+name+'(');end=s.index('\nfunction ',start+1);return s[start:end]
 assert block(a)==block(b),name;formulas[name]=hashlib.sha256(block(b).encode()).hexdigest()
def journal(s):return s[s.index("const JOURNAL_DB="):s.index('</script>',s.index('const JOURNAL_DB='))]
assert journal(a)==journal(b),'Trade persistence, accounting and grading changed'
scripts=re.findall(r'<script>(.*?)</script>',b,re.S)
for s in scripts:subprocess.run(['node','--check'],input=s,text=True,check=True)
for f in ['ta-clubs-v2.js','ta-json-recovery.js','ta-data002b-ui.js']:subprocess.run(['node','--check',str(ROOT/f)],check=True)
out={'outcome':'PASS','baseline':BASE,'frozenFilesSHA256':hashes,'formulaSHA256':formulas,'journalCodeUnchanged':True,'inlineSyntaxChecks':len(scripts),'externalSyntaxChecks':3}
(ROOT/'qa/data002b/preservation.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
