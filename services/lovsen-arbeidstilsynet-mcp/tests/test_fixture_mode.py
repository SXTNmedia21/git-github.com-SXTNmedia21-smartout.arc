"""
test_fixture_mode.py — Tests verifying LOVSEN_MCP_FIXTURE=1 contract (ADR-0244).

Key invariants:
- LOVSEN_MCP_FIXTURE=1 activates FIXTURE_MODE in the client module
- fetch_url raises RuntimeError in fixture mode — network guard
- Missing fixture file → FileNotFoundError with path in message
- Malformed fixture JSON → ValueError with parse error info
- Hash mismatch in fixture → Pydantic ValidationError ("hash mismatch")
- Zero outbound HTTP during the entire test suite (RuntimeError guard enforces this)
"""

from __future__ import annotations

import hashlib
import json
import os
import sys

import pytest

os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    mods = [k for k in sys.modules if "lovsen" in k or "arbeidstilsynet" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Fixture mode flag ─────────────────────────────────────────────────────────


def test_fixture_mode_is_active():
    """LOVSEN_MCP_FIXTURE=1 means FIXTURE_MODE is True in the client module."""
    _reload()
    from src.arbeidstilsynet_client import FIXTURE_MODE

    assert FIXTURE_MODE is True


# ── Network guard ─────────────────────────────────────────────────────────────


def test_fetch_url_raises_in_fixture_mode():
    """fetch_url raises RuntimeError when FIXTURE_MODE is active — network guard."""
    _reload()
    from src.arbeidstilsynet_client import fetch_url

    with pytest.raises(RuntimeError, match="fixture mode"):
        fetch_url("https://www.arbeidstilsynet.no/test")


def test_search_arbeidstilsynet_raises_in_fixture_mode():
    """search_arbeidstilsynet also raises RuntimeError (delegates to fetch_url)."""
    _reload()
    from src.arbeidstilsynet_client import search_arbeidstilsynet

    with pytest.raises(RuntimeError, match="fixture mode"):
        search_arbeidstilsynet("HMS")


# ── Missing fixture → clear error ─────────────────────────────────────────────


def test_missing_fixture_raises_file_not_found(tmp_path, monkeypatch):
    """Missing fixture file raises FileNotFoundError with path in message."""
    _reload()
    from src import fixtures

    # Point the fixtures dir to an empty tmp dir
    monkeypatch.setattr(fixtures, "_FIXTURES_DIR", tmp_path)
    # Patch the _FIXTURE_FILES dict to point to the tmp dir
    import src.fixtures as fix_mod
    original = dict(fix_mod._FIXTURE_FILES)
    monkeypatch.setattr(
        fix_mod,
        "_FIXTURE_FILES",
        {k: tmp_path / v.name for k, v in original.items()},
    )

    with pytest.raises(FileNotFoundError, match="Fixture file missing"):
        fix_mod._load_fixture("hms_systematisk_arbeid")


def test_missing_fixture_does_not_reach_network(tmp_path, monkeypatch):
    """FileNotFoundError is raised before any network call is attempted."""
    _reload()
    import src.fixtures as fix_mod

    original = dict(fix_mod._FIXTURE_FILES)
    monkeypatch.setattr(
        fix_mod,
        "_FIXTURE_FILES",
        {k: tmp_path / v.name for k, v in original.items()},
    )

    with pytest.raises(FileNotFoundError):
        fix_mod._load_fixture("hms_systematisk_arbeid")
    # If we got here without RuntimeError, network was not touched


# ── Malformed fixture JSON ─────────────────────────────────────────────────────


def test_malformed_fixture_json_raises_value_error(tmp_path, monkeypatch):
    """Malformed fixture JSON raises ValueError with parse error info."""
    _reload()
    import src.fixtures as fix_mod

    bad_path = tmp_path / "hms_systematisk_arbeid.json"
    bad_path.write_text("{not valid json !!!", encoding="utf-8")

    monkeypatch.setattr(
        fix_mod,
        "_FIXTURE_FILES",
        {**fix_mod._FIXTURE_FILES, "hms_systematisk_arbeid": bad_path},
    )

    with pytest.raises(ValueError, match="Malformed fixture JSON"):
        fix_mod._load_fixture("hms_systematisk_arbeid")


# ── Hash mismatch → corruption detected ──────────────────────────────────────


def test_hash_mismatch_detected_by_pydantic():
    """
    A Citation with hash that doesn't match verbatim_text is rejected
    by the Pydantic model_validator with 'hash mismatch'.
    """
    _reload()
    from src.citation import Citation
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="hash mismatch"):
        Citation(
            lov="arbeidstilsynet-veiledning",
            paragraph="§5",
            verbatim_text="Internkontroll tekst.",
            hash="a" * 64,  # deliberately wrong hash
            fetched_at="2026-04-29T00:00:00+00:00",
            source_url="https://www.arbeidstilsynet.no/tema/",
        )


def test_fixture_hash_validation_catches_corruption(tmp_path, monkeypatch):
    """
    _validate_fixture_hash raises ValueError on hash mismatch
    (separate from Pydantic — called before Citation construction).
    """
    _reload()
    import src.fixtures as fix_mod

    corrupt = {
        "lov": "arbeidstilsynet-veiledning",
        "paragraph": "§5",
        "verbatim_text": "Real text.",
        "hash": "b" * 64,  # wrong hash
        "fetched_at": "2026-04-29T00:00:00+00:00",
        "source_url": "https://www.arbeidstilsynet.no/tema/",
    }
    corrupt_path = tmp_path / "corrupt.json"

    with pytest.raises(ValueError, match="corruption"):
        fix_mod._validate_fixture_hash(corrupt, corrupt_path)


# ── All 3 seeded fixtures load cleanly ───────────────────────────────────────


def test_all_3_fixtures_load_without_error():
    """hms, arbeidstid, risikovurdering fixtures all load and pass hash validation."""
    _reload()
    import src.fixtures as fix_mod

    for key in ["hms_systematisk_arbeid", "arbeidstid_natt_skift", "risikovurdering_kjokken_template"]:
        data = fix_mod._load_fixture(key)
        fix_mod._validate_fixture_hash(data, fix_mod._FIXTURE_FILES[key])
        assert "verbatim_text" in data
        assert len(data["hash"]) == 64
