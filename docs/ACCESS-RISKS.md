# Patreon access and distribution risks

Reviewed 2026-10-04 against [Patreon Terms of Use](https://www.patreon.com/policy/legal) and [Patreon's robots file](https://www.patreon.com/robots.txt). Policies can change. This is an engineering risk assessment, not legal advice or permission from Patreon.

## What the extension does

Gallery Scout makes signed-in website requests from an existing Patreon tab. It uses undocumented website APIs because the official OAuth experiment did not list the tested paid subscriber's posts. The extension neither reads cookie values nor transfers session cookies to a server. It shows only posts Patreon explicitly marks viewable. It does not unlock posts, defeat DRM, or bypass age gates.

## Material risks

1. **Viewing is not a blanket download license.** Under the Terms' member section, creators grant a non-exclusive, non-transferable, non-sublicensable, revocable, limited license to access and view creations for private, personal, non-promotional, non-commercial use. That wording is not permission to archive or redistribute all media. Save only material you are independently permitted to save; ask creators if unsure.
2. **Automation is not approved by this project.** Patreon's robots file disallows `/api/` and `/file`. Robots directives are crawler guidance, not a legal determination about this browser extension, but they are a caution signal. We have not obtained Patreon approval. A working endpoint and a paid membership do not resolve platform-policy questions.
3. **Undocumented endpoints are fragile.** Patreon can change response fields, eligibility, authentication or rate limits. Account access and previously available posts can be revoked. Stop when denied or rate-limited; do not rotate accounts, evade blocks or retry indefinitely.
4. **YouTube is separate.** A public or unlisted watch URL is not a download permission. Exported links can disclose early-access content. `yt-dlp` is separately installed, not bundled or invoked by this extension. Users must comply with provider terms, creator rights and applicable law.
5. **Source distribution is not content distribution.** Apache-2.0 covers our code only. Do not bundle paid content, real signed URLs, cookies, membership screenshots, or account data in releases, issues or the Pages site.
6. **Branding must remain accurate.** This is an unofficial third-party tool, not endorsed by Patreon or video providers. Do not advertise guaranteed access, full archive completeness, DRM removal or permanent backups.

## Release posture

Distribute as an experimental source/unpacked Chrome extension, with prominent limitations and privacy documentation. Chrome Web Store submission is not part of this release. Get legal/platform clarification before a broader commercial launch or advertising automated downloads as generally authorized. Keep downloads user-initiated, bounded and cancellable. No unattended crawling or maintainer-hosted account service is included.

## Outstanding decisions

- No written Patreon authorization has been obtained.
- Real-session smoke tests are needed before tagging a general release.
- This assessment does not establish legal compliance in any jurisdiction or audit third-party download tools.
