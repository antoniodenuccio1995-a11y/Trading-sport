"""Real-source import matrix + isolated archive/trade regressions. No personal profiles."""
import argparse
import csv
import datetime as dt
import functools
import hashlib
import http.server
import io
import json
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--sources', type=Path, required=True)
parser.add_argument('--output', type=Path, default=ROOT / 'qa' / 'TA-CSV-001-browser.json')
parser.add_argument('--chromium', default='/usr/bin/chromium')
args = parser.parse_args()
CANDIDATE = 'Trading_Analytics_v0.2U-rc1_TA-CSV-001.html'
LEAGUES = {'ROU': 'SuperLiga Romania', 'DNK': 'Superliga Danimarca', 'P1': 'Primeira Liga',
           'SP1': 'La Liga', 'SP2': 'Segunda División', 'F1': 'Ligue 1', 'F2': 'Ligue 2', 'N1': 'Eredivisie'}
result = {'matrix': [], 'checks': [], 'pageerrors': []}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *unused):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/'


def read_source(code, year):
    name = code + '.csv' if code in ['ROU', 'DNK'] else f'{code}_{str(year)[2:]}{str(year+1)[2:]}.csv'
    raw = (args.sources / name).read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('cp1252')
    target = []
    for row in csv.DictReader(io.StringIO(text)):
        value = row.get('Date', '')
        date = None
        for fmt in ['%d/%m/%Y', '%d/%m/%y', '%Y-%m-%d']:
            try:
                date = dt.datetime.strptime(value, fmt).date()
                break
            except ValueError:
                pass
        if date is None:
            continue
        season = int(row['Season'].split('/')[0]) if row.get('Season') else date.year - (date.month < 7)
        if season != year:
            continue
        home, away = row.get('HomeTeam', row.get('Home', '')), row.get('AwayTeam', row.get('Away', ''))
        hg, ag = row.get('FTHG', row.get('HG', '')), row.get('FTAG', row.get('AG', ''))
        if not home or not away or not hg.isdecimal() or not ag.isdecimal():
            continue
        target.append({'date': date.isoformat(), 'home': home.strip(), 'away': away.strip(), 'hg': int(hg), 'ag': int(ag), 'row': row})
    assert target, (code, year)
    return name, raw, text, target


def go_data(page):
    if page.evaluate("document.body.dataset.workspace") == 'dati':
        return
    page.locator('.workspace-nav button[data-open-workspace="dati"]').click()


def ready(page):
    page.wait_for_function("document.querySelector('#archiveStorageMode').textContent.includes('IndexedDB')")


def queue(page, filename, content, league='', season='', manual=False):
    go_data(page)
    if manual:
        page.locator('#taTManualLeague').select_option(league)
        page.locator('#taTManualSeason').select_option(str(season))
        page.locator('#taTManualFiles').set_input_files({'name': filename, 'mimeType': 'text/csv', 'buffer': content})
        page.locator('#taTManualImport').click()
    else:
        if not page.locator('#taRHistoric').evaluate('(el)=>el.open'):
            page.locator('#taRHistoric > summary').click()
        page.locator('#smartHistoricFiles').set_input_files({'name': filename, 'mimeType': 'text/csv', 'buffer': content})
    page.wait_for_function("document.querySelector('#smartImportStatus').textContent.includes('file riconosciuti')")
    assert not page.locator('#smartFileList .is-error').count(), page.locator('#smartFileList').inner_text()


def confirm(page):
    page.locator('#smartImportConfirm').click()
    page.wait_for_function("document.querySelector('#smartImportStatus').textContent.startsWith('Importazione completata:')")
    return page.locator('#smartImportStatus').inner_text()


def download_json(page, selector):
    # Some controls live in hidden workspaces. DOM click still exercises the real handler.
    with page.expect_download() as download:
        page.locator(selector).evaluate('(el)=>el.click()')
    return json.loads(Path(download.value.path()).read_text())


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
        context = browser.new_context(accept_downloads=True)
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
        page = context.new_page()
        page.set_default_timeout(10000)
        page.on('pageerror', lambda error: result['pageerrors'].append(str(error)))
        response = page.goto(BASE + CANDIDATE)
        assert response.status == 200
        ready(page)
        for section in ['partite', 'analisi', 'classifiche', 'squadre', 'dati', 'strategie', 'validazione']:
            page.locator(f'.workspace-nav button[data-open-workspace="{section}"]').click()
            assert page.locator('#' + section).is_visible()
        result['checks'].append('Seven primary workspaces visible; HTTP 200; IndexedDB ready')

        # A single archive is incrementally populated: later imports must preserve earlier leagues.
        expected_total = 0
        for code, league in LEAGUES.items():
            for year in [2024, 2025]:
                source, raw, text, expected = read_source(code, year)
                manual = code in ['ROU', 'DNK'] or year == 2025
                # Neutral name proves the manual choice is used, not a filename heuristic.
                filename = 'normalizzato.csv' if manual else source
                queue(page, filename, raw, league=league, season=year, manual=manual)
                status = confirm(page)
                expected_total += len(expected)
                actual = page.evaluate('''([league,season])=>{
                  const s=standingsCompute(league,season),games=s.games;
                  return {count:games.length,total:rows.length,
                    goals:games.reduce((n,r)=>n+r.h+r.a,0),missingHT:games.filter(r=>r.ht===null).length,
                    identities:games.map(r=>[new Date(r.d).toISOString().slice(0,10),r.H,r.A,r.h,r.a]),
                    stats:leagueGoalProfile(games)};
                }''', [league, year])
                assert actual['count'] == len(expected), (code, year, actual, len(expected), status)
                assert actual['total'] == expected_total, (actual['total'], expected_total)
                assert actual['goals'] == sum(r['hg'] + r['ag'] for r in expected)
                identities = sorted([r['date'], r['home'], r['away'], r['hg'], r['ag']] for r in expected)
                assert sorted(actual['identities']) == identities, (code, year, 'Match identity/result mismatch')
                assert actual['stats']['n'] == len(expected)
                assert abs(actual['stats']['total'] - actual['goals'] / len(expected)) < 1e-10
                page.locator('.workspace-nav button[data-open-workspace="classifiche"]').click()
                page.locator('#standLeague').select_option(league)
                page.locator('#standSeason').select_option(str(year))
                assert str(len(expected)) in page.locator('#standStatus').inner_text()
                item = {'code': code, 'league': league, 'season': f'{year}/{year+1}', 'source': source,
                        'sha256': hashlib.sha256(raw).hexdigest(), 'source_played': len(expected),
                        'imported': actual['count'], 'goals': actual['goals'], 'missing_ht': actual['missingHT'],
                        'path': 'manual explicit league/season' if manual else 'guided metadata recognition', 'status': 'PASS'}
                result['matrix'].append(item)
                print('PASS', code, year, len(expected), flush=True)

        # Re-importing the same source cannot erase or duplicate another league/season.
        source, raw, text, expected = read_source('N1', 2025)
        queue(page, source, raw)
        duplicate_status = confirm(page)
        assert page.evaluate('rows.length') == expected_total
        assert 'già presenti' in duplicate_status
        result['checks'].append('Duplicate real CSV import keeps complete archive unchanged')

        # Invalid date, missing final/half-time scores, aliases and conflicting final results.
        csv_edge = b'Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HTHG,HTAG\nI1,12/08/2024,Inter Milan,Juventus,2,1,,\nI1,13/08/2024,Roma,Milan,,,,\nI1,31/02/2025,Napoli,Lazio,1,0,0,0\n'
        queue(page, 'I1_2425.csv', csv_edge)
        assert '1 incontri importabili' in page.locator('[data-csv-preview="0"]').inner_text()
        confirm(page)
        edge = page.evaluate("rows.filter(r=>r.lg==='Serie A')")
        assert len(edge) == 1 and edge[0]['H'] == 'Inter' and edge[0]['ht'] is None
        conflict = csv_edge.replace(b'Inter Milan,Juventus,2,1', b'Inter,Juventus,0,3')
        queue(page, 'I1_2425.csv', conflict)
        assert '1 risultati discordanti' in confirm(page)
        assert page.evaluate("rows.find(r=>r.lg==='Serie A').h") == 2
        expected_total += 1
        result['checks'].append('Team alias dedup, score conflict preservation, invalid date exclusion, missing FT/HT handling')

        # Known league contradictions block all writes, but the user can correct the choice.
        queue(page, 'normalizzato.csv', raw, league='Ligue 1', season=2025, manual=True)
        page.locator('#smartImportConfirm').click()
        page.wait_for_function("document.querySelector('#smartImportStatus').textContent.includes('conflitto')")
        assert page.evaluate('rows.length') == expected_total
        page.locator('[data-smart-league="0"]').select_option('Eredivisie')
        confirm(page)
        assert page.evaluate('rows.length') == expected_total
        result['checks'].append('Wrong manual league blocks writes; correcting selection allows safe re-import')

        # Exact utility field list; synthetic values because only the header was supplied.
        fields = (ROOT / 'tests/fixtures/utility-header.csv').read_text().strip().split(',')
        values = {'Div': 'UTILITY_UNKNOWN', 'Date': '12/08/2025', 'Time': '20:00',
                  'HomeTeam': 'QA Utility Home', 'AwayTeam': 'QA Utility Away', 'FTHG': '2', 'FTAG': '1',
                  'HTHG': '1', 'HTAG': '0', 'B365H': '2.25'}
        utility = (','.join(fields) + '\n' + ','.join(values.get(k, '') for k in fields)).encode()
        queue(page, 'normalizzato.csv', utility)
        assert page.locator('[data-smart-league="0"]').input_value() == ''
        page.locator('#smartImportConfirm').click()
        page.wait_for_function("document.querySelector('#smartImportStatus').textContent.includes('specifica il campionato')")
        assert page.evaluate('rows.length') == expected_total
        page.locator('[data-smart-league="0"]').select_option('SuperLiga Romania')
        page.locator('[data-smart-season="0"]').select_option('2025')
        confirm(page)
        assert page.evaluate("rows.find(r=>r.H==='QA Utility Home').o.B365H") == '2.25'
        expected_total += 1
        result['checks'].append('Exact 131-column utility header with synthetic row: unknown Div requires manual league; season and odds preserved')

        # Explicit season is metadata for grouping; it must survive JSON compact/restore.
        queue(page, 'neutral.csv', b'Date,HomeTeam,AwayTeam,FTHG,FTAG\n01/07/2025,QA Alpha,QA Beta,1,0\n', league='Eredivisie', season=2024, manual=True)
        page.locator('#smartImportConfirm').click()
        page.wait_for_function("document.querySelector('#smartImportStatus').textContent.includes('Conferma la discrepanza')")
        assert page.evaluate('rows.length') == expected_total
        page.locator('[data-smart-accept="0"]').check()
        confirm(page)
        assert page.evaluate("se(rows.find(r=>r.H==='QA Alpha'))") == 2024
        expected_total += 1
        backup = download_json(page, '#archiveExportBackup')
        assert len(backup['records']) == expected_total
        assert next(r for r in backup['records'] if r[2] == 'QA Alpha')[8]['CsvSeason'] == 2024
        page.reload(); ready(page)
        assert page.evaluate('rows.length') == expected_total
        page.on('dialog', lambda dialog: dialog.accept())
        go_data(page)
        page.locator('#archiveImportBackup').set_input_files({'name': 'qa.json', 'mimeType': 'application/json', 'buffer': json.dumps(backup).encode()})
        page.wait_for_function("document.querySelector('#archiveStorageStatus').textContent.includes('Backup ripristinato')")
        assert page.evaluate('rows.length') == expected_total
        assert page.evaluate("se(rows.find(r=>r.H==='QA Alpha'))") == 2024
        page.locator('#archiveImportBackup').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': b'{"records": []}'})
        page.wait_for_function("document.querySelector('#archiveStorageStatus').textContent.includes('Ripristino non riuscito')")
        assert page.evaluate('rows.length') == expected_total
        result['checks'].append('JSON export, persistence after reload, restore with season metadata, invalid backup leaves archive intact')

        # The existing trade journal is not seeded with personal data.
        trade = {'id': 'TA-CSV-001-SYNTHETIC', 'league': 'Eredivisie', 'H': 'QA Alpha', 'A': 'QA Beta',
                 'marketKey': 'o25', 'side': 'back', 'odds': 2.1, 'stake': 10, 'fee': 5,
                 'createdAt': '2026-10-26T10:00:00Z', 'd': 1751328000000, 'marketName': 'Over 2.5',
                 'kind': 'simulated', 'source': 'SYNTHETIC QA ONLY', 'observedAt': '2026-10-26T09:55:00Z',
                 'maxRisk': 10, 'risk': 10, 'operationScore': 45, 'managementScore': None,
                 'model': 'QA fixture - no real valuation', 'grade': {'score': 50, 'reason': 'Synthetic regression fixture'}, 'events': []}
        journal = {'format': 'TradingAnalyticsTradeJournal', 'version': 1, 'items': [trade], 'quotes': []}
        page.locator('#taImportTrades').set_input_files({'name': 'journal.json', 'mimeType': 'application/json', 'buffer': json.dumps(journal).encode()})
        page.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Importati e verificati 1 trade')")
        restored = download_json(page, '#taExportTrades')
        assert restored['items'] == [trade]
        page.locator('#taImportTrades').set_input_files({'name': 'journal.json', 'mimeType': 'application/json', 'buffer': json.dumps(journal).encode()})
        page.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Nessun trade')")
        invalid = dict(journal, items=[dict(trade, odds=0)])
        page.locator('#taImportTrades').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid).encode()})
        page.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('FALLITA')")
        assert download_json(page, '#taExportTrades')['items'] == [trade]
        page.locator('form[data-ta-close-id="TA-CSV-001-SYNTHETIC"]').evaluate('''form=>{
          form.elements.percent.value='50'; form.elements.pnl.value='1.25'; form.requestSubmit();
        }''')
        page.wait_for_function("document.querySelector('#taTradeMessage').textContent.includes('Chiusura 50% registrata')")
        closed = download_json(page, '#taExportTrades')['items'][0]
        assert len(closed['events']) == 1 and closed['events'][0]['pnl'] == 1.25
        assert closed['events'][0]['percent'] == 50 and closed['grade'] == trade['grade']
        assert closed['operationScore'] == trade['operationScore']
        page.reload(); ready(page)
        assert download_json(page, '#taExportTrades')['items'] == [closed]
        result['checks'].append('Synthetic trade journal import, duplicate suppression, invalid rejection, 50% close, frozen grade, export and IndexedDB persistence')

        legacy_context = browser.new_context(accept_downloads=True)
        legacy_context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
        legacy_page = legacy_context.new_page()
        legacy_page.on('pageerror', lambda error: result['pageerrors'].append(str(error)))
        legacy_page.on('dialog', lambda dialog: dialog.accept())
        legacy_page.goto(BASE + CANDIDATE); ready(legacy_page); go_data(legacy_page)
        # Exact original v2 compact shape, deliberately without the new season metadata.
        legacy_record = [1723420800000, 'Serie A', 'QA Legacy H', 'QA Legacy A', 1, 0, 0, 0, {'B365H': '2.1'}, 0, 0, None]
        legacy_backup = {'format': 'TradingAnalyticsBackup', 'version': 2, 'records': [legacy_record]}
        legacy_page.locator('#archiveImportBackup').set_input_files({'name': 'legacy-v02T.json', 'mimeType': 'application/json', 'buffer': json.dumps(legacy_backup).encode()})
        legacy_page.wait_for_function("document.querySelector('#archiveStorageStatus').textContent.includes('Backup ripristinato')")
        assert download_json(legacy_page, '#archiveExportBackup')['records'] == [legacy_record]
        assert legacy_page.evaluate('se(rows[0])') == 2024
        legacy_context.close()
        result['checks'].append('Original v0.2T compact JSON without CsvSeason restores and re-exports without data changes')

        file_context = browser.new_context()
        file_context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(ROOT.as_uri()) else route.abort())
        file_page = file_context.new_page()
        file_page.on('pageerror', lambda error: result['pageerrors'].append(str(error)))
        try:
            file_page.goto((ROOT / CANDIDATE).as_uri()); ready(file_page)
            assert file_page.evaluate("typeof TACsv.read") == 'function'
            result['checks'].append('Candidate also starts via file:// with its sibling JavaScript module and IndexedDB')
        except Exception as error:
            if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(error):
                raise
            result['limitations'] = ['Optional file:// startup blocked by Chromium administrator policy; HTTP workflow verified. No policy bypass attempted.']
        file_context.close()

        assert not result['pageerrors'], result['pageerrors']
        result['checks'].append('No uncaught JavaScript errors; all external network blocked during browser tests')
        result['total_real_matches'] = sum(x['imported'] for x in result['matrix'])
        result['total_archive_records'] = expected_total
        result['outcome'] = 'PASS'
        go_data(page)
        page.screenshot(path=str(args.output.parent / 'TA-CSV-001-candidate.png'), full_page=False)
        browser.close()
except Exception:
    result['outcome'] = 'FAIL'
    raise
finally:
    server.shutdown()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False))
print('PASS', len(result['matrix']), 'league/season cases;', len(result['checks']), 'regression checks', flush=True)
