const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sandbox = { URL, URLSearchParams };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/feed.js'), 'utf8'), sandbox);
const feed = sandbox.PatreonGalleryFeed;

test('discovers only same-origin campaign post feeds from a signed-in tab', () => {
  const candidates = feed.discoverFeeds([
    'https://www.patreon.com/api/campaigns/15105167/posts?page%5Bcursor%5D=next&filter%5Bcontains_exclusive_posts%5D=true',
    'https://www.patreon.com/api/posts/170870330/conversations',
    'https://evil.example/api/campaigns/999/posts',
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].campaignId, '15105167');
  assert.equal(new URL(candidates[0].url).pathname, '/api/posts');
  assert.equal(new URL(candidates[0].url).searchParams.get('filter[campaign_id]'), '15105167');
  assert.equal(new URL(candidates[0].url).searchParams.get('sort'), '-published_at');
  assert.equal(new URL(candidates[0].url).searchParams.has('page[cursor]'), false);
});

test('discovers a campaign from a chronological archive request without a campaign-feed request', () => {
  const feeds = feed.discoverFeeds([
    'https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=15105167&sort=-published_at&page%5Bcursor%5D=older',
    'https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=15105167&sort=-published_at&page%5Bcursor%5D=more',
    'https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=15105167&filter%5Bcampaign_id%5D=999',
    'https://evil.example/api/posts?filter%5Bcampaign_id%5D=123',
  ]);
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].campaignId, '15105167');
  assert.equal(new URL(feeds[0].url).searchParams.get('page[cursor]'), null);
});

test('returns only viewable posts and safe preview and original URLs', () => {
  const posts = feed.normalizePage({ data: [
    { id: '42', type: 'post', attributes: { title: 'Subscriber strip', current_user_can_view: true,
      published_at: '2026-09-29T09:00:15Z', post_type: 'image_file',
      patreon_url: '/creator/posts/strip-42', is_preview_blurred: true,
      image: { large_url: 'https://c10.patreonusercontent.com/strip.jpg?token-time=123' },
      post_file: { url: 'https://c10.patreonusercontent.com/original.jpg?token-time=123' } } },
    { id: '43', type: 'post', attributes: { title: 'Locked', current_user_can_view: false,
      image: { url: 'https://c10.patreonusercontent.com/locked.jpg' } } },
    { id: '44', type: 'post', attributes: { title: '<script>bad</script>', current_user_can_view: true,
      post_type: 'text_only', attachments_preview_metadata: [{ file_name: 'sample.pdf' }],
      patreon_url: 'https://evil.example/steal', image: { url: 'https://evil.example/img' } } },
  ] });
  assert.equal(posts.length, 2);
  assert.equal(posts[0].previewMayBeBlurred, true);
  assert.equal(posts[0].url, 'https://www.patreon.com/creator/posts/strip-42');
  assert.equal(posts[0].previewUrl, 'https://c10.patreonusercontent.com/strip.jpg?token-time=123');
  assert.equal(posts[0].fullUrl, 'https://c10.patreonusercontent.com/original.jpg?token-time=123');
  assert.equal(posts[1].type, 'file');
  assert.equal(posts[1].previewUrl, null);
  assert.equal(posts[1].url, 'https://www.patreon.com/posts/44');
  assert.equal(posts[1].title, '<script>bad</script>'); // UI must use textContent.
});

test('accepts only the same campaign feed as a next page', () => {
  const path = '/api/campaigns/15105167/posts?page%5Bcursor%5D=cursor-2';
  assert.equal(feed.safeNextUrl('https://www.patreon.com' + path, '15105167'), 'https://www.patreon.com' + path);
  assert.equal(feed.safeNextUrl('https://evil.example' + path, '15105167'), null);
  assert.equal(feed.safeNextUrl('https://www.patreon.com/api/campaigns/999/posts?page%5Bcursor%5D=secret', '15105167'), null);
  assert.equal(feed.safeNextUrl('https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=15105167&page%5Bcursor%5D=second', '15105167'), 'https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=15105167&page%5Bcursor%5D=second');
  assert.equal(feed.safeNextUrl('https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=999&page%5Bcursor%5D=second', '15105167'), null);
  assert.equal(feed.safeNextUrl('https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=15105167&filter%5Bcampaign_id%5D=999&page%5Bcursor%5D=second', '15105167'), null);
  assert.equal(feed.safeNextUrl('https://www.patreon.com/api/posts/42/conversations?page%5Bcursor%5D=comments', '15105167'), null);
});

test('video detail provides only direct viewable playback and download media, not a preview clip', () => {
  const video = 'https://c10.patreonusercontent.com/video/full.mp4?expires=123';
  const download = 'https://c10.patreonusercontent.com/video/download.mp4?expires=123';
  const detail = feed.normalizeDetail({ data: { type: 'post', id: '55', attributes: {
    current_user_can_view: true, post_type: 'video_external_file', title: 'Video post',
    post_file: { url: video, download_url: download, name: 'full-video.mp4' },
    video_preview: { url: 'https://c10.patreonusercontent.com/preview.mp4' },
  } } }, '55');
  assert.equal(detail.assets.length, 1);
  assert.equal(detail.assets[0].type, 'video');
  assert.equal(detail.assets[0].displayUrl, video);
  assert.equal(detail.assets[0].downloadUrl, download);
  assert.equal(detail.assets[0].name, 'full-video.mp4');
  assert.equal(detail.assets.some((asset) => asset.displayUrl?.includes('preview.mp4')), false);
});

test('YouTube videos use a poster and watch link instead of an extension iframe that fails with error 153', () => {
  const attrs = { current_user_can_view: true, post_type: 'video_embed', title: 'Show',
    embed: { url: 'https://www.youtube.com/watch?v=AbCdEfGhI12&t=42',
      html: '<iframe src="https://evil.example/steal"></iframe>' } };
  const post = feed.normalizePage({ data: [{ type: 'post', id: '70', attributes: attrs }] })[0];
  assert.equal(post.type, 'video');
  assert.equal(post.previewUrl, 'https://i.ytimg.com/vi/AbCdEfGhI12/hqdefault.jpg');
  assert.equal(post.youtubeWatchUrl, 'https://www.youtube.com/watch?v=AbCdEfGhI12');
  const detail = feed.normalizeDetail({ data: { type: 'post', id: '70', attributes: attrs } }, '70');
  assert.equal(detail.embed.embedUrl, null);
  assert.equal(detail.embed.watchUrl, 'https://www.youtube.com/watch?v=AbCdEfGhI12');
  assert.equal(detail.assets.length, 0);
});

test('a viewable link post with a recognized video provider joins the video gallery', () => {
  const attrs = { current_user_can_view: true, post_type: 'link', embed: { url: 'https://youtu.be/AbCdEfGhI12' } };
  assert.equal(feed.normalizePage({ data: [{ type: 'post', id: '78', attributes: attrs }] })[0].type, 'video');
  assert.equal(feed.normalizePage({ data: [{ type: 'post', id: '79', attributes: {
    ...attrs, current_user_can_view: false } }] }).length, 0);
  const detail = feed.normalizeDetail({ data: { type: 'post', id: '78', attributes: attrs } }, '78');
  assert.equal(detail.embed.watchUrl, 'https://www.youtube.com/watch?v=AbCdEfGhI12');
});

test('unresolved link posts remain candidates for a YouTube URL export', () => {
  const page = feed.normalizePage({ data: [{ id: '55', type: 'post', attributes: {
    post_type: 'link', current_user_can_view: true, title: 'External video', published_at: '2026-01-01',
  } }] }, '123');
  assert.equal(page[0].type, 'post');
  assert.equal(page[0].possibleVideoLink, true);
  assert.equal(page[0].youtubeWatchUrl, null);
});

test('a viewable text post exposes both distinct YouTube links from its body without turning into a video post', () => {
  const attrs = { current_user_can_view: true, post_type: 'text_only', title: 'Two tutorials',
    content_json_string: JSON.stringify({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Tutorial: https://youtu.be/AbCdEfGhI12' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second tutorial: https://youtu.be/MnOpQrStU34' }] },
    ] }),
  };
  const post = feed.normalizePage({ data: [{ id: '80', type: 'post', attributes: attrs }] })[0];
  assert.equal(post.type, 'post');
  assert.deepEqual(Array.from(post.youtubeWatchUrls), [
    'https://www.youtube.com/watch?v=AbCdEfGhI12',
    'https://www.youtube.com/watch?v=MnOpQrStU34',
  ]);
  const detail = feed.normalizeDetail({ data: { id: '80', type: 'post', attributes: attrs } }, '80');
  assert.deepEqual(Array.from(detail.youtubeWatchUrls), Array.from(post.youtubeWatchUrls));
});

test('a thumbnail on a text-only post does not turn its card into an image viewer', () => {
  const post = feed.normalizePage({ data: [{ type: 'post', id: '80', attributes: {
    current_user_can_view: true, post_type: 'text_only',
    image: { large_url: 'https://c10.patreonusercontent.com/preview.jpg' },
    content_teaser_text: 'Watch https://youtu.be/AbCdEfGhI12',
  } }] })[0];
  assert.equal(post.type, 'post');
  assert.equal(post.previewUrl, 'https://c10.patreonusercontent.com/preview.jpg');
  assert.deepEqual(Array.from(post.youtubeWatchUrls), ['https://www.youtube.com/watch?v=AbCdEfGhI12']);
});

test('body hyperlinks, HTML links, and teaser duplicates export only canonical authorized YouTube URLs', () => {
  const attrs = { current_user_can_view: true, post_type: 'text_only',
    content_teaser_text: 'https://youtu.be/AbCdEfGhI12',
    content: '<a href="https://www.youtube.com/watch?v=MnOpQrStU34&amp;feature=share">Watch</a> https://www.youtube.com.evil.example/watch?v=AbCdEfGhI12',
    content_json_string: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Video one', marks: [{ type: 'link', attrs: { href: 'https://youtu.be/AbCdEfGhI12' } }] },
      { type: 'text', text: 'Video two', marks: [{ type: 'link', attrs: { href: 'https://youtu.be/MnOpQrStU34' } }] },
    ] }] }),
  };
  const page = feed.normalizePage({ data: [
    { type: 'post', id: '81', attributes: attrs },
    { type: 'post', id: '82', attributes: { ...attrs, current_user_can_view: false } },
  ] });
  assert.equal(page.length, 1);
  assert.deepEqual(Array.from(page[0].youtubeWatchUrls), [
    'https://www.youtube.com/watch?v=AbCdEfGhI12', 'https://www.youtube.com/watch?v=MnOpQrStU34',
  ]);
  assert.equal(feed.normalizeDetail({ data: { type: 'post', id: '82', attributes: { ...attrs, current_user_can_view: false } } }, '82'), null);
});

test('Vimeo unlisted embeds retain only their validated hash; other video links cannot iframe', () => {
  const vimeo = feed.normalizeDetail({ data: { type: 'post', id: '71', attributes: {
    current_user_can_view: true, post_type: 'video_embed', embed: {
      url: 'https://vimeo.com/123456789?h=Abc123def&autoplay=1',
      html: '<script>alert(1)</script>', thumbnail_url: 'https://i.vimeocdn.com/video/123_640.jpg',
    },
  } } }, '71');
  assert.equal(vimeo.embed.embedUrl, 'https://player.vimeo.com/video/123456789?h=Abc123def');
  assert.equal(vimeo.previewUrl, 'https://i.vimeocdn.com/video/123_640.jpg');
  const unknown = feed.normalizeDetail({ data: { type: 'post', id: '72', attributes: {
    current_user_can_view: true, post_type: 'video_embed', embed: { url: 'https://video.example/watch/1', html: '<iframe src="https://evil.example/"></iframe>' },
  } } }, '72');
  assert.equal(unknown.embed.embedUrl, null);
  assert.equal(unknown.embed.watchUrl, 'https://video.example/watch/1');
  const spoof = feed.normalizeDetail({ data: { type: 'post', id: '73', attributes: {
    current_user_can_view: true, post_type: 'video_embed', embed: { url: 'https://www.youtube.com.evil.example/watch?v=AbCdEfGhI12' },
  } } }, '73');
  assert.equal(spoof.embed.embedUrl, null);
  assert.equal(feed.normalizeDetail({ data: { type: 'post', id: '74', attributes: {
    current_user_can_view: true, post_type: 'video_embed', embed: { url: 'javascript:alert(1)' },
  } } }, '74').embed, null);
});

test('file preview metadata is a display-only image, never a download asset', () => {
  const attrs = { current_user_can_view: true, post_type: 'file',
    attachments_preview_metadata: [{ file_name: 'manual.pdf', image_url: 'https://c10.patreonusercontent.com/manual-cover.jpg' }],
  };
  const post = feed.normalizePage({ data: [{ id: '75', type: 'post', attributes: attrs }] })[0];
  const detail = feed.normalizeDetail({ data: { id: '75', type: 'post', attributes: attrs } }, '75');
  assert.equal(post.type, 'file');
  assert.deepEqual(Array.from(post.fileNames), ['manual.pdf']);
  assert.equal(post.previewUrl, attrs.attachments_preview_metadata[0].image_url);
  assert.equal(detail.previewUrl, post.previewUrl);
  assert.deepEqual(Array.from(detail.fileNames), ['manual.pdf']);
  assert.equal(detail.assets.length, 1);
  assert.equal(detail.assets[0].name, 'manual.pdf');
  assert.equal(detail.assets[0].downloadUrl, null);
});

test('a direct file post exposes its attached file rather than a thumbnail', () => {
  const record = { type: 'post', id: '66', attributes: { current_user_can_view: true, post_type: 'file',
    title: 'Template', post_file: { name: 'template.zip', download_url: 'https://www.patreon.com/file?h=abc' } } };
  assert.equal(feed.normalizePage({ data: [record] })[0].type, 'file');
  assert.deepEqual(Array.from(feed.normalizePage({ data: [record] })[0].fileNames), ['template.zip']);
  const detail = feed.normalizeDetail({ data: record }, '66');
  assert.equal(detail.assets.length, 1);
  assert.equal(detail.assets[0].name, 'template.zip');
  assert.deepEqual(Array.from(detail.fileNames), ['template.zip']);
  assert.equal(detail.assets[0].downloadUrl, 'https://www.patreon.com/file?h=abc');
});

test('PDF relationship resolves an included download URL, not a media ID or preview filename', () => {
  const payload = { data: { id: '44', type: 'post', attributes: {
    current_user_can_view: true, post_type: 'text_only', title: 'Design files',
    attachments_preview_metadata: [{ file_name: 'manual.pdf' }],
  }, relationships: { attachments_media: { data: [{ type: 'media', id: '123' }] } } },
  included: [
    { id: '123', type: 'media', attributes: { file_name: 'manual.pdf', mimetype: 'application/pdf', download_url: 'https://c10.patreonusercontent.com/files/manual.pdf?expires=123' } },
    { id: '999', type: 'media', attributes: { file_name: 'unrelated.pdf', download_url: 'https://c10.patreonusercontent.com/files/other.pdf' } },
  ] };
  const detail = feed.normalizeDetail(payload, '44');
  assert.equal(detail.assets.length, 1);
  assert.equal(detail.assets[0].type, 'file');
  assert.equal(detail.assets[0].name, 'manual.pdf');
  assert.equal(detail.assets[0].downloadUrl, payload.included[0].attributes.download_url);
  const withoutPreviewNames = { ...payload, data: { ...payload.data,
    attributes: { ...payload.data.attributes, attachments_preview_metadata: [] } } };
  assert.deepEqual(Array.from(feed.normalizeDetail(withoutPreviewNames, '44').fileNames), ['manual.pdf']);
  const withPoster = feed.normalizeDetail({ ...payload, included: [{ ...payload.included[0], attributes: {
    ...payload.included[0].attributes, image_urls: { default: 'https://c10.patreonusercontent.com/files/manual-preview.jpg' },
  } }] }, '44');
  assert.equal(withPoster.previewUrl, 'https://c10.patreonusercontent.com/files/manual-preview.jpg');
  assert.equal(withPoster.assets[0].previewUrl, withPoster.previewUrl);
  assert.equal(feed.normalizeDetail({ ...payload, included: [] }, '44').assets[0].downloadUrl, null);
  assert.equal(feed.normalizeDetail({ ...payload, included: [{ ...payload.included[0], attributes: {
    ...payload.included[0].attributes, download_url: 'https://evil.example/manual.pdf' } }] }, '44').assets[0].downloadUrl, null);
  assert.equal(feed.normalizeDetail({ ...payload, data: { ...payload.data, attributes: { ...payload.data.attributes, current_user_can_view: false } } }, '44'), null);
});

test('only a viewable image post supplies a full-resolution URL for the viewer', () => {
  const attrs = { title: 'Full strip', current_user_can_view: true, post_type: 'image_file',
    post_file: { url: 'https://c10.patreonusercontent.com/full/strip.jpg?token-time=123' },
    image: { large_url: 'https://c10.patreonusercontent.com/preview.jpg' },
    content_json_string: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The full strip.' }] }] }),
  };
  const detail = feed.normalizeDetail({ data: { id: '42', type: 'post', attributes: attrs } }, '42');
  assert.equal(detail.fullUrl, attrs.post_file.url);
  assert.equal(detail.description, 'The full strip.');
  assert.equal(feed.normalizeDetail({ data: { id: '42', type: 'post', attributes: { ...attrs, current_user_can_view: false } } }, '42'), null);
  assert.equal(feed.normalizeDetail({ data: { id: '42', type: 'post', attributes: { ...attrs, post_file: { url: 'https://evil.example/strip.jpg' } } } }, '42').fullUrl, null);
});
