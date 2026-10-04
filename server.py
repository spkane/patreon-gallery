#!/usr/bin/env python3
"""Small stdlib Patreon OAuth/API + static-file server for Patreon Gallery Scout.

This is a development server. Configure with environment variables:

  PATREON_CLIENT_ID=...
  PATREON_CLIENT_SECRET=...
  PATREON_REDIRECT_URI=http://127.0.0.1:8000/api/v1/auth/callback
  PATREON_GALLERY_SESSION_SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
  PORT=8000

Then run: python3 server.py
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import html
import json
import mimetypes
import os
import re
import secrets
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent
SESSION_COOKIE = "pgs_session"
SESSIONS: Dict[str, Dict[str, Any]] = {}
CREATOR_TOKEN_CACHE: Dict[str, Any] = {}

PATREON_API = "https://www.patreon.com/api/oauth2/v2"
PATREON_AUTHORIZE = "https://www.patreon.com/oauth2/authorize"
PATREON_TOKEN = "https://www.patreon.com/api/oauth2/token"
DEFAULT_SCOPES = "identity identity[email] identity.memberships"
MAX_LIMIT = 100


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def creator_token_configured() -> bool:
    return bool(env("PATREON_GALLERY_CREATOR_ACCESS_TOKEN"))


def creator_access_token() -> str:
    return CREATOR_TOKEN_CACHE.get("access_token") or env("PATREON_GALLERY_CREATOR_ACCESS_TOKEN")


def session_secret() -> bytes:
    configured = env("PATREON_GALLERY_SESSION_SECRET")
    if configured:
        return configured.encode("utf-8")
    # Development fallback. Sessions become invalid on restart.
    if not hasattr(session_secret, "_secret"):
        session_secret._secret = secrets.token_bytes(48)  # type: ignore[attr-defined]
    return session_secret._secret  # type: ignore[attr-defined]


def json_dumps(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def make_error(code: str, message: str, status: int, details: Optional[Dict[str, Any]] = None) -> Tuple[int, Dict[str, Any]]:
    return status, {"error": {"code": code, "message": message, "details": details or {}, "requestId": secrets.token_hex(8)}}


def sign(value: str) -> str:
    digest = hmac.new(session_secret(), value.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def verify_signed(value: str, signature: str) -> bool:
    return hmac.compare_digest(sign(value), signature)


def cookie_value(session_id: str) -> str:
    return f"{session_id}.{sign(session_id)}"


def now() -> int:
    return int(time.time())


def parse_query(path: str) -> Tuple[str, Dict[str, List[str]]]:
    parsed = urllib.parse.urlparse(path)
    return parsed.path, urllib.parse.parse_qs(parsed.query)


def first(query: Dict[str, List[str]], key: str, default: str = "") -> str:
    values = query.get(key)
    return values[0] if values else default


def strip_html(value: str) -> str:
    without_tags = re.sub(r"<br\s*/?>", "\n", value or "", flags=re.I)
    without_tags = re.sub(r"</p\s*>", "\n\n", without_tags, flags=re.I)
    without_tags = re.sub(r"<[^>]+>", "", without_tags)
    return re.sub(r"\n{3,}", "\n\n", html.unescape(without_tags)).strip()


def safe_ext(filename: str, fallback: str = "FILE") -> str:
    suffix = Path(filename or "").suffix.replace(".", "").upper()
    return suffix[:6] if suffix else fallback


def infer_type(name: str, mime: str = "", raw_type: str = "") -> str:
    candidate = f"{mime} {raw_type} {name}".lower()
    if "video" in candidate or any(candidate.endswith(ext) for ext in [".mp4", ".mov", ".webm", ".m4v"]):
        return "video"
    if "image" in candidate or any(candidate.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]):
        return "image"
    return "file"


def find_urlish(value: Any, preferred: Iterable[str] = ()) -> str:
    """Find a usable URL in unknown Patreon media/attachment attributes."""
    if isinstance(value, str):
        return value if value.startswith("http") else ""
    if isinstance(value, dict):
        for key in preferred:
            found = find_urlish(value.get(key))
            if found:
                return found
        for key in ["download_url", "url", "original_url", "image_url", "large_url", "thumbnail_url"]:
            found = find_urlish(value.get(key))
            if found:
                return found
        # Patreon image_urls is often a dict of sizes. Prefer larger values first.
        image_urls = value.get("image_urls")
        if isinstance(image_urls, dict):
            for key in ["original", "large", "default", "medium", "small"]:
                found = find_urlish(image_urls.get(key))
                if found:
                    return found
        for nested in value.values():
            found = find_urlish(nested)
            if found:
                return found
    if isinstance(value, list):
        for item in value:
            found = find_urlish(item)
            if found:
                return found
    return ""


def api_request(method: str, url: str, token: Optional[str] = None, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    body = None
    headers = {"Accept": "application/json", "User-Agent": "PatreonGalleryScout/0.1"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
            if not raw:
                return {}
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"raw": raw}
        raise PatreonHTTPError(exc.code, payload) from exc


class PatreonHTTPError(Exception):
    def __init__(self, status: int, payload: Any):
        super().__init__(f"Patreon API returned {status}")
        self.status = status
        self.payload = payload


class AppHandler(BaseHTTPRequestHandler):
    server_version = "PatreonGalleryScout/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"{self.address_string()} - - [{self.log_date_time_string()}] {fmt % args}")

    def do_GET(self) -> None:  # noqa: N802
        try:
            path, query = parse_query(self.path)
            if path.startswith("/api/v1/"):
                self.handle_api_get(path, query)
            else:
                self.serve_static(path)
        except Exception as exc:  # Keep unexpected errors in canonical error shape.
            traceback.print_exc()
            self.send_json(*make_error("internal_error", "Unexpected server error", 500, {"type": type(exc).__name__}))

    def do_POST(self) -> None:  # noqa: N802
        try:
            path, query = parse_query(self.path)
            if path.startswith("/api/v1/"):
                self.handle_api_post(path, query)
            else:
                self.send_json(*make_error("not_found", "Route not found", 404))
        except Exception as exc:
            traceback.print_exc()
            self.send_json(*make_error("internal_error", "Unexpected server error", 500, {"type": type(exc).__name__}))

    def session(self) -> Tuple[str, Dict[str, Any], bool]:
        raw_cookie = self.headers.get("Cookie", "")
        cookies: Dict[str, str] = {}
        for part in raw_cookie.split(";"):
            if "=" in part:
                key, value = part.strip().split("=", 1)
                cookies[key] = value
        raw = cookies.get(SESSION_COOKIE, "")
        if "." in raw:
            session_id, signature = raw.rsplit(".", 1)
            if session_id in SESSIONS and verify_signed(session_id, signature):
                return session_id, SESSIONS[session_id], False
        session_id = secrets.token_urlsafe(32)
        SESSIONS[session_id] = {"createdAt": now()}
        return session_id, SESSIONS[session_id], True

    def set_session_cookie(self, session_id: str) -> None:
        secure = "; Secure" if env("COOKIE_SECURE", "0") == "1" else ""
        self.send_header("Set-Cookie", f"{SESSION_COOKIE}={cookie_value(session_id)}; Path=/; HttpOnly; SameSite=Lax{secure}")

    def clear_session_cookie(self) -> None:
        self.send_header("Set-Cookie", f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")

    def send_json(self, status: int, payload: Dict[str, Any], session_id: Optional[str] = None) -> None:
        body = json_dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        if session_id:
            self.set_session_cookie(session_id)
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location: str, session_id: Optional[str] = None) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        if session_id:
            self.set_session_cookie(session_id)
        self.end_headers()

    def read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(min(length, 1024 * 1024))
        return json.loads(raw.decode("utf-8"))

    def serve_static(self, path: str) -> None:
        if path in ["", "/"]:
            path = "/index.html"
        # Never serve .env, source code, session data, or other project files.
        public_paths = {
            "/index.html", "/styles.css", "/app.js",
            "/assets/patreon-gallery-icon.svg", "/assets/patreon-gallery-icon.png",
        }
        if path not in public_paths:
            self.send_json(*make_error("not_found", "Route not found", 404))
            return
        relative = Path(path.lstrip("/"))
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents and target != ROOT:
            self.send_json(*make_error("not_found", "Route not found", 404))
            return
        if not target.exists() or not target.is_file():
            self.send_json(*make_error("not_found", "File not found", 404, {"path": path}))
            return
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store" if target.name in ["index.html", "app.js", "styles.css"] else "public, max-age=3600")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_api_get(self, path: str, query: Dict[str, List[str]]) -> None:
        if path == "/api/v1/auth/status":
            self.auth_status()
            return
        if path == "/api/v1/auth/login":
            self.auth_login()
            return
        if path == "/api/v1/auth/callback":
            self.auth_callback(query)
            return
        if path == "/api/v1/memberships":
            self.memberships()
            return
        if path.startswith("/api/v1/memberships/") and path.endswith("/posts"):
            membership_id = urllib.parse.unquote(path.removeprefix("/api/v1/memberships/").removesuffix("/posts"))
            self.membership_posts(membership_id, query)
            return
        self.send_json(*make_error("not_found", "Route not found", 404, {"path": path}))

    def handle_api_post(self, path: str, query: Dict[str, List[str]]) -> None:
        if path == "/api/v1/auth/logout":
            session_id, session, _ = self.session()
            session.clear()
            self.send_response(204)
            self.clear_session_cookie()
            self.end_headers()
            return
        self.send_json(*make_error("not_found", "Route not found", 404, {"path": path}))

    def require_config(self) -> Optional[Tuple[int, Dict[str, Any]]]:
        missing = [name for name in ["PATREON_CLIENT_ID", "PATREON_CLIENT_SECRET"] if not env(name)]
        if missing:
            return make_error("patreon_oauth_not_configured", "Patreon OAuth is not configured on this server", 503, {"missing": missing})
        return None

    def require_auth(self, allow_creator_token: bool = False) -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[Tuple[int, Dict[str, Any]]]]:
        session_id, session, created = self.session()
        if allow_creator_token and creator_token_configured():
            return session_id, session, None
        if created:
            return session_id, session, make_error("unauthenticated", "Connect Patreon before using this endpoint", 401)
        token = session.get("token")
        if not token or not token.get("access_token"):
            return session_id, session, make_error("unauthenticated", "Connect Patreon before using this endpoint", 401)
        if token.get("expires_at", 0) - 60 < now() and token.get("refresh_token"):
            try:
                session["token"] = self.refresh_token(token["refresh_token"])
            except Exception as exc:
                session.pop("token", None)
                return session_id, session, make_error("token_refresh_failed", "Patreon session expired; please connect again", 401, {"type": type(exc).__name__})
        return session_id, session, None

    def auth_status(self) -> None:
        configured = self.require_config() is None or creator_token_configured()
        session_id, session, created = self.session()
        token = session.get("token") or {}
        payload = {
            "configured": configured,
            "authenticated": bool(token.get("access_token")),
            "creatorTokenConfigured": creator_token_configured(),
            "user": session.get("user"),
            "scopes": env("PATREON_SCOPES", DEFAULT_SCOPES),
        }
        self.send_json(200, payload, session_id if created else None)

    def auth_login(self) -> None:
        config_error = self.require_config()
        if config_error:
            self.send_json(*config_error)
            return
        session_id, session, _ = self.session()
        state = secrets.token_urlsafe(32)
        session["oauth_state"] = state
        params = {
            "response_type": "code",
            "client_id": env("PATREON_CLIENT_ID"),
            "redirect_uri": env("PATREON_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/auth/callback"),
            "scope": env("PATREON_SCOPES", DEFAULT_SCOPES),
            "state": state,
        }
        self.redirect(f"{PATREON_AUTHORIZE}?{urllib.parse.urlencode(params)}", session_id)

    def auth_callback(self, query: Dict[str, List[str]]) -> None:
        config_error = self.require_config()
        if config_error:
            self.send_json(*config_error)
            return
        session_id, session, _ = self.session()
        if first(query, "error"):
            self.redirect(f"/?auth_error={urllib.parse.quote(first(query, 'error_description', first(query, 'error')))}", session_id)
            return
        if first(query, "state") != session.get("oauth_state"):
            self.send_json(*make_error("invalid_oauth_state", "OAuth state did not match; try connecting again", 400), session_id=session_id)
            return
        code = first(query, "code")
        if not code:
            self.send_json(*make_error("missing_oauth_code", "OAuth callback did not include a code", 400), session_id=session_id)
            return
        try:
            token = self.exchange_code(code)
            session["token"] = token
            profile = self.fetch_identity(token["access_token"])
            session["user"] = normalize_user(profile)
            session["memberships"] = normalize_memberships(profile)
            session.pop("oauth_state", None)
            self.redirect("/", session_id)
        except PatreonHTTPError as exc:
            self.send_json(*make_error("patreon_oauth_or_identity_failed", "Patreon OAuth succeeded, but token exchange or identity lookup failed", 502, {"status": exc.status, "payload": exc.payload}), session_id=session_id)

    def exchange_code(self, code: str) -> Dict[str, Any]:
        payload = api_request("POST", PATREON_TOKEN, data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": env("PATREON_CLIENT_ID"),
            "client_secret": env("PATREON_CLIENT_SECRET"),
            "redirect_uri": env("PATREON_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/auth/callback"),
        })
        payload["expires_at"] = now() + int(payload.get("expires_in", 0) or 0)
        return payload

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        payload = api_request("POST", PATREON_TOKEN, data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": env("PATREON_CLIENT_ID"),
            "client_secret": env("PATREON_CLIENT_SECRET"),
        })
        payload["expires_at"] = now() + int(payload.get("expires_in", 0) or 0)
        return payload

    def fetch_identity(self, access_token: str) -> Dict[str, Any]:
        # Patreon is strict about sparse fieldsets and occasionally rejects fields
        # that older docs/examples list. Try useful campaign metadata first, then
        # progressively fall back to smaller fieldsets instead of failing auth.
        query_variants = [
            {
                "include": "memberships.campaign",
                "fields[user]": "full_name,thumb_url,email",
                "fields[member]": "patron_status,last_charge_date,last_charge_status,currently_entitled_amount_cents",
                "fields[campaign]": "creation_name,url,image_url,image_small_url,summary",
            },
            {
                "include": "memberships.campaign",
                "fields[user]": "full_name,thumb_url,email",
                "fields[member]": "patron_status,last_charge_date,last_charge_status,currently_entitled_amount_cents",
                "fields[campaign]": "creation_name,url,summary",
            },
            {
                "include": "memberships.campaign",
                "fields[user]": "full_name,thumb_url,email",
                "fields[member]": "patron_status,last_charge_date,last_charge_status,currently_entitled_amount_cents",
            },
            {
                "include": "memberships",
                "fields[user]": "full_name,thumb_url,email",
                "fields[member]": "patron_status,last_charge_date,last_charge_status,currently_entitled_amount_cents",
            },
        ]
        last_error: Optional[PatreonHTTPError] = None
        for params in query_variants:
            url = f"{PATREON_API}/identity?{urllib.parse.urlencode(params)}"
            try:
                return api_request("GET", url, token=access_token)
            except PatreonHTTPError as exc:
                if exc.status != 400:
                    raise
                last_error = exc
        if last_error:
            raise last_error
        raise RuntimeError("No Patreon identity query variants were configured")

    def creator_api_request(self, method: str, url: str) -> Dict[str, Any]:
        try:
            return api_request(method, url, token=creator_access_token())
        except PatreonHTTPError as exc:
            refresh = env("PATREON_GALLERY_CREATOR_REFRESH_TOKEN")
            if exc.status != 401 or not refresh:
                raise
            CREATOR_TOKEN_CACHE.update(self.refresh_token(refresh))
            return api_request(method, url, token=creator_access_token())

    def creator_identity(self) -> Dict[str, Any]:
        query_variants = [
            {
                "include": "campaign",
                "fields[user]": "full_name,thumb_url,email",
                "fields[campaign]": "creation_name,url,image_url,image_small_url,summary",
            },
            {
                "include": "campaign",
                "fields[user]": "full_name,thumb_url,email",
                "fields[campaign]": "creation_name,url,summary",
            },
            {"include": "campaign", "fields[user]": "full_name,thumb_url,email"},
        ]
        last_error: Optional[PatreonHTTPError] = None
        for params in query_variants:
            url = f"{PATREON_API}/identity?{urllib.parse.urlencode(params)}"
            try:
                return self.creator_api_request("GET", url)
            except PatreonHTTPError as exc:
                if exc.status != 400:
                    raise
                last_error = exc
        if last_error:
            raise last_error
        raise RuntimeError("No Patreon creator identity query variants were configured")

    def current_memberships(self, session: Dict[str, Any]) -> List[Dict[str, Any]]:
        subscriber_memberships: List[Dict[str, Any]] = []
        creator_memberships: List[Dict[str, Any]] = []
        token = session.get("token")
        if token and token.get("access_token"):
            if "subscriber_memberships" not in session:
                session["subscriber_memberships"] = normalize_memberships(self.fetch_identity(token["access_token"]))
            subscriber_memberships = session.get("subscriber_memberships", [])
        if creator_token_configured():
            if "creator_memberships" not in session:
                session["creator_memberships"] = normalize_creator_campaigns(self.creator_identity())
            creator_memberships = session.get("creator_memberships", [])
        merged: List[Dict[str, Any]] = []
        seen_campaigns = set()
        for item in creator_memberships + subscriber_memberships:
            campaign_id = item.get("campaignId") or item.get("id")
            key = campaign_id or item.get("id")
            if key in seen_campaigns:
                continue
            seen_campaigns.add(key)
            merged.append(item)
        session["memberships"] = merged
        return merged

    def memberships(self) -> None:
        session_id, session, error = self.require_auth(allow_creator_token=True)
        if error:
            self.send_json(*error, session_id=session_id)
            return
        try:
            self.send_json(200, {"items": self.current_memberships(session)})
        except PatreonHTTPError as exc:
            self.send_json(*make_error("patreon_identity_lookup_failed", "Patreon identity, membership, or creator campaign lookup failed", 502, {"status": exc.status, "payload": exc.payload}))

    def membership_posts(self, membership_id: str, query: Dict[str, List[str]]) -> None:
        session_id, session, error = self.require_auth(allow_creator_token=True)
        if error:
            self.send_json(*error, session_id=session_id)
            return
        memberships = session.get("memberships") or self.current_memberships(session)
        membership = next((item for item in memberships if item.get("id") == membership_id), None)
        if not membership:
            self.send_json(*make_error("membership_not_found", "No membership with that id is available for this Patreon account", 404, {"membershipId": membership_id}))
            return
        campaign_id = membership.get("campaignId")
        if not campaign_id:
            self.send_json(*make_error("campaign_missing", "This membership did not include a Patreon campaign id", 422, {"membershipId": membership_id}))
            return
        limit = min(max(int(first(query, "limit", "25") or "25"), 1), MAX_LIMIT)
        # Patreon Post v2 does not document attachments/media as includable
        # relationships. Explicit sparse fields are required by API v2.
        params = {
            "page[count]": str(limit),
            "fields[post]": "title,content,published_at,url,is_public,embed_data,embed_url",
        }
        cursor = first(query, "cursor")
        if cursor:
            params["page[cursor]"] = cursor
        url = f"{PATREON_API}/campaigns/{urllib.parse.quote(str(campaign_id))}/posts?{urllib.parse.urlencode(params)}"
        access_token = creator_access_token() if membership.get("source") == "creator_env" else session.get("token", {}).get("access_token")
        if not access_token:
            self.send_json(*make_error("post_token_missing", "No Patreon token is available to load posts for this membership", 401, {"membershipId": membership_id}))
            return
        try:
            payload = self.creator_api_request("GET", url) if membership.get("source") == "creator_env" else api_request("GET", url, token=access_token)
            posts = normalize_posts(payload)
            next_cursor = (
                (((payload.get("meta") or {}).get("pagination") or {}).get("cursors") or {}).get("next")
                or next_cursor_from_links((payload.get("links") or {}).get("next"))
            )
            self.send_json(200, {"items": posts, "nextCursor": next_cursor})
        except PatreonHTTPError as exc:
            self.send_json(*make_error("patreon_posts_unavailable", f"Patreon rejected the posts request (HTTP {exc.status}). See error details for the reason.", 502, {"status": exc.status, "payload": exc.payload, "membershipSource": membership.get("source", "subscriber_oauth")}))


def normalize_user(profile: Dict[str, Any]) -> Dict[str, Any]:
    data = profile.get("data") or {}
    attrs = data.get("attributes") or {}
    return {
        "id": data.get("id"),
        "name": attrs.get("full_name") or attrs.get("vanity") or "Patreon user",
        "email": attrs.get("email"),
        "avatarUrl": attrs.get("thumb_url"),
    }


def included_map(payload: Dict[str, Any]) -> Dict[Tuple[str, str], Dict[str, Any]]:
    return {(item.get("type"), str(item.get("id"))): item for item in payload.get("included", []) if item.get("type") and item.get("id")}


def normalize_memberships(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    included = included_map(profile)
    data = profile.get("data") or {}
    membership_refs = (((data.get("relationships") or {}).get("memberships") or {}).get("data") or [])
    memberships: List[Dict[str, Any]] = []
    for ref in membership_refs:
        member = included.get((ref.get("type"), str(ref.get("id")))) or {}
        member_attrs = member.get("attributes") or {}
        campaign_ref = ((((member.get("relationships") or {}).get("campaign") or {}).get("data")) or {})
        campaign = included.get((campaign_ref.get("type"), str(campaign_ref.get("id")))) or {}
        campaign_attrs = campaign.get("attributes") or {}
        campaign_url = campaign_attrs.get("url") or ""
        name = campaign_attrs.get("creation_name") or campaign_attrs.get("name") or f"Campaign {campaign_ref.get('id') or ref.get('id')}"
        memberships.append({
            "id": str(ref.get("id") or campaign_ref.get("id")),
            "campaignId": str(campaign_ref.get("id") or ""),
            "name": name,
            "handle": campaign_url.replace("https://www.patreon.com/", "") if campaign_url else "Patreon campaign",
            "url": campaign_url,
            "description": strip_html(campaign_attrs.get("summary") or f"{name} Patreon membership"),
            "avatarUrl": campaign_attrs.get("image_small_url") or campaign_attrs.get("image_url"),
            "coverUrl": campaign_attrs.get("image_url"),
            "patronStatus": member_attrs.get("patron_status"),
            "source": "subscriber_oauth",
            "posts": [],
            "postsLoaded": False,
        })
    return memberships


def normalize_creator_campaigns(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    included = included_map(profile)
    data = profile.get("data") or {}
    campaign_refs = []
    relationships = data.get("relationships") or {}
    for rel_name in ["campaign", "campaigns"]:
        rel_data = (relationships.get(rel_name) or {}).get("data") or []
        if isinstance(rel_data, dict):
            rel_data = [rel_data]
        campaign_refs.extend(rel_data)

    campaigns = []
    seen = set()
    for ref in campaign_refs:
        campaign = included.get((ref.get("type"), str(ref.get("id")))) or {}
        if campaign:
            campaigns.append(campaign)
            seen.add(str(campaign.get("id")))
    for campaign in profile.get("included", []) or []:
        if campaign.get("type") == "campaign" and str(campaign.get("id")) not in seen:
            campaigns.append(campaign)
            seen.add(str(campaign.get("id")))

    memberships: List[Dict[str, Any]] = []
    for campaign in campaigns:
        campaign_attrs = campaign.get("attributes") or {}
        campaign_id = str(campaign.get("id") or "")
        if not campaign_id:
            continue
        campaign_url = campaign_attrs.get("url") or ""
        name = campaign_attrs.get("creation_name") or campaign_attrs.get("name") or f"Creator campaign {campaign_id}"
        memberships.append({
            "id": f"creator-{campaign_id}",
            "campaignId": campaign_id,
            "name": name,
            "handle": campaign_url.replace("https://www.patreon.com/", "") if campaign_url else "Creator campaign",
            "url": campaign_url,
            "description": strip_html(campaign_attrs.get("summary") or f"{name} creator campaign"),
            "avatarUrl": campaign_attrs.get("image_small_url") or campaign_attrs.get("image_url"),
            "coverUrl": campaign_attrs.get("image_url"),
            "patronStatus": "creator_token",
            "source": "creator_env",
            "posts": [],
            "postsLoaded": False,
        })
    return memberships


def asset_from_record(record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    attrs = record.get("attributes") or {}
    raw_type = record.get("type") or attrs.get("type") or ""
    name = attrs.get("name") or attrs.get("file_name") or attrs.get("filename") or attrs.get("title") or f"patreon-{record.get('id', 'asset')}"
    url = find_urlish(attrs, preferred=["download_url", "url"])
    preview = find_urlish(attrs, preferred=["thumbnail_url", "image_urls", "preview_url"])
    media_type = infer_type(name, attrs.get("mimetype") or attrs.get("mime_type") or "", raw_type)
    if not url and preview:
        url = preview
    if not url:
        return None
    return {
        "id": str(record.get("id") or secrets.token_hex(4)),
        "type": media_type,
        "fileType": safe_ext(name, media_type.upper()),
        "name": name,
        "url": url,
        "previewUrl": preview or url,
        "downloadUrl": attrs.get("download_url") or url,
    }


def normalize_posts(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    included = included_map(payload)
    posts: List[Dict[str, Any]] = []
    for post in payload.get("data", []) or []:
        attrs = post.get("attributes") or {}
        relationships = post.get("relationships") or {}
        assets: List[Dict[str, Any]] = []
        for rel_name in ["attachments", "media", "images", "post_file"]:
            rel = relationships.get(rel_name) or {}
            rel_data = rel.get("data") or []
            if isinstance(rel_data, dict):
                rel_data = [rel_data]
            for ref in rel_data:
                asset = asset_from_record(included.get((ref.get("type"), str(ref.get("id")))) or {})
                if asset and asset["url"] not in {existing["url"] for existing in assets}:
                    assets.append(asset)
        for key in ["image", "images", "thumbnail", "thumbnail_url"]:
            found = find_urlish(attrs.get(key))
            if found and found not in {existing["url"] for existing in assets}:
                name = f"{attrs.get('title') or post.get('id')}-{key}.jpg"
                assets.append({"id": f"{post.get('id')}-{key}", "type": "image", "fileType": "JPG", "name": name, "url": found, "previewUrl": found, "downloadUrl": found})
        title = attrs.get("title") or f"Patreon post {post.get('id')}"
        published = (attrs.get("published_at") or attrs.get("created_at") or "")[:10]
        posts.append({
            "id": str(post.get("id")),
            "title": title,
            "date": published or "1970-01-01",
            "description": strip_html(attrs.get("content") or attrs.get("teaser_text") or ""),
            "originalUrl": attrs.get("url") or "https://www.patreon.com/posts/" + str(post.get("id")),
            "commentsUrl": (attrs.get("url") or "https://www.patreon.com/posts/" + str(post.get("id"))) + "?view=comments",
            "assets": assets,
        })
    return posts


def next_cursor_from_links(next_url: Optional[str]) -> Optional[str]:
    if not next_url:
        return None
    parsed = urllib.parse.urlparse(next_url)
    query = urllib.parse.parse_qs(parsed.query)
    return first(query, "page[cursor]") or None


def main() -> None:
    port = int(env("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), AppHandler)
    print(f"Patreon Gallery Scout running at http://127.0.0.1:{port}")
    if not env("PATREON_CLIENT_ID") or not env("PATREON_CLIENT_SECRET"):
        print("OAuth not configured yet. Set PATREON_CLIENT_ID and PATREON_CLIENT_SECRET to connect real Patreon accounts.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")


if __name__ == "__main__":
    main()
