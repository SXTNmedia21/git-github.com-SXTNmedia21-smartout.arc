"""
lovdata_client.py — HTTP client for Lovdata.no with rate-limiting and caching.

ADR-0244 rules enforced here:
- LOVSEN_FIXTURE_MODE=true  → fixture-only mode, ZERO outbound HTTP (ADR-0258 canonical)
- LOVSEN_MCP_FIXTURE=1      → legacy alias, still honoured during cutover
- 1 req/sec rate-limit per domain (token bucket via asyncio)
- 24h TTL cache: in-memory dict primary, filesystem fallback at ~/.cache/lovsen-mcp/lovdata/
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

LOVDATA_BASE_URL = "https://lovdata.no"
RATE_LIMIT_RPS = 1.0  # requests per second per domain (ADR-0244)
CACHE_TTL_SECONDS = 86_400  # 24 hours

# Fixture mode flag — read at import time; tools must check before calling http_get.
# ADR-0258 canonical envvar: LOVSEN_FIXTURE_MODE=true (checked first).
# Legacy fallback: LOVSEN_MCP_FIXTURE=1 (still honoured during cutover; removed post-cert-pass).
_FIXTURE_MODE_CANONICAL = os.environ.get("LOVSEN_FIXTURE_MODE", "").strip().lower() in (
    "true", "1", "yes"
)
_FIXTURE_MODE_LEGACY = os.environ.get("LOVSEN_MCP_FIXTURE", "").strip() in ("1", "true", "yes")
FIXTURE_MODE: bool = _FIXTURE_MODE_CANONICAL or _FIXTURE_MODE_LEGACY

_FIXTURES_DIR = Path(__file__).parent / "fixtures"
_CACHE_DIR = Path.home() / ".cache" / "lovsen-mcp" / "lovdata"

# ── Token bucket (asyncio) ────────────────────────────────────────────────────


class _TokenBucket:
    """Asyncio token bucket for rate-limiting — one bucket per domain."""

    def __init__(self, rate: float) -> None:
        self._rate = rate  # tokens per second
        self._tokens: float = rate
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Wait until a token is available, then consume it."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            self._tokens = min(self._rate, self._tokens + elapsed * self._rate)
            self._last_refill = now
            if self._tokens < 1.0:
                wait = (1.0 - self._tokens) / self._rate
                logger.warning(
                    "[lovdata-client] rate-limit throttle — waiting %.2fs (%.2f tokens available)",
                    wait,
                    self._tokens,
                )
                await asyncio.sleep(wait)
                self._tokens = 0.0
            else:
                self._tokens -= 1.0


_buckets: dict[str, _TokenBucket] = {}


def _get_bucket(domain: str) -> _TokenBucket:
    if domain not in _buckets:
        _buckets[domain] = _TokenBucket(RATE_LIMIT_RPS)
    return _buckets[domain]


# ── In-memory cache ───────────────────────────────────────────────────────────

_mem_cache: dict[str, tuple[Any, float]] = {}  # key → (value, expires_at)


def _cache_key(parts: list[str]) -> str:
    raw = "|".join(p.lower().strip() for p in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> Optional[Any]:
    if key in _mem_cache:
        value, expires_at = _mem_cache[key]
        if time.monotonic() < expires_at:
            logger.debug("[lovdata-client] cache hit (memory) key=%s…", key[:16])
            return value
        del _mem_cache[key]
    # Filesystem fallback
    fs_path = _CACHE_DIR / f"{key}.json"
    if fs_path.exists():
        try:
            data = json.loads(fs_path.read_text(encoding="utf-8"))
            if time.monotonic() < data.get("_expires_at", 0):
                logger.debug("[lovdata-client] cache hit (filesystem) key=%s…", key[:16])
                value = data["value"]
                _mem_cache[key] = (value, data["_expires_at"])
                return value
        except (json.JSONDecodeError, KeyError, OSError):
            pass
    return None


def _cache_set(key: str, value: Any) -> None:
    expires_at = time.monotonic() + CACHE_TTL_SECONDS
    _mem_cache[key] = (value, expires_at)
    # Persist to filesystem
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        fs_path = _CACHE_DIR / f"{key}.json"
        fs_path.write_text(
            json.dumps({"value": value, "_expires_at": expires_at}),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("[lovdata-client] cache write failed (non-fatal): %s", exc)


# ── Fixture loader ────────────────────────────────────────────────────────────


def _fixture_key(lov: str, paragraph: str) -> str:
    """Derive fixture filename from law abbreviation + paragraph number."""
    # e.g. lov="aml", paragraph="14-6" → "aml_14_6.json"
    safe_para = paragraph.replace("-", "_").replace("§", "").strip()
    return f"{lov.lower()}_{safe_para}.json"


def load_fixture(lov: str, paragraph: str) -> dict[str, Any]:
    """Load a fixture JSON file. Raises FileNotFoundError if missing (CI safety)."""
    filename = _fixture_key(lov, paragraph)
    path = _FIXTURES_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"fixture not found at {path} — "
            f"unset LOVSEN_FIXTURE_MODE to use live Lovdata, or add the fixture file"
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"fixture {path} has malformed JSON: {exc}") from exc


def list_fixtures(lov: str | None = None) -> list[dict[str, Any]]:
    """Return all available fixture dicts, optionally filtered by law."""
    results = []
    for fp in sorted(_FIXTURES_DIR.glob("*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
            if lov is None or data.get("lov", "").lower() == lov.lower():
                results.append(data)
        except (json.JSONDecodeError, OSError):
            continue
    return results


# ── HTTP client ───────────────────────────────────────────────────────────────


async def http_get(url: str, params: dict[str, str] | None = None) -> httpx.Response:
    """
    Make a rate-limited GET request to Lovdata.no.
    Raises RuntimeError if FIXTURE_MODE is active — no outbound HTTP allowed.
    """
    if FIXTURE_MODE:
        raise RuntimeError(
            "LOVSEN_FIXTURE_MODE=true is active — outbound HTTP calls are forbidden in fixture mode"
        )
    bucket = _get_bucket(LOVDATA_BASE_URL)
    await bucket.acquire()
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        logger.info("[lovdata-client] GET %s params=%s", url, params)
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response


async def fetch_law_html(lov: str, paragraph: str) -> str:
    """
    Fetch the HTML page for a specific Aml./ferielov/etc. paragraph from Lovdata.
    Returns raw HTML string. Caches for 24h.
    """
    cache_key = _cache_key([lov, paragraph])
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    url = f"{LOVDATA_BASE_URL}/dokument/NL/{_lov_path(lov)}/KAPITTEL_{_para_chapter(paragraph)}#§{paragraph}"
    response = await http_get(url)
    html = response.text
    _cache_set(cache_key, html)
    return html


async def search_lovdata_html(query: str, lov: str | None = None, limit: int = 10) -> str:
    """
    Search Lovdata for a query string. Returns HTML of search results.
    """
    cache_key = _cache_key(["search", query, lov or "", str(limit)])
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params: dict[str, str] = {"q": query}
    if lov:
        params["scope"] = _lov_path(lov)
    url = f"{LOVDATA_BASE_URL}/search/"
    response = await http_get(url, params)
    html = response.text
    _cache_set(cache_key, html)
    return html


async def fetch_law_index_html(lov: str) -> str:
    """Fetch the law index page for metadata extraction. Cached 24h."""
    cache_key = _cache_key(["index", lov])
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    url = f"{LOVDATA_BASE_URL}/dokument/NL/{_lov_path(lov)}/"
    response = await http_get(url)
    html = response.text
    _cache_set(cache_key, html)
    return html


# ── Law path helpers ──────────────────────────────────────────────────────────

_LOV_PATHS: dict[str, str] = {
    "aml": "lov/2005-06-17-62",      # Arbeidsmiljøloven
    "ferielov": "lov/1988-04-29-21",  # Ferieloven
    "otp-loven": "lov/2005-12-21-124",  # OTP-loven
    "ftrl": "lov/1997-02-28-19",     # Folketrygdloven
}


def _lov_path(lov: str) -> str:
    key = lov.lower().strip()
    return _LOV_PATHS.get(key, key)


def _para_chapter(paragraph: str) -> str:
    """Extract chapter number from paragraph reference, e.g. '14-6' → '14'."""
    return paragraph.split("-")[0] if "-" in paragraph else paragraph
