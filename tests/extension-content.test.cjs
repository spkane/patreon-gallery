const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function createContentScript(responses, options = {}) {
  const urls = [];
  let listener;
  const sandbox = {
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    location: { pathname: options.pathname || '/c/Creator/posts' },
    performance: { getEntriesByType: () => options.resources ?? [{ name: 'https://www.patreon.com/api/campaigns/15105167/posts?page%5Bcursor%5D=null&page%5Bcount%5D=6' }] },
    chrome: { runtime: { id: 'our-extension', onMessage: { addListener: (fn) => { listener = fn; } } } },
    fetch: async (url, options) => {
      urls.push({ url, options });
      return { ok: true, json: async () => responses.shift() };
    },
  };
  for (const file of ['feed.js', 'content.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8'), sandbox);
  }
  function message(request) {
    return new Promise((resolve) => listener(request, { id: 'our-extension' }, resolve));
  }
  return { message, urls, rejectedMessage: (sender) => listener({ action: 'DISCOVER_FEEDS' }, sender, () => { throw new Error('unexpected reply'); }) };
}

test('content script ignores external and tab senders without making requests', () => {
  const { rejectedMessage, urls } = createContentScript([]);
  assert.equal(rejectedMessage({ id: 'another-extension' }), undefined);
  assert.equal(rejectedMessage({ id: 'our-extension', tab: { id: 1 } }), undefined);
  assert.equal(urls.length, 0);
});

test('content script follows only its campaign feed cursor and returns viewable posts', async () => {
  const next = 'https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=15105167&page%5Bcursor%5D=second';
  const first = { data: [
    { id: '1', type: 'post', attributes: { title: 'Viewable', current_user_can_view: true } },
    { id: '2', type: 'post', attributes: { title: 'Locked', current_user_can_view: false } },
  ], links: { next } };
  const second = { data: [{ id: '3', type: 'post', attributes: { title: 'Page two', current_user_can_view: true } }], links: {} };
  const { message, urls } = createContentScript([first, second]);
  const discovery = await message({ action: 'DISCOVER_FEEDS' });
  assert.equal(discovery.feeds.length, 1);
  assert.equal(discovery.feeds[0].campaignId, '15105167');
  assert.equal(discovery.feeds[0].url, undefined); // Raw request URLs stay inside the content script.
  const page1 = await message({ action: 'LOAD_PAGE', campaignId: '15105167', reset: true });
  assert.equal(page1.posts.length, 1);
  assert.equal(page1.hasMore, true);
  const page2 = await message({ action: 'LOAD_PAGE', campaignId: '15105167' });
  assert.equal(page2.posts.length, 1);
  assert.equal(page2.posts[0].title, 'Page two');
  assert.equal(page2.hasMore, false);
  assert.equal(new URL(urls[0].url).pathname, '/api/posts');
  assert.equal(new URL(urls[0].url).searchParams.has('page[cursor]'), false);
  assert.equal(urls[1].url, next);
  assert.equal(urls[0].options.credentials, 'include');
});

test('loads the original image for one entitled post on demand', async () => {
  const detail = { data: { id: '42', type: 'post', attributes: {
    title: 'Strip', post_type: 'image_file', current_user_can_view: true,
    post_file: { url: 'https://c10.patreonusercontent.com/original.jpg?token-time=123' },
  } } };
  const { message, urls } = createContentScript([detail]);
  const response = await message({ action: 'LOAD_DETAIL', campaignId: '15105167', postId: '42' });
  assert.equal(response.detail.fullUrl, detail.data.attributes.post_file.url);
  assert.equal(new URL(urls[0].url).pathname, '/api/posts/42');
  assert.equal(new URL(urls[0].url).searchParams.get('include'), 'attachments_media,images,media');
  assert.match(new URL(urls[0].url).searchParams.get('fields[post]'), /(?:^|,)embed(?:,|$)/);
  assert.equal(urls[0].options.credentials, 'include');
});

test('uses only its own campaign when Patreon supplies a cursor without links.next', async () => {
  const { message, urls } = createContentScript([
    { data: [], meta: { pagination: { cursors: { next: 'second' } } } },
    { data: [], links: {} },
  ]);
  const first = await message({ action: 'LOAD_PAGE', campaignId: '15105167', reset: true });
  assert.equal(first.hasMore, true);
  const second = await message({ action: 'LOAD_PAGE', campaignId: '15105167' });
  assert.equal(second.hasMore, false);
  assert.equal(new URL(urls[1].url).searchParams.get('filter[campaign_id]'), '15105167');
  assert.equal(new URL(urls[1].url).searchParams.get('page[cursor]'), 'second');
});

test('discovers a Patreon Posts tab by its vanity when performance feed requests are missing', async () => {
  const campaigns = { data: [{ type: 'campaign', id: '15105167', attributes: { vanity: 'TheBloomCountyBoys' } }] };
  const page = { data: [{ id: '42', type: 'post', attributes: { title: 'Subscriber post', current_user_can_view: true } }], links: {} };
  const { message, urls } = createContentScript([campaigns, page], { resources: [], pathname: '/cw/TheBloomCountyBoys/posts' });
  const discovery = await message({ action: 'DISCOVER_FEEDS' });
  assert.equal(discovery.feeds[0].campaignId, '15105167');
  assert.equal(new URL(urls[0].url).searchParams.get('filter[vanity]'), 'TheBloomCountyBoys');
  const result = await message({ action: 'LOAD_PAGE', campaignId: '15105167', reset: true });
  assert.equal(result.posts[0].title, 'Subscriber post');
  assert.equal(new URL(urls[1].url).searchParams.get('filter[campaign_id]'), '15105167');
});

test('does not mistake a generic Patreon page for a campaign', async () => {
  const { message, urls } = createContentScript([], { resources: [], pathname: '/home' });
  const discovery = await message({ action: 'DISCOVER_FEEDS' });
  assert.equal(discovery.feeds.length, 0);
  assert.equal(urls.length, 0);
});

test('does not trust an unrelated campaign returned by a vanity lookup', async () => {
  const { message } = createContentScript([
    { data: [{ type: 'campaign', id: '999', attributes: { vanity: 'AnotherCreator' } }] },
  ], { resources: [], pathname: '/c/TheBloomCountyBoys/posts' });
  const discovery = await message({ action: 'DISCOVER_FEEDS' });
  assert.equal(discovery.feeds.length, 0);
});

test('content script rejects cross-origin next links', async () => {
  const { message } = createContentScript([{ data: [], links: { next: 'https://evil.example/steal?page%5Bcursor%5D=x' } }]);
  const page = await message({ action: 'LOAD_PAGE', campaignId: '15105167', reset: true });
  assert.equal(page.hasMore, false);
});
