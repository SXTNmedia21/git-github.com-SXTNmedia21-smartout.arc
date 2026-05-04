"""
test_lookup_tariff_supplement.py — Tests for the lookup_tariff_supplement tool.

Covers:
  - Happy path: 2024 kveldstillegg → 25% rate in Citation
  - Happy path: 2025 kveldstillegg → 27% rate in Citation (different from 2024)
  - Version-mismatch (unsupported version) → explicit ValueError
  - Unknown category → explicit ValueError
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


def test_lookup_kveldstillegg_2024():
    """lookup_tariff_supplement(category='kveldstillegg', version='2024') → 25% rate."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="kveldstillegg", version="2024")

    assert result["law_version"] == "2024"
    assert "25 %" in result["verbatim_text"] or "25%" in result["verbatim_text"]
    assert result["lov"] == "riksavtalen"
    assert len(result["hash"]) == 64
    assert result["source_url"].startswith("https://")


# ── Happy path: 2025 kveldstillegg ───────────────────────────────────────────


def test_lookup_kveldstillegg_2025():
    """lookup_tariff_supplement(category='kveldstillegg', version='2025') → 27% rate."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="kveldstillegg", version="2025")

    assert result["law_version"] == "2025"
    assert "27 %" in result["verbatim_text"] or "27%" in result["verbatim_text"]
    assert len(result["hash"]) == 64


# ── Happy path: garantilonn ──────────────────────────────────────────────────


def test_lookup_garantilonn_2024():
    """lookup_tariff_supplement(category='garantilonn', version='2024') → NOK 38 000."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="garantilonn", version="2024")

    assert result["law_version"] == "2024"
    assert "38 000" in result["verbatim_text"] or "38000" in result["verbatim_text"]


def test_lookup_garantilonn_2025():
    """lookup_tariff_supplement(category='garantilonn', version='2025') → NOK 40 500."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="garantilonn", version="2025")

    assert result["law_version"] == "2025"
    assert "40 500" in result["verbatim_text"] or "40500" in result["verbatim_text"]


# ── Norwegian ø alias accepted ────────────────────────────────────────────────


def test_lookup_garantilønn_alias_accepted():
    """garantilønn (with ø) is accepted as alias for garantilonn."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="garantilønn", version="2024")
    assert result["law_version"] == "2024"


# ── Version-mismatch → explicit error ────────────────────────────────────────


def test_lookup_unsupported_version_raises():
    """Unsupported version raises ValueError listing supported versions."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    with pytest.raises(ValueError, match="Unsupported"):
        lookup_tariff_supplement(category="kveldstillegg", version="2023")


def test_lookup_no_silent_fallback_on_bad_version():
    """version='latest' is not accepted — no default/silent fallback."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    with pytest.raises(ValueError, match="Unsupported"):
        lookup_tariff_supplement(category="kveldstillegg", version="latest")


# ── Unknown category → explicit error ────────────────────────────────────────


def test_lookup_unknown_category_raises():
    """Unknown category raises ValueError."""
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    with pytest.raises(ValueError, match="Unknown"):
        lookup_tariff_supplement(category="helgetillegg", version="2024")
