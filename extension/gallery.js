/* Gallery Scout extension page. Only normalized, viewable post metadata crosses from a Patreon tab. */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const els = {
    findTabs: byId('findTabs'), membershipSelect: byId('membershipSelect'), reloadFeed: byId('reloadFeed'),
    search: byId('search'), typeFilter: byId('typeFilter'), viewFilter: byId('viewFilter'),
    sort: byId('sort'), fromDate: byId('fromDate'), toDate: byId('toDate'),
    heading: byId('heading'), subtitle: byId('subtitle'), connectionBadge: byId('connectionBadge'),
    jump: byId('jump'), shownCount: byId('shownCount'), loadedCount: byId('loadedCount'),
    viewedCount: byId('viewedCount'), status: byId('status'), grid: byId('grid'), loadMore: byId('loadMore'),
    viewer: byId('viewer'), viewerTitle: byId('viewerTitle'), viewerCounter: byId('viewerCounter'),
    viewerImage: byId('viewerImage'), viewerVideo: byId('viewerVideo'), viewerEmbed: byId('viewerEmbed'),
    viewerEmbedStart: byId('viewerEmbedStart'), viewerMediaLink: byId('viewerMediaLink'),
    viewerFallback: byId('viewerFallback'),
    viewerAssets: byId('viewerAssets'), viewerDownload: byId('viewerDownload'),
    viewerLoading: byId('viewerLoading'), viewerDescription: byId('viewerDescription'),
    viewerStage: byId('viewerStage'), viewerPrev: byId('viewerPrev'), viewerNext: byId('viewerNext'),
    viewerClose: byId('viewerClose'), viewerZoom: byId('viewerZoom'), viewerOriginal: byId('viewerOriginal'),
    viewerHint: byId('viewerHint'), viewerJump: byId('viewerJump'), viewerDate: byId('viewerDate'),
    viewerGo: byId('viewerGo'), viewerCancelScan: byId('viewerCancelScan'), openGallery: byId('openGallery'),
    startOldestPost: byId('startOldestPost'), startOldestUnreadPost: byId('startOldestUnreadPost'),
    scanDialog: byId('scanDialog'), scanProgress: byId('scanProgress'), scanCancel: byId('scanCancel'),
    downloadScope: byId('downloadScope'), downloadDates: byId('downloadDates'),
    downloadFrom: byId('downloadFrom'), downloadTo: byId('downloadTo'),
    prepareDownloads: byId('prepareDownloads'), downloadProgress: byId('downloadProgress'),
    cancelDownloads: byId('cancelDownloads'), downloadConfirm: byId('downloadConfirm'),
    downloadConfirmText: byId('downloadConfirmText'), confirmDownloads: byId('confirmDownloads'),
    dismissDownloads: byId('dismissDownloads'),
    exportYoutubeUrls: byId('exportYoutubeUrls'), youtubeExportStatus: byId('youtubeExportStatus'),
    cancelYoutubeExport: byId('cancelYoutubeExport'),
  };
  const VIEWED_KEY = 'gallery-scout-extension:viewed:v1';
  const preferredTabId = Number(new URLSearchParams(location.search).get('tabId'));
  let viewed = {};
  try { viewed = JSON.parse(localStorage.getItem(VIEWED_KEY) || '{}') || {}; } catch { /* reset malformed local state */ }
  const navigation = globalThis.GalleryNavigation;
  const downloads = globalThis.GalleryDownloads;
  const fileIcons = globalThis.GalleryFileIcons;
  const state = { feeds: [], selected: null, posts: new Map(), pages: 0, hasMore: false,
    limitReached: false, loading: false, scanning: false, scanCancelled: false };
  let viewerPostId = null;
  let viewerGeneration = 0;
  let viewerBusy = false;
  let viewerAssets = [];
  let viewerYoutubeUrl = null;
  let viewerLinkUrl = null;
  let viewerEmbedSrc = null;
  let batchPosts = [];
  let batchActive = false;
  let batchCancelled = false;
  let postDownloadBusy = false;
  let youtubeExporting = false;
  let youtubeExportCancelled = false;
  const pendingOpens = new Map();
  const actionMessages = new Map();

  const imageOrder = () => navigation.orderMedia(state.posts.values());

  function setStatus(message, error = false) {
    els.status.textContent = message;
    els.status.classList.toggle('error', error);
  }

  function send(action) {
    return chrome.runtime.sendMessage(action);
  }

  function labelFor(item) {
    return `${item.title} · campaign ${item.campaignId}`;
  }

  async function discoverTabs() {
    els.findTabs.disabled = true;
    setStatus('Looking for a Patreon Posts tab…');
    try {
      const response = await send({ action: 'LIST_TABS',
        preferredTabId: Number.isInteger(preferredTabId) && preferredTabId > 0 ? preferredTabId : null });
      if (response?.error) throw new Error(response.error);
      const tabs = response?.tabs || [];
      const feeds = tabs.flatMap((tab) =>
        (tab.feeds || []).map((feed) => ({ tabId: tab.tabId, campaignId: feed.campaignId, title: tab.title }))
      );
      state.feeds = feeds;
      els.membershipSelect.replaceChildren();
      if (!feeds.length) {
        const choice = new Option('No feeds detected — reload a Patreon Posts tab', '');
        els.membershipSelect.add(choice);
        state.selected = null;
        state.posts.clear(); state.pages = 0; state.hasMore = false;
        render();
        const blocked = tabs.filter((tab) => tab.needsReload).length;
        const error = tabs.find((tab) => tab.error)?.error;
        const message = !tabs.length
          ? 'No www.patreon.com tab found. Open a paid membership’s Posts page in Chrome, then click Find open Patreon tabs.'
          : blocked ? `Found ${tabs.length} Patreon tab(s), but could not connect to ${blocked}. Reload those Patreon tabs and try again.`
          : error ? `Patreon tab found, but campaign lookup failed: ${error}. Try reopening its Posts page.`
          : `Found ${tabs.length} Patreon tab(s), but no campaign feed. Open a membership’s Posts page (not an individual post), then try again.`;
        setStatus(message, true);
        return;
      }
      for (const [index, item] of feeds.entries()) els.membershipSelect.add(new Option(labelFor(item), String(index)));
      els.membershipSelect.disabled = false;
      if (!state.selected || !feeds.some((item) => item.tabId === state.selected.tabId && item.campaignId === state.selected.campaignId)) {
        state.selected = feeds[0];
      }
      const selectedIndex = feeds.findIndex((item) => item.tabId === state.selected.tabId && item.campaignId === state.selected.campaignId);
      els.membershipSelect.value = String(selectedIndex);
      els.reloadFeed.disabled = false;
      setStatus(`Found ${feeds.length} campaign feed${feeds.length === 1 ? '' : 's'}. Select one to browse.`);
    } catch (error) {
      setStatus(error.message || 'Could not find Patreon tabs.', true);
    } finally {
      els.findTabs.disabled = false;
    }
  }

  function selectedKey() { return state.selected?.campaignId || ''; }
  function wasViewed(post) { return Boolean(viewed[`${selectedKey()}:${post.id}`]); }

  function filteredPosts() {
    const query = els.search.value.trim().toLowerCase();
    const matching = [...state.posts.values()].filter((post) => {
      if (query && !post.title.toLowerCase().includes(query)) return false;
      if (els.typeFilter.value !== 'all' && post.type !== els.typeFilter.value) return false;
      if (els.viewFilter.value === 'viewed' && !wasViewed(post)) return false;
      if (els.viewFilter.value === 'unviewed' && wasViewed(post)) return false;
      if (els.fromDate.value && post.date < els.fromDate.value) return false;
      if (els.toDate.value && post.date > els.toDate.value) return false;
      return true;
    });
    const ordered = navigation.orderPosts(matching);
    return els.sort.value === 'asc' ? ordered : ordered.reverse();
  }

  function addText(parent, tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    parent.append(node);
    return node;
  }

  function createFileIcon(name, extraClass = '') {
    const icon = document.createElement('span');
    const kind = fileIcons.kindForName(name);
    icon.className = `file-icon ${extraClass}`.trim();
    icon.dataset.tone = kind.tone;
    icon.setAttribute('aria-hidden', 'true');
    addText(icon, 'span', 'file-icon-type', kind.label);
    return icon;
  }

  function showFileStage(fileNames) {
    els.viewerImage.removeAttribute('src');
    els.viewerImage.hidden = true;
    els.viewerFallback.classList.add('file-stage');
    els.viewerFallback.hidden = false;
    els.viewerFallback.replaceChildren(createFileIcon(fileNames?.[0]));
    addText(els.viewerFallback, 'span', 'file-stage-label', 'File post');
    for (const name of (fileNames || []).slice(0, 3)) addText(els.viewerFallback, 'span', 'file-stage-name', name);
    if (!fileNames?.length) addText(els.viewerFallback, 'span', 'file-stage-name', 'Filename not provided by Patreon');
    if (fileNames?.length > 3) addText(els.viewerFallback, 'span', 'file-stage-more', `+${fileNames.length - 3} more files below`);
  }

  function markViewed(post) {
    viewed[`${selectedKey()}:${post.id}`] = true;
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed));
  }

  function updateViewerControls() {
    const images = imageOrder();
    const index = images.findIndex((post) => post.id === viewerPostId);
    els.viewerCounter.textContent = index < 0 ? '' : `${index + 1} / ${images.length} media posts · oldest → newest${state.limitReached ? ' · archive capped' : ''}`;
    els.viewerPrev.disabled = viewerBusy || state.scanning || (index <= 0 && !state.hasMore);
    els.viewerNext.disabled = viewerBusy || state.scanning || index >= images.length - 1;
    els.viewerGo.disabled = viewerBusy || state.scanning;
  }

  function setZoom(zoomed) {
    els.viewerStage.classList.toggle('zoomed', zoomed);
    els.viewerZoom.setAttribute('aria-pressed', String(zoomed));
    els.viewerZoom.textContent = zoomed ? 'Fit in window' : 'Zoom to 100%';
    if (!zoomed) els.viewerStage.scrollTo(0, 0);
  }

  async function queueAsset(post, asset, index) {
    const response = await send({ action: 'DOWNLOAD_ASSET', url: asset.downloadUrl,
      filename: downloads.filename(selectedKey(), post, asset, index) });
    if (response?.error) throw new Error(response.error);
    if (!Number.isInteger(response?.downloadId)) throw new Error('Chrome did not queue the download.');
    return response.downloadId;
  }

  function openKey(post, asset) { return `${selectedKey()}:${post.id}:${asset.id}`; }

  async function openDownloaded(post, asset, report) {
    const key = openKey(post, asset);
    const response = await send({ action: 'OPEN_DOWNLOADED', downloadId: pendingOpens.get(key) });
    if (response?.error) throw new Error(response.error);
    if (response?.pending) { report('Still downloading. Try Open again when Chrome finishes.'); return; }
    if (response?.opened || response?.shown) {
      pendingOpens.delete(key);
      report(response.opened ? 'Opening the downloaded file.' : 'Chrome Downloads is open. Select the file there to launch it.');
    }
  }

  async function openAsset(post, asset, index, report) {
    if (pendingOpens.has(openKey(post, asset))) return openDownloaded(post, asset, report);
    const url = asset.displayUrl || asset.downloadUrl;
    if (!url || !downloads.browserViewable(asset.name) && !asset.downloadUrl) {
      report('No directly accessible file was provided. Open the Patreon post instead.');
      return;
    }
    const response = await send({ action: 'OPEN_ASSET', url,
      filename: downloads.filename(selectedKey(), post, asset, index) });
    if (response?.error) throw new Error(response.error);
    if (response?.requiresOpen && Number.isInteger(response.downloadId)) {
      pendingOpens.set(openKey(post, asset), response.downloadId);
      report('Download queued. When it finishes, click Open downloaded file.');
    } else if (response?.opened) report('Opened in a browser tab.');
  }

  function exportYoutubeList(urls) {
    const text = downloads.youtubeBatchText(urls);
    if (!text) return 0;
    const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `gallery-scout-youtube-${selectedKey()}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return text.trim().split('\n').length;
  }

  async function downloadEntry(post, report) {
    const response = await send({ action: 'LOAD_DETAIL', tabId: state.selected.tabId,
      campaignId: state.selected.campaignId, postId: post.id });
    if (response?.error) throw new Error(response.error);
    const assets = (response?.detail?.assets || []).filter((asset) => asset.downloadUrl);
    if (assets.length) {
      if (assets.length > 50) {
        report('More than 50 files on this post. Open the viewer to choose files, or use the confirmed batch download.');
        return;
      }
      let queued = 0;
      for (const [index, asset] of assets.entries()) {
        await queueAsset(post, asset, index + 1);
        queued++;
        if (index + 1 < assets.length) await new Promise((resolve) => setTimeout(resolve, 250));
      }
      report(`${queued} file${queued === 1 ? '' : 's'} queued. Check Chrome Downloads.`);
    } else {
      const urls = [ ...(post.youtubeWatchUrls || []), ...(response?.detail?.youtubeWatchUrls || []),
        ...(response?.detail?.embed?.provider === 'YouTube' ? [response.detail.embed.watchUrl] : []) ];
      const count = exportYoutubeList(urls);
      if (count) post.youtubeWatchUrls = downloads.youtubeBatchText(urls).trim().split('\n');
      report(count ? `Saved ${count} YouTube URL${count === 1 ? '' : 's'} for yt-dlp. No videos were downloaded.`
        : 'Patreon did not provide a directly downloadable file or YouTube link for this post.');
    }
  }

  async function downloadPostAssets(post, assets, report) {
    if (postDownloadBusy) return;
    postDownloadBusy = true;
    els.viewerDownload.disabled = true;
    let queued = 0;
    try {
      for (const [index, asset] of assets.entries()) {
        if (!asset.downloadUrl) continue;
        try {
          await queueAsset(post, asset, index + 1);
          queued++;
        } catch (error) { report(error.message || 'Download could not be queued.'); }
      }
      report(`${queued} download${queued === 1 ? '' : 's'} queued. Check Chrome Downloads for completion.`);
    } finally {
      postDownloadBusy = false;
      if (viewerPostId === post.id) els.viewerDownload.disabled = !viewerAssets.some((asset) => asset.downloadUrl);
    }
  }

  function renderViewerAssets(post) {
    els.viewerAssets.replaceChildren();
    els.viewerAssets.hidden = viewerAssets.length === 0;
    els.viewerDownload.disabled = postDownloadBusy || !viewerAssets.some((asset) => asset.downloadUrl);
    for (const [index, asset] of viewerAssets.entries()) {
      const row = addText(els.viewerAssets, 'div', 'viewer-asset', '');
      if (asset.type === 'file') row.append(createFileIcon(asset.name, 'file-icon-small'));
      else if (asset.previewUrl) {
        const thumbnail = document.createElement('img');
        thumbnail.src = asset.previewUrl;
        thumbnail.alt = '';
        thumbnail.referrerPolicy = 'no-referrer';
        row.append(thumbnail);
      }
      addText(row, 'span', '', `${asset.type} · ${asset.name}`);
      const downloadButton = addText(row, 'button', '', 'Download ↓');
      downloadButton.type = 'button';
      downloadButton.disabled = !asset.downloadUrl;
      downloadButton.title = asset.downloadUrl ? `Download ${asset.name}` : 'Patreon did not provide a direct download URL';
      downloadButton.addEventListener('click', async () => {
        try {
          await queueAsset(post, asset, index + 1);
          els.viewerLoading.textContent = 'Download queued. Check Chrome Downloads for completion.';
        } catch (error) { els.viewerLoading.textContent = error.message || 'Could not queue download.'; }
      });
      const open = addText(row, 'button', '', pendingOpens.has(openKey(post, asset)) ? 'Open downloaded file ↗' : 'Open ↗');
      open.type = 'button';
      open.disabled = !asset.displayUrl && !asset.downloadUrl;
      open.title = open.disabled ? 'Patreon did not provide a direct file URL' : `Open ${asset.name}`;
      open.addEventListener('click', async () => {
        try {
          await openAsset(post, asset, index + 1, (message) => { els.viewerLoading.textContent = message; });
          open.textContent = pendingOpens.has(openKey(post, asset)) ? 'Open downloaded file ↗' : 'Open ↗';
        } catch (error) { els.viewerLoading.textContent = error.message || 'Could not open file.'; }
      });
    }
  }

  function showMediaLink(url, label) {
    viewerLinkUrl = url;
    els.viewerMediaLink.hidden = !url;
    els.viewerMediaLink.firstElementChild.textContent = label;
  }

  function showMediaPreview(url, fallback) {
    els.viewerFallback.classList.remove('file-stage');
    els.viewerFallback.replaceChildren();
    if (url) {
      els.viewerImage.src = url;
      els.viewerImage.hidden = false;
      els.viewerFallback.hidden = true;
    } else {
      els.viewerImage.removeAttribute('src');
      els.viewerImage.hidden = true;
      els.viewerFallback.hidden = false;
      els.viewerFallback.textContent = fallback;
    }
  }

  async function openFileCard(post, cover) {
    const { tabId, campaignId } = state.selected;
    cover.disabled = true;
    cover.setAttribute('aria-busy', 'true');
    try {
      const response = await send({ action: 'LOAD_DETAIL', tabId, campaignId, postId: post.id });
      if (state.selected?.tabId !== tabId || state.selected?.campaignId !== campaignId) return;
      const files = (response?.detail?.assets || []).filter((asset) =>
        asset.type === 'file' && (asset.displayUrl || asset.downloadUrl));
      if (response?.detail?.fileNames?.length) post.fileNames = response.detail.fileNames;
      if (files.length === 1) {
        markViewed(post);
        await openAsset(post, files[0], 1, (message) => actionMessages.set(`${campaignId}:${post.id}`, message));
        render();
      } else showViewer(post.id);
    } catch { showViewer(post.id); }
    finally { cover.disabled = false; cover.removeAttribute('aria-busy'); }
  }

  async function showViewer(postId) {
    const post = state.posts.get(postId);
    if (!post || !['image', 'video', 'file'].includes(post.type)) return;
    if (!els.viewer.open) els.viewer.showModal();
    viewerPostId = postId;
    const generation = ++viewerGeneration;
    markViewed(post);
    els.viewerTitle.textContent = post.title;
    els.viewerHint.textContent = state.limitReached
      ? 'Archive may be incomplete (100-page safety limit). ← older · → newer · Escape closes.'
      : post.type === 'image' ? '← older · → newer · Escape closes · Zoom for original pixels'
      : '← older · → newer · Escape closes';
    els.viewerDescription.textContent = '';
    viewerAssets = [];
    viewerYoutubeUrl = null;
    els.viewerDownload.textContent = 'Download post ↓';
    viewerEmbedSrc = null;
    els.viewerAssets.replaceChildren();
    els.viewerAssets.hidden = true;
    els.viewerDownload.disabled = true;
    els.viewerZoom.hidden = post.type !== 'image';
    els.viewerVideo.pause();
    els.viewerVideo.onerror = null;
    els.viewerVideo.removeAttribute('src');
    els.viewerVideo.hidden = true;
    els.viewerEmbed.removeAttribute('src');
    els.viewerEmbed.hidden = true;
    els.viewerStage.classList.remove('has-embed');
    els.viewerStage.classList.toggle('has-file', post.type === 'file');
    els.viewerEmbedStart.hidden = true;
    showMediaLink(null, '');
    els.viewerImage.alt = post.title;
    els.viewerImage.onload = null;
    els.viewerImage.onerror = () => {
      if (generation !== viewerGeneration) return;
      els.viewerImage.onerror = null;
      if (post.previewUrl && els.viewerImage.src !== post.previewUrl) els.viewerImage.src = post.previewUrl;
      else { els.viewerImage.hidden = true; els.viewerFallback.hidden = false; }
      els.viewerLoading.textContent = 'Preview image unavailable; use the link to open the media.';
    };
    if (post.type === 'file') showFileStage(post.fileNames);
    else showMediaPreview(post.fullUrl || post.previewUrl,
      post.type === 'video' ? 'Video preview unavailable' : 'Image preview unavailable');
    setZoom(false);
    els.viewerLoading.textContent = 'Checking available media…';
    updateViewerControls();
    try {
      const response = await send({ action: 'LOAD_DETAIL', tabId: state.selected.tabId, campaignId: state.selected.campaignId, postId });
      if (generation !== viewerGeneration || !els.viewer.open) return;
      if (response?.error) throw new Error(response.error);
      const detail = response?.detail || {};
      els.viewerDescription.textContent = detail.description || '';
      viewerAssets = Array.isArray(detail.assets) ? detail.assets : [];
      viewerYoutubeUrl = detail.embed?.provider === 'YouTube' ? detail.embed.watchUrl : null;
      renderViewerAssets(post);
      if (viewerYoutubeUrl && !viewerAssets.some((asset) => asset.downloadUrl)) {
        els.viewerDownload.textContent = 'Download URL list ↓';
        els.viewerDownload.disabled = false;
      }
      const preview = detail.previewUrl || post.previewUrl;
      if (post.type === 'file') {
        if (detail.fileNames?.length) post.fileNames = detail.fileNames;
        showFileStage(post.fileNames);
      } else if (post.type === 'video') showMediaPreview(preview, 'Video preview unavailable');
      if (post.type === 'video') {
        const playable = viewerAssets.find((asset) => asset.type === 'video' && asset.displayUrl);
        const embed = detail.embed;
        if (playable) {
          showMediaLink(playable.displayUrl, 'Open video ↗');
          els.viewerMediaLink.hidden = true; // Let native playback controls receive clicks.
          els.viewerImage.hidden = true;
          els.viewerFallback.hidden = true;
          els.viewerVideo.hidden = false;
          els.viewerVideo.poster = preview || '';
          els.viewerVideo.src = playable.displayUrl;
          els.viewerVideo.onerror = () => {
            if (generation !== viewerGeneration) return;
            els.viewerVideo.hidden = true;
            showMediaPreview(preview, 'Video cannot play here');
            els.viewerMediaLink.hidden = false;
            els.viewerLoading.textContent = 'This video cannot play here. Open the video directly.';
          };
          els.viewerLoading.textContent = '';
        } else if (embed?.embedUrl) {
          viewerEmbedSrc = embed.embedUrl;
          els.viewerEmbed.title = `${post.title} · ${embed.provider} video`;
          showMediaLink(embed.watchUrl || post.url, `Watch on ${embed.provider} ↗`);
          els.viewerEmbedStart.hidden = false;
          els.viewerLoading.textContent = 'Preview only · choose Play here or open the video.';
        } else {
          showMediaLink(embed?.watchUrl || post.url,
            embed?.watchUrl ? `Open on ${embed.provider.slice(0, 60)} ↗` : 'Open post on Patreon ↗');
          els.viewerLoading.textContent = embed?.provider === 'YouTube'
            ? 'YouTube cannot play inside this Chrome extension (player error 153). Click the preview to watch on YouTube.'
            : 'No playable video was provided. Open the video directly.';
        }
      } else if (post.type === 'image') {
        const fullUrl = detail.fullUrl || post.fullUrl;
        if (fullUrl && els.viewerImage.src !== fullUrl) {
          els.viewerImage.onload = () => { if (generation === viewerGeneration) els.viewerLoading.textContent = ''; };
          els.viewerImage.src = fullUrl;
        } else els.viewerLoading.textContent = fullUrl ? '' : 'Original not provided; showing the available preview.';
      } else {
        const file = viewerAssets.find((asset) => asset.type === 'file' && (asset.downloadUrl || asset.displayUrl));
        showMediaLink(file?.downloadUrl || file?.displayUrl || post.url,
          file ? `Open ${file.name} ↗` : 'Open post on Patreon ↗');
        els.viewerLoading.textContent = file
          ? downloads.browserViewable(file.name)
            ? 'Open views this file in a browser tab. Download only saves a copy.'
            : 'Open downloads this file first. When it finishes, click Open downloaded file to launch it.'
          : 'Patreon did not provide a direct file URL. Use the original post; Open and Download are unavailable here.';
      }
    } catch (error) {
      if (generation === viewerGeneration) {
        if (post.type !== 'image') showMediaLink(post.url, 'Open post on Patreon ↗');
        els.viewerLoading.textContent = `${error.message || 'Media unavailable.'} Open the original Patreon post.`;
      }
    }
  }

  async function stepViewer(direction) {
    if (viewerBusy || state.scanning || !els.viewer.open) return;
    viewerBusy = true;
    updateViewerControls();
    try {
      let next = navigation.adjacent(imageOrder(), viewerPostId, direction);
      // The archive arrives newest-first. Only older images can be on a later page.
      while (!next && direction === -1 && state.hasMore && els.viewer.open) {
        els.viewerLoading.textContent = `Finding older media · page ${state.pages + 1}…`;
        if (!await loadPage(false)) {
          els.viewerLoading.textContent = 'Could not load older posts. Please try ← again.';
          return;
        }
        next = navigation.adjacent(imageOrder(), viewerPostId, direction);
        if (!next && state.hasMore) await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (next && els.viewer.open) showViewer(next.id);
      else if (els.viewer.open) els.viewerLoading.textContent = direction === 1
        ? 'This is the newest media post.' : state.limitReached ? 'Older posts may exist beyond the safety limit.' : 'This is the oldest media post.';
    } finally {
      viewerBusy = false;
      updateViewerControls();
    }
  }

  async function scanArchive(purpose = 'the oldest unread media') {
    if (state.scanning || state.loading || !state.selected) return false;
    state.scanning = true;
    state.scanCancelled = false;
    els.viewerCancelScan.hidden = !els.viewer.open;
    render();
    let complete = true;
    try {
      while (state.hasMore && !state.scanCancelled) {
        const progress = `Page ${state.pages + 1} · ${state.posts.size} viewable posts loaded. Finding ${purpose}…`;
        els.scanProgress.textContent = progress;
        if (els.viewer.open) els.viewerLoading.textContent = progress;
        if (!await loadPage(false)) {
          complete = false;
          if (els.viewer.open) els.viewerLoading.textContent = 'Could not finish scanning. Please try again.';
          break;
        }
        if (state.hasMore && !state.scanCancelled) await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return complete && !state.scanCancelled;
    } finally {
      state.scanning = false;
      els.viewerCancelScan.hidden = true;
      if (els.scanDialog.open) els.scanDialog.close();
      if (state.scanCancelled) setStatus('Archive scan stopped. Open the gallery to resume from this page.');
      render();
    }
  }

  async function startAtPost(mode) {
    if (!state.selected || state.loading || state.scanning || batchActive || youtubeExporting) return;
    if (state.hasMore) {
      els.scanDialog.querySelector('#scanTitle').textContent = 'Finding the oldest posts…';
      els.scanDialog.showModal();
      if (!await scanArchive('the oldest posts')) return;
    }
    const ordered = navigation.orderPosts(state.posts.values());
    const target = navigation.pick(ordered, mode, wasViewed);
    if (!target) { setStatus('No viewable posts were found in this archive.', true); return; }
    const allOpened = mode === 'oldest-unread' && ordered.every(wasViewed);
    els.search.value = '';
    els.typeFilter.value = 'all';
    els.viewFilter.value = 'all';
    els.fromDate.value = '';
    els.toDate.value = '';
    els.sort.value = 'asc';
    render();
    const card = byId(`post-${target.id}`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card?.querySelector('.cover-action')?.focus({ preventScroll: true });
    setStatus(`${ordered.length} viewable posts loaded, sorted oldest first. ${allOpened ? 'All have been opened here; showing the oldest.' : mode === 'oldest' ? 'Showing the oldest post.' : 'Showing the oldest unread post.'}${state.limitReached ? ' Archive capped at 100 pages; older posts may exist.' : ''}`);
  }

  async function startGallery() {
    if (!state.selected || state.loading || state.scanning || batchActive) return;
    els.scanDialog.querySelector('#scanTitle').textContent = 'Finding your starting point…';
    if (state.hasMore) els.scanDialog.showModal();
    if (state.hasMore && !await scanArchive()) return;
    const target = navigation.pick(imageOrder(), 'oldest-unread', wasViewed);
    if (!target) { setStatus('No viewable media posts were found in this archive.', true); return; }
    els.viewerJump.value = 'oldest-unread';
    els.viewerDate.hidden = true;
    showViewer(target.id);
  }

  function needsArchiveScan(mode, date) {
    if (!state.hasMore) return false;
    const images = imageOrder();
    if (mode === 'newest' && images.length) return false;
    if (mode === 'newest-unread' && images.some((post) => !wasViewed(post))) return false;
    if (mode === 'date' && images.length &&
        (images[0].date <= date || images[images.length - 1].date < date)) return false;
    return true;
  }

  async function jumpViewer() {
    if (!els.viewer.open || state.scanning || viewerBusy) return;
    const mode = els.viewerJump.value;
    if (mode === 'date' && !els.viewerDate.value) {
      els.viewerLoading.textContent = 'Choose a date to jump to.';
      els.viewerDate.focus();
      return;
    }
    if (needsArchiveScan(mode, els.viewerDate.value) && !await scanArchive()) return;
    const target = navigation.pick(imageOrder(), mode, wasViewed, els.viewerDate.value);
    if (target && els.viewer.open) showViewer(target.id);
  }

  function downloadOptions() {
    const scope = els.downloadScope.value;
    return { scope, search: els.search.value, type: els.typeFilter.value, view: els.viewFilter.value,
      from: scope === 'dates' ? els.downloadFrom.value : els.fromDate.value,
      to: scope === 'dates' ? els.downloadTo.value : els.toDate.value };
  }

  async function prepareBatch() {
    if (batchActive || state.loading || state.scanning || !state.selected) return;
    const options = downloadOptions();
    if (options.scope === 'dates' && (!options.from || !options.to || options.from > options.to)) {
      els.downloadProgress.textContent = 'Choose a valid From and To date before preparing downloads.';
      return;
    }
    if (state.hasMore) {
      els.scanDialog.querySelector('#scanTitle').textContent = 'Checking matching posts…';
      els.scanDialog.showModal();
      if (!await scanArchive('posts for download')) return;
    }
    batchPosts = downloads.select(state.posts.values(), options, wasViewed);
    if (!batchPosts.length) {
      els.downloadProgress.textContent = 'No accessible media posts match this selection.';
      return;
    }
    els.downloadConfirmText.textContent = `${batchPosts.length} matching post${batchPosts.length === 1 ? '' : 's'}. Downloadable media will be resolved on demand into Downloads/Gallery Scout/${selectedKey()}/. Some posts may have no downloadable files. Chrome may request multiple-download permission. The job queues at most 1,500 files${state.limitReached ? '; the archive hit its 100-page safety limit' : ''}.`;
    els.downloadConfirm.showModal();
  }

  async function runBatch() {
    if (batchActive || !batchPosts.length || !state.selected) return;
    els.downloadConfirm.close();
    const posts = batchPosts;
    batchPosts = [];
    batchActive = true;
    batchCancelled = false;
    els.cancelDownloads.hidden = false;
    render();
    let queued = 0;
    let attempts = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (const [position, post] of posts.entries()) {
        if (batchCancelled || attempts >= 1500) break;
        els.downloadProgress.textContent = `Checking post ${position + 1} of ${posts.length} · ${queued} queued · ${skipped} unavailable.`;
        let assets;
        try {
          const response = await send({ action: 'LOAD_DETAIL', tabId: state.selected.tabId,
            campaignId: state.selected.campaignId, postId: post.id });
          if (response?.error) throw new Error('Post media unavailable.');
          assets = response?.detail?.assets || [];
        } catch { failed++; continue; }
        for (const [index, asset] of assets.entries()) {
          if (batchCancelled || attempts >= 1500) break;
          if (!asset.downloadUrl) { skipped++; continue; }
          attempts++;
          try { await queueAsset(post, asset, index + 1); queued++; }
          catch { failed++; }
          if (!batchCancelled) await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!assets.length) skipped++;
      }
      els.downloadProgress.textContent = `${queued} files queued, ${skipped} unavailable, ${failed} failed to queue.${batchCancelled ? ' Stopped before remaining posts.' : attempts >= 1500 ? ' Reached the 1,500-attempt safety limit; narrow your filters for the rest.' : ' Check Chrome Downloads for completion.'}`;
    } finally {
      batchActive = false;
      els.cancelDownloads.hidden = true;
      render();
    }
  }

  async function exportYoutubeUrls() {
    if (youtubeExporting || batchActive || state.loading || state.scanning || !state.selected) return;
    const options = downloadOptions();
    if (options.scope === 'dates' && (!options.from || !options.to || options.from > options.to)) {
      els.youtubeExportStatus.textContent = 'Choose a valid From and To date first.';
      return;
    }
    if (state.hasMore) {
      els.scanDialog.querySelector('#scanTitle').textContent = 'Finding YouTube posts…';
      els.scanDialog.showModal();
      if (!await scanArchive('YouTube posts')) return;
    }
    const candidates = [...state.posts.values()].filter((post) =>
      post.type === 'video' || post.possibleVideoLink || post.youtubeWatchUrls?.length);
    const posts = downloads.select(candidates, options, wasViewed, true);
    youtubeExporting = true;
    youtubeExportCancelled = false;
    els.cancelYoutubeExport.hidden = false;
    render();
    const urls = [];
    try {
      for (const [index, post] of posts.entries()) {
        if (youtubeExportCancelled) break;
        els.youtubeExportStatus.textContent = `Checking video post ${index + 1} of ${posts.length} · ${urls.length} YouTube links.`;
        if (!post.possibleVideoLink && (post.youtubeWatchUrls?.length || post.youtubeWatchUrl)) {
          urls.push(...(post.youtubeWatchUrls?.length ? post.youtubeWatchUrls : [post.youtubeWatchUrl]));
          continue;
        }
        urls.push(...(post.youtubeWatchUrls || []));
        try {
          const response = await send({ action: 'LOAD_DETAIL', tabId: state.selected.tabId,
            campaignId: state.selected.campaignId, postId: post.id });
          if (response?.error) throw new Error('Post unavailable.');
          urls.push(...(response?.detail?.youtubeWatchUrls || []));
          if (response?.detail?.embed?.provider === 'YouTube') urls.push(response.detail.embed.watchUrl);
        } catch { /* inaccessible or no video link */ }
        if (!youtubeExportCancelled) await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (youtubeExportCancelled) els.youtubeExportStatus.textContent = 'Export stopped; no list saved.';
      else {
        const count = exportYoutubeList(urls);
        els.youtubeExportStatus.textContent = count
          ? `${count} YouTube URL${count === 1 ? '' : 's'} saved as a .txt file. Run yt-dlp --batch-file "path/to/exported-list.txt".${state.limitReached ? ' Archive limited to 100 pages.' : ''}`
          : 'No YouTube video URLs were found in the selected posts.';
      }
    } catch {
      els.youtubeExportStatus.textContent = 'Could not save the URL list. Try again.';
    } finally {
      youtubeExporting = false;
      els.cancelYoutubeExport.hidden = true;
      render();
    }
  }

  function postCard(post) {
    const card = document.createElement('article');
    card.className = 'card';
    card.id = `post-${post.id}`;
    const canBrowse = ['image', 'video', 'file'].includes(post.type);
    const cover = addText(card, 'button', 'cover cover-action', '');
    cover.type = 'button';
    cover.setAttribute('aria-label', post.type === 'file' ? `Open file from ${post.title}` :
      canBrowse ? `View ${post.title} in media gallery` : `Open Patreon post ${post.title}`);
    cover.addEventListener('click', () => {
      if (post.type === 'file') openFileCard(post, cover);
      else if (canBrowse) showViewer(post.id);
      else { markViewed(post); chrome.tabs.create({ url: post.url }); render(); }
    });
    if (post.type === 'file') {
      cover.classList.add('file-cover');
      cover.append(createFileIcon(post.fileNames?.[0]));
      addText(cover, 'span', 'file-cover-action', 'Open file ↗');
    } else if (post.previewUrl) {
      const image = document.createElement('img');
      image.src = post.previewUrl;
      image.alt = `Preview for ${post.title}`;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      cover.append(image);
    } else {
      addText(cover, 'span', 'cover-fallback', post.type === 'video' ? '▶ Video post' :
        post.youtubeWatchUrls?.length ? `▶ ${post.youtubeWatchUrls.length} video links in post` : '✦ Patreon post');
    }
    addText(cover, 'span', 'card-kind', post.type);
    if (wasViewed(post)) addText(cover, 'span', 'card-viewed', 'Opened');
    const copy = addText(card, 'div', 'card-copy', '');
    addText(copy, 'p', 'card-date', post.date || 'Undated');
    addText(copy, 'h3', '', post.title);
    if (post.type === 'file') {
      const files = addText(copy, 'div', 'file-details', '');
      addText(files, 'span', 'file-details-heading', 'File post');
      for (const name of (post.fileNames || []).slice(0, 3)) addText(files, 'span', 'file-name', name);
      if (!post.fileNames?.length) addText(files, 'span', 'file-name file-name-missing', 'Filename not provided by Patreon');
      if (post.fileNames?.length > 3) addText(files, 'span', 'file-name file-name-missing', `+${post.fileNames.length - 3} more files · open to see all`);
    }
    const note = post.type === 'file'
      ? post.attachmentCount > 1 ? 'Click to choose an attachment.' : 'Click the icon to open the file when available.'
      : canBrowse ? 'Click the preview to browse media with ← →.'
      : post.youtubeWatchUrls?.length ? 'Open the post or choose a YouTube video below.'
      : 'Open on Patreon for the full post.';
    addText(copy, 'p', 'card-note', note);
    if (post.youtubeWatchUrls?.length) {
      const links = addText(copy, 'div', 'card-video-links', '');
      addText(links, 'span', 'card-video-links-label',
        `${post.youtubeWatchUrls.length} YouTube video${post.youtubeWatchUrls.length === 1 ? '' : 's'}`);
      for (const [index, url] of post.youtubeWatchUrls.entries()) {
        const link = addText(links, 'button', 'card-video-link', `Open video ${index + 1} on YouTube ↗`);
        link.type = 'button';
        link.addEventListener('click', () => { markViewed(post); chrome.tabs.create({ url }); render(); });
      }
    }
    const actions = addText(copy, 'div', 'card-actions', '');
    const download = addText(actions, 'button', 'button button-outline',
      post.youtubeWatchUrls?.length || post.youtubeWatchUrl ? 'Download URL list ↓' :
        !canBrowse && post.possibleVideoLink ? 'Find video links ↓' : 'Download ↓');
    download.type = 'button';
    download.disabled = !canBrowse && !post.possibleVideoLink && !post.youtubeWatchUrls?.length;
    const postKey = `${selectedKey()}:${post.id}`;
    const waitingForOpen = post.type === 'file' && [...pendingOpens.keys()].some((key) => key.startsWith(`${postKey}:`));
    const open = addText(actions, 'button', 'button button-primary', waitingForOpen ? 'Open downloaded file ↗' : 'Open ↗');
    open.type = 'button';
    const actionStatus = addText(copy, 'p', 'card-action-status', actionMessages.get(postKey) || '');
    actionStatus.setAttribute('role', 'status');
    function report(message) {
      actionMessages.set(postKey, message);
      actionStatus.textContent = message;
    }
    download.addEventListener('click', async () => {
      download.disabled = true;
      report('Checking available media…');
      const priorLinks = post.youtubeWatchUrls?.length || 0;
      try { await downloadEntry(post, report); }
      catch (error) { report(error.message || 'Download unavailable.'); }
      finally {
        download.disabled = false;
        if ((post.youtubeWatchUrls?.length || 0) !== priorLinks) render();
      }
    });
    open.addEventListener('click', () => {
      if (post.type === 'file') openFileCard(post, cover);
      else if (post.type === 'video' && post.youtubeWatchUrl) {
        markViewed(post);
        chrome.tabs.create({ url: post.youtubeWatchUrl });
        render();
      } else if (canBrowse) showViewer(post.id);
      else { markViewed(post); chrome.tabs.create({ url: post.url }); render(); }
    });
    const original = addText(copy, 'button', 'card-original', 'Original Patreon post ↗');
    original.type = 'button';
    original.addEventListener('click', () => {
      markViewed(post);
      chrome.tabs.create({ url: post.url });
      render();
    });
    return card;
  }

  function render() {
    const posts = filteredPosts();
    els.grid.replaceChildren(...posts.map(postCard));
    els.shownCount.textContent = String(posts.length);
    els.loadedCount.textContent = String(state.posts.size);
    els.viewedCount.textContent = String([...state.posts.values()].filter(wasViewed).length);
    els.loadMore.hidden = !state.hasMore;
    els.loadMore.disabled = state.loading || state.scanning;
    els.reloadFeed.disabled = state.loading || state.scanning || !state.selected;
    els.membershipSelect.disabled = state.loading || state.scanning || state.feeds.length === 0;
    els.findTabs.disabled = state.loading || state.scanning;
    els.openGallery.disabled = state.loading || state.scanning || batchActive || youtubeExporting || !state.selected || state.pages === 0;
    els.startOldestPost.disabled = state.loading || state.scanning || batchActive || youtubeExporting || !state.selected || state.pages === 0;
    els.startOldestUnreadPost.disabled = els.startOldestPost.disabled;
    els.prepareDownloads.disabled = state.loading || state.scanning || batchActive || youtubeExporting || !state.selected || state.pages === 0;
    els.exportYoutubeUrls.disabled = state.loading || state.scanning || batchActive || youtubeExporting || !state.selected || state.pages === 0;
    els.membershipSelect.disabled ||= batchActive || youtubeExporting;
    els.reloadFeed.disabled ||= batchActive || youtubeExporting;
    els.findTabs.disabled ||= batchActive || youtubeExporting;
    els.downloadScope.disabled = batchActive || youtubeExporting;
    els.jump.replaceChildren();
    els.jump.add(new Option('Choose a loaded post', ''));
    posts.forEach((post) => els.jump.add(new Option(post.title, post.id)));
    els.jump.disabled = posts.length === 0;
    els.connectionBadge.textContent = state.selected ? 'Signed-in tab selected' : 'Waiting for a tab';
    els.subtitle.textContent = state.selected
      ? `Campaign ${state.selected.campaignId} · ${state.pages} page${state.pages === 1 ? '' : 's'} loaded · only posts Patreon marks viewable are shown.`
      : 'Choose a Patreon tab to start exploring posts you can view.';
    if (els.viewer.open) updateViewerControls();
  }

  async function loadPage(reset = false) {
    if (state.loading || !state.selected) return;
    state.loading = true;
    if (reset) { state.posts.clear(); state.pages = 0; state.hasMore = false; state.limitReached = false; }
    if (!state.scanning) render();
    setStatus(reset ? 'Loading the first page from your Patreon tab…' : 'Loading the next page…');
    try {
      const response = await send({ action: 'LOAD_PAGE', tabId: state.selected.tabId, campaignId: state.selected.campaignId, reset });
      if (response?.error) throw new Error(response.error);
      for (const post of response?.posts || []) state.posts.set(post.id, post);
      state.pages = response?.page || state.pages;
      state.hasMore = Boolean(response?.hasMore);
      state.limitReached = Boolean(response?.limitReached);
      setStatus(`${state.posts.size} viewable posts loaded (${response?.received ?? '?'} records on this page). ${state.hasMore ? 'Load another page to continue.' : state.limitReached ? 'Reached the 100-page safety limit.' : 'Patreon returned no next page.'} Filters search loaded posts only.`);
      return true;
    } catch (error) {
      setStatus(error.message || 'Could not load posts from Patreon.', true);
      return false;
    } finally {
      state.loading = false;
      if (!state.scanning) render();
    }
  }

  function resetViewer() {
    if (!viewerPostId) return;
    ++viewerGeneration;
    viewerPostId = null;
    state.scanCancelled = true;
    els.viewerVideo.pause();
    els.viewerVideo.removeAttribute('src');
    els.viewerEmbed.removeAttribute('src');
    els.viewerEmbed.hidden = true;
    els.viewerStage.classList.remove('has-embed', 'has-file');
    els.viewerImage.removeAttribute('src');
    els.viewerMediaLink.hidden = true;
    els.viewerEmbedStart.hidden = true;
    viewerLinkUrl = null;
    viewerEmbedSrc = null;
    viewerAssets = [];
    viewerYoutubeUrl = null;
    render();
  }
  function closeViewer() {
    if (els.viewer.open) els.viewer.close();
    resetViewer();
  }
  els.viewerClose.addEventListener('click', closeViewer);
  els.viewer.addEventListener('cancel', resetViewer);
  els.viewerPrev.addEventListener('click', () => stepViewer(-1));
  els.viewerNext.addEventListener('click', () => stepViewer(1));
  els.openGallery.addEventListener('click', startGallery);
  els.startOldestPost.addEventListener('click', () => startAtPost('oldest'));
  els.startOldestUnreadPost.addEventListener('click', () => startAtPost('oldest-unread'));
  els.downloadScope.addEventListener('change', () => { els.downloadDates.hidden = els.downloadScope.value !== 'dates'; });
  els.prepareDownloads.addEventListener('click', prepareBatch);
  els.exportYoutubeUrls.addEventListener('click', exportYoutubeUrls);
  els.cancelYoutubeExport.addEventListener('click', () => { youtubeExportCancelled = true; els.youtubeExportStatus.textContent = 'Stopping after the current post…'; });
  els.confirmDownloads.addEventListener('click', runBatch);
  els.dismissDownloads.addEventListener('click', () => { batchPosts = []; els.downloadConfirm.close(); });
  els.cancelDownloads.addEventListener('click', () => { batchCancelled = true; els.downloadProgress.textContent = 'Stopping after the current download is queued…'; });
  els.scanCancel.addEventListener('click', () => { state.scanCancelled = true; els.scanDialog.close(); });
  els.scanDialog.addEventListener('cancel', () => { state.scanCancelled = true; });
  els.viewerCancelScan.addEventListener('click', () => { state.scanCancelled = true; });
  els.viewerJump.addEventListener('change', () => {
    els.viewerDate.hidden = els.viewerJump.value !== 'date';
    if (els.viewerJump.value !== 'date') jumpViewer();
  });
  els.viewerGo.addEventListener('click', jumpViewer);
  els.viewerDate.addEventListener('change', jumpViewer);
  els.viewerZoom.addEventListener('click', () => setZoom(!els.viewerStage.classList.contains('zoomed')));
  els.viewerImage.addEventListener('click', () => { if (!els.viewerZoom.hidden) setZoom(!els.viewerStage.classList.contains('zoomed')); });
  els.viewerMediaLink.addEventListener('click', async () => {
    const post = state.posts.get(viewerPostId);
    const file = post?.type === 'file' && viewerAssets.find((asset) =>
      asset.type === 'file' && (asset.displayUrl || asset.downloadUrl));
    if (file) {
      try {
        await openAsset(post, file, viewerAssets.indexOf(file) + 1,
          (message) => { els.viewerLoading.textContent = message; });
        renderViewerAssets(post);
        showMediaLink(viewerLinkUrl, pendingOpens.has(openKey(post, file)) ? 'Open downloaded file ↗' : `Open ${file.name} ↗`);
      } catch (error) { els.viewerLoading.textContent = error.message || 'Could not open file.'; }
    } else if (viewerLinkUrl) chrome.tabs.create({ url: viewerLinkUrl });
  });
  els.viewerEmbedStart.addEventListener('click', () => {
    if (!viewerEmbedSrc) return;
    els.viewerImage.hidden = true;
    els.viewerFallback.hidden = true;
    els.viewerEmbedStart.hidden = true;
    els.viewerEmbed.hidden = false;
    els.viewerStage.classList.add('has-embed');
    els.viewerEmbed.src = viewerEmbedSrc;
  });
  els.viewerDownload.addEventListener('click', () => {
    const post = state.posts.get(viewerPostId);
    if (!post) return;
    if (viewerYoutubeUrl && !viewerAssets.some((asset) => asset.downloadUrl)) {
      const count = exportYoutubeList([viewerYoutubeUrl]);
      els.viewerLoading.textContent = count ? 'Saved a URL list for yt-dlp; no video downloaded.' : 'No YouTube URL available.';
    } else downloadPostAssets(post, viewerAssets, (message) => { els.viewerLoading.textContent = message; });
  });
  els.viewerOriginal.addEventListener('click', () => {
    const post = state.posts.get(viewerPostId);
    if (post) chrome.tabs.create({ url: post.url });
  });
  document.addEventListener('keydown', (event) => {
    if (!els.viewer.open || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.target.closest('video, input, select') || event.key === 'Escape') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      stepViewer(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  els.findTabs.addEventListener('click', discoverTabs);
  els.membershipSelect.addEventListener('change', () => {
    if (els.viewer.open) closeViewer();
    state.selected = state.feeds[Number(els.membershipSelect.value)] || null;
    state.posts.clear(); state.pages = 0; state.hasMore = false; state.limitReached = false;
    render();
    loadPage(true);
  });
  els.reloadFeed.addEventListener('click', () => loadPage(true));
  els.loadMore.addEventListener('click', () => loadPage(false));
  for (const id of ['search', 'typeFilter', 'viewFilter', 'sort', 'fromDate', 'toDate']) {
    els[id].addEventListener(id === 'search' || id.includes('Date') ? 'input' : 'change', render);
  }
  els.jump.addEventListener('change', () => {
    const node = document.getElementById(`post-${els.jump.value}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  discoverTabs().then(() => { if (state.selected) loadPage(true); });
})();
