/* Pure gallery ordering: right goes forward in time, independent of card-grid sort. */
(() => {
  'use strict';

  function orderPosts(posts) {
    return [...posts].sort((a, b) =>
      (a.date || '9999').localeCompare(b.date || '9999') ||
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );
  }

  function orderImages(posts) {
    return orderPosts([...posts].filter((post) => post.type === 'image'));
  }

  function orderMedia(posts) {
    return orderPosts([...posts].filter((post) => ['image', 'video', 'file'].includes(post.type)));
  }

  function adjacent(images, postId, direction) {
    const index = images.findIndex((post) => post.id === postId);
    return index < 0 ? null : images[index + direction] || null;
  }

  function pick(images, mode, wasViewed, date = '') {
    if (!images.length) return null;
    switch (mode) {
      case 'oldest': return images[0];
      case 'newest': return images[images.length - 1];
      case 'newest-unread': return images.findLast((post) => !wasViewed(post)) || images[images.length - 1];
      case 'date': return images.find((post) => post.date >= date) || images[images.length - 1];
      default: return images.find((post) => !wasViewed(post)) || images[0];
    }
  }

  globalThis.GalleryNavigation = { orderImages, orderMedia, orderPosts, adjacent, pick };
})();
