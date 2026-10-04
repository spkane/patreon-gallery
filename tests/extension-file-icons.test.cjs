const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/file-icons.js'), 'utf8'), sandbox);
const { kindForName } = sandbox.GalleryFileIcons;

test('the file illustration uses the real filename extension, not the post title', () => {
  assert.equal(kindForName('Chapter 12.final.PDF').label, 'PDF');
  assert.equal(kindForName('Chapter 12.final.PDF').tone, 'pdf');
  assert.equal(kindForName('source-bundle.tar.gz').label, 'ZIP');
  assert.equal(kindForName('sheet.xlsx').tone, 'sheet');
  assert.equal(kindForName('unavailable').label, 'FILE');
});
