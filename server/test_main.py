import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient
from server.main import app, buckets, cache, fetch_payload


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"VIBECUT_TOKEN": "test-token-only-for-tests-1234567890", "LASTFM_API_KEY": "test-key"})
        self.env.start()
        self.addCleanup(self.env.stop)
        cache.clear()
        buckets.clear()
        self.client = TestClient(app, base_url="http://localhost")
        self.headers = {"Authorization": "Bearer test-token-only-for-tests-1234567890"}

    def test_auth_and_health(self):
        self.assertEqual(self.client.get("/health").status_code, 401)
        self.assertEqual(self.client.get("/health", headers=self.headers).json()["audio"], "local-files")

    def test_no_key_and_invalid_queries(self):
        with patch.dict(os.environ, {"LASTFM_API_KEY": ""}):
            self.assertEqual(self.client.get("/search?q=hello", headers=self.headers).status_code, 503)
        self.assertEqual(self.client.get("/search?q=x", headers=self.headers).status_code, 422)
        self.assertEqual(self.client.get("/search?q=hello&kind=bad", headers=self.headers).status_code, 422)

    def test_normalization_cache_and_all_kinds(self):
        for kind in ["track", "album", "artist"]:
            payload = {"results": {f"{kind}matches": {kind: [{"name": "Song", "artist": "Artist", "image": [{"#text": "https://example.org/art.jpg"}]}]}}}
            with patch("server.main.fetch_payload", new=AsyncMock(return_value=payload)) as request:
                first = self.client.get(f"/search?q=Song&kind={kind}", headers=self.headers)
                second = self.client.get(f"/search?q=song&kind={kind}", headers=self.headers)
                self.assertEqual(first.status_code, 200)
                self.assertEqual(first.json(), second.json())
                self.assertEqual(first.json()["results"][0]["kind"], kind)
                self.assertEqual(request.await_count, 1)

    def test_timeout_and_provider_error(self):
        with patch("server.main.fetch_payload", new=AsyncMock(side_effect=httpx.ReadTimeout("timeout"))):
            self.assertEqual(self.client.get("/search?q=test", headers=self.headers).status_code, 504)
        with patch("server.main.fetch_payload", new=AsyncMock(return_value={"error": 10})):
            self.assertEqual(self.client.get("/search?q=test", headers=self.headers).status_code, 502)

    def test_reject_weak_token_and_hide_schema(self):
        with patch.dict(os.environ, {"VIBECUT_TOKEN": "short"}):
            self.assertEqual(self.client.get("/health", headers=self.headers).status_code, 503)
        for path in ["/docs", "/redoc", "/openapi.json"]:
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_host_cors_and_response_headers(self):
        self.assertEqual(self.client.get("/health", headers={**self.headers, "Host": "attacker.example"}).status_code, 400)
        response = self.client.get("/health", headers={**self.headers, "Origin": "https://attacker.example"})
        self.assertNotIn("access-control-allow-origin", response.headers)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")

    def test_rate_limits_and_malformed_provider(self):
        from server.main import rate_limit
        from fastapi import HTTPException
        for _ in range(3):
            rate_limit("unit", 3, now=1)
        with self.assertRaises(HTTPException) as error:
            rate_limit("unit", 3, now=2)
        self.assertEqual(error.exception.status_code, 429)
        rate_limit("unit", 3, now=62)
        with patch("server.main.fetch_payload", new=AsyncMock(return_value=["invalid"])):
            self.assertEqual(self.client.get("/search?q=hello", headers=self.headers).status_code, 502)

    def test_oversized_upstream_response(self):
        import asyncio
        from fastapi import HTTPException
        class Chunks(httpx.AsyncByteStream):
            async def __aiter__(self):
                for _ in range(10):
                    yield b"x" * 65536
        transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=Chunks()))
        client = httpx.AsyncClient(transport=transport)
        with patch("server.main.httpx.AsyncClient", return_value=client):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(fetch_payload("test", "query", "track"))
        self.assertEqual(error.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
