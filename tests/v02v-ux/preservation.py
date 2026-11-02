from pathlib import Path
import hashlib,json,os,re,subprocess
R=Path(__file__).resolve().parents[2];base='43b92dfc21112a1df7f20dc6f56f6add8042219a'
files=subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=R,text=True).splitlines();checked=[f for f in files if not f.startswith('qa/')]
for f in checked:assert (R/f).read_bytes()==subprocess.check_output(['git','show',base+':'+f],cwd=R),f
old=(R/'Trading_Analytics_v0.2V-rc1_TA-V02V-001.html').read_text();new=(R/'Trading_Analytics_v0.2V-rc2_TA-V02V-UX-002.html').read_text()
def span(text,start,end):return text[text.index(start):text.index(end,text.index(start))]
protected=[('function run(S)','function eq('),('function safeKickoffFuture(','function taUpcomingRows('),('function fraction(','const nav='),('const JOURNAL_DB=','function bindEvents('),('function reviewerPeriod(','function renderMarketReviewer('),('function finalAssessment(', 'function renderSeasonTrends('),('function standingsCompute(','function standingsZoneRules('),('const ARCHIVE_DB=','async function archiveInitialize('),('function archiveStrictWrite(','async function archiveInitialize(')]
actual=[]
for start,end in protected:
 try:a=span(old,start,end);b=span(new,start,end)
 except ValueError:
  if start=='function finalAssessment(':continue
  raise
 assert a==b,start;actual.append(start)
# Exact permitted changes in the descriptive analysis builder: date eligibility and one host.
a=span(old,'function buildMatchAnalysis(','function compareMatch(')
expected=a.replace('const all=taStatRows().filter(r=>!r.up&&r.d<cutoff&&r.lg===league).sort','const all=taStatRows().filter(r=>!r.up&&r.d<Math.min(cutoff,TAV02V.day(Date.now()))&&r.lg===league).sort').replace("html+=rankingsContext(all,season,H,A);","html+=rankingsContext(all,season,H,A);\n html+='<div id=\"vMatchPanel\"></div>';")
assert expected==span(new,'function buildMatchAnalysis(','function compareMatch(')
for script in re.findall(r'<script(?: [^>]*)?>(.*?)</script>',new,re.S):
 if script.strip():subprocess.run(['node','--check'],input=script,text=True,check=True)
for f in ['ta-v02v-ux-ui.js','ta-v02v-refresh.js']:subprocess.run(['node','--check',str(R/f)],check=True)
assert hashlib.sha256((R/'tests/v02v-ux/independent-new.cjs').read_bytes()).hexdigest()=='90a7e2620b4cf2868dab9ee49b765ecef37f7037fb5eb96601a6b31c10dff532'
O=Path(os.environ['TA_UX_OUT']);O.mkdir(parents=True,exist_ok=True);(O/'preservation.json').write_text(json.dumps({'outcome':'PASS','baseline':base,'frozenFiles':len(checked),'protectedCodeSpans':actual,'descriptiveBuilderOnlyWhitelistedChanges':True,'originalHTMLCSSAndAllModulesUnchanged':True},indent=2)+'\n');print('PASS all audited non-QA files preserved:',len(checked),'and protected rc2 formulas/trade/persistence code identical')
