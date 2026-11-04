"""Optional private metadata proxy. Audio remains entirely on the device."""
import hashlib
import hmac
import os
import time
import asyncio
import json
from collections import OrderedDict, deque
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware


buckets: OrderedDict[str, deque] = OrderedDict()
upstream_gate = asyncio.Semaphore(4)


def rate_limit(key: str, limit: int, now: float | None = None):
    now = time.monotonic() if now is None else now
    bucket = buckets.setdefault(key, deque())
    buckets.move_to_end(key)
    while bucket and now - bucket[0] >= 60:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(429, "Too many requests. Try again shortly.", headers={"Retry-After": "60"})
    bucket.append(now)
    while len(buckets) > 1024:
        buckets.popitem(last=False)


async def authorize(request: Request, authorization: str = Header(default="")):
    rate_limit(f"auth:{request.client.host if request.client else 'unknown'}", 60)
    token = os.environ.get("VIBECUT_TOKEN", "")
    if len(token) < 32 or len(token) > 4096 or token != token.strip() or any(c in token for c in "\r\n\0") or token.startswith(("replace-with", "your-")):
        raise HTTPException(503, "Configure a random VIBECUT_TOKEN of at least 32 characters on the server.")
    if len(authorization) > 4103 or not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(401, "Invalid server access token.")


app = FastAPI(title="VibeCut metadata", dependencies=[Depends(authorize)], docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=[h.strip() for h in os.environ.get("VIBECUT_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]").split(",") if h.strip()])
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("VIBECUT_WEB_ORIGIN", "http://localhost:8081")],
    allow_methods=["GET"], allow_headers=["Authorization"],
)
cache: OrderedDict[tuple[str, str], tuple[float, dict]] = OrderedDict()


@app.middleware("http")
async def response_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    return response


async def fetch_payload(key: str, query: str, kind: str):
    async with asyncio.timeout(8), httpx.AsyncClient(timeout=8, follow_redirects=False, trust_env=False) as client:
        async with client.stream("GET", "https://ws.audioscrobbler.com/2.0/", params={
            "method": f"{kind}.search", kind: query, "api_key": key, "format": "json", "limit": 20,
        }, headers={"Accept-Encoding": "identity"}) as response:
            response.raise_for_status()
            body = bytearray()
            async for chunk in response.aiter_raw(chunk_size=65536):
                body.extend(chunk)
                if len(body) > 524288:
                    raise HTTPException(502, "The metadata provider response was too large.")
    return json.loads(body)


@app.get("/health")
def health():
    return {"ok": True, "metadata": bool(os.environ.get("LASTFM_API_KEY")), "audio": "local-files"}


@app.get("/search")
async def search(q: str = Query(min_length=2, max_length=150), kind: Literal["track", "album", "artist"] = "track"):
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(422, "Enter at least two characters.")
    key = os.environ.get("LASTFM_API_KEY", "")
    if not key:
        raise HTTPException(503, "Set LASTFM_API_KEY on the server to enable online search.")
    cache_key = (kind, query.casefold())
    if cache_key in cache and cache[cache_key][0] > time.monotonic():
        cache.move_to_end(cache_key)
        return cache[cache_key][1]
    rate_limit("upstream-global", 30)
    if upstream_gate.locked():
        raise HTTPException(503, "The metadata server is busy. Try again shortly.")
    try:
        async with upstream_gate:
            payload = await fetch_payload(key, query, kind)
        if not isinstance(payload, dict):
            raise HTTPException(502, "The metadata provider returned an invalid response.")
        if payload.get("error"):
            raise HTTPException(502, "The metadata provider rejected this request.")
        results_container = payload.get("results")
        matches = results_container.get(f"{kind}matches") if isinstance(results_container, dict) else None
        if not isinstance(matches, dict):
            raise HTTPException(502, "The metadata provider returned invalid results.")
        entries = matches.get(kind, [])
        if isinstance(entries, dict):
            entries = [entries]
        if not isinstance(entries, list):
            raise HTTPException(502, "The metadata provider returned invalid results.")
        results = []
        seen = set()
        for item in entries[:20]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("name", ""))[:500]
            artist = item.get("artist", "")
            if isinstance(artist, dict):
                artist = artist.get("name", "")
            artist = str(artist)[:500]
            identity = f"{kind}:{title}:{artist}"
            if identity in seen or not title:
                continue
            seen.add(identity)
            images = item.get("image", [])
            if not isinstance(images, list):
                images = []
            artwork = next((image.get("#text") for image in reversed(images[:10]) if isinstance(image, dict)
                            and isinstance(image.get("#text"), str) and image["#text"].startswith("https://") and len(image["#text"]) <= 4096), None)
            results.append({"id": hashlib.sha256(identity.encode()).hexdigest()[:24],
                            "kind": kind, "title": title, "artist": artist, "artwork": artwork})
        result = {"results": results, "provider": "lastfm"}
    except (httpx.TimeoutException, TimeoutError):
        raise HTTPException(504, "The metadata provider timed out.") from None
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(502, "The metadata provider is unavailable.") from None
    cache[cache_key] = (time.monotonic() + 900, result)
    cache.move_to_end(cache_key)
    while len(cache) > 200:
        cache.popitem(last=False)
    return result
