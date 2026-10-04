const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/navigation.js'), 'utf8'), sandbox);
const nav = sandbox.GalleryNavigation;
const posts = [
  { id: '30', date: '2026-09-30', type: 'image' },
  { id: '10', date: '2026-01-02', type: 'image' },
  { id: '8', date: '2026-01-02', type: 'image' },
  { id: '20', date: '2026-03-05', type: 'image' },
  { id: '15', date: '2026-02-04', type: 'file' },
];

test('navigation runs oldest to newest even when the card grid is newest first', () => {
  const images = nav.orderImages(posts);
  assert.deepEqual(Array.from(images, (post) => post.id), ['8', '10', '20', '30']);
  assert.equal(nav.adjacent(images, '10', 1)?.id, '20'); // Right = newer.
  assert.equal(nav.adjacent(images, '10', -1)?.id, '8'); // Left = older.
  assert.equal(nav.adjacent(images, '30', 1), null);
  assert.equal(nav.adjacent(images, 'missing', 1), null);
});

test('post start targets include text posts and choose the oldest unread post', () => {
  const items = nav.orderPosts([
    ...posts,
    { id: '5', date: '2025-12-31', type: 'post' },
    { id: '9', date: '2026-01-02', type: 'post' },
  ]);
  assert.deepEqual(Array.from(items, (post) => post.id), ['5', '8', '9', '10', '15', '20', '30']);
  assert.equal(nav.pick(items, 'oldest', () => false)?.id, '5');
  assert.equal(nav.pick(items, 'oldest-unread', (post) => ['5', '8'].includes(post.id))?.id, '9');
});

test('media gallery includes videos and files in chronological navigation', () => {
  const items = nav.orderMedia(posts);
  assert.deepEqual(Array.from(items, (post) => post.id), ['8', '10', '15', '20', '30']);
  assert.equal(nav.adjacent(items, '10', 1)?.id, '15');
});

test('oldest unread is the default, and jump targets honor reading state and date', () => {
  const images = nav.orderImages(posts);
  const viewed = (post) => ['8', '20'].includes(post.id);
  assert.equal(nav.pick(images, 'oldest-unread', viewed)?.id, '10');
  assert.equal(nav.pick(images, 'newest-unread', viewed)?.id, '30');
  assert.equal(nav.pick(images, 'oldest', viewed)?.id, '8');
  assert.equal(nav.pick(images, 'newest', viewed)?.id, '30');
  assert.equal(nav.pick(images, 'date', viewed, '2026-02-01')?.id, '20');
  assert.equal(nav.pick(images, 'date', viewed, '2026-12-31')?.id, '30');
  assert.equal(nav.pick(images, 'oldest-unread', () => true)?.id, '8');
  assert.equal(nav.pick(images, 'newest-unread', () => true)?.id, '30');
});
