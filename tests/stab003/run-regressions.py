from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[2]
s=(ROOT/'tests/data002b/run-regressions.py').read_text().replace('ROOT=Path(__file__).resolve().parents[2]',f'ROOT=Path({str(ROOT)!r})').replace('Trading_Analytics_v0.2U-rc3_TA-DATA-002B.html','Trading_Analytics_v0.2U-rc4_TA-STAB-003.html').replace('qa/data002b/','qa/stab003/').replace('TA-DATA-002B-compat.png','TA-STAB-003-compat.png')
old="    go_data(page)\n    if manual:"
new="    go_data(page)\n    page.locator('#taRLeagueCard').evaluate('(el)=>el.open=true')\n    if manual:"
adapt="source=source.replace("+repr(old)+","+repr(new)+")\n"
adapt+="source=source.replace("+repr("r.o.ClubHomeRaw??r.H,r.o.ClubAwayRaw??r.A")+","+repr("r.o.HistOriginalHome??r.o.ClubHomeRaw??r.H,r.o.HistOriginalAway??r.o.ClubAwayRaw??r.A")+")\n"
s=s.replace("script=Path('/tmp/ta-data002b-compat.py');script.write_text(source)","source=source.replace(\"'1 risultati discordanti'\",\"'1 risultati o dati discordanti'\")\n"+adapt+"script=Path('/tmp/ta-stab003-compat.py');script.write_text(source)")
s=s.replace("script=Path('/tmp/ta-stab003-compat.py');script.write_text(source)","source=source.replace("+repr("page.wait_for_function('!archiveBackupBusy && window.taLastMigration')")+","+repr("page.wait_for_function('!archiveBackupBusy && window.taLastMigration', timeout=60000)")+")\nsource=source.replace("+repr("def ready(page):\n")+","+repr("def ready(page):\n    page.evaluate('window.taStabAreaReady')\n")+")\nscript=Path('/tmp/ta-stab003-compat.py');script.write_text(source)")
p=Path('/tmp/ta-stab003-run-regressions.py');p.write_text(s);subprocess.run(['python',str(p)],check=True)
