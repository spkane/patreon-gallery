const assert = require('node:assert/strict');
const { test } = require('node:test');
const manifest = require('../extension/manifest.json');
const fs = require('node:fs');
const path = require('node:path');

test('the extension permits Vimeo frames but never YouTube frames that fail with error 153', () => {
  const csp = manifest.content_security_policy.extension_pages;
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'self'/);
  assert.match(csp, /frame-src https:\/\/player\.vimeo\.com(?:;|$)/);
  assert.equal(csp.includes('youtube-nocookie.com'), false);
  assert.equal(csp.includes('https://*'), false);
  assert.equal(manifest.host_permissions.some((host) => host.includes('youtube') || host.includes('vimeo')), false);
  assert.equal(manifest.permissions.includes('downloads.open'), true);
  const html = fs.readFileSync(path.join(__dirname, '../extension/gallery.html'), 'utf8');
  const iframe = html.match(/<iframe id="viewerEmbed"[^>]*>/)?.[0];
  assert.ok(iframe, 'Vimeo player iframe is present');
  assert.match(iframe, /\ballow="[^"]*fullscreen(?:;|")/);
  assert.doesNotMatch(iframe, /\sallowfullscreen(?:\s|>|=)/i, 'do not declare fullscreen twice');
});
