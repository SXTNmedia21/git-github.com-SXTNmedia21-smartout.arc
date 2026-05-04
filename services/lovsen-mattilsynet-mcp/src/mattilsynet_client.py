"""
mattilsynet_client.py — HTTP client for Mattilsynet.no

Handles:
- Rate limiting: 1 request/sec per ADR-0244
- 24h TTL disk cache at ~/.cache/lovsen-mcp/mattilsynet/
- Fixture mode bypass when LOVSEN_MCP_FIXTURE=1
- stderr-only logging (MCP servers must not write to stdout)

This module is the ONLY place allowed to make outbound HTTP calls to
Mattilsynet.no. The capability layer (P1.S4) MUST call MCP tools, not
this module directly.

Reference: docs/decisions/0244-lovsen-mcp-boundary.md
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx

# --- Logging — stderr only (MCP stdio must not pollute stdout) ---
_handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(logging.Formatter("%(asctime)s [mattilsynet-mcp] %(levelname)s %(message)s"))
logger = logging.getLogger("lovsen.mattilsynet")
logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False

# --- Config ---
FIXTURE_MODE: bool = os.environ.get("LOVSEN_MCP_FIXTURE", "0").strip() in ("1", "true", "yes")
CACHE_DIR: Path = Path.home() / ".cache" / "lovsen-mcp" / "mattilsynet"
CACHE_TTL_SECONDS: int = 24 * 3600  # 24h per ADR-0244
RATE_LIMIT_DELAY: float = 1.0  # 1 req/sec per ADR-0244
BASE_URL: str = "https://www.mattilsynet.no"

# Module-level state for rate limiting
_last_request_at: float = 0.0


def _cache_path(url: str) -> Path:
    """Return the cache file path for a URL (SHA-256 of URL as filename)."""
    url_hash = hashlib.sha256(url.encode()).hexdigest()
    return CACHE_DIR / f"{url_hash}.json"


def _read_cache(url: str) -> dict[str, Any] | None:
    """Return cached response if still within TTL, else None."""
    path = _cache_path(url)
    if not path.exists():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        cached_at: float = data.get("_cached_at", 0.0)
        if time.time() - cached_at > CACHE_TTL_SECONDS:
            logger.info(f"Cache expired for {url}")
            return None
        logger.info(f"Cache hit for {url}")
        return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning(f"Cache read error for {url}: {exc}")
        return None


def _write_cache(url: str, data: dict[str, Any]) -> None:
    """Write response to cache with timestamp."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _cache_path(url)
    payload = {**data, "_cached_at": time.time()}
    try:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(f"Cache written for {url}")
    except OSError as exc:
        logger.warning(f"Cache write error for {url}: {exc}")


def _rate_limit() -> None:
    """Enforce 1 req/sec rate limit. Blocks if called too quickly."""
    global _last_request_at
    now = time.time()
    elapsed = now - _last_request_at
    if elapsed < RATE_LIMIT_DELAY:
        delay = RATE_LIMIT_DELAY - elapsed
        logger.debug(f"Rate limit: sleeping {delay:.3f}s")
        time.sleep(delay)
    _last_request_at = time.time()


def fetch_url(url: str) -> str:
    """
    Fetch a URL from Mattilsynet.no.

    - In fixture mode: raises RuntimeError (callers should use fixtures directly)
    - Uses disk cache with 24h TTL
    - Enforces 1 req/sec rate limit
    - Returns raw HTML as string
    """
    if FIXTURE_MODE:
        raise RuntimeError(
            f"[mattilsynet-mcp] fetch_url called in FIXTURE mode for {url}. "
            "Callers must read fixtures directly when LOVSEN_MCP_FIXTURE=1."
        )

    # Try cache first
    cached = _read_cache(url)
    if cached is not None:
        return cached.get("html", "")

    # Rate limit + fetch
    _rate_limit()
    logger.info(f"Fetching {url}")
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            response = client.get(
                url,
                headers={
                    "User-Agent": (
                        "lovsen-mattilsynet-mcp/0.1.0 "
                        "(Norwegian food-safety regulation lookup; "
                        "research/compliance tool; contact: pontus@smartout.no)"
                    ),
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "no,nb;q=0.9,en;q=0.8",
                },
            )
            response.raise_for_status()
            html = response.text
    except httpx.HTTPError as exc:
        logger.error(f"HTTP error fetching {url}: {exc}")
        raise

    _write_cache(url, {"html": html})
    return html
