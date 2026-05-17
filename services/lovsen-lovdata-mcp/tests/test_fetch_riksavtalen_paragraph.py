"""
test_fetch_riksavtalen_paragraph.py — Tests for fetch_riksavtalen_paragraph tool.

All tests run in fixture mode — zero network calls.
Fixture-mode guard in lovdata_client.py raises RuntimeError on any http_get call,
so any accidental live-network path will fail loudly.

6 test cases per spec:
  1. fixture_mode_taro79_kveldstillegg   — happy path, LOVSEN_FIXTURE_MODE=true
  2. fixture_mode_legacy_envvar          — LOVSEN_MCP_FIXTURE=1 backwards-compat
  3. unknown_taro_id_raises              — ValueError listing supported IDs
  4. missing_version_raises              — ValueError per ADR-0258
  5. missing_fixture_raises              — explicit FileNotFoundError (CI safety)
  6. paragraph_normalization             — "4-3" input normalizes to "§4-3" in output
"""

from __future__ import annotations

import importlib
import os
import sys

import pytest


# ── Module reload helper ───────────────────────────────────────────────────────


def _reload_modules() -> None:
    """Purge lovsen/lovdata modules so FIXTURE_MODE constant re-evaluates from env."""
    to_del = [k for k in sys.modules if "lovsen" in k or "lovdata" in k]
    for mod in to_del:
        del sys.modules[mod]


# ── Test 1: fixture mode, canonical envvar ─────────────────────────────────────


def test_fixture_mode_taro79_kveldstillegg(monkeypatch):
    """
    fetch_riksavtalen_paragraph returns a valid Citation in fixture mode (LOVSEN_FIXTURE_MODE=true).
    Asserts: hash present, verbatim_text contains 'kveldstillegg', source_url matches TARO.
    """
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    monkeypatch.delenv("LOVSEN_MCP_FIXTURE", raising=False)
    _reload_modules()

    from src.tools.fetch_riksavtalen_paragraph import fetch_riksavtalen_paragraph

    result = fetch_riksavtalen_paragraph(
        taro_id="taro-79",
        paragraph="§4-3",
        version="2024-2026",
    )

    assert len(result["hash"]) == 64, "hash must be 64-char hex SHA-256"
    assert result["hash"].islower(), "hash must be lowercase"
    assert "kveldstillegg" in result["verbatim_text"].lower(), (
        f"verbatim_text must mention kveldstillegg; got: {result['verbatim_text']!r}"
    )
    assert "lovdata.no" in result["source_url"], (
        f"source_url must be a Lovdata URL; got: {result['source_url']!r}"
    )
    assert "TARO" in result["source_url"] or "taro" in result["source_url"].lower(), (
        f"source_url must reference TARO namespace; got: {result['source_url']!r}"
    )
    assert result["paragraph"] == "§4-3"
    assert result["law_version"] == "2024-2026"


# ── Test 2: legacy envvar backwards-compat ────────────────────────────────────


def test_fixture_mode_legacy_envvar(monkeypatch):
    """
    LOVSEN_MCP_FIXTURE=1 (legacy) activates fixture mode for backwards-compat.
    Same call as test 1 must succeed without network access.
    """
    monkeypatch.delenv("LOVSEN_FIXTURE_MODE", raising=False)
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")
    _reload_modules()

    from src.tools.fetch_riksavtalen_paragraph import fetch_riksavtalen_paragraph

    result = fetch_riksavtalen_paragraph(
        taro_id="taro-79",
        paragraph="4-3",
        version="2024-2026",
    )

    assert "kveldstillegg" in result["verbatim_text"].lower()
    assert len(result["hash"]) == 64


# ── Test 3: unknown taro_id raises ────────────────────────────────────────────


def test_unknown_taro_id_raises(monkeypatch):
    """
    taro-999 raises ValueError listing the supported TARO IDs.
    """
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    _reload_modules()

    from src.tools.fetch_riksavtalen_paragraph import fetch_riksavtalen_paragraph

    with pytest.raises(ValueError, match="taro-999"):
        fetch_riksavtalen_paragraph(
            taro_id="taro-999",
            paragraph="4-3",
            version="2024-2026",
        )


# ── Test 4: missing version raises ────────────────────────────────────────────


def test_missing_version_raises(monkeypatch):
    """
    Empty version raises ValueError per ADR-0258 (no silent fallback to latest version).
    """
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    _reload_modules()

    from src.tools.fetch_riksavtalen_paragraph import fetch_riksavtalen_paragraph

    with pytest.raises(ValueError, match="version must not be empty"):
        fetch_riksavtalen_paragraph(
            taro_id="taro-79",
            paragraph="4-3",
            version="",
        )


# ── Test 5: missing fixture raises explicitly ─────────────────────────────────


def test_fixture_mode_missing_fixture_raises(monkeypatch):
    """
    Requesting a paragraph with no fixture file raises FileNotFoundError (CI safety).
    Must NOT silently fall back to network — network calls are forbidden in fixture mode.
    """
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    _reload_modules()

    from src.tools.fetch_riksavtalen_paragraph import fetch_riksavtalen_paragraph

    with pytest.raises(FileNotFoundError, match="fixture not found"):
        fetch_riksavtalen_paragraph(
            taro_id="taro-79",
            paragraph="§99-99",  # no fixture exists for this
            version="2024-2026",
        )


# ── Test 6: paragraph normalization ──────────────────────────────────────────


def test_paragraph_normalization(monkeypatch):
    """
    "4-3" input (no § prefix) normalizes to "§4-3" in the output Citation.
    """
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    _reload_modules()

    from src.tools.fetch_riksavtalen_paragraph import fetch_riksavtalen_paragraph

    result = fetch_riksavtalen_paragraph(
        taro_id="taro-79",
        paragraph="4-3",  # no § prefix
        version="2024-2026",
    )

    assert result["paragraph"] == "§4-3", (
        f"paragraph must normalize to '§4-3'; got: {result['paragraph']!r}"
    )
