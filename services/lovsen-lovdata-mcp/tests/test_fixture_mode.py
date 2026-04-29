"""
test_fixture_mode.py — Tests verifying LOVSEN_MCP_FIXTURE=1 contract (ADR-0244).

Key invariants:
- Env var switches the client to fixture-only mode
- Missing fixture → FileNotFoundError (CI-safe: never falls back to network)
- Malformed fixture JSON → ValueError (fail fast)
- Hash mismatch in fixture → ValueError with "fixture corruption detected"
- Zero outbound HTTP calls during the entire module run (enforced via
  pytest-httpx global mock and lovdata_client.py's RuntimeError guard)
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import pytest
from pathlib import Path

os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload_client():
    mods = [k for k in sys.modules if "lovsen" in k or "lovdata" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Fixture mode active ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_fixture_mode_is_active():
    """LOVSEN_MCP_FIXTURE=1 means FIXTURE_MODE is True in the client module."""
    _reload_client()
    from src.lovdata_client import FIXTURE_MODE

    assert FIXTURE_MODE is True


@pytest.mark.asyncio
async def test_http_get_raises_in_fixture_mode():
    """http_get raises RuntimeError when FIXTURE_MODE is active — network guard."""
    _reload_client()
    from src.lovdata_client import http_get

    with pytest.raises(RuntimeError, match="LOVSEN_MCP_FIXTURE=1 is active"):
        await http_get("https://lovdata.no/test")


# ── Missing fixture → clear error ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_missing_fixture_raises_file_not_found():
    """Missing fixture file raises FileNotFoundError with path in message."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    with pytest.raises(FileNotFoundError, match="fixture not found"):
        await fetch_paragraph(lov="aml", paragraph="999-99")


@pytest.mark.asyncio
async def test_missing_fixture_does_not_make_network_call():
    """
    When fixture is missing, the system raises immediately without attempting HTTP.
    This test verifies no RuntimeError from http_get is raised — only FileNotFoundError.
    """
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    with pytest.raises(FileNotFoundError):
        await fetch_paragraph(lov="aml", paragraph="999-99")
    # If RuntimeError (network guard) were raised instead, the test would fail


# ── Malformed fixture JSON ─────────────────────────────────────────────────────


def test_malformed_fixture_json_raises(tmp_path, monkeypatch):
    """Malformed fixture JSON raises ValueError with parse error info."""
    _reload_client()
    from src import lovdata_client

    monkeypatch.setattr(lovdata_client, "_FIXTURES_DIR", tmp_path)

    bad_fixture = tmp_path / "aml_99_1.json"
    bad_fixture.write_text("{not valid json !!!", encoding="utf-8")

    with pytest.raises(ValueError, match="malformed JSON"):
        lovdata_client.load_fixture("aml", "99-1")


# ── Hash mismatch → corruption detected ──────────────────────────────────────


def test_hash_mismatch_detected(tmp_path, monkeypatch):
    """
    A fixture with a hash that doesn't match verbatim_text is rejected
    with 'fixture corruption detected'.

    The Citation Pydantic model validator catches this via hash_matches_verbatim_text.
    We verify this by calling Citation(**corrupt_data) directly — the same validator
    that fetch_paragraph runs on every load.
    """
    _reload_client()
    import src.lovdata_client as lc

    monkeypatch.setattr(lc, "_FIXTURES_DIR", tmp_path)

    # Write a fixture with intentionally wrong hash
    corrupt = {
        "lov": "aml",
        "paragraph": "§88-1",
        "ledd": None,
        "bokstav": None,
        "verbatim_text": "Some real text here.",
        "hash": "a" * 64,  # wrong hash — sha256("Some real text here.") ≠ "aaa…"
        "fetched_at": "2026-04-29T00:00:00Z",
        "source_url": "https://lovdata.no/test",
        "law_version": None,
    }
    (tmp_path / "aml_88_1.json").write_text(
        json.dumps(corrupt), encoding="utf-8"
    )

    # load_fixture loads raw JSON — no hash validation here
    data = lc.load_fixture("aml", "88-1")
    assert data["hash"] == "a" * 64  # raw load succeeds

    # Citation model validator detects the corruption
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="fixture corruption detected"):
        Citation(**data)


# ── 3 seeded fixtures load cleanly ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_all_3_fixtures_load_without_error():
    """aml_14_6, aml_15_3, aml_15_6 all load successfully in fixture mode."""
    _reload_client()
    from src.tools.fetch_paragraph import fetch_paragraph

    for para in ["14-6", "15-3", "15-6"]:
        result = await fetch_paragraph(lov="aml", paragraph=para)
        assert result["lov"] == "aml"
        assert result["paragraph"] == f"§{para}"
        assert len(result["hash"]) == 64
