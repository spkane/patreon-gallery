/* Pure, URL-free batch selection and safe relative Chrome Downloads filenames. */
(() => {
  'use strict';

  function component(value, maxLength = 64) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ._()-]/gi, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/\s+/g, ' ')
      .replace(/^[. -]+|[. ]+$/g, '')
      .slice(0, maxLength).replace(/[. ]+$/g, '') || 'media';
  }

  function filename(campaignId, post, asset, index) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(post.date) ? post.date : 'undated';
    const id = /^\d+$/.test(String(post.id)) ? post.id : 'post';
    const campaign = /^\d+$/.test(String(campaignId)) ? campaignId : 'campaign';
    const originalName = String(asset.name || post.title || '');
    const originalExtension = originalName.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
    let name = component(originalName, originalExtension ? 58 : 64);
    if (originalExtension && !name.toLowerCase().endsWith(`.${originalExtension}`)) {
      name = `${name.replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 58)}.${originalExtension}`;
    } else if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
      name += asset.type === 'image' ? '.jpg' : asset.type === 'video' ? '.mp4' : '.bin';
    }
    return `Gallery Scout/${campaign}/${date}_${id}_${Math.max(1, Number(index) || 1)}_${name}`;
  }

  function select(posts, options, wasViewed, includePosts = false) {
    return [...posts].filter((post) => {
      if (!['image', 'video', 'file'].includes(post.type) && !(includePosts && post.type === 'post')) return false;
      const scope = options.scope;
      if (scope === 'unread') return !wasViewed(post);
      if (scope === 'all') return true;
      const from = options.from || '';
      const to = options.to || '';
      if (from && post.date < from || to && post.date > to) return false;
      if (scope === 'dates') return true;
      if (scope !== 'current') return false;
      if (options.search && !post.title.toLowerCase().includes(options.search.trim().toLowerCase())) return false;
      if (options.type && options.type !== 'all' && post.type !== options.type) return false;
      if (options.view === 'viewed' && !wasViewed(post)) return false;
      if (options.view === 'unviewed' && wasViewed(post)) return false;
      return true;
    });
  }

  function browserViewable(name) {
    if (typeof name !== 'string') return false;
    return /\.(?:pdf|txt|md|json|csv|jpg|jpeg|png|gif|webp|bmp|avif|mp3|wav|ogg|mp4|webm)$/i.test(name);
  }

  function youtubeBatchText(urls) {
    const unique = new Set((urls || []).filter((value) =>
      typeof value === 'string' && /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(value)));
    return unique.size ? `${[...unique].join('\n')}\n` : '';
  }

  globalThis.GalleryDownloads = { filename, select, youtubeBatchText, browserViewable };
})();
