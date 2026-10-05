# Release security and permissions review

Scope: Chrome extension, source packaging, public documentation/site. Reviewed 2026-10-04. This is a maintainer review, not an independent penetration test or certification. The legacy localhost OAuth demo is outside the extension release and has not received a complete deployment/security audit.

## Threat model

Inputs: Patreon website JSON, provider URLs, extension runtime messages, local viewed state, download filenames. Outputs: gallery DOM, browser tabs, Chrome Downloads, text URL exports. A malicious creator can control post text and links. A local user can edit an unpacked extension. Patreon and media providers remain trusted to enforce account access on the network.

## Findings recorded before remediation

### LOW-1: gallery sender checked by URL prefix

Location: `extension/background.js:29` in the pre-release code. The runtime handler accepted any same-extension URL beginning with `gallery.html`, not just that page. A future bundled `gallery.html-other` page could inherit download and tab privileges unexpectedly. Reachability requires a same-extension context; an ordinary website cannot impersonate the extension ID. Remediation: compare parsed origin and pathname exactly, while permitting query strings. Add negative regression cases.

### LOW-2: content script did not validate runtime sender

Location: `extension/content.js:108` in the pre-release code. The handler ignored the sender and would process commands delivered by another extension context if Chrome routed them. Ordinary page JavaScript cannot directly invoke this isolated handler and no external messaging is declared, limiting reachability. Remediation: accept only the extension's own ID and its service-worker sender (no tab); regression-test rejected senders without performing fetches.

### LOW-3: raw exception messages could disclose request URLs

Location: `extension/background.js`, runtime rejection response. Most download failures were sanitized, but other Chrome API failures could return error text containing a signed URL or tab data. Remediation: return a generic message for unexpected errors; retain only explicitly authored safe validation errors.

### LOW-4: real early-access watch links in test fixtures

Location: `tests/extension-feed.test.cjs:120–165` in pre-release source. Multi-link regression tests used the user-provided example's real video IDs. Publishing source could disclose links intended for members. Remediation: replace them with synthetic IDs/titles. Earlier commits still retain those values; review history before any source push. No history rewrite was performed.

## Non-findings and safeguards

- Post normalization requires `current_user_can_view === true` for feed and detail data. Locked previews do not create assets.
- Asset/download URLs are HTTPS, credential-free, and restricted to Patreon file routes or Patreon CDN hosts. Filenames reject traversal and remain relative to Downloads.
- No provider-supplied HTML is rendered. Post text uses `textContent`; YouTube body links are reduced to validated canonical watch URLs. Vimeo frames are click-to-load and CSP restricted.
- No cookie-reading permission, exported session, native messaging, external messaging, remote JavaScript, analytics, or maintainer backend is used by the extension.
- Opening downloaded files requires a separate user action and verifies `byExtensionId`. Download does not deliberately launch files. Chrome's warnings and security decisions must not be bypassed.
- Scans are capped at 100 pages; batches are paced and capped at 1,500 attempts. Detail fetches have timeouts and reject redirects.

## Permissions decision

| Permission | Purpose | Decision |
| --- | --- | --- |
| `https://www.patreon.com/*` | Signed-in content scripts, tab discovery/URL visibility, same-origin API reads | Retain this one host; no wildcard web access or CDN host permission |
| `scripting` | Restore the bundled content script on already-open Patreon tabs after extension reload | Retain; only bundled files injected into permitted Patreon tabs |
| `downloads` | Explicit download queues, checking completion and extension ownership, showing a file | Retain for the advertised download functionality |
| `downloads.open` | Separate Open downloaded file action | Retain; never automatically open after download. Native-app launch is sensitive and should only be used with trusted files |

`tabs`, `cookies`, `history`, `webRequest`, `nativeMessaging`, and broad host access are not requested. Making downloads optional is a possible later UX improvement, not a security guarantee; this release retains them because downloads are a core feature. Chrome's `downloads` permission necessarily grants more history visibility than this implementation uses.

## Remediation and verification

The release hardens both sender checks and unexpected error responses, with tests, and replaces real early-access fixture links with synthetic examples. Packaging uses a file allowlist and places the manifest at ZIP root. The site contains no extension code that runs against Patreon, OAuth credentials, third-party scripts, or private membership screenshots.

Run `python3 scripts/check.py` for current tests and package checks. This report describes inspected code, not a guarantee of zero vulnerabilities. Real-session release smoke tests are still required; see the release checklist.

## Residual risks

- Patreon website APIs are undocumented and can change or revoke access. Scanning, simultaneous gallery tabs, or many detail requests may trigger rate limits. Stop on errors; do not bypass restrictions.
- Browser download redirects are ultimately handled by Chrome. A validated initial CDN URL does not establish the safety of the returned bytes or final destination.
- Filename extensions are only hints for browser support, not proof of MIME type or safety. Native files can execute dangerous app behavior; downloaded content is untrusted.
- Signed URLs exist in page memory and Chrome download history. Viewed IDs persist locally. Shared profiles, screenshots, logs and URL exports can disclose membership or unlisted-video information.
- The legacy Python/OAuth demo must remain localhost-only and is not supported for paid-subscriber archive access or internet deployment.
