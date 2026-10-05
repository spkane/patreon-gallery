"""Public-site and documentation invariants; no network access or dependencies."""
from html.parser import HTMLParser
from pathlib import Path
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
        for url in page.urls:
            if url.startswith('#'):
                self.assertIn(url[1:], page.ids)
            elif not url.startswith('https://'):
                self.assertTrue((ROOT / 'site' / url).exists(), url)
        for file in (ROOT / 'site').rglob('*'):
            if file.is_file():
                self.assertIn(file.suffix, ['.html', '.css'])

    def test_release_docs_exist(self):
        for name in ['LICENSE', 'NOTICE', 'SECURITY.md', 'CHANGELOG.md',
                     'docs/PRIVACY.md', 'docs/ACCESS-RISKS.md', 'docs/RELEASE.md', 'docs/SECURITY-AUDIT.md']:
            self.assertTrue((ROOT / name).is_file(), name)
        self.assertIn('Apache License', (ROOT / 'LICENSE').read_text())


if __name__ == '__main__':
    unittest.main()
