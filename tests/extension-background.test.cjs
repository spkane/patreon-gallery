const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

test('repairs a Patreon tab after extension reload by injecting bundled content scripts', async () => {
  let onMessage;
  let onClick;
  const injections = [];
  const opened = [];
  const downloads = [];
  const launched = [];
  const shown = [];
  let downloadState = 'complete';
  let rejectNativeOpen = false;
  let messages = 0;
  const sandbox = { URL, chrome: {
    runtime: {
      id: 'our-extension', getURL: (path) => `chrome-extension://our-extension/${path}`,
      onMessage: { addListener: (listener) => { onMessage = listener; } },
    },
    action: { onClicked: { addListener: (listener) => { onClick = listener; } } },
    tabs: {
      create: async (options) => { opened.push(options.url); },
      query: async () => [{ id: 17, url: 'https://www.patreon.com/c/Creator/posts', title: 'Creator Posts' }],
      sendMessage: async () => {
        messages++;
        if (messages === 1) throw new Error('Receiving end does not exist');
        return { feeds: [{ campaignId: '15105167' }] };
      },
    },
    scripting: { executeScript: async (request) => { injections.push(request); } },
    downloads: {
      download: async (options) => { downloads.push(options); return 42; },
      search: async ({ id }) => [{ id, state: downloadState, byExtensionId: id === 42 ? 'our-extension' : 'other-extension' }],
      open: async (id) => { if (rejectNativeOpen) throw new Error('user gesture required'); launched.push(id); },
      show: async (id) => { shown.push(id); },
    },
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8'), sandbox);
  assert.equal(typeof onClick, 'function');
  onClick({ id: 17, url: 'https://www.patreon.com/cw/Creator/posts' });
  assert.equal(new URL(opened[0]).searchParams.get('tabId'), '17');
  const response = await new Promise((resolve) => onMessage(
    { action: 'LIST_TABS', preferredTabId: 17 },
    { id: 'our-extension', url: 'chrome-extension://our-extension/gallery.html?tabId=17' }, resolve,
  ));
  assert.equal(response.tabs[0].feeds[0].campaignId, '15105167');
  assert.equal(messages, 2);
  assert.equal(injections.length, 1);
  assert.deepEqual(Array.from(injections[0].files), ['feed.js', 'content.js']);
  assert.equal(injections[0].target.tabId, 17);

  const sender = { id: 'our-extension', url: 'chrome-extension://our-extension/gallery.html' };
  const queue = (request) => new Promise((resolve) => onMessage(request, sender, resolve));
  const queued = await queue({ action: 'DOWNLOAD_ASSET',
    url: 'https://c10.patreonusercontent.com/files/manual.pdf?signature=secret',
    filename: 'Gallery Scout/15105167/2026-09-30-manual.pdf' });
  assert.equal(queued.downloadId, 42);
  assert.equal(queued.url, undefined); // Signed media URLs never appear in responses.
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].saveAs, false);
  const blockedHost = await queue({ action: 'DOWNLOAD_ASSET', url: 'https://evil.example/collect', filename: 'Gallery Scout/15105167/test.pdf' });
  const blockedPath = await queue({ action: 'DOWNLOAD_ASSET', url: 'https://c10.patreonusercontent.com/file.pdf', filename: '../escape.pdf' });
  assert.match(blockedHost.error, /download/i);
  assert.match(blockedPath.error, /filename/i);
  assert.equal(downloads.length, 1);
  const inline = await queue({ action: 'OPEN_ASSET', url: 'https://c10.patreonusercontent.com/manual.pdf',
    filename: 'Gallery Scout/15105167/manual.pdf' });
  assert.equal(inline.opened, true);
  assert.equal(opened.at(-1), 'https://c10.patreonusercontent.com/manual.pdf');
  const native = await queue({ action: 'OPEN_ASSET', url: 'https://c10.patreonusercontent.com/model.blend',
    filename: 'Gallery Scout/15105167/model.blend' });
  assert.equal(native.downloadId, 42);
  assert.equal(native.requiresOpen, true);
  assert.equal(launched.length, 0); // No auto-open without a later user gesture.
  const openedNative = await queue({ action: 'OPEN_DOWNLOADED', downloadId: 42 });
  assert.equal(openedNative.opened, true);
  assert.deepEqual(launched, [42]);
  downloadState = 'in_progress';
  assert.equal((await queue({ action: 'OPEN_DOWNLOADED', downloadId: 42 })).pending, true);
  downloadState = 'complete';
  assert.match((await queue({ action: 'OPEN_DOWNLOADED', downloadId: 43 })).error, /not created/i);
  rejectNativeOpen = true;
  assert.equal((await queue({ action: 'OPEN_DOWNLOADED', downloadId: 42 })).shown, true);
  assert.deepEqual(shown, [42]);
  assert.equal(downloads.length, 2);
  const unauthorized = onMessage({ action: 'DOWNLOAD_ASSET', url: 'https://c10.patreonusercontent.com/strip.jpg', filename: 'Gallery Scout/15105167/strip.jpg' },
    { id: 'website', url: 'https://www.patreon.com/' }, () => {});
  assert.equal(unauthorized, undefined);
  assert.equal(downloads.length, 2);
});
