"""Public-site and documentation invariants; no network access or dependencies."""
from html.parser import HTMLParser
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.ids = set()
        self.tags = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        self.tags.append(tag)
        if 'id' in data:
            self.ids.add(data['id'])
        for key in ['href', 'src']:
            if key in data:
                self.urls.append(data[key])


class SiteTests(unittest.TestCase):
    def test_static_site_links_and_no_scripts(self):
        page = Links()
        page.feed((ROOT / 'site/index.html').read_text())
        self.assertNotIn('script', page.tags)
        self.assertNotIn('form', page.tags)
        # Pages includes the same screenshot assets used by the README.
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory) / 'site'
            shutil.copytree(ROOT / 'site', site)
            shutil.copytree(ROOT / 'docs/screenshots', site / 'screenshots', dirs_exist_ok=True)
            for url in page.urls:
                if url.startswith('#'):
                    self.assertIn(url[1:], page.ids)
                elif not url.startswith('https://'):
                    self.assertTrue((site / url).exists(), url)
            for file in site.rglob('*'):
                if file.is_file():
                    self.assertIn(file.suffix, ['.html', '.css', '.png'])
                    if file.suffix == '.png':
                        self.assertEqual(file.read_bytes()[:8], b'\x89PNG\r\n\x1a\n', str(file))

    def test_readme_screenshots_are_present(self):
        import re
        readme = (ROOT / 'README.md').read_text()
        images = re.findall(r'!\[[^\]]+\]\((docs/screenshots/[^)]+)\)', readme)
        self.assertEqual(len(images), 4)
        for name in images:
            self.assertEqual((ROOT / name).read_bytes()[:8], b'\x89PNG\r\n\x1a\n', name)
        self.assertIn('synthetic posts', readme)
        self.assertIn('manifest.json', readme)
        self.assertIn('Code → Download ZIP', readme)

    def test_release_docs_exist(self):
        for name in ['LICENSE', 'NOTICE', 'SECURITY.md', 'CHANGELOG.md',
                     'docs/PRIVACY.md', 'docs/ACCESS-RISKS.md', 'docs/RELEASE.md', 'docs/SECURITY-AUDIT.md']:
            self.assertTrue((ROOT / name).is_file(), name)
        self.assertIn('Apache License', (ROOT / 'LICENSE').read_text())


if __name__ == '__main__':
    unittest.main()
