"""
nho_reiseliv_client.py — HTTP client for nhoreiseliv.no (Riksavtalen)

Responsibilities:
  - 1 req/sec rate limit per ADR-0244
  - 24h TTL file-system cache at ~/.cache/lovsen-mcp/nho-reiseliv/
  - Zero network in fixture mode (LOVSEN_FIXTURE_MODE=true canonical per ADR-0258)
  - Version-routing: every fetch requires an explicit version; no silent fallback
  - Emit logs to stderr only — stdout is reserved for MCP JSON-RPC

Why rate limit at the MCP level: capability tools call this server via MCP stdio;
they cannot coordinate per-source request rates. Centralising here satisfies ADR-0244.

Why no default version: tariff rates change year-over-year. Silently returning the
"latest" version when 2024 was requested is a data-integrity failure (README §5
Versjons-bevissthet, ADR-0244).
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

logger = logging.getLogger("lovsen.nho_reiseliv")

# ADR-0244: 1 req/sec per source domain
_MIN_INTERVAL_SEC = 1.0
_last_request_time: float = 0.0

# 24h TTL in seconds
_CACHE_TTL_SEC = 24 * 60 * 60

_CACHE_DIR = Path(
    os.environ.get(
        "LOVSEN_CACHE_DIR",
        str(Path.home() / ".cache" / "lovsen-mcp" / "nho-reiseliv"),
    )
)

# Fixture mode flag — read at import time; tools must check before calling fetch_url.
# ADR-0258 canonical envvar: LOVSEN_FIXTURE_MODE=true (checked first).
# Legacy fallback: LOVSEN_MCP_FIXTURE=1 (still honoured during cutover; removed post-cert-pass).
_FIXTURE_MODE_CANONICAL = os.environ.get("LOVSEN_FIXTURE_MODE", "").strip().lower() in (
    "true", "1", "yes"
)
_FIXTURE_MODE_LEGACY = os.environ.get("LOVSEN_MCP_FIXTURE", "").strip() in ("1", "true", "yes")
FIXTURE_MODE: bool = _FIXTURE_MODE_CANONICAL or _FIXTURE_MODE_LEGACY

_BASE_URL = "https://www.nhoreiseliv.no"

# Supported versions — explicitly enumerated; never silently fall back
SUPPORTED_VERSIONS = {"2024", "2025"}


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


def _validate_version(version: str) -> None:
    """
    Raise ValueError for unsupported versions.

    Never silently falls back — README §5 + ADR-0244.
    """
    if version not in SUPPORTED_VERSIONS:
        raise ValueError(
            f"Unsupported Riksavtalen version: {version!r}. "
            f"Supported: {sorted(SUPPORTED_VERSIONS)}. "
            "Specify an explicit version — no silent fallback."
        )


def fetch_url(url: str, *, timeout: float = 10.0) -> str:
    """
    Fetch URL with cache + rate limit.

    Raises RuntimeError in fixture mode — callers must intercept before calling this.
    Raises httpx.HTTPError on network failures.
    """
    if FIXTURE_MODE:
        raise RuntimeError(
            "nho_reiseliv_client.fetch_url called in fixture mode — "
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


def fetch_riksavtalen_page(version: str, paragraph: Optional[str] = None) -> str:
    """
    Fetch the Riksavtalen page for a specific version.

    Raises ValueError for unsupported versions (never falls back).
    Not called in fixture mode.
    """
    _validate_version(version)
    url = f"{_BASE_URL}/overenskomster/riksavtalen/{version}"
    if paragraph:
        # Normalise paragraph anchor for URL (e.g. "§6.1" → "6-1")
        anchor = paragraph.lstrip("§").replace(".", "-")
        url = f"{url}#{anchor}"
    return fetch_url(url)
