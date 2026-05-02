"""
test_fetch_riksavtalen.py — Tests for the fetch_riksavtalen tool.

Covers:
  - Happy path: 2024 kveldstillegg → correct Citation
  - Happy path: 2025 garantilonn → correct Citation
  - Unsupported version → ValueError with supported-versions list
  - LOVSEN_MCP_FIXTURE=1 required (zero network)
"""

from __future__ import annotations

import os
import sys

import pytest

os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    mods = [k for k in sys.modules if "lovsen" in k or "nho_reiseliv" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Happy path: 2024 kveldstillegg ───────────────────────────────────────────


def test_fetch_riksavtalen_2024_kveldstillegg():
    """fetch_riksavtalen(version='2024', paragraph='§6.1') returns 2024 Citation."""
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen

    result = fetch_riksavtalen(version="2024", paragraph="§6.1")

    assert result["law_version"] == "2024"
    assert "kveldstillegg" in result["verbatim_text"].lower() or "kveldsarbeid" in result["verbatim_text"].lower()
    assert "25 %" in result["verbatim_text"] or "25%" in result["verbatim_text"]
    assert result["lov"] == "riksavtalen"
    assert len(result["hash"]) == 64
    assert result["source_url"].startswith("https://www.nhoreiseliv.no")


# ── Happy path: 2025 garantilonn ─────────────────────────────────────────────


def test_fetch_riksavtalen_2025_garantilonn():
    """fetch_riksavtalen(version='2025', paragraph='§5') returns 2025 Citation."""
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen

    result = fetch_riksavtalen(version="2025", paragraph="§5")

    assert result["law_version"] == "2025"
    assert "garantilønn" in result["verbatim_text"].lower() or "garantilonn" in result["verbatim_text"].lower()
    # 2025 minimum wage is NOK 40 500
    assert "40 500" in result["verbatim_text"] or "40500" in result["verbatim_text"]
    assert len(result["hash"]) == 64


# ── Metadata-only (no paragraph) ─────────────────────────────────────────────


def test_fetch_riksavtalen_metadata_only():
    """fetch_riksavtalen(version='2024') with no paragraph returns metadata dict."""
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen

    result = fetch_riksavtalen(version="2024")

    assert result["law_version"] == "2024"
    assert result.get("metadata_only") is True


# ── Unsupported version → explicit error ─────────────────────────────────────


def test_fetch_riksavtalen_unsupported_version():
    """fetch_riksavtalen with unsupported version raises ValueError listing supported versions."""
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen

    with pytest.raises(ValueError, match="Unsupported"):
        fetch_riksavtalen(version="2023", paragraph="§6.1")


def test_fetch_riksavtalen_future_version_raises():
    """fetch_riksavtalen with future version raises ValueError — no silent fallback."""
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen

    with pytest.raises(ValueError, match="Unsupported"):
        fetch_riksavtalen(version="2030", paragraph="§6.1")


# ── No network in fixture mode ────────────────────────────────────────────────


def test_fetch_riksavtalen_no_network_in_fixture_mode():
    """fetch_url raises RuntimeError in fixture mode — no HTTP ever sent."""
    _reload()
    from src.nho_reiseliv_client import fetch_url

    with pytest.raises(RuntimeError, match="fixture mode"):
        fetch_url("https://www.nhoreiseliv.no/test")
