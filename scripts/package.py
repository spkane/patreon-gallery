#!/usr/bin/env python3
"""Build a reproducible, allowlisted extension ZIP with manifest.json at root."""
import argparse
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ['manifest.json', 'background.js', 'content.js', 'feed.js', 'downloads.js',
         'file-icons.js', 'navigation.js', 'gallery.js', 'gallery.html', 'gallery.css',
         'assets/patreon-gallery-icon.png']


def build(output=None):
    version = json.loads((ROOT / 'extension/manifest.json').read_text())['version']
    output = Path(output) if output else ROOT / 'dist' / f'gallery-scout-{version}.zip'
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(FILES):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (ROOT / 'extension' / name).read_bytes())
        for name in ['LICENSE', 'NOTICE']:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (ROOT / name).read_bytes())
    print(output)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    build(parser.parse_args().output)
