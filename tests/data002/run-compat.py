"""Run the complete TA-CSV-001 browser suite on rc2, with explicit metadata extension adaptation."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[2]
source=(root/'tests/browser-regression.py').read_text()
replacements=[("ROOT = Path(__file__).resolve().parents[1]",'ROOT = Path('+repr(str(root))+')'),
 ('Trading_Analytics_v0.2U-rc1_TA-CSV-001.html','Trading_Analytics_v0.2U-rc2_TA-DATA-002.html'),
 ("r.H,r.A,r.h,r.a]),", "r.o.ClubHomeRaw??r.H,r.o.ClubAwayRaw??r.A,r.h,r.a]),"),
 ("assert download_json(legacy_page, '#archiveExportBackup')['records'] == [legacy_record]", """legacy_export = download_json(legacy_page, '#archiveExportBackup')['records']
        assert len(legacy_export) == 1
        assert legacy_export[0][:8] == legacy_record[:8]
        assert legacy_export[0][9:] == legacy_record[9:]
        assert all(legacy_export[0][8][k] == v for k, v in legacy_record[8].items())
        assert legacy_export[0][8]['ClubHomeId'] and legacy_export[0][8]['ClubAwayId']"""),
 ('TA-CSV-001-candidate.png','TA-DATA-002-compat.png')]
for old,new in replacements:
 assert old in source,old
 source=source.replace(old,new)
script=Path('/tmp/ta-data002-browser-compat.py');script.write_text(source)
out=root/'qa/data002/csv-regression.json'
subprocess.run(['python',str(script),'--sources','/tmp/ta-csv-001-sources','--output',str(out)],check=True)
(root/'qa/data002/compat-adaptations.json').write_text(json.dumps({'original_script_sha256':hashlib.sha256((root/'tests/browser-regression.py').read_bytes()).hexdigest(),'changes':['repository path','candidate filename','output screenshot filename','match source denominations compared through preserved ClubHomeRaw/ClubAwayRaw, since canonical display names intentionally change','legacy compact comparison permits added Club* identity metadata but asserts all original fields unchanged']},indent=2))
