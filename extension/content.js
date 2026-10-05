/* Runs inside the user's signed-in Patreon tab. Never reads cookie values. */
(() => {
  'use strict';

  const feed = globalThis.PatreonGalleryFeed;
  const state = new Map();
  const MAX_PAGES = 100;
  let attemptedVanity = null;

  function registerFeed(item) {
    if (item && !state.has(item.campaignId)) {
      state.set(item.campaignId, { firstUrl: item.url, nextUrl: item.url, pages: 0, seen: new Set() });
    }
  }

  async function findFeeds() {
    const resourceNames = performance.getEntriesByType('resource').map((entry) => entry.name);
    for (const item of feed.discoverFeeds(resourceNames)) registerFeed(item);
    if (!state.size) {
      // An already-open Posts tab may have no surviving performance feed entries.
      // Resolve only its validated public campaign vanity, without reading page cookies.
      const match = location.pathname.match(/^\/(?:(?:c|cw)\/([a-z0-9_-]{2,100})(?:\/posts)?|([a-z0-9_-]{2,100})\/posts)\/?$/i);
      const vanity = match?.[1] || match?.[2];
      if (vanity && vanity !== attemptedVanity) {
        if (/^\d+$/.test(vanity)) {
          registerFeed(feed.archiveForCampaign(vanity));
          attemptedVanity = vanity;
        } else {
          const url = new URL('/api/campaigns', 'https://www.patreon.com');
          url.searchParams.set('filter[vanity]', vanity);
          url.searchParams.set('fields[campaign]', 'name,vanity');
          const payload = await fetchJson(url.href);
          attemptedVanity = vanity;
          const campaign = payload.data?.find((item) => item.type === 'campaign' &&
            /^\d+$/.test(String(item.id)) &&
            item.attributes?.vanity?.toLowerCase() === vanity.toLowerCase());
          if (campaign) registerFeed(feed.archiveForCampaign(campaign.id));
        }
      }
    }
    return [...state.keys()].map((campaignId) => ({ campaignId }));
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        credentials: 'include', redirect: 'error',
        headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Patreon returned HTTP ${response.status}.`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadPage(campaignId, reset) {
    await findFeeds();
    const current = state.get(campaignId);
    if (!current) {
      throw new Error('No campaign feed request found. Reload the Patreon Posts tab, then retry.');
    }
    if (reset) {
      current.nextUrl = current.firstUrl;
      current.pages = 0;
      current.seen.clear();
    }
    if (!current.nextUrl || current.pages >= MAX_PAGES) {
      return { posts: [], hasMore: false, page: current.pages, limitReached: current.pages >= MAX_PAGES };
    }
    if (current.seen.has(current.nextUrl)) {
      throw new Error('Patreon repeated a feed page cursor. Stopping to avoid a loop.');
    }

    const target = current.nextUrl;
    const payload = await fetchJson(target);
    const posts = feed.normalizePage(payload);
    current.seen.add(target);
    current.pages += 1;
    let next = feed.safeNextUrl(payload.links?.next, campaignId);
    const cursor = payload.meta?.pagination?.cursors?.next;
    if (!next && typeof cursor === 'string' && cursor.length > 0 && cursor.length < 2000) {
      const fallback = new URL(target);
      fallback.searchParams.set('page[cursor]', cursor);
      next = feed.safeNextUrl(fallback.href, campaignId);
    }
    current.nextUrl = next && !current.seen.has(next) && current.pages < MAX_PAGES ? next : null;
    return {
      posts, received: payload.data.length, hasMore: Boolean(current.nextUrl), page: current.pages,
      limitReached: current.pages >= MAX_PAGES,
    };
  }

  async function loadDetail(campaignId, postId) {
    await findFeeds();
    if (!state.has(campaignId) || !/^\d+$/.test(postId)) throw new Error('Unknown campaign or post.');
    const url = new URL(`/api/posts/${postId}`, 'https://www.patreon.com');
    url.searchParams.set('fields[post]', 'title,content_json_string,content_teaser_text,current_user_can_view,post_type,post_file,image,thumbnail,embed,attachments_preview_metadata');
    url.searchParams.set('include', 'attachments_media,images,media');
    url.searchParams.set('json-api-version', '1.0');
    const detail = feed.normalizeDetail(await fetchJson(url.href), postId);
    if (!detail) throw new Error('Patreon did not provide viewable media for this post.');
    return { detail };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only our background worker brokers requests; reject tab/external contexts.
    if (sender.id !== chrome.runtime.id || sender.tab) return;
    if (message?.action === 'DISCOVER_FEEDS') {
      findFeeds().then((feeds) => sendResponse({ feeds }),
        (error) => sendResponse({ error: error.message || 'Could not find a campaign on this tab.' }));
      return true;
    }
    if (message?.action === 'LOAD_PAGE') {
      loadPage(String(message.campaignId), message.reset === true)
        .then(sendResponse, (error) => sendResponse({ error: error.message || 'Unable to read Patreon posts.' }));
      return true;
    }
    if (message?.action === 'LOAD_DETAIL') {
      loadDetail(String(message.campaignId), String(message.postId))
        .then(sendResponse, (error) => sendResponse({ error: error.message || 'Unable to load this post.' }));
      return true;
    }
  });
})();
