const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../extension/gallery.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../extension/gallery.css'), 'utf8');

test('viewer status has its own row rather than overlaying file and YouTube Open actions', () => {
  assert.match(html, /id="viewerAssets"[^>]*><\/div>\s*<p id="viewerLoading"/);
  const statusStyle = css.match(/\.viewer-loading\{([^}]*)\}/)?.[1];
  assert.ok(statusStyle);
  assert.equal(statusStyle.includes('position:absolute'), false);
  assert.match(css, /\.viewer-stage\.has-file \.viewer-media-link span\{/);
});
