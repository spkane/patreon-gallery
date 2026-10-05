# General-release checklist

Distribution target: Apache-2.0 source/unpacked Chrome beta, not Chrome Web Store. Do not advertise this as a finished or Patreon-approved product.

## Before publication

- [ ] Review current Patreon/provider terms and the access-risk report; obtain advice/permission where needed. No platform approval has been established.
- [ ] Run `python3 scripts/check.py` with Node 22+ and Python 3.10+.
- [ ] Install the packaged ZIP in a fresh Chrome profile; confirm permission prompts and extension errors.
- [ ] In a real signed-in paid membership, check multiple creators, locked posts, oldest/oldest-unread starts, all-viewed fallback, date jumps and scan cancellation/limit reporting.
- [ ] Check actual PDF/browser Open, native-file Open, Download-only, batch confirmation/cancellation, failed/expired URLs and Chrome security warnings.
- [ ] Check body YouTube links, multiple links, export filters and unavailable Vimeo/media fallbacks.
- [ ] Review the archive file list: no credentials, signed URLs, private content, mocks, caches, `.git` or legacy server.
- [ ] Review Git history before pushing source: older commits may retain user-supplied early-access YouTube links replaced by synthetic fixtures in this release. Decide whether those links were intended to be public; redact history only with explicit owner approval. A new commit does not erase older content.
- [ ] Review privacy/security/access docs and license; enable private vulnerability reporting or establish a private reporting channel.
- [ ] Review project branding and ownership of bundled artwork. No third-party content should be included as examples.

## Make a release (manual, explicit publication step)

1. Update manifest version and changelog; run checks and build with `python3 scripts/package.py`.
2. Review and commit source. Push only after approving publication.
3. Create a version tag and GitHub release matching the manifest, initially marked **pre-release**.
4. Upload the versioned ZIP and its SHA-256 checksum. Record tested Chrome version, platforms and real-session results; list known limits and access/privacy risks.
5. Verify download → extraction → Load unpacked instructions from a clean folder. Do not claim a release asset exists until uploaded.

No workflow auto-publishes a release or pushes a tag. CI validates packaging only.

## Publish the static site

Enable repository Settings → Pages → Source: GitHub Actions after pushing the reviewed changes. The site workflow uploads **only `site/`**, never the root OAuth demo, extension ZIPs or account data. The intended URL for this repository is `https://spkane.github.io/patreon-gallery/`; do not treat it as live until deployment succeeds. Verify mobile layout, links and accessibility on the deployed site.

Pinned action revisions were checked against upstream GitHub refs when prepared. Re-check/update them periodically. Pages deployment needs the `github-pages` environment and repository policy to allow the workflow.

## Current readiness

Local automated tests and synthetic browser checks can establish code behavior, not paid-session availability, platform permission, successful native app launching or production deployment. Those remain human release gates. The legacy OAuth server is excluded and must not be deployed with the site.
