"""
arbeidstilsynet_client.py — HTTP client for arbeidstilsynet.no

Responsibilities:
  - 1 req/sec rate limit per ADR-0244
  - 24h TTL file-system cache at ~/.cache/lovsen-mcp/arbeidstilsynet/
  - Zero network in fixture mode (LOVSEN_MCP_FIXTURE=1)
  - Emit logs to stderr only — stdout is reserved for MCP JSON-RPC

Why rate limit at the MCP level: capability tools call this server via MCP stdio;
they cannot coordinate per-source request rates. Centralising here satisfies ADR-0244.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

import httpx

logger = logging.getLogger("lovsen.arbeidstilsynet")

# ADR-0244: 1 req/sec per source domain
_MIN_INTERVAL_SEC = 1.0
_last_request_time: float = 0.0

# 24h TTL in seconds
_CACHE_TTL_SEC = 24 * 60 * 60

_CACHE_DIR = Path(os.environ.get("LOVSEN_CACHE_DIR", str(Path.home() / ".cache" / "lovsen-mcp" / "arbeidstilsynet")))

# Fixture mode flag
FIXTURE_MODE = os.environ.get("LOVSEN_MCP_FIXTURE", "").strip() in ("1", "true", "yes")

_BASE_URL = "https://www.arbeidstilsynet.no"


def _cache_path(url: str) -> Path:
    """Derive a deterministic cache file path from URL."""
    key = hashlib.sha256(url.encode()).hexdigest()
    return _CACHE_DIR / f"{key}.json"


def _read_cache(url: str) -> Optional[str]:
    """Return cached HTML string if still within TTL, else None."""
    path = _cache_path(url)
    if not path.exists():
        return None
    age = time.time() - path.stat().st_mtime
    if age > _CACHE_TTL_SEC:
        logger.debug("cache expired for %s (age=%.0fs)", url, age)
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("content")
    except Exception as exc:
        logger.warning("cache read error for %s: %s", url, exc)
        return None


def _write_cache(url: str, content: str) -> None:
    """Write content to cache with current mtime."""
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path = _cache_path(url)
        path.write_text(
            json.dumps({"url": url, "content": content}),
            encoding="utf-8",
        )
    except Exception as exc:
        logger.warning("cache write error for %s: %s", url, exc)


def _rate_limit() -> None:
    """Block until 1 req/sec budget allows a new request."""
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    wait = _MIN_INTERVAL_SEC - elapsed
    if wait > 0:
        logger.debug("rate limit: sleeping %.3fs", wait)
        time.sleep(wait)
    _last_request_time = time.monotonic()


def fetch_url(url: str, *, timeout: float = 10.0) -> str:
    """
    Fetch URL with cache + rate limit.

    Raises RuntimeError in fixture mode — callers must intercept before calling this.
    Raises httpx.HTTPError on network failures.
    """
    if FIXTURE_MODE:
        raise RuntimeError(
            "arbeidstilsynet_client.fetch_url called in fixture mode — "
            "fixture resolver must intercept before reaching the HTTP client"
        )

    cached = _read_cache(url)
    if cached is not None:
        logger.debug("cache hit: %s", url)
        return cached

    _rate_limit()
    logger.info("GET %s", url)
    response = httpx.get(
        url,
        timeout=timeout,
        headers={"User-Agent": "lovsen-mcp/1.0 (smartout.no; research)"},
        follow_redirects=True,
    )
    response.raise_for_status()
    content = response.text
    _write_cache(url, content)
    return content


def search_arbeidstilsynet(query: str, scope: Optional[str] = None) -> str:
    """
    Build the search URL for arbeidstilsynet.no full-text search.

    Returns the HTML of the search results page.
    Not called in fixture mode.
    """
    params = {"q": query}
    if scope:
        params["category"] = scope
    url = f"{_BASE_URL}/tema/?" + "&".join(f"{k}={v}" for k, v in params.items())
    return fetch_url(url)


def fetch_arbeidstilsynet_page(path: str) -> str:
    """
    Fetch a specific arbeidstilsynet.no page by path (e.g. '/tema/hms-kort/').
    Not called in fixture mode.
    """
    url = f"{_BASE_URL}{path}"
    return fetch_url(url)
