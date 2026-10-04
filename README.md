# Patreon Gallery Scout

A frontend + small local Python backend for browsing Patreon membership media as a responsive image/video/file gallery.

## Current features

- Patreon OAuth login through a local backend (`server.py`).
- Membership picker populated from the authenticated Patreon account when OAuth is configured.
- Demo fallback for The Bloom County Boys and Mango Jelly Solutions when the server is not running/configured.
- Responsive card grid with image previews, video posters, and file-type tiles.
- Post detail dialog with media playback/preview, post description, comments link, and original post link.
- Search, date range filtering, media-type filtering, viewed/unviewed filtering, and ascending/descending sort.
- Per-membership viewed tracking and last-viewed resume via `localStorage`.
- Jump-to-post index.
- The separate Chrome extension (`extension/`) offers per-entry Open/Download actions, explicitly confirmed filtered batch queues, and a YouTube URL-list export for `yt-dlp`; it does not bundle a native downloader or export signed media URLs.

## Configure Patreon OAuth

You need three local values:

| Variable | Where it comes from | Notes |
|---|---|---|
| `PATREON_CLIENT_ID` | Patreon developer portal | Public OAuth client identifier. |
| `PATREON_CLIENT_SECRET` | Patreon developer portal | Private OAuth secret. Do not commit it. |
| `PATREON_GALLERY_SESSION_SECRET` | Generated locally | Used by this app to sign local browser sessions; not from Patreon. |

### 1. Create a Patreon OAuth client

1. Sign in to Patreon with the account you want to use for development.
2. Open Patreon's developer/client registration page: `https://www.patreon.com/portal/registration/register-clients`
3. Create a new client/app.
4. Set the redirect/callback URI exactly to:

   ```text
   http://127.0.0.1:8000/api/v1/auth/callback
   ```

   Patreon redirect URIs must match exactly. If you use `localhost`, a different port, or HTTPS, update both Patreon and `PATREON_REDIRECT_URI` to the same value.

5. Save the client and copy its client ID and client secret.

### 2. Export secrets before starting the server

```bash
export PATREON_CLIENT_ID="paste-client-id-here"
export PATREON_CLIENT_SECRET="paste-client-secret-here"
export PATREON_REDIRECT_URI="http://127.0.0.1:8000/api/v1/auth/callback"
export PATREON_GALLERY_SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
```

Alternatively, copy `.env.example` to `.env`, fill it in, and load it into your current shell:

```bash
cp .env.example .env
# edit .env, then:
set -a
source .env
set +a
```

Do not commit `.env` or paste the client secret into frontend JavaScript.

### 3. OAuth scopes

The default scopes are:

```text
identity identity[email] identity.memberships
```

If Patreon approves broader scopes for your OAuth app, override them with `PATREON_SCOPES`.

### Paid subscriber post access: what we have actually tested

The goal is to browse memberships you **pay for**. The first observed posts error was HTTP 400 because our request incorrectly included `attachments,media`; it was **not** an access-denied response. The request now uses documented Post v2 fields. After restarting `server.py`, select a paid membership again to test it. If Patreon still rejects the request, the app displays the upstream reason and allows retry by selecting that membership again.

Patreon's published docs say the official campaign posts endpoint requires the `campaigns.posts` OAuth scope; our default scopes request only `identity identity[email] identity.memberships`. Whether that scope enables access to *another creator's* paid posts for a subscriber has **not yet been confirmed**. Post/media URLs are not guaranteed by the documented Post v2 fields. Do not assume a non-empty post list means all images, videos, or files can be downloaded.

Creator access/refresh tokens are **not** the right solution for the main use case. They only apply to campaigns you own/manage. See `docs/SUBSCRIBER-ACCESS-INVESTIGATION.md` for the evidence, risks, and browser-session alternatives if the corrected official API still cannot provide subscribed content.

## Chrome subscriber preview (experimental)

The OAuth v2 campaign-post endpoint returned an empty list for a paid subscriber membership, but Patreon's **signed-in website** returned viewable post records via its own `/api/campaigns/{id}/posts` feed. A separate, local Chrome extension prototype is in `extension/`:

1. In Chrome, sign into Patreon and open a membership's **Posts** page at `https://www.patreon.com/.../posts`.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select this repository's **`extension/` directory**.
3. Keep the membership’s **Posts** tab open (`www.patreon.com/cw/<creator>/posts` is one current route). The extension can attach to an already-open tab and discover its campaign from its page or feed request; if discovery fails, reload that Patreon tab and click **Find open Patreon tabs**. An individual post page or generic Patreon home page may not identify the membership.
4. Click **Gallery Scout for Patreon** in Chrome's extensions menu and choose the campaign. **Load oldest post** or **Load oldest unread post** scans the archive with a **Stop scanning** control, clears post filters, sorts all viewable cards oldest first (including text posts), then focuses and scrolls to the requested card. The unread action falls back to the oldest if all were opened. **Media viewer · oldest unread** instead opens the chronological image/video/file viewer at its oldest unread media post. Click a brown text-post cover to open the original Patreon post; file cards offer separate **Open** and **Download** controls, with multiple/missing files shown in the viewer.

The gallery shows only posts whose website response says `current_user_can_view: true`. It discovers the selected campaign from the signed-in tab and pages through the website's chronological `/api/posts` archive. **←** goes older; **→** goes newer, across image, video, and attachment posts regardless of the card-grid sort. The **Jump to** menu offers oldest/newest, their unread equivalents, or the closest image/video/file post on or after a date. The viewer offers original-resolution images and direct inline video when Patreon provides a playable URL. **YouTube videos show a thumbnail linked to YouTube instead of an inline player:** YouTube's player returns error 153 inside Chrome extension pages without an accepted HTTP referrer. Vimeo still offers a click-to-load embed. The extension never executes provider-supplied embed HTML; unsupported videos show a preview or placeholder linking to the original video when available. File posts show a type-specific file icon (PDF, ZIP, DOC, etc.) and the full filename when Patreon provides it. Every card has **Open** and **Download** actions; every attachment in the viewer shows both, disabled if Patreon supplied no usable URL. **Download** queues a file and never deliberately opens it. **Open** opens browser-supported formats (such as PDF, common images/videos, and text) in a tab. For archives, 3D projects, and other native-app formats it queues a download, then changes to **Open downloaded file** for a second click after the download completes. Chrome can require opening it from Chrome Downloads instead; browser PDF download preferences and server response headers may also force downloads. Embeds, DRM streams, missing/expired URLs, thumbnails, and attachment IDs alone are **not** downloadable; a separate actual media URL is required.

**YouTube downloads:** YouTube cards' **Download URL list** and the viewer's **Download URL list** save plain-text watch URLs, **not video files**. Viewable text posts can contain multiple YouTube links; when Patreon provides the post body, each recognized link appears on its card, and **Download URL list** exports all of them. If the archive omitted the body, **Find video links** checks the post detail on demand. Use the sidebar's **Export YouTube URLs for yt-dlp** to collect validated watch URLs from selected video and text posts (it can scan more pages and check many details; use **Stop export** to cancel). Install the separately maintained `yt-dlp` tool yourself and run `yt-dlp --batch-file "/path/to/downloaded-list.txt"` on the resulting list, only for videos you are allowed to save. Gallery Scout does not invoke local executables, copy Patreon cookies, or export signed Patreon CDN URLs. YouTube availability, download permissions, and tool behavior depend on the video's provider and your rights.

**Batch downloads:** Choose **Current filters** (including search, media type, viewed state and sidebar dates), **All accessible media**, **Not opened here**, or **Date range**, then click **Prepare downloads**. If necessary, the gallery scans remaining post pages before showing the matching post count. **Start downloads** explicitly confirms the job; it resolves each post's entitled media immediately before queueing files under `Downloads/Gallery Scout/<campaign-id>/`. **Stop queueing** prevents new files from being added but cannot cancel downloads already started by Chrome. Jobs queue at most 1,500 files, paced one at a time; Chrome may ask you to allow multiple automatic downloads. “Queued” does not guarantee successful completion—check Chrome Downloads for any failed or expired links. No bulk job starts automatically while browsing.

The extension uses `scripting` only on `www.patreon.com`, Chrome's `downloads` permission for explicit downloads, and `downloads.open` for a separate, user-initiated Open downloaded file click. It never requests or exports cookies or passwords, sends media/tokens to `localhost`, or stores signed CDN URLs in its own local state. Chrome may retain source URLs in its download history. Card filters cover loaded pages; the gallery and batch preparation can scan up to 100 pages (up to 2,000 posts). If that limit is reached, “all,” “oldest post,” and “oldest unread” cover only the loaded subset. Viewed markers are stored in the browser profile rather than synced with Patreon's read state. Reload the extension at `chrome://extensions` after changing its files.

The website endpoint is **undocumented** and can change. Use only for content your account can view; respect Patreon terms, creator rights, and DRM. This extension was built from source here, not from any third-party downloader. More background is in `docs/SUBSCRIBER-ACCESS-INVESTIGATION.md`.

## Run locally

```bash
python3 server.py
```

Then open:

```text
http://127.0.0.1:8000
```

For demo mode, run `python3 server.py` without OAuth credentials; the UI shows sample data. **Do not use `python3 -m http.server` in this project directory**: it can expose `.env` and other local files over HTTP. `server.py` only serves the intended UI files.

## API contract

See `docs/API.md`.

## Important Patreon API note

This implementation uses OAuth and the official Patreon API first. Patreon may not expose subscriber-entitled post media through public API scopes; campaign post access may require additional approval or creator-level permissions. If Patreon refuses post/media access, the app will still authenticate and list available memberships, then show the API error for posts instead of scraping or bypassing access controls.

The OAuth-backed localhost demo currently cannot list the tested paid subscriber's posts. The Chrome extension handles media downloads within the browser instead; it does not transmit cookies to the backend or create a server-side archive.
