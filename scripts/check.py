#!/usr/bin/env python3
"""Run release checks. Requires Node.js 22+ and Python 3.10+."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from package import build, FILES


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


run('node', '--test', *map(str, sorted((ROOT / 'tests').glob('extension-*.test.cjs'))))
run(sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-q')
for file in sorted((ROOT / 'extension').glob('*.js')):
    run('node', '--check', str(file))
manifest = json.loads((ROOT / 'extension/manifest.json').read_text())
assert manifest['manifest_version'] == 3
assert manifest['host_permissions'] == ['https://www.patreon.com/*']
assert set(manifest['permissions']) == {'scripting', 'downloads', 'downloads.open'}
with tempfile.TemporaryDirectory() as directory:
    a = build(Path(directory) / 'a.zip')
    b = build(Path(directory) / 'b.zip')
    assert hashlib.sha256(a.read_bytes()).digest() == hashlib.sha256(b.read_bytes()).digest()
    with zipfile.ZipFile(a) as archive:
        assert set(archive.namelist()) == set(FILES + ['LICENSE', 'NOTICE'])
        assert archive.testzip() is None
        assert json.loads(archive.read('manifest.json')) == manifest
print('PASS: tests, JavaScript syntax, permission contract, allowlist and reproducible ZIP')
