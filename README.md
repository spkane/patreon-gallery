# Gallery Scout for Patreon

An unofficial, local Chrome extension for browsing posts and media available through **your signed-in Patreon memberships**. Start at the oldest post or oldest unread post, browse media chronologically, and save files where you have permission.

**Experimental beta.** Not affiliated with or endorsed by Patreon, YouTube or Vimeo. Uses undocumented Patreon website APIs and can stop working without notice. Paid access is not blanket permission to download or redistribute content. Read the [access risks](docs/ACCESS-RISKS.md), [privacy policy](docs/PRIVACY.md), and [permissions/security audit](docs/SECURITY-AUDIT.md) before installing.

## Install in Chrome

No Chrome Web Store install is available. You need desktop Chrome and a Patreon account with access to the posts you want to browse.

1. Download a versioned extension ZIP from [GitHub Releases](https://github.com/spkane/patreon-gallery/releases) **if a release has been published**, or clone/download this repository and use its `extension` folder directly. Do not install an unknown third-party build.
2. For a release ZIP, extract it into a permanent folder. That folder must contain `manifest.json` directly. Keep it there; Chrome loads the files in place.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder (or the repository's `extension` folder). Do not select the ZIP itself or the repository root.
4. Review the permissions. Pin **Gallery Scout for Patreon** if desired.
5. Sign into Patreon normally and open a membership's **Posts** page on `www.patreon.com`. Click the extension icon to open the gallery. No password, OAuth client registration, local Python server or exported cookie is required.

On update, replace files in the same installed folder, click **Reload** on the extension card, close old gallery tabs, reload the Patreon Posts tab, and open a fresh gallery. Reinstalling from a different path may change the unpacked extension ID and lose local reading markers.

## Browse

- Choose a detected membership/feed, then **Load posts**. If none appears, open the creator's Posts page, reload it, and choose **Find open Patreon tabs**. A generic home page or individual post may not identify a feed.
- **Load oldest post** scans the archive, clears post filters, sorts all cards oldest-first and focuses the oldest card, including text posts.
- **Load oldest unread post** does the same for the oldest post not opened in this Chrome profile; it falls back to the oldest if all are opened. Merely focusing a card does not mark it opened.
- **Media viewer · oldest unread** starts the image/video/file viewer. **← is older; → is newer**, regardless of card sort. Use its oldest/newest/unread/date jumps and Escape to close.
- Click a brown text-post cover to open the original Patreon post. Image/video covers start the viewer. File covers open a single usable file or show attachment choices.
- Filter loaded cards by title, media type, reading state and date. Ordinary search does not automatically search the whole archive.

“Unread” is local to Gallery Scout, not Patreon's read state. Archive scans have a **100-page safety limit** (normally about 2,000 posts); oldest/all may refer only to that subset. Scan progress and **Stop scanning** are shown; denial or rate limiting should not be bypassed.

## Open and Download

**Download** queues files and does not deliberately open them. **Open** shows browser-supported formats in a tab; other formats download first, then require a second **Open downloaded file** click. Chrome may instead reveal the file for you to open manually. Server headers, browser preferences, MIME types and app availability affect the result. Only launch files you trust.

Files show their full names and type icons when Patreon supplies metadata. Missing direct URLs disable attachment actions; previews and media IDs are not downloadable files. A Chrome queue acknowledgement is **not** successful download completion—check Chrome Downloads.

**Prepare downloads** uses current filters, all accessible media, unread posts or a date range. Confirm explicitly before it starts. Files go under `Downloads/Gallery Scout/<campaign-id>/`; queues are paced and capped at 1,500 attempts. **Stop queueing** prevents further additions but does not cancel files already queued in Chrome.

### YouTube and Vimeo

YouTube cannot reliably embed in extension pages (player error 153); use its watch links. Vimeo supports validated click-to-load frames. No provider-supplied HTML is executed.

Text posts can have multiple YouTube links. Each recognized link appears on its card. **Find video links** checks detail if the feed omitted the body. **Download URL list** saves a text list, not videos. The sidebar **Export YouTube URLs for yt-dlp** collects links in the selected scope and can be stopped.

Install [yt-dlp](https://github.com/yt-dlp/yt-dlp) separately, then, only for videos you are allowed to save:

```sh
yt-dlp --batch-file "/path/to/gallery-scout-youtube-list.txt"
```

Gallery Scout does not bundle or invoke that tool, bypass DRM or export Patreon cookies. Treat unlisted-video URL lists as private.

## Permissions and privacy

| Permission | Why it is used |
| --- | --- |
| `https://www.patreon.com/*` | Discover eligible tabs and read viewable posts using the signed-in website |
| `scripting` | Restore bundled content scripts on existing Patreon tabs after extension reload |
| `downloads` | Explicit download queues, completion/ownership checks, reveal downloaded files |
| `downloads.open` | A separate user-initiated attempt to open a completed file |

No `cookies`, `history`, `tabs`, native messaging, broad website access, telemetry or maintainer backend is requested/used. Media providers receive ordinary network requests; Chrome may retain signed URLs in download history. Opened-post IDs are stored locally. See [Privacy](docs/PRIVACY.md) for clearing data and [Security](SECURITY.md) for reporting.

## Troubleshooting

- **No feeds:** reload a signed-in membership Posts tab and find tabs again. Check Chrome site-access settings.
- **Stale errors after updating:** close old gallery tabs and clear old entries at `chrome://extensions`. Report errors that recur, not stored warnings alone.
- **Missing/failed media:** open the original Patreon post. The API may omit assets or return expired links. Do not bypass locked posts or rate limits.
- **Wrong oldest:** check the scan limit, loaded count and whether you chose all posts or the media-only viewer.
- **Bug reports:** include extension/Chrome versions, action taken and redacted status text in [Issues](https://github.com/spkane/patreon-gallery/issues). Do not attach tokens, cookie exports, raw HAR files, private screenshots or signed CDN URLs.

## Develop and package

Requires Node.js 22+ and Python 3.10+; the extension and static site need no dependency installation or bundler.

```sh
python3 scripts/check.py
python3 scripts/package.py
```

The package appears under `dist/`, with `manifest.json` at root and only allowlisted extension files plus license notices. ZIP generation is reproducible; binaries, caches and secrets are not source-tracked. Load source directly for local iteration.

The static project site is in `site/`; preview with `python3 -m http.server 8080 --directory site --bind 127.0.0.1`. The Pages workflow deploys only that directory. To publish later, push the reviewed commit and enable **Settings → Pages → Source: GitHub Actions**. This preparation does not activate Pages or create a public release.

Before tagging/uploading a release, follow the [release checklist](docs/RELEASE.md). CI checks tests and packaging; it does not prove paid-session compatibility or legal permission.

## Legacy OAuth demo

The root Python server and web UI are retained as an **unsupported localhost research demo**, not part of the extension or Pages deployment. Official OAuth returned an empty list for the tested paid-subscriber campaign. Do not deploy it publicly or assume it retrieves paid memberships. Its historical setup notes are in [Legacy demo](docs/LEGACY-DEMO.md); endpoint notes and subscriber investigation remain in `docs/` for development context.

## License

[Apache License 2.0](LICENSE), with [NOTICE](NOTICE). Applies to this project's code, not Patreon posts, creator media or provider content. Compatible-service names do not imply endorsement.
