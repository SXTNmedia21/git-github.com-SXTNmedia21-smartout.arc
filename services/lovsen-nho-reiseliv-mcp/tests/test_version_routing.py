"""
test_version_routing.py — CRITICAL: proves version-routing integrity.

This is the primary correctness gate for the Lovsen tariff agent.
Tariff-version-forveksling (returning 2025 rates for a 2024 query) is the
primary risk identified in the agent README §Risiko.

Tests:
  1. version=2024 returns 2024 hash (not 2025)
  2. version=2025 returns 2025 hash (not 2024)
  3. 2024 and 2025 hashes differ — proves fixture corpus is not copy-pasted
  4. version=2024 returns verbatim text containing 2024-specific rates
  5. version=2025 returns verbatim text containing 2025-specific rates
  6. No silent fallback: unsupported version → clear error, not closest match
  7. Both tools (fetch_riksavtalen + lookup_tariff_supplement) honour version-routing

All tests run with LOVSEN_MCP_FIXTURE=1 (zero network).
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


# ── Hash isolation: 2024 ≠ 2025 ──────────────────────────────────────────────


def test_kveldstillegg_hashes_differ_between_versions():
    """
    CRITICAL: asking 2024 returns 2024 hash; asking 2025 returns 2025 hash.
    Hashes must differ — proves version-routing works end-to-end.
    """
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result_2024 = lookup_tariff_supplement(category="kveldstillegg", version="2024")
    result_2025 = lookup_tariff_supplement(category="kveldstillegg", version="2025")

    hash_2024 = result_2024["hash"]
    hash_2025 = result_2025["hash"]

    # Hashes must differ — same hash means same content → copy-paste seeding bug
    assert hash_2024 != hash_2025, (
        f"VERSION ROUTING FAILURE: 2024 and 2025 kveldstillegg return the SAME hash "
        f"({hash_2024[:16]}…) — fixture corpus is copy-pasted or routing is broken"
    )

    # 2024 hash must match what 2024 call returned
    assert result_2024["law_version"] == "2024", "law_version field mismatch for 2024 call"
    assert result_2025["law_version"] == "2025", "law_version field mismatch for 2025 call"


def test_garantilonn_hashes_differ_between_versions():
    """
    CRITICAL: garantilonn hashes must differ between 2024 and 2025.
    """
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result_2024 = lookup_tariff_supplement(category="garantilonn", version="2024")
    result_2025 = lookup_tariff_supplement(category="garantilonn", version="2025")

    assert result_2024["hash"] != result_2025["hash"], (
        "VERSION ROUTING FAILURE: 2024 and 2025 garantilonn have identical hash"
    )


# ── Rate values confirm correct fixture routing ───────────────────────────────


def test_2024_kveldstillegg_returns_25_percent():
    """
    Asking for 2024 kveldstillegg must return the 25% rate (2024 agreement value).
    If 2025 fixture (27%) is returned, version-routing is broken.
    """
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="kveldstillegg", version="2024")

    assert "25 %" in result["verbatim_text"] or "25%" in result["verbatim_text"], (
        f"Expected 25% (2024 rate) in verbatim_text but got: {result['verbatim_text'][:200]}"
    )
    assert "27 %" not in result["verbatim_text"] and "27%" not in result["verbatim_text"], (
        "2025 rate (27%) leaked into 2024 response — version-routing failure"
    )


def test_2025_kveldstillegg_returns_27_percent():
    """
    Asking for 2025 kveldstillegg must return the 27% rate (2025 agreement value).
    If 2024 fixture (25%) is returned, version-routing is broken.
    """
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="kveldstillegg", version="2025")

    assert "27 %" in result["verbatim_text"] or "27%" in result["verbatim_text"], (
        f"Expected 27% (2025 rate) in verbatim_text but got: {result['verbatim_text'][:200]}"
    )


def test_2024_garantilonn_returns_38000():
    """
    Asking for 2024 garantilonn must return NOK 38 000 (2024 minimum wage).
    """
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="garantilonn", version="2024")

    assert "38 000" in result["verbatim_text"] or "38000" in result["verbatim_text"], (
        f"Expected 38 000 (2024 rate) in verbatim_text but got: {result['verbatim_text'][:200]}"
    )
    # Must NOT return 2025 rate
    assert "40 500" not in result["verbatim_text"], (
        "2025 rate (40 500) leaked into 2024 garantilonn response"
    )


def test_2025_garantilonn_returns_40500():
    """
    Asking for 2025 garantilonn must return NOK 40 500 (2025 minimum wage).
    """
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    result = lookup_tariff_supplement(category="garantilonn", version="2025")

    assert "40 500" in result["verbatim_text"] or "40500" in result["verbatim_text"], (
        f"Expected 40 500 (2025 rate) in verbatim_text but got: {result['verbatim_text'][:200]}"
    )


# ── No silent fallback ────────────────────────────────────────────────────────


def test_no_silent_fallback_on_unsupported_version_lookup():
    """
    Unsupported version raises ValueError — never silently returns closest/latest.
    """
    _reload()
    from src.tools.lookup_tariff_supplement import lookup_tariff_supplement

    with pytest.raises(ValueError, match="Unsupported"):
        lookup_tariff_supplement(category="kveldstillegg", version="2023")


def test_no_silent_fallback_on_unsupported_version_fetch():
    """
    fetch_riksavtalen with unsupported version raises ValueError — no fallback.
    """
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen

    with pytest.raises(ValueError, match="Unsupported"):
        fetch_riksavtalen(version="2026", paragraph="§6.1")


# ── fetch_riksavtalen also routes correctly ───────────────────────────────────


def test_fetch_riksavtalen_routes_2024_and_2025_correctly():
    """
    fetch_riksavtalen returns 2024 hash for 2024 and 2025 hash for 2025.
    """
    _reload()
    from src.tools.fetch_riksavtalen import fetch_riksavtalen

    result_2024 = fetch_riksavtalen(version="2024", paragraph="§6.1")
    result_2025 = fetch_riksavtalen(version="2025", paragraph="§6.1")

    assert result_2024["hash"] != result_2025["hash"], (
        "VERSION ROUTING FAILURE: fetch_riksavtalen returns same hash for 2024 and 2025"
    )
    assert result_2024["law_version"] == "2024"
    assert result_2025["law_version"] == "2025"
