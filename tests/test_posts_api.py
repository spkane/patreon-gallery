import json
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import server


class PostsApiTests(unittest.TestCase):
    def setUp(self):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.AppHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.session_id = "test-session"
        server.SESSIONS[self.session_id] = {
            "token": {"access_token": "subscriber-token", "expires_at": server.now() + 3600},
            "memberships": [{"id": "membership-1", "campaignId": "campaign-1", "source": "subscriber_oauth"}],
        }
        self.cookie = f"{server.SESSION_COOKIE}={server.cookie_value(self.session_id)}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)
        server.SESSIONS.pop(self.session_id, None)

    def request(self, path):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.httpd.server_port}{path}",
            headers={"Cookie": self.cookie},
        )
        try:
            with urllib.request.urlopen(request, timeout=3) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def test_subscriber_posts_request_uses_valid_fields_and_returns_next_cursor(self):
        def fake_patreon_request(method, url, token=None, data=None):
            self.assertEqual(token, "subscriber-token")
            parsed = urllib.parse.urlsplit(url)
            self.assertEqual(parsed.path, "/api/oauth2/v2/campaigns/campaign-1/posts")
            query = urllib.parse.parse_qs(parsed.query)
            self.assertNotIn("include", query)
            self.assertIn("title", query.get("fields[post]", [""])[0])
            self.assertEqual(query.get("page[count]"), ["25"])
            return {
                "data": [{"type": "post", "id": "post-1", "attributes": {
                    "title": "Subscriber post", "content": "Hello", "published_at": "2026-09-28T10:00:00Z",
                    "url": "https://www.patreon.com/posts/post-1",
                }}],
                "meta": {"pagination": {"cursors": {"next": "cursor-2"}}},
            }

        with patch.object(server, "api_request", side_effect=fake_patreon_request):
            status, payload = self.request("/api/v1/memberships/membership-1/posts")
        self.assertEqual(status, 200)
        self.assertEqual(payload["items"][0]["title"], "Subscriber post")
        self.assertEqual(payload["nextCursor"], "cursor-2")

    def test_static_server_does_not_expose_local_configuration(self):
        status, payload = self.request("/.env.example")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"]["code"], "not_found")

    def test_patreon_validation_errors_remain_visible_not_mislabeled_as_permission_denial(self):
        upstream = {"errors": [{"code_name": "ParameterInvalidOnType", "detail": "Invalid include"}]}
        with patch.object(server, "api_request", side_effect=server.PatreonHTTPError(400, upstream)):
            status, payload = self.request("/api/v1/memberships/membership-1/posts")
        self.assertEqual(status, 502)
        self.assertEqual(payload["error"]["details"]["status"], 400)
        self.assertEqual(payload["error"]["details"]["payload"], upstream)
        self.assertNotIn("creator", payload["error"]["message"].lower())


if __name__ == "__main__":
    unittest.main()
