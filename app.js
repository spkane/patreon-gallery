const svgData = (label, palette = ["#f6b13b", "#e8542f", "#241b19"], shape = "strip") => {
  const [bg, accent, ink] = palette;
  const motif = shape === "comic"
    ? `<path d="M80 120h500v440H80z" fill="#fff8ec" stroke="${ink}" stroke-width="10"/><path d="M132 185h140M132 245h340M132 305h240" stroke="${ink}" stroke-width="14" stroke-linecap="round"/><ellipse cx="405" cy="384" rx="112" ry="92" fill="${accent}" stroke="${ink}" stroke-width="10"/><path d="M360 368c30-35 92-34 118 0" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/>`
    : shape === "video"
      ? `<rect x="74" y="96" width="532" height="388" rx="38" fill="#211917"/><polygon points="295,202 295,378 438,290" fill="${accent}"/><path d="M95 528h490" stroke="${ink}" stroke-width="14" stroke-linecap="round"/>`
      : `<rect x="135" y="82" width="350" height="480" rx="26" fill="#fff8ec" stroke="${ink}" stroke-width="10"/><path d="M374 82v112h111" fill="none" stroke="${ink}" stroke-width="10"/><path d="M190 252h240M190 312h210M190 372h240" stroke="${ink}" stroke-width="14" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 620"><rect width="680" height="620" fill="${bg}"/><circle cx="588" cy="76" r="156" fill="${accent}" opacity=".22"/><circle cx="42" cy="565" r="170" fill="#96ccb9" opacity=".35"/>${motif}<text x="48" y="585" fill="${ink}" font-family="Georgia,serif" font-size="42" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const textFile = (content) => `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;

const demoMemberships = [
  {
    id: "bloom-county-boys",
    name: "The Bloom County Boys",
    handle: "cw/TheBloomCountyBoys",
    url: "https://www.patreon.com/cw/TheBloomCountyBoys",
    description: "Demo comic-strip archive with sequential images, commentary, and easy resume behavior.",
    postsLoaded: true,
    posts: [
      {
        id: "bloom-2024-09-01",
        title: "Sunday strip: A penguin tries cloud storage",
        date: "2024-09-01",
        description: "A sample comic-gallery post showing how a subscriber could browse a full-size strip, read creator notes, jump to comments, and mark the post as viewed.",
        originalUrl: "https://www.patreon.com/cw/TheBloomCountyBoys/posts/sample-sunday-strip",
        commentsUrl: "https://www.patreon.com/cw/TheBloomCountyBoys/posts/sample-sunday-strip?view=comments",
        assets: [
          { id: "bloom-0901-strip", type: "image", name: "sunday-strip-cloud-storage.png", url: svgData("Sunday Strip", ["#ffe3a0", "#e8542f", "#241b19"], "comic") },
          { id: "bloom-0901-panel", type: "image", name: "bonus-panel.png", url: svgData("Bonus Panel", ["#cbe7dc", "#f6b13b", "#241b19"], "comic") }
        ]
      },
      {
        id: "bloom-2024-08-28",
        title: "Process clip: inking the punchline",
        date: "2024-08-28",
        description: "Video posts appear with a poster image in the grid. In the detail view they can play inline when the source is available to the browser.",
        originalUrl: "https://www.patreon.com/cw/TheBloomCountyBoys/posts/sample-process-clip",
        commentsUrl: "https://www.patreon.com/cw/TheBloomCountyBoys/posts/sample-process-clip?view=comments",
        assets: [
          { id: "bloom-0828-video", type: "video", name: "inking-punchline.mp4", previewUrl: svgData("Process Clip", ["#241b19", "#e8542f", "#fff8ec"], "video"), url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", downloadUrl: textFile("Demo placeholder for inking-punchline.mp4. Real Patreon media requires authenticated retrieval.") }
        ]
      }
    ]
  },
  {
    id: "mango-jelly-solutions",
    name: "Mango Jelly Solutions",
    handle: "c/mangojellysolutions",
    url: "https://www.patreon.com/c/mangojellysolutions",
    description: "Demo mixed-media membership with video previews, downloadable design files, and searchable release notes.",
    postsLoaded: true,
    posts: [
      {
        id: "mango-2024-09-12",
        title: "September asset drop: citrus UI kit",
        date: "2024-09-12",
        description: "A mixed file-and-image post for testing asset counts, bulk downloads, post descriptions, and original Patreon links.",
        originalUrl: "https://www.patreon.com/c/mangojellysolutions/posts/sample-citrus-ui-kit",
        commentsUrl: "https://www.patreon.com/c/mangojellysolutions/posts/sample-citrus-ui-kit?view=comments",
        assets: [
          { id: "mango-0912-preview", type: "image", name: "citrus-ui-kit-preview.png", url: svgData("Citrus Kit", ["#f6b13b", "#96ccb9", "#241b19"], "strip") },
          { id: "mango-0912-zip", type: "file", fileType: "ZIP", name: "citrus-ui-kit.zip", url: textFile("Demo ZIP placeholder. Replace with authenticated Patreon file URL in production."), previewUrl: svgData("ZIP Bundle", ["#fff2c7", "#e8542f", "#241b19"], "file") }
        ]
      },
      {
        id: "mango-2024-08-31",
        title: "Behind the build: responsive gallery walkthrough",
        date: "2024-08-31",
        description: "A sample video entry. The preview poster loads in card view and the detail pane provides playback plus download/open actions.",
        originalUrl: "https://www.patreon.com/c/mangojellysolutions/posts/sample-gallery-walkthrough",
        commentsUrl: "https://www.patreon.com/c/mangojellysolutions/posts/sample-gallery-walkthrough?view=comments",
        assets: [
          { id: "mango-0831-video", type: "video", name: "responsive-gallery-walkthrough.mp4", previewUrl: svgData("Walkthrough", ["#2e3731", "#96ccb9", "#fff8ec"], "video"), url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", downloadUrl: textFile("Demo placeholder for responsive-gallery-walkthrough.mp4.") }
        ]
      }
    ]
  }
];

const STORAGE_KEYS = {
  viewed: "patreon-gallery:viewed:v1",
  lastViewed: "patreon-gallery:last-viewed:v1",
  activeMembership: "patreon-gallery:active-membership:v1"
};

let memberships = demoMemberships;
let backendMode = "demo";
let authUser = null;
let loadingMembershipId = "";

const state = {
  activeMembershipId: localStorage.getItem(STORAGE_KEYS.activeMembership) || demoMemberships[0].id,
  filters: { search: "", from: "", to: "", type: "all", viewed: "all", sort: "desc" },
  viewed: readJson(STORAGE_KEYS.viewed, {}),
  lastViewed: readJson(STORAGE_KEYS.lastViewed, {})
};

const $ = (id) => document.getElementById(id);
const els = {
  membershipList: $("membershipList"),
  galleryGrid: $("galleryGrid"),
  activeTitle: $("activeTitle"),
  activeSubtitle: $("activeSubtitle"),
  searchInput: $("searchInput"),
  fromDate: $("fromDate"),
  toDate: $("toDate"),
  typeFilter: $("typeFilter"),
  viewedFilter: $("viewedFilter"),
  sortOrder: $("sortOrder"),
  clearFilters: $("clearFilters"),
  resetState: $("resetState"),
  downloadFiltered: $("downloadFiltered"),
  continueButton: $("continueButton"),
  jumpSelect: $("jumpSelect"),
  postDialog: $("postDialog"),
  dialogBody: $("dialogBody"),
  closeDialog: $("closeDialog"),
  emptyState: $("emptyState"),
  toast: $("toast"),
  statPosts: $("statPosts"),
  statAssets: $("statAssets"),
  statViewed: $("statViewed"),
  statDateRange: $("statDateRange"),
  apiModeBadge: $("apiModeBadge"),
  authStatusText: $("authStatusText"),
  authAction: $("authAction"),
  logoutAction: $("logoutAction")
};

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.viewed, JSON.stringify(state.viewed));
  localStorage.setItem(STORAGE_KEYS.lastViewed, JSON.stringify(state.lastViewed));
  localStorage.setItem(STORAGE_KEYS.activeMembership, state.activeMembershipId);
}

function activeMembership() {
  return memberships.find((membership) => membership.id === state.activeMembershipId) || memberships[0] || { id: "", name: "No memberships", handle: "", description: "", posts: [] };
}

function allAssets(post) { return post.assets || []; }

function formatDate(date) {
  if (!date || date === "1970-01-01") return "Undated";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  if (!response.ok) {
    let payload = {};
    try { payload = await response.json(); } catch { /* ignore */ }
    const error = new Error(payload?.error?.message || `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadAuthAndMemberships() {
  try {
    const status = await apiFetch("/api/v1/auth/status");
    if (!status.configured) {
      backendMode = "server-unconfigured";
      memberships = demoMemberships;
      updateAuthPanel(status);
      return;
    }
    if (!status.authenticated && !status.creatorTokenConfigured) {
      backendMode = "server-guest";
      memberships = demoMemberships;
      updateAuthPanel(status);
      return;
    }
    backendMode = status.authenticated ? "patreon" : "creator-token";
    authUser = status.user;
    const payload = await apiFetch("/api/v1/memberships");
    memberships = (payload.items || []).map((membership) => ({ ...membership, posts: membership.posts || [], postsLoaded: Boolean(membership.postsLoaded) }));
    if (memberships.length && !memberships.some((membership) => membership.id === state.activeMembershipId)) {
      state.activeMembershipId = memberships[0].id;
      persist();
    }
    updateAuthPanel(status);
    if (memberships.length) await loadPostsForMembership(activeMembership());
  } catch (error) {
    backendMode = "demo";
    memberships = demoMemberships;
    updateAuthPanel(null, error);
  }
}

function updateAuthPanel(status, error = null) {
  const badge = els.apiModeBadge;
  badge.classList.remove("connected");
  els.logoutAction.hidden = true;
  els.authAction.hidden = false;
  if (backendMode === "patreon") {
    badge.textContent = "Connected";
    badge.classList.add("connected");
    const creatorNote = status?.creatorTokenConfigured ? " Creator-token campaigns are also available." : "";
    els.authStatusText.textContent = `Connected as ${status?.user?.name || "a Patreon user"}. Choose any returned membership below.${creatorNote}`;
    els.authAction.textContent = "Reconnect";
    els.logoutAction.hidden = false;
    return;
  }
  if (backendMode === "creator-token") {
    badge.textContent = "Creator token";
    badge.classList.add("connected");
    els.authStatusText.textContent = "Using PATREON_GALLERY_CREATOR_ACCESS_TOKEN to load creator campaigns. Connect Patreon too if you also want subscriber memberships.";
    els.authAction.textContent = "Connect Patreon";
    return;
  }
  if (backendMode === "server-guest") {
    badge.textContent = "Ready";
    els.authStatusText.textContent = "Patreon OAuth is configured. Connect a Patreon account to load your memberships; demo content is shown until then.";
    els.authAction.textContent = "Connect Patreon";
    return;
  }
  if (backendMode === "server-unconfigured") {
    badge.textContent = "Needs config";
    els.authStatusText.textContent = "The local server is running, but PATREON_CLIENT_ID and PATREON_CLIENT_SECRET are not configured. Demo content is shown.";
    els.authAction.textContent = "Connect Patreon";
    return;
  }
  badge.textContent = "Demo";
  els.authStatusText.textContent = error ? "No local API server was detected. Start python3 server.py to enable Patreon OAuth. Demo content is shown." : "Demo content is shown.";
  els.authAction.textContent = "Connect Patreon";
}

async function loadPostsForMembership(membership) {
  if (!membership || !["patreon", "creator-token"].includes(backendMode) || membership.postsLoaded || loadingMembershipId === membership.id) return;
  loadingMembershipId = membership.id;
  membership.loadError = "";
  renderGallery();
  try {
    let cursor = "";
    let page = 0;
    const posts = [];
    do {
      const suffix = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const payload = await apiFetch(`/api/v1/memberships/${encodeURIComponent(membership.id)}/posts?limit=100${suffix}`);
      posts.push(...(payload.items || []));
      cursor = payload.nextCursor || "";
      page += 1;
    } while (cursor && page < 10);
    membership.posts = posts;
    membership.postsLoaded = true;
  } catch (error) {
    membership.posts = [];
    membership.postsLoaded = false;
    const upstream = error.payload?.error?.details;
    const reasons = (upstream?.payload?.errors || []).map((item) => item.detail || item.title).filter(Boolean);
    membership.loadError = [error.payload?.error?.message || error.message, ...reasons, "Select this membership again to retry."].join(" ");
    console.warn("Unable to load Patreon posts", error);
  } finally {
    loadingMembershipId = "";
    renderGallery();
  }
}

function postMatches(post) {
  const query = state.filters.search.trim().toLowerCase();
  const date = post.date || "1970-01-01";
  const viewed = Boolean(state.viewed[post.id]);
  const text = [post.title, post.description, ...allAssets(post).map((asset) => asset.name)].join(" ").toLowerCase();
  const typeMatch = state.filters.type === "all" || allAssets(post).some((asset) => asset.type === state.filters.type);
  const viewedMatch = state.filters.viewed === "all" || (state.filters.viewed === "viewed" ? viewed : !viewed);
  const fromMatch = !state.filters.from || date >= state.filters.from;
  const toMatch = !state.filters.to || date <= state.filters.to;
  const searchMatch = !query || text.includes(query);
  return typeMatch && viewedMatch && fromMatch && toMatch && searchMatch;
}

function filteredPosts() {
  const posts = (activeMembership().posts || []).filter(postMatches);
  return posts.sort((a, b) => state.filters.sort === "asc" ? (a.date || "").localeCompare(b.date || "") : (b.date || "").localeCompare(a.date || ""));
}

function renderMemberships() {
  els.membershipList.innerHTML = memberships.map((membership) => {
    const posts = membership.posts || [];
    const viewed = posts.filter((post) => state.viewed[post.id]).length;
    const totalAssets = posts.reduce((count, post) => count + allAssets(post).length, 0);
    const loading = loadingMembershipId === membership.id ? " · loading posts…" : "";
    const source = membership.source === "creator_env" ? " · creator token" : "";
    const status = ["patreon", "creator-token"].includes(backendMode) && !membership.postsLoaded ? " · posts not loaded" : loading;
    return `<button class="membership-card ${membership.id === state.activeMembershipId ? "active" : ""}" type="button" data-membership="${escapeHtml(membership.id)}">
      <strong>${escapeHtml(membership.name)}</strong>
      <span>${posts.length} posts · ${totalAssets} assets · ${viewed} viewed${source}${status}</span>
    </button>`;
  }).join("") || `<p class="panel-note">No memberships were returned for this Patreon account.</p>`;
}

function renderStats(posts) {
  const membership = activeMembership();
  const assetCount = posts.reduce((count, post) => count + allAssets(post).length, 0);
  const viewedCount = posts.filter((post) => state.viewed[post.id]).length;
  const dates = posts.map((post) => post.date).filter(Boolean).sort();
  els.statPosts.textContent = posts.length;
  els.statAssets.textContent = assetCount;
  els.statViewed.textContent = viewedCount;
  els.statDateRange.textContent = dates.length ? `${formatDate(dates[0])} – ${formatDate(dates.at(-1))}` : "—";
  els.activeTitle.textContent = membership.name || "Gallery";
  const source = membership.url ? ` Source: ${membership.handle || membership.url}` : "";
  els.activeSubtitle.textContent = `${membership.description || "Choose a membership to view its posts."}${source}`;
}

function renderJump(posts) {
  els.jumpSelect.innerHTML = posts.map((post, index) => `<option value="${escapeHtml(post.id)}">${index + 1}. ${escapeHtml(post.title)} · ${formatDate(post.date)}</option>`).join("");
  els.jumpSelect.disabled = posts.length === 0;
}

function previewMarkup(asset) {
  if (asset.type === "image") return `<img loading="lazy" src="${asset.url}" alt="${escapeHtml(asset.name)}" />`;
  if (asset.type === "video") return `<img loading="lazy" src="${asset.previewUrl || asset.url}" alt="Video preview for ${escapeHtml(asset.name)}" /><span class="video-badge">▶ Video</span>`;
  return `<div class="file-preview"><div><div class="file-icon">${escapeHtml(asset.fileType || "FILE")}</div><strong>${escapeHtml(asset.name)}</strong></div></div><span class="file-badge">File</span>`;
}

function placeholderAsset(post) {
  return { id: `${post.id}-placeholder`, type: "file", fileType: "POST", name: "No media returned by Patreon API", url: post.originalUrl || "#" };
}

function renderGallery() {
  const membership = activeMembership();
  const posts = filteredPosts();
  renderMemberships();
  renderStats(posts);
  renderJump(posts);
  if (loadingMembershipId === membership.id) {
    els.emptyState.hidden = false;
    els.emptyState.textContent = "Loading Patreon posts…";
  } else if (membership.loadError) {
    els.emptyState.hidden = false;
    els.emptyState.textContent = membership.loadError;
  } else {
    els.emptyState.hidden = posts.length !== 0;
    els.emptyState.textContent = backendMode === "patreon" && membership.postsLoaded && !membership.posts.length
      ? "Patreon OAuth returned no posts for this membership. For a signed-in browser preview, see the Chrome extension setup in README.md."
      : "No posts match the current filters.";
  }
  els.galleryGrid.innerHTML = posts.map((post) => {
    const previewAssets = (allAssets(post).length ? allAssets(post) : [placeholderAsset(post)]).slice(0, 3);
    const viewedBadge = state.viewed[post.id] ? `<span class="viewed-badge">Viewed</span>` : "";
    const types = [...new Set((allAssets(post).length ? allAssets(post) : [placeholderAsset(post)]).map((asset) => asset.type))].join(" + ");
    return `<article class="post-card" id="post-${escapeHtml(post.id)}" data-post="${escapeHtml(post.id)}">
      <div class="media-stack">
        ${previewAssets.map((asset) => `<button class="media-tile" type="button" data-open-post="${escapeHtml(post.id)}" aria-label="Open ${escapeHtml(post.title)}">${previewMarkup(asset)}${viewedBadge}</button>`).join("")}
      </div>
      <div class="card-body">
        <div class="card-meta"><span>${formatDate(post.date)}</span><span>${escapeHtml(types || "post")}</span></div>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="description">${escapeHtml(post.description || "No description returned.")}</p>
        <div class="asset-actions">
          <button class="secondary-button" type="button" data-open-post="${escapeHtml(post.id)}">Open</button>
          <button class="ghost-button" type="button" data-download-post="${escapeHtml(post.id)}">Download post</button>
          <a class="link-button" href="${post.originalUrl || '#'}" target="_blank" rel="noreferrer">Original ↗</a>
        </div>
      </div>
    </article>`;
  }).join("");
}

function markViewed(post) {
  state.viewed[post.id] = new Date().toISOString();
  state.lastViewed[state.activeMembershipId] = post.id;
  persist();
}

function mediaDetailMarkup(asset) {
  if (asset.type === "image") return `<img src="${asset.url}" alt="${escapeHtml(asset.name)}" />`;
  if (asset.type === "video") return `<video src="${asset.url}" poster="${asset.previewUrl || ""}" controls preload="metadata"></video>`;
  return `<a href="${asset.url}" target="_blank" rel="noreferrer" class="file-preview"><div><div class="file-icon">${escapeHtml(asset.fileType || "FILE")}</div><strong>${escapeHtml(asset.name)}</strong><p>Open file</p></div></a>`;
}

function openPost(postId) {
  const post = activeMembership().posts.find((candidate) => candidate.id === postId);
  if (!post) return;
  markViewed(post);
  const assets = allAssets(post).length ? allAssets(post) : [placeholderAsset(post)];
  els.dialogBody.innerHTML = `<div class="dialog-layout">
    <div class="dialog-media">${assets.map(mediaDetailMarkup).join("")}</div>
    <aside class="dialog-copy">
      <p class="eyebrow">${formatDate(post.date)}</p>
      <h2 id="dialogTitle">${escapeHtml(post.title)}</h2>
      <p class="dialog-description">${escapeHtml(post.description || "No description returned.")}</p>
      <div class="dialog-link-row">
        <a class="primary-button" href="${post.originalUrl || '#'}" target="_blank" rel="noreferrer">Original post ↗</a>
        <a class="secondary-button" href="${post.commentsUrl || post.originalUrl || '#'}" target="_blank" rel="noreferrer">Comments ↗</a>
      </div>
      <div class="dialog-asset-list">
        ${assets.map((asset) => `<div class="dialog-asset-row"><span>${escapeHtml(asset.name)}</span><button class="ghost-button" type="button" data-download-asset="${escapeHtml(post.id)}::${escapeHtml(asset.id)}">Download</button></div>`).join("")}
      </div>
    </aside>
  </div>`;
  if (typeof els.postDialog.showModal === "function") els.postDialog.showModal();
  renderGallery();
}

function downloadUrl(url, filename) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  anchor.target = url.startsWith("http") ? "_blank" : "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function downloadableUrl(asset) { return asset.downloadUrl || asset.url || asset.previewUrl; }
function downloadAsset(asset) { downloadUrl(downloadableUrl(asset), asset.name || "patreon-asset"); }

function downloadPost(post) {
  const assets = allAssets(post);
  if (!assets.length) {
    toast("No downloadable media was returned for this post. Opening original Patreon post instead.");
    window.open(post.originalUrl, "_blank", "noreferrer");
    return;
  }
  assets.forEach((asset, index) => setTimeout(() => downloadAsset(asset), index * 180));
  toast(`Queued ${assets.length} download${assets.length === 1 ? "" : "s"}.`);
}

function downloadFiltered() {
  const posts = filteredPosts();
  const assets = posts.flatMap((post) => allAssets(post).map((asset) => ({ post, asset })));
  const manifest = {
    membership: activeMembership().name,
    exportedAt: new Date().toISOString(),
    filters: state.filters,
    posts: posts.map((post) => ({ id: post.id, title: post.title, date: post.date, originalUrl: post.originalUrl, commentsUrl: post.commentsUrl, assets: allAssets(post).map((asset) => ({ name: asset.name, type: asset.type, url: asset.url })) }))
  };
  downloadUrl(`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest, null, 2))}`, "patreon-gallery-export-manifest.json");
  assets.forEach(({ asset }, index) => setTimeout(() => downloadAsset(asset), 300 + index * 220));
  toast(`Queued manifest plus ${assets.length} asset download${assets.length === 1 ? "" : "s"}. Browser settings may ask for permission.`);
}

function resetFilters() {
  state.filters = { search: "", from: "", to: "", type: "all", viewed: "all", sort: "desc" };
  els.searchInput.value = "";
  els.fromDate.value = "";
  els.toDate.value = "";
  els.typeFilter.value = "all";
  els.viewedFilter.value = "all";
  els.sortOrder.value = "desc";
  renderGallery();
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => els.toast.classList.remove("show"), 3200);
}

function continueLastViewed() {
  const membership = activeMembership();
  const lastViewedId = state.lastViewed[membership.id];
  const target = membership.posts.find((post) => post.id === lastViewedId)
    || membership.posts.find((post) => !state.viewed[post.id])
    || membership.posts[0];
  if (target) openPost(target.id);
}

async function selectMembership(id) {
  state.activeMembershipId = id;
  persist();
  const membership = activeMembership();
  renderGallery();
  await loadPostsForMembership(membership);
}

function bindEvents() {
  els.membershipList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-membership]");
    if (!button) return;
    selectMembership(button.dataset.membership);
  });

  els.galleryGrid.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-post]");
    const downloadButton = event.target.closest("[data-download-post]");
    if (openButton) openPost(openButton.dataset.openPost);
    if (downloadButton) {
      const post = activeMembership().posts.find((candidate) => candidate.id === downloadButton.dataset.downloadPost);
      if (post) downloadPost(post);
    }
  });

  els.dialogBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-download-asset]");
    if (!button) return;
    const [postId, assetId] = button.dataset.downloadAsset.split("::");
    const post = activeMembership().posts.find((candidate) => candidate.id === postId);
    const asset = (post?.assets || []).find((candidate) => candidate.id === assetId);
    if (asset) { downloadAsset(asset); toast(`Downloaded ${asset.name}`); }
  });

  els.closeDialog.addEventListener("click", () => els.postDialog.close());
  els.postDialog.addEventListener("click", (event) => { if (event.target === els.postDialog) els.postDialog.close(); });

  els.searchInput.addEventListener("input", (event) => { state.filters.search = event.target.value; renderGallery(); });
  els.fromDate.addEventListener("input", (event) => { state.filters.from = event.target.value; renderGallery(); });
  els.toDate.addEventListener("input", (event) => { state.filters.to = event.target.value; renderGallery(); });
  els.typeFilter.addEventListener("change", (event) => { state.filters.type = event.target.value; renderGallery(); });
  els.viewedFilter.addEventListener("change", (event) => { state.filters.viewed = event.target.value; renderGallery(); });
  els.sortOrder.addEventListener("change", (event) => { state.filters.sort = event.target.value; renderGallery(); });
  els.clearFilters.addEventListener("click", resetFilters);
  els.downloadFiltered.addEventListener("click", downloadFiltered);
  els.continueButton.addEventListener("click", continueLastViewed);
  els.jumpSelect.addEventListener("change", (event) => openPost(event.target.value));
  els.resetState.addEventListener("click", () => {
    state.viewed = {};
    state.lastViewed = {};
    persist();
    renderGallery();
    toast("Viewed history reset.");
  });
  els.logoutAction.addEventListener("click", async () => {
    try { await apiFetch("/api/v1/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    window.location.reload();
  });
}

async function init() {
  bindEvents();
  updateAuthPanel(null);
  renderGallery();
  await loadAuthAndMemberships();
  renderGallery();
}

init();
