"""Download only public Football-Data CSVs; TLS verification remains enabled."""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=Path('/tmp/ta-csv-001-sources'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
targets = [(f'{code}_{year}.csv', f'https://www.football-data.co.uk/mmz4281/{year}/{code}.csv')
           for code in ['P1', 'SP1', 'SP2', 'F1', 'F2', 'N1'] for year in ['2425', '2526']]
targets += [(code + '.csv', f'https://www.football-data.co.uk/new/{code}.csv') for code in ['ROU', 'DNK']]


def fetch(item):
    name, url = item
    with urllib.request.urlopen(url, timeout=30) as response:
        content, final_url = response.read(), response.url
    if b'Date,' not in content[:500]:
        raise ValueError(f'{name}: response is not the expected CSV')
    (args.output / name).write_bytes(content)
    print(name, len(content), flush=True)
    return {'file': name, 'url': url, 'final_url': final_url, 'bytes': len(content),
            'sha256': hashlib.sha256(content).hexdigest()}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    files = list(pool.map(fetch, targets))
(args.output / 'manifest.json').write_text(json.dumps({
    'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'files': files
}, indent=2))
