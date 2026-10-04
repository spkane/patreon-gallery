/* A file-type illustration is derived only from the filename, never from a media URL. */
(() => {
  'use strict';
  function kindForName(name) {
    const ext = typeof name === 'string' ? name.trim().match(/\.([a-z0-9]{1,6})$/i)?.[1]?.toLowerCase() : null;
    if (!ext) return { label: 'FILE', tone: 'other' };
    if (ext === 'pdf') return { label: 'PDF', tone: 'pdf' };
    if (['zip', 'gz', 'tgz', 'rar', '7z', 'tar'].includes(ext)) return { label: 'ZIP', tone: 'archive' };
    if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return { label: 'DOC', tone: 'document' };
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { label: 'XLS', tone: 'sheet' };
    if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return { label: 'PPT', tone: 'slides' };
    if (['txt', 'md', 'epub'].includes(ext)) return { label: ext.toUpperCase(), tone: 'text' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return { label: 'IMG', tone: 'image' };
    return { label: ext.length <= 4 ? ext.toUpperCase() : 'FILE', tone: 'other' };
  }
  globalThis.GalleryFileIcons = { kindForName };
})();
