# Privacy

Gallery Scout Chrome extension — updated 2026-10-04.

## What stays local

The extension uses your signed-in Patreon tab to read viewable post titles, dates, descriptions, links and media metadata. The gallery keeps these and temporary media URLs in memory. It stores opened-post markers (campaign/post IDs) in the extension page's local storage on your Chrome profile. They are not synced to Patreon's reading state or sent to the maintainer.

The extension does not read cookie values, ask for passwords, export sessions, send Patreon data to a maintainer server, or include analytics, advertising or telemetry. The separate legacy OAuth demo is not the Chrome extension and is not covered by these extension-specific statements.

## Network requests and files

Patreon receives authenticated website requests and media requests. Thumbnails may be loaded from YouTube/Vimeo or Patreon CDNs, so those providers receive normal browser network information. Vimeo's player loads only after you choose playback; YouTube opens on its own site. Provider privacy policies apply independently. Browser extensions, network administrators and the browser itself may have separate visibility.

Explicit downloads are saved by Chrome and may appear in Chrome download history, including source URLs. YouTube URL-list exports contain watch links; unlisted links can disclose creator content, so do not share them publicly. The extension does not delete downloads or browser history when uninstalled.

## Clearing data

Uninstalling the extension normally removes its extension-origin local storage. In Chrome's developer tools for the gallery, Application → Local Storage can also remove `gallery-scout-extension:viewed:v1`. Close existing gallery tabs afterward so their in-memory markers do not get written back. Downloads and exported lists must be removed separately through your filesystem; clear download history separately in Chrome. Opening a post in a browser tab also creates normal browser history.

## Project website and support

The static project site has no analytics, third-party scripts or forms. GitHub hosts it and may process access logs under [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). A public issue is public: never attach raw HAR files, cookies, tokens, signed media URLs, private filenames or unredacted membership screenshots.

Questions: use the [project issue tracker](https://github.com/spkane/patreon-gallery/issues) for non-sensitive questions. For security issues, follow the security policy rather than filing exploit details publicly.
