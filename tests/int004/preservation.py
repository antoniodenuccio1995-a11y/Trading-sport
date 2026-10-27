from pathlib import Path
import subprocess,hashlib,re,json
ROOT=Path(__file__).resolve().parents[2];BASE='242a15efae0ab64fd851335354c40c750d2d2e95'
old=(ROOT/'Trading_Analytics_v0.2U-rc4_TA-STAB-003.html').read_text();new=(ROOT/'Trading_Analytics_v0.2U-rc5_TA-INT-004.html').read_text();formula={}
for name in ['gradeMarket','scoreFromPrice','fraction','emptyScore','weightedHistorical','blendedRelative','standingsZoneRules']:
 def block(s):
  i=s.index('function '+name+'(');return s[i:s.index('\nfunction ',i+1)]
 assert block(old)==block(new),name;formula[name]=hashlib.sha256(block(new).encode()).hexdigest()
def journal(s):return s[s.index('const JOURNAL_DB='):s.index('</script>',s.index('const JOURNAL_DB='))]
assert journal(old)==journal(new)
for m in re.finditer(r'<script>(.*?)</script>',new,re.S):subprocess.run(['node','--check'],input=m[1],text=True,check=True)
modules=['ta-clubs-v4.js','ta-json-recovery-rc5.js','ta-csv-import-v02U-rc5.js','ta-fixture-identity.js','ta-history-coverage-rc5.js','ta-history-manifest-rc5.js',*map(lambda p:p.name,ROOT.glob('*int004*.js'))]
for f in set(modules):subprocess.run(['node','--check',str(ROOT/f)],check=True)
files=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],cwd=ROOT,text=True).splitlines()
for f in files:assert (ROOT/f).read_bytes()==subprocess.check_output(['git','show',BASE+':'+f],cwd=ROOT),f
(ROOT/'qa/int004/preservation.json').write_text(json.dumps({'outcome':'PASS','baseline':BASE,'frozenFiles':len(files),'formulaSHA256':formula,'journalUnchanged':True,'syntaxChecked':True},indent=2)+'\n');print('Preserved baseline files:',len(files))
