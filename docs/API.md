# Patreon Gallery Scout API

## Scope

Same-repo browser frontend calls a local Python backend. The backend owns Patreon OAuth secrets, session cookies, token refresh, and Patreon API calls.

## Auth

- Browser session cookie: `pgs_session`, `HttpOnly`, `SameSite=Lax`.
- Patreon OAuth redirect flow starts at `GET /api/v1/auth/login`.
- Access/refresh tokens are stored only in server memory for this prototype.

## Error shape

All JSON errors use:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable message",
    "details": {},
    "requestId": "hex-id"
  }
}
```

## Endpoints

### `GET /api/v1/auth/status`

Response `200`:

```json
{
  "configured": true,
  "authenticated": true,
  "user": { "id": "123", "name": "Name", "email": "user@example.com", "avatarUrl": "https://..." },
  "scopes": "identity identity[email] identity.memberships"
}
```

### `GET /api/v1/auth/login`

Redirects to Patreon OAuth. Requires `PATREON_CLIENT_ID` and `PATREON_CLIENT_SECRET`; otherwise returns `503 patreon_oauth_not_configured`.

### `GET /api/v1/auth/callback`

OAuth callback. Exchanges `code`, validates `state`, loads Patreon identity + memberships, then redirects to `/`.

### `POST /api/v1/auth/logout`

Clears the local session. Response `204`.

### `GET /api/v1/memberships`

Requires auth. Response `200`:

```json
{ "items": [{ "id": "member-id", "campaignId": "campaign-id", "name": "Creator", "url": "https://www.patreon.com/...", "posts": [], "postsLoaded": false }] }
```

### `GET /api/v1/memberships/{membershipId}/posts?limit=100&cursor=opaque`

Requires auth. Cursor-paginated. `limit` is capped at 100.

Response `200`:

```json
{
  "items": [{
    "id": "post-id",
    "title": "Post title",
    "date": "2024-09-01",
    "description": "Plain text description",
    "originalUrl": "https://www.patreon.com/posts/...",
    "commentsUrl": "https://www.patreon.com/posts/...?view=comments",
    "assets": [{ "id": "asset-id", "type": "image", "name": "file.png", "url": "https://...", "previewUrl": "https://...", "downloadUrl": "https://..." }]
  }],
  "nextCursor": null
}
```

The upstream request uses documented Post v2 fields (`title,content,published_at,url,is_public,embed_data,embed_url`) and no unsupported `include` relationships. Pagination reads `meta.pagination.cursors.next` (falling back to a `links.next` cursor). Depending on Patreon's response, `assets` may be empty even when a post is returned; media availability has not been verified for subscriber tokens.

If Patreon rejects the request, returns `502 patreon_posts_unavailable` with upstream `details.status` and `details.payload.errors`; the frontend displays the upstream reason. A validation (400), scope (401/403), or permission response must be diagnosed separately. An empty `items` array with `200` is not an API error.

## Versioning

Path-versioned under `/api/v1`. Additive response fields are allowed within v1; breaking changes require `/api/v2`.
