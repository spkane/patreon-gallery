/* Shared feed parsing for the Chrome content script. No credentials are read or stored. */
(function () {
  'use strict';

  const PATREON_ORIGIN = 'https://www.patreon.com';
  const campaignPath = /^\/api\/campaigns\/(\d+)\/posts\/?$/;

  function parsePatreonUrl(value) {
    try {
      const url = new URL(value, PATREON_ORIGIN);
      if (url.origin !== PATREON_ORIGIN || url.username || url.password || url.href.length > 10000) return null;
      return url;
    } catch {
      return null;
    }
  }

  function archiveForCampaign(campaignId) {
    if (!/^\d+$/.test(String(campaignId))) return null;
    const archive = new URL('/api/posts', PATREON_ORIGIN);
    archive.searchParams.set('filter[campaign_id]', String(campaignId));
    archive.searchParams.set('filter[contains_exclusive_posts]', 'true');
    archive.searchParams.set('filter[is_draft]', 'false');
    archive.searchParams.set('sort', '-published_at');
    archive.searchParams.set('page[count]', '20');
    archive.searchParams.set('json-api-version', '1.0');
    return { campaignId: String(campaignId), url: archive.href };
  }

  function discoverFeeds(resourceNames) {
    const seen = new Set();
    const feeds = [];
    for (const name of (resourceNames || []).slice(-500)) {
      const url = parsePatreonUrl(name);
      const match = url && url.pathname.match(campaignPath);
      const archiveIds = url?.pathname === '/api/posts' ? url.searchParams.getAll('filter[campaign_id]') : [];
      const campaignId = match?.[1] || (archiveIds.length === 1 && /^\d+$/.test(archiveIds[0]) ? archiveIds[0] : null);
      if (!campaignId || seen.has(campaignId)) continue;
      seen.add(campaignId);
      // The site's campaign feed can be a short, engagement-weighted carousel.
      // Use the signed-in website's chronological archive endpoint instead.
      feeds.push(archiveForCampaign(campaignId));
    }
    return feeds;
  }

  function safeNextUrl(value, campaignId) {
    const url = parsePatreonUrl(value);
    if (!url || !/^\d+$/.test(String(campaignId))) return null;
    const campaignFeed = url.pathname === `/api/campaigns/${campaignId}/posts`;
    const archiveFeed = url.pathname === '/api/posts' &&
      url.searchParams.getAll('filter[campaign_id]').length === 1 &&
      url.searchParams.get('filter[campaign_id]') === String(campaignId);
    if (!campaignFeed && !archiveFeed) return null;
    if (!url.searchParams.get('page[cursor]')) return null;
    return url.href;
  }

  function safePreviewUrl(value) {
    if (!value || typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (!/^(?:[a-z0-9-]+\.)?patreonusercontent\.com$/i.test(url.hostname)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function safeVideoPoster(value) {
    const patreon = safePreviewUrl(value);
    if (patreon) return patreon;
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 2048 &&
          ['i.ytimg.com', 'img.youtube.com', 'i.vimeocdn.com'].includes(url.hostname)) return url.href;
    } catch { /* invalid image URL */ }
    return null;
  }

  // Never parse provider-supplied HTML: only canonicalize explicitly recognized HTTPS video links.
  function videoEmbed(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    let url;
    try { url = new URL(value); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    let id = null;
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
      if (host === 'youtu.be') id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
      else if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) id = url.searchParams.get('v');
      else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return {
        // YouTube embeds in chrome-extension:// pages return player error 153 (no HTTP Referer).
        provider: 'YouTube', embedUrl: null,
        watchUrl: `https://www.youtube.com/watch?v=${id}`,
        previewUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const match = host === 'player.vimeo.com'
        ? url.pathname.match(/^\/video\/(\d{1,20})(?:\/([A-Za-z0-9]{6,64}))?\/?$/)
        : url.pathname.match(/^\/(\d{1,20})(?:\/([A-Za-z0-9]{6,64}))?\/?$/);
      if (match) {
        const hash = match[2] || (url.searchParams.getAll('h').length === 1 ? url.searchParams.get('h') : null);
        if (hash && !/^[A-Za-z0-9]{6,64}$/.test(hash)) return null;
        const suffix = hash ? `?h=${hash}` : '';
        return { provider: 'Vimeo', embedUrl: `https://player.vimeo.com/video/${match[1]}${suffix}`,
          watchUrl: `https://vimeo.com/${match[1]}${suffix}`, previewUrl: null };
      }
    }
    // Unrecognized providers are NEVER iframed; a clearly labelled link is user-initiated.
    return { provider: host, embedUrl: null, watchUrl: url.href, previewUrl: null };
  }

  // Only canonical watch URLs cross into the gallery; never pass through arbitrary body links.
  function youtubeLinksFromAttributes(attrs) {
    const urls = new Set();
    function scan(text) {
      if (typeof text !== 'string') return;
      const matches = text.slice(0, 100000).match(/https:\/\/[^\s<>"'\\]{1,2048}/g) || [];
      for (const candidate of matches.slice(0, 100)) {
        const embed = videoEmbed(candidate.replace(/[.,;!?)\]}]+$/g, ''));
        if (embed?.provider === 'YouTube') urls.add(embed.watchUrl);
        if (urls.size >= 30) return;
      }
    }
    scan(attrs.embed?.url);
    scan(attrs.content_teaser_text);
    scan(attrs.content);
    if (typeof attrs.content_json_string === 'string' && attrs.content_json_string.length <= 1000000) {
      try {
        const document = JSON.parse(attrs.content_json_string);
        let visited = 0;
        function visit(node, depth = 0) {
          if (!node || depth > 24 || ++visited > 2000 || urls.size >= 30) return;
          if (Array.isArray(node)) { for (const child of node.slice(0, 500)) visit(child, depth + 1); return; }
          if (typeof node !== 'object') return;
          scan(node.text);
          scan(node.attrs?.href);
          for (const mark of (Array.isArray(node.marks) ? node.marks : []).slice(0, 20)) scan(mark?.attrs?.href);
          visit(node.content, depth + 1);
        }
        visit(document);
      } catch { /* malformed rich-text content */ }
    }
    return [...urls];
  }

  function safePostUrl(value, id) {
    const url = parsePatreonUrl(value || `/posts/${id}`);
    if (url && url.pathname.includes('/posts/')) return url.href;
    return `${PATREON_ORIGIN}/posts/${id}`;
  }

  function fileNamesFromAttributes(attrs, includePostFile = true) {
    const candidates = includePostFile ? [attrs.post_file?.file_name || attrs.post_file?.name] : [];
    if (Array.isArray(attrs.attachments_preview_metadata)) {
      for (const item of attrs.attachments_preview_metadata.slice(0, 100)) {
        candidates.push(item?.file_name || item?.filename || item?.name);
      }
    }
    return [...new Set(candidates.filter((name) => typeof name === 'string' && name.trim() && name.length <= 500)
      .map((name) => name.trim()))];
  }

  function normalizePage(payload) {
    if (!Array.isArray(payload?.data)) throw new Error('Patreon did not return a post list.');
    return payload.data.filter((record) => {
      return record?.type === 'post' && /^\d+$/.test(String(record.id)) && record.attributes?.current_user_can_view === true;
    }).map((record) => {
      const attrs = record.attributes;
      const image = attrs.image || {};
      const thumbnail = attrs.thumbnail || {};
      const embed = videoEmbed(attrs.embed?.url);
      const previewUrl = safePreviewUrl(
        image.large_url || image.url || thumbnail.default_large || thumbnail.default || thumbnail.url ||
        attrs.attachments_preview_metadata?.[0]?.image_url || attrs.attachments_preview_metadata?.[0]?.thumbnail_url
      ) || safeVideoPoster(attrs.embed?.thumbnail_url) || embed?.previewUrl || null;
      const attachmentCount = Math.max(
        Array.isArray(attrs.attachments_preview_metadata) ? attrs.attachments_preview_metadata.length : 0,
        Array.isArray(record.relationships?.attachments_media?.data) ? record.relationships.attachments_media.data.length : 0,
      );
      const kind = String(attrs.post_type || '').toLowerCase();
      const youtubeWatchUrls = youtubeLinksFromAttributes(attrs);
      const type = kind.includes('video') || (kind === 'link' && (embed?.provider === 'YouTube' || embed?.embedUrl)) ? 'video' :
        kind.includes('image') ? 'image' : kind.includes('file') || attachmentCount ? 'file' :
        previewUrl && kind !== 'text_only' ? 'image' : 'post';
      return {
        id: String(record.id),
        title: String(attrs.title || `Post ${record.id}`),
        date: String(attrs.published_at || '').slice(0, 10),
        url: safePostUrl(attrs.patreon_url || attrs.url, record.id),
        previewUrl,
        youtubeWatchUrl: embed?.provider === 'YouTube' ? embed.watchUrl : null,
        youtubeWatchUrls,
        possibleVideoLink: kind === 'text_only' || kind === 'link' && !embed,
        fullUrl: kind.includes('image') ? safePreviewUrl(attrs.post_file?.url) : null,
        previewMayBeBlurred: attrs.is_preview_blurred === true,
        type,
        attachmentCount,
        fileNames: type === 'file' ? fileNamesFromAttributes(attrs) : [],
      };
    });
  }

  function plainDescription(attrs) {
    if (typeof attrs.content_json_string !== 'string') return String(attrs.content_teaser_text || '');
    try {
      const document = JSON.parse(attrs.content_json_string);
      const parts = [];
      let length = 0;
      function visit(node, depth = 0) {
        if (!node || typeof node !== 'object' || length > 2500 || depth > 24) return;
        if (node.type === 'text' && typeof node.text === 'string') {
          parts.push(node.text.slice(0, 2500 - length));
          length += node.text.length;
        }
        if (Array.isArray(node.content)) {
          for (const child of node.content.slice(0, 500)) visit(child, depth + 1);
          if (node.type === 'paragraph') parts.push('\n');
        }
      }
      visit(document);
      return parts.join('').trim().slice(0, 2500) || String(attrs.content_teaser_text || '');
    } catch {
      return String(attrs.content_teaser_text || '');
    }
  }

  function safeAssetUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 10000) return null;
      if (/^(?:[a-z0-9-]+\.)*patreonusercontent\.com$/i.test(url.hostname)) return url.href;
      if (url.origin === PATREON_ORIGIN && /^\/(?:file|media|api\/media)(?:\/|\?|$)/.test(url.pathname)) return url.href;
    } catch { /* no URL */ }
    return null;
  }

  function normalizeDetail(payload, postId) {
    const record = payload?.data;
    if (!record || record.type !== 'post' || String(record.id) !== String(postId) ||
        record.attributes?.current_user_can_view !== true) return null;
    const attrs = record.attributes;
    const image = attrs.image || {};
    const thumbnail = attrs.thumbnail || {};
    const kind = String(attrs.post_type || '').toLowerCase();
    const assets = [];
    const seen = new Set();
    function add(type, name, displayValue, downloadValue, id, previewValue) {
      const displayUrl = safeAssetUrl(displayValue);
      const downloadUrl = safeAssetUrl(downloadValue);
      if (!displayUrl && !downloadUrl) return;
      const key = downloadUrl || displayUrl;
      if (seen.has(key)) return;
      seen.add(key);
      assets.push({ id: String(id), type, name: String(name || `${type}-${postId}`),
        displayUrl, downloadUrl, previewUrl: safePreviewUrl(previewValue) });
    }

    const postFile = attrs.post_file || {};
    if (kind.includes('image')) {
      add('image', postFile.name || postFile.file_name || `${postId}.jpg`,
        postFile.url, postFile.download_url || postFile.url, `post:${postId}:image`);
    }
    if (kind.includes('video')) {
      const direct = safeAssetUrl(postFile.url);
      const downloadable = safeAssetUrl(postFile.download_url) ||
        (/\.(?:mp4|webm|mov)(?:\?|$)/i.test(direct || '') ? direct : null);
      add('video', postFile.name || postFile.file_name || `${postId}.mp4`,
        direct, downloadable, `post:${postId}:video`);
    } else if (kind.includes('file') && !kind.includes('image')) {
      const direct = postFile.download_url || postFile.url;
      add('file', postFile.name || postFile.file_name || `attachment-${postId}`,
        direct, direct, `post:${postId}:file`, postFile.image_urls?.default || postFile.thumbnail_url);
    }

    const fileNames = fileNamesFromAttributes(attrs, !kind.includes('image') && !kind.includes('video'));
    const included = new Map((Array.isArray(payload.included) ? payload.included : [])
      .filter((item) => item?.type === 'media' && /^\d+$/.test(String(item.id)))
      .map((item) => [String(item.id), item.attributes || {}]));
    for (const relation of ['images', 'attachments_media']) {
      const references = record.relationships?.[relation]?.data;
      if (!Array.isArray(references)) continue;
      for (const ref of references.slice(0, 100)) {
        if (ref?.type !== 'media') continue;
        const media = included.get(String(ref.id));
        if (!media) continue;
        if (relation === 'images') {
          if (String(postFile.media_id) === String(ref.id)) continue;
          const original = media.image_urls?.original || media.download_url;
          add('image', media.file_name || `${ref.id}.jpg`, original, media.download_url || original, `media:${ref.id}`);
        } else {
          if (typeof media.file_name === 'string' && media.file_name.trim() && media.file_name.length <= 500 &&
              !fileNames.includes(media.file_name.trim())) fileNames.push(media.file_name.trim());
          const url = media.download_url;
          add('file', media.file_name || `attachment-${ref.id}`, url, url, `media:${ref.id}`,
            media.image_urls?.default || media.image_urls?.large || media.thumbnail_url);
        }
      }
    }

    if (kind.includes('file') || fileNames.length || record.relationships?.attachments_media?.data?.length) {
      for (const [index, name] of fileNames.entries()) {
        if (assets.some((asset) => asset.type === 'file' && asset.name === name)) continue;
        const metadata = attrs.attachments_preview_metadata?.find((item) =>
          (item?.file_name || item?.filename || item?.name) === name);
        assets.push({ id: `preview:${postId}:${index}`, type: 'file', name,
          displayUrl: null, downloadUrl: null,
          previewUrl: safePreviewUrl(metadata?.image_url || metadata?.thumbnail_url) });
      }
    }
    const embed = videoEmbed(attrs.embed?.url || (!safeAssetUrl(postFile.url) && postFile.url));
    const firstAttachmentPreview = attrs.attachments_preview_metadata?.[0];
    const filePreview = assets.find((asset) => asset.type === 'file' && asset.previewUrl)?.previewUrl;
    return {
      fullUrl: assets.find((asset) => asset.type === 'image')?.displayUrl || null,
      previewUrl: safePreviewUrl(image.large_url || image.url || thumbnail.default_large || thumbnail.default ||
        firstAttachmentPreview?.image_url || firstAttachmentPreview?.thumbnail_url) ||
        filePreview || safeVideoPoster(attrs.embed?.thumbnail_url) || embed?.previewUrl || null,
      embed,
      youtubeWatchUrls: youtubeLinksFromAttributes(attrs),
      fileNames,
      description: plainDescription(attrs),
      assets,
    };
  }

  globalThis.PatreonGalleryFeed = { archiveForCampaign, discoverFeeds, safeNextUrl, safeAssetUrl, normalizePage, normalizeDetail };
})();
