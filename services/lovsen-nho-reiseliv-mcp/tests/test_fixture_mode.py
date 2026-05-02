"""
test_fixture_mode.py — Tests verifying LOVSEN_MCP_FIXTURE=1 contract (ADR-0244).

Key invariants:
  - LOVSEN_MCP_FIXTURE=1 activates FIXTURE_MODE in the client module
  - fetch_url raises RuntimeError in fixture mode — network guard
  - Missing fixture → FileNotFoundError with path in message
  - Malformed fixture JSON → ValueError with parse error info
  - Hash mismatch in fixture → ValueError "corruption"
  - Zero outbound HTTP during the entire test suite (RuntimeError guard enforces this)
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

import pytest

os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    mods = [k for k in sys.modules if "lovsen" in k or "nho_reiseliv" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Fixture mode flag ─────────────────────────────────────────────────────────


def test_fixture_mode_is_active():
    """LOVSEN_MCP_FIXTURE=1 means FIXTURE_MODE is True in the client module."""
    _reload()
    from src.nho_reiseliv_client import FIXTURE_MODE

    assert FIXTURE_MODE is True


# ── Network guard ─────────────────────────────────────────────────────────────


def test_fetch_url_raises_in_fixture_mode():
    """fetch_url raises RuntimeError when FIXTURE_MODE is active — network guard."""
    _reload()
    from src.nho_reiseliv_client import fetch_url

    with pytest.raises(RuntimeError, match="fixture mode"):
        fetch_url("https://www.nhoreiseliv.no/test")


def test_fetch_riksavtalen_page_raises_in_fixture_mode():
    """fetch_riksavtalen_page also raises RuntimeError (delegates to fetch_url)."""
    _reload()
    from src.nho_reiseliv_client import fetch_riksavtalen_page

    with pytest.raises(RuntimeError, match="fixture mode"):
        fetch_riksavtalen_page("2024", "§6.1")


# ── Missing fixture → clear error ─────────────────────────────────────────────


def test_missing_fixture_raises_file_not_found(tmp_path, monkeypatch):
    """Missing fixture file raises FileNotFoundError with path in message."""
    _reload()
    import src.fixtures as fix_mod

    # Point to non-existent file
    monkeypatch.setattr(
        fix_mod,
        "_FIXTURE_FILES",
        {
            **fix_mod._FIXTURE_FILES,
            ("2024", "kveldstillegg"): tmp_path / "nonexistent.json",
        },
    )

    with pytest.raises(FileNotFoundError, match="Fixture file missing"):
        fix_mod._load_fixture("2024", "kveldstillegg")


def test_missing_fixture_does_not_reach_network(tmp_path, monkeypatch):
    """FileNotFoundError is raised before any network call is attempted."""
    _reload()
    import src.fixtures as fix_mod

    monkeypatch.setattr(
        fix_mod,
        "_FIXTURE_FILES",
        {
            **fix_mod._FIXTURE_FILES,
            ("2025", "garantilonn"): tmp_path / "nonexistent.json",
        },
    )

    with pytest.raises(FileNotFoundError):
        fix_mod._load_fixture("2025", "garantilonn")
    # No RuntimeError = network not touched


# ── Malformed fixture JSON ─────────────────────────────────────────────────────


def test_malformed_fixture_json_raises_value_error(tmp_path, monkeypatch):
    """Malformed fixture JSON raises ValueError with parse error info."""
    _reload()
    import src.fixtures as fix_mod

    bad_path = tmp_path / "bad.json"
    bad_path.write_text("{not valid json !!!", encoding="utf-8")

    monkeypatch.setattr(
        fix_mod,
        "_FIXTURE_FILES",
        {
            **fix_mod._FIXTURE_FILES,
            ("2024", "kveldstillegg"): bad_path,
        },
    )

    with pytest.raises(ValueError, match="Malformed fixture JSON"):
        fix_mod._load_fixture("2024", "kveldstillegg")


# ── Hash mismatch → corruption detected ──────────────────────────────────────


def test_hash_mismatch_detected(tmp_path, monkeypatch):
    """_validate_fixture_hash raises ValueError on hash mismatch."""
    _reload()
    import src.fixtures as fix_mod

    corrupt = {
        "lov": "riksavtalen",
        "paragraph": "§6.1",
        "verbatim_text": "Real text.",
        "hash": "b" * 64,  # wrong hash
        "fetched_at": "2026-04-29T00:00:00+00:00",
        "source_url": "https://www.nhoreiseliv.no/overenskomster/riksavtalen/2024",
        "law_version": "2024",
    }
    corrupt_path = tmp_path / "corrupt.json"

    with pytest.raises(ValueError, match="corruption"):
        fix_mod._validate_fixture_hash(corrupt, corrupt_path)


def test_citation_model_rejects_wrong_hash():
    """Citation model_validator raises ValueError on hash mismatch."""
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash mismatch"):
        Citation(
            lov="riksavtalen",
            paragraph="§6.1",
            verbatim_text="Some verbatim text.",
            hash="a" * 64,
            fetched_at="2026-04-29T00:00:00+00:00",
            source_url="https://www.nhoreiseliv.no/overenskomster/riksavtalen/2024",
            law_version="2024",
        )


# ── Unsupported version → explicit error (not fixture-not-found) ──────────────


def test_unsupported_version_raises_value_error():
    """Unsupported version raises ValueError, not FileNotFoundError."""
    _reload()
    import src.fixtures as fix_mod

    with pytest.raises(ValueError, match="Unsupported"):
        fix_mod._load_fixture("2099", "kveldstillegg")


# ── All 4 seeded fixtures load cleanly ───────────────────────────────────────


def test_all_4_fixtures_load_without_error():
    """All 4 versioned fixtures load and pass hash validation."""
    _reload()
    import src.fixtures as fix_mod

    for version in ["2024", "2025"]:
        for category in ["kveldstillegg", "garantilonn"]:
            data = fix_mod._load_fixture(version, category)
            assert "verbatim_text" in data
            assert len(data["hash"]) == 64
            assert data["law_version"] == version
