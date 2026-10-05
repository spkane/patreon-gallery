/* Messages are restricted to this extension's gallery page and Patreon tabs. */
function safeDownloadUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 10000) return null;
    if (/^(?:[a-z0-9-]+\.)*patreonusercontent\.com$/i.test(url.hostname)) return url.href;
    if (url.origin === 'https://www.patreon.com' && /^\/(?:file|media|api\/media)(?:\/|$)/.test(url.pathname)) return url.href;
  } catch { /* malformed URL */ }
  return null;
}

function safeFilename(value) {
  if (typeof value !== 'string' || value.length > 240) return false;
  const segments = value.split('/');
  return segments.length > 1 && segments.length <= 4 && segments.every((segment) =>
    segment.length > 0 && segment.length <= 100 && segment !== '.' && segment !== '..' &&
    /^[a-z0-9][a-z0-9 ._()-]*$/i.test(segment) && !/[. ]$/.test(segment));
}
chrome.action.onClicked.addListener((tab) => {
  const gallery = new URL(chrome.runtime.getURL('gallery.html'));
  if (Number.isInteger(tab?.id) && tab.url?.startsWith('https://www.patreon.com/')) {
    gallery.searchParams.set('tabId', String(tab.id));
  }
  chrome.tabs.create({ url: gallery.href });
});

class GalleryError extends Error {}

function isGallerySender(sender) {
  if (sender.id !== chrome.runtime.id) return false;
  try {
    const actual = new URL(sender.url);
    const expected = new URL(chrome.runtime.getURL('gallery.html'));
    return actual.protocol === expected.protocol && actual.host === expected.host && actual.pathname === expected.pathname;
  } catch { return false; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isGallerySender(sender)) return;

  async function forward() {
    if (message?.action === 'LIST_TABS') {
      const tabs = await chrome.tabs.query({ url: 'https://www.patreon.com/*' });
      if (Number.isInteger(message.preferredTabId)) {
        tabs.sort((a, b) => Number(b.id === message.preferredTabId) - Number(a.id === message.preferredTabId));
      }
      const results = await Promise.all(tabs.map(async (tab) => {
        let reply;
        try {
          reply = await chrome.tabs.sendMessage(tab.id, { action: 'DISCOVER_FEEDS' });
        } catch {
          // An extension reload can detach the prior content script from an already-open tab.
          // Reinject only our bundled scripts, into www.patreon.com tabs permitted by the manifest.
          try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['feed.js', 'content.js'] });
            reply = await chrome.tabs.sendMessage(tab.id, { action: 'DISCOVER_FEEDS' });
          } catch {
            return { tabId: tab.id, title: tab.title || 'Patreon tab', feeds: [], needsReload: true };
          }
        }
        return { tabId: tab.id, title: tab.title || 'Patreon tab', feeds: reply?.feeds || [], error: reply?.error || null };
      }));
      return { tabs: results };
    }
    if (message?.action === 'OPEN_DOWNLOADED') {
      if (!Number.isInteger(message.downloadId) || message.downloadId < 0) throw new GalleryError('Invalid download.');
      const [item] = await chrome.downloads.search({ id: message.downloadId });
      if (!item || item.byExtensionId !== chrome.runtime.id) throw new GalleryError('Download not created by Gallery Scout.');
      if (item.state !== 'complete') return { pending: true };
      try {
        await chrome.downloads.open(item.id);
        return { opened: true };
      } catch {
        // Some Chrome versions require the user to open from Chrome Downloads instead.
        await chrome.downloads.show(item.id);
        return { shown: true };
      }
    }
    if (message?.action === 'DOWNLOAD_ASSET' || message?.action === 'OPEN_ASSET') {
      const url = safeDownloadUrl(message.url);
      if (!url) throw new GalleryError('This media URL cannot be downloaded safely. Open the original post instead.');
      if (!safeFilename(message.filename)) throw new GalleryError('Invalid download filename.');
      const viewable = /\.(?:pdf|txt|md|json|csv|jpg|jpeg|png|gif|webp|bmp|avif|mp3|wav|ogg|mp4|webm)$/i.test(message.filename);
      if (message.action === 'OPEN_ASSET' && viewable) {
        await chrome.tabs.create({ url });
        return { opened: true };
      }
      try {
        const downloadId = await chrome.downloads.download({
          url, filename: message.filename, conflictAction: 'uniquify', saveAs: false,
        });
        return message.action === 'OPEN_ASSET' ? { downloadId, requiresOpen: true } : { downloadId };
      } catch {
        // Chrome error details can contain signed URLs; never return them to the gallery.
        throw new GalleryError('Chrome could not queue this download. Check Downloads or open the post on Patreon.');
      }
    }
    if (message?.action === 'LOAD_PAGE' || message?.action === 'LOAD_DETAIL') {
      if (!Number.isInteger(message.tabId) || !/^\d+$/.test(String(message.campaignId))) {
        throw new GalleryError('Invalid tab or campaign.');
      }
      const tab = await chrome.tabs.get(message.tabId);
      if (!tab.url?.startsWith('https://www.patreon.com/')) throw new GalleryError('Open a Patreon tab before loading posts.');
      if (message.action === 'LOAD_DETAIL') {
        if (!/^\d+$/.test(String(message.postId))) throw new GalleryError('Invalid post ID.');
        return chrome.tabs.sendMessage(message.tabId, {
          action: 'LOAD_DETAIL', campaignId: String(message.campaignId), postId: String(message.postId),
        });
      }
      return chrome.tabs.sendMessage(message.tabId, {
        action: 'LOAD_PAGE', campaignId: String(message.campaignId), reset: message.reset === true,
      });
    }
    throw new GalleryError('Unsupported gallery action.');
  }

  forward().then(sendResponse, (error) => sendResponse({
    error: error instanceof GalleryError ? error.message : 'Chrome could not complete this action. Reload the Patreon tab and try again.',
  }));
  return true;
});
