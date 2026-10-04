const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/downloads.js'), 'utf8'), sandbox);
const plan = sandbox.GalleryDownloads;

test('names downloads within the campaign folder without traversal or signed URLs', () => {
  const filename = plan.filename('15105167', { id: '42', date: '2026-09-30', title: '../A comic <script>' },
    { name: '../../strip.jpg', type: 'image', downloadUrl: 'https://c10.patreonusercontent.com/strip.jpg?secret=123' }, 1);
  assert.match(filename, /^Gallery Scout\/15105167\/2026-09-30_42_1_/);
  assert.match(filename, /strip\.jpg$/);
  assert.equal(filename.includes('..'), false);
  assert.equal(filename.includes('secret'), false);
  assert.match(plan.filename('15105167', { id: '42', date: '2026-09-30' },
    { name: `${'a'.repeat(120)}.pdf`, type: 'file' }, 2), /\.pdf$/);
});

test('exports only canonical YouTube watch URLs as a yt-dlp batch list', () => {
  const result = plan.youtubeBatchText([
    'https://www.youtube.com/watch?v=AbCdEfGhI12',
    'https://www.youtube.com/watch?v=AbCdEfGhI12',
    'https://evil.example/watch?v=AbCdEfGhI12',
    'https://www.youtube.com/watch?v=AbCdEfGhI12&token=secret',
    'https://www.youtube.com/watch?v=12345678901',
  ]);
  assert.equal(result, 'https://www.youtube.com/watch?v=AbCdEfGhI12\nhttps://www.youtube.com/watch?v=12345678901\n');
});

test('opens only browser-safe file types inline; other files require a downloaded-file action', () => {
  for (const name of ['manual.pdf', 'notes.txt', 'comic.png', 'clip.mp4']) {
    assert.equal(plan.browserViewable(name), true, name);
  }
  for (const name of ['archive.zip', 'source.blend', 'page.html', 'vector.svg', 'script.js']) {
    assert.equal(plan.browserViewable(name), false, name);
  }
});

test('YouTube export can select text posts without adding them to direct-media batch downloads', () => {
  const posts = [{ id: '1', date: '2026-01-01', title: 'Two video links', type: 'post' }];
  const options = { scope: 'current', type: 'post' };
  assert.deepEqual(Array.from(plan.select(posts, options, () => false)), []);
  assert.deepEqual(Array.from(plan.select(posts, options, () => false, true), (post) => post.id), ['1']);
});

test('current filters and unread/date scopes select only intended media posts', () => {
  const posts = [
    { id: '1', date: '2026-01-01', title: 'Early strip', type: 'image' },
    { id: '2', date: '2026-05-01', title: 'Middle clip', type: 'video' },
    { id: '3', date: '2026-09-01', title: 'Latest PDF', type: 'file' },
    { id: '4', date: '2026-06-01', title: 'No media', type: 'post' },
  ];
  const viewed = (post) => post.id === '2';
  assert.deepEqual(Array.from(plan.select(posts, { scope: 'unread' }, viewed), (post) => post.id), ['1', '3']);
  assert.deepEqual(Array.from(plan.select(posts, { scope: 'dates', from: '2026-03-01', to: '2026-09-01' }, viewed), (post) => post.id), ['2', '3']);
  assert.deepEqual(Array.from(plan.select(posts, { scope: 'current', search: 'clip', type: 'video', view: 'viewed' }, viewed), (post) => post.id), ['2']);
});
