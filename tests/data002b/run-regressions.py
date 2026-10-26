"""Preserve existing assertions; adapt filenames and the explicitly changed JSON UX."""
from pathlib import Path
import subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'tests/browser-regression.py').read_text()
changes=[('ROOT = Path(__file__).resolve().parents[1]',f'ROOT = Path({str(ROOT)!r})'),
 ('Trading_Analytics_v0.2U-rc1_TA-CSV-001.html','Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html'),
 ('r.H,r.A,r.h,r.a]),','r.o.ClubHomeRaw??r.H,r.o.ClubAwayRaw??r.A,r.h,r.a]),'),
 ('TA-CSV-001-candidate.png','TA-DATA-002B-compat.png'),
 ('assert download_json(legacy_page, \'#archiveExportBackup\')[\'records\'] == [legacy_record]',"""legacy_export = download_json(legacy_page, '#archiveExportBackup')['records']
        assert len(legacy_export) == 1
        assert legacy_export[0][:8] == legacy_record[:8]
        assert legacy_export[0][9:] == legacy_record[9:]
        assert all(legacy_export[0][8][k] == v for k, v in legacy_record[8].items())
        assert legacy_export[0][8]['ClubHomeId'] and legacy_export[0][8]['ClubAwayId']"""),
 ('page.wait_for_function("document.querySelector(\'#archiveStorageStatus\').textContent.includes(\'Backup ripristinato\')")',"""page.wait_for_function('!archiveBackupBusy && window.taLastMigration.safe')
        page.locator('#taRecoveryConfirm').evaluate('(el)=>el.click()')
        page.wait_for_function('!archiveBackupBusy && window.taLastMigration.status === "salvata"')"""),
 ('legacy_page.wait_for_function("document.querySelector(\'#archiveStorageStatus\').textContent.includes(\'Backup ripristinato\')")',"""legacy_page.wait_for_function('!archiveBackupBusy && window.taLastMigration.safe')
        legacy_page.locator('#taRecoveryConfirm').evaluate('(el)=>el.click()')
        legacy_page.wait_for_function('!archiveBackupBusy && window.taLastMigration.status === "salvata"')"""),
 ('page.wait_for_function("document.querySelector(\'#archiveStorageStatus\').textContent.includes(\'Ripristino non riuscito\')")',"page.wait_for_function('!archiveBackupBusy && window.taLastMigration.status === \"bloccata\"')")]
# The legacy-prefixed statement must be changed before the shorter matching substring.
changes[5],changes[6]=changes[6],changes[5]
for old,new in changes:
 assert old in source,old;source=source.replace(old,new)
source=source.replace("page.wait_for_function('!archiveBackupBusy && window.taLastMigration.safe')", """page.wait_for_function('!archiveBackupBusy && window.taLastMigration')
        if not page.evaluate('window.taLastMigration.safe'):
            Path('/tmp/ta-data002b-blocked.json').write_text(json.dumps(page.evaluate('window.taLastMigration')))
            raise AssertionError('Backup self-roundtrip was blocked; diagnostics in /tmp/ta-data002b-blocked.json')""",1)
script=Path('/tmp/ta-data002b-compat.py');script.write_text(source)
subprocess.run(['python',str(script),'--sources','/tmp/ta-csv-001-sources','--output',str(ROOT/'qa/data002b/csv-regression.json')],check=True)
(ROOT/'qa/data002b/compat-adaptations.json').write_text(json.dumps({'originalSHA256':hashlib.sha256((ROOT/'tests/browser-regression.py').read_bytes()).hexdigest(),'changes':['Candidate and output paths','Source names compared through preserved raw-name metadata','Legacy JSON permits identity metadata while checking every original field','JSON import now waits for the preview then explicitly clicks confirm; invalid import asserts blocked report instead of old status text','All match, season, goals, odds, counts and trade assertions retained']},indent=2))
