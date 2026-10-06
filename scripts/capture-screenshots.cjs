/* Optional documentation tool. Install playwright separately; never uses a Patreon session. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1180 }, deviceScaleFactor: 1 });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://gallery-scout.test') return route.abort();
      const examples = new Set(['/earth-apollo17.jpg', '/earth-study.mp4']);
      const name = examples.has(url.pathname) ? `docs/examples${url.pathname}`
        : `extension/${url.pathname === '/' ? 'gallery.html' : url.pathname.slice(1)}`;
      const file = path.resolve(root, name);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
      const body = fs.readFileSync(file);
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
      if (range && path.extname(file) === '.mp4') {
        const start = Number(range[1]);
        const end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);
        await route.fulfill({ status: 206, body: body.subarray(start, end + 1), contentType: 'video/mp4',
          headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}` } });
      } else {
        await route.fulfill({ body, contentType: types[path.extname(file)] || 'application/octet-stream', headers: { 'Accept-Ranges': 'bytes' } });
      }
    });
    await page.addInitScript(() => {
      const image = 'http://gallery-scout.test/earth-apollo17.jpg';
      const video = 'http://gallery-scout.test/earth-study.mp4';
      const posts = [
        { id: '101', type: 'image', title: 'The Blue Marble — Apollo 17', date: '2026-09-03', previewUrl: image, fullUrl: image },
        { id: '104', type: 'video', title: 'Earth study — animated photo', date: '2026-08-31', previewUrl: image },
        { id: '102', type: 'file', title: 'Sketchbook templates', date: '2026-09-02', attachmentCount: 2, fileNames: ['Coastal Study — Practice Guide.pdf', 'Sketchbook Templates.zip'] },
        { id: '103', type: 'post', title: 'Notes from the studio', date: '2026-09-01' },
      ].map(post => ({ ...post, url: `https://www.patreon.com/posts/${post.id}` }));
      localStorage.setItem('gallery-scout-extension:viewed:v1', JSON.stringify({ '123:103': true }));
      window.chrome = { runtime: { sendMessage: async message => {
        if (message.action === 'LIST_TABS') return { tabs: [{ tabId: 1, title: 'Example Studio · synthetic demo', feeds: [{ campaignId: '123' }] }] };
        if (message.action === 'LOAD_PAGE') return { posts, received: posts.length, page: 1, hasMore: false };
        if (message.action === 'LOAD_DETAIL') return { detail: message.postId === '101'
          ? { fullUrl: image, description: 'NASA / Apollo 17 crew · public-domain photograph. Synthetic post, not Patreon content.', assets: [{ id: 'image:101', type: 'image', name: 'earth-apollo17.jpg', displayUrl: image, downloadUrl: 'https://c10.patreonusercontent.com/example.jpg' }] }
          : message.postId === '104'
          ? { description: 'Original silent pan/zoom animation of the NASA Apollo 17 photograph. Synthetic post, not Patreon content.', assets: [{ id: 'video:104', type: 'video', name: 'earth-study.mp4', displayUrl: video, downloadUrl: 'https://c10.patreonusercontent.com/example.mp4' }] }
          : { fileNames: posts[2].fileNames, description: 'Synthetic attachment metadata. These are not real download links.', assets: posts[2].fileNames.map((name, i) => ({ id: `file:${i}`, type: 'file', name, displayUrl: `https://c10.patreonusercontent.com/example-${i}`, downloadUrl: `https://c10.patreonusercontent.com/example-${i}` })) } };
        return { error: 'Screenshot demo: network and downloads are disabled.' };
      } }, tabs: { create: async () => {} } };
    });
    const output = path.join(root, 'docs/screenshots');
    fs.mkdirSync(output, { recursive: true });
    await page.goto('http://gallery-scout.test/');
    await page.waitForSelector('#post-101');
    await page.locator('#post-101 img').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(output, 'main-gallery.png'), fullPage: true, timeout: 15000 });
    await page.locator('#post-101 .cover-action').click();
    await page.waitForFunction(() => document.querySelector('#viewerImage').complete && document.querySelector('#viewerDownload').disabled === false);
    await page.screenshot({ path: path.join(output, 'image-viewer.png'), timeout: 15000 });
    await page.locator('#viewerPrev').click();
    await page.waitForFunction(() => document.querySelectorAll('#viewerAssets .viewer-asset').length === 2);
    await page.screenshot({ path: path.join(output, 'file-viewer.png'), timeout: 15000 });
    await page.locator('#viewerPrev').click();
    await page.waitForFunction(() => !document.querySelector('#viewerVideo').hidden && document.querySelector('#viewerVideo').readyState >= 2);
    await page.locator('#viewerVideo').evaluate(async video => {
      await video.play();
      video.pause();
      await Promise.all([
        new Promise(resolve => video.requestVideoFrameCallback(resolve)),
        new Promise(resolve => {
          video.addEventListener('seeked', resolve, { once: true });
          video.currentTime = 2.5;
        }),
      ]);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (video.currentTime < 2.4) throw new Error('Video frame did not seek.');
    });
    await page.screenshot({ path: path.join(output, 'video-viewer.png'), timeout: 15000 });
    console.log('Captured main gallery, photographic image, video playback frame, and file viewer with synthetic posts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
