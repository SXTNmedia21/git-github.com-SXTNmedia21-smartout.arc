"""
fixtures.py — fixture loader for lovsen-arbeidstilsynet-mcp

Reads pre-built Citation JSON files from src/fixtures/.
Active when LOVSEN_MCP_FIXTURE=1 (enforced by arbeidstilsynet_client.FIXTURE_MODE).

Fixture routing:
  search_guidance:
    scope='hms'            → hms_systematisk_arbeid.json
    scope='arbeidstid'     → arbeidstid_natt_skift.json
    scope='risikovurdering'→ risikovurdering_kjokken_template.json
    query keyword match    → first fixture whose keywords match (case-insensitive)
    fallback               → hms_systematisk_arbeid.json (most generic)

  fetch_workplace_assessment_template:
    template_id='risikovurdering-kjokken' → risikovurdering_kjokken_template.json
    unknown id → MCP error

Error semantics:
  - Missing fixture file → fail fast with explicit path in message
  - Malformed JSON → ParseError with path
  - verbatim_text + hash mismatch → "fixture corruption" error
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("lovsen.arbeidstilsynet.fixtures")

_FIXTURES_DIR = Path(__file__).parent / "fixtures"

# Fixture file registry
_FIXTURE_FILES = {
    "hms_systematisk_arbeid": _FIXTURES_DIR / "hms_systematisk_arbeid.json",
    "arbeidstid_natt_skift": _FIXTURES_DIR / "arbeidstid_natt_skift.json",
    "risikovurdering_kjokken_template": _FIXTURES_DIR / "risikovurdering_kjokken_template.json",
}

# Template ID → fixture key mapping
_TEMPLATE_MAP: dict[str, str] = {
    "risikovurdering-kjokken": "risikovurdering_kjokken_template",
}

# Keyword routing for search_guidance (case-insensitive)
_KEYWORD_MAP: list[tuple[list[str], str]] = [
    (["arbeidstid", "natt", "skift", "nattarbeid", "§10-3", "10-3"], "arbeidstid_natt_skift"),
    (["risikovurdering", "risiko", "kjøkken", "kjokken", "kitchen", "template"], "risikovurdering_kjokken_template"),
    (["hms", "internkontroll", "systematisk", "§5", "vernetjeneste"], "hms_systematisk_arbeid"),
]


def _load_fixture(key: str) -> dict[str, Any]:
    """Load and return a fixture dict. Raises on missing file or bad JSON."""
    path = _FIXTURE_FILES.get(key)
    if path is None:
        raise KeyError(f"Unknown fixture key: {key!r}. Available: {list(_FIXTURE_FILES)}")
    if not path.exists():
        raise FileNotFoundError(
            f"Fixture file missing: {path}. "
            "Ensure 3 seed fixtures are present in src/fixtures/."
        )
    try:
        raw = path.read_text(encoding="utf-8")
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed fixture JSON at {path}: {exc}") from exc


def _validate_fixture_hash(data: dict[str, Any], path: Path) -> None:
    """Verify verbatim_text matches hash. Raises on corruption."""
    import hashlib
    vt = data.get("verbatim_text", "")
    expected = hashlib.sha256(vt.encode()).hexdigest()
    actual = data.get("hash", "")
    if actual != expected:
        raise ValueError(
            f"Fixture corruption at {path}: "
            f"hash mismatch (expected {expected[:12]}…, got {actual[:12]}…). "
            "Re-generate the fixture with make_citation()."
        )


def _resolve_search_key(query: str, scope: Optional[str]) -> str:
    """Map query + scope to a fixture key."""
    # Scope takes priority
    if scope == "hms":
        return "hms_systematisk_arbeid"
    if scope == "arbeidstid":
        return "arbeidstid_natt_skift"
    if scope == "risikovurdering":
        return "risikovurdering_kjokken_template"

    # Keyword match on query
    lower_query = query.lower()
    for keywords, key in _KEYWORD_MAP:
        if any(kw.lower() in lower_query for kw in keywords):
            return key

    # Generic fallback
    return "hms_systematisk_arbeid"


def fixture_search_guidance(query: str, scope: Optional[str], limit: int) -> list[dict[str, Any]]:
    """Return list of Citation dicts from fixture for search_guidance."""
    key = _resolve_search_key(query, scope)
    data = _load_fixture(key)
    path = _FIXTURE_FILES[key]
    _validate_fixture_hash(data, path)
    logger.debug("fixture_search_guidance: key=%s query=%r scope=%r", key, query, scope)
    # Return as a list (fixture is a single Citation)
    return [data][:limit]


def fixture_fetch_template(template_id: str) -> dict[str, Any]:
    """Return Citation dict from fixture for fetch_workplace_assessment_template."""
    key = _TEMPLATE_MAP.get(template_id)
    if key is None:
        available = list(_TEMPLATE_MAP.keys())
        raise ValueError(
            f"template-not-found: no fixture for template_id={template_id!r}. "
            f"Available templates: {available}"
        )
    data = _load_fixture(key)
    path = _FIXTURE_FILES[key]
    _validate_fixture_hash(data, path)
    logger.debug("fixture_fetch_template: template_id=%r key=%s", template_id, key)
    return data


def list_available_templates() -> list[str]:
    """Return list of known template IDs."""
    return list(_TEMPLATE_MAP.keys())
