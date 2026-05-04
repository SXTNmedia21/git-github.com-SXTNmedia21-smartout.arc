"""
test_fetch_workplace_assessment_template.py — Tests for fetch_workplace_assessment_template tool.

All tests run in LOVSEN_MCP_FIXTURE=1 mode — no outbound HTTP.
Network blocking enforced by RuntimeError guard in arbeidstilsynet_client.fetch_url().
"""

from __future__ import annotations

import os
import sys
from datetime import datetime

import pytest

os.environ["LOVSEN_MCP_FIXTURE"] = "1"


def _reload():
    mods = [k for k in sys.modules if "lovsen" in k or "arbeidstilsynet" in k]
    for m in mods:
        del sys.modules[m]


@pytest.fixture(autouse=True)
def fixture_mode_env(monkeypatch):
    monkeypatch.setenv("LOVSEN_MCP_FIXTURE", "1")


# ── Happy path ────────────────────────────────────────────────────────────────


def test_fetch_template_risikovurdering_kjokken_happy_path():
    """fetch_workplace_assessment_template returns valid Citation for known template_id."""
    _reload()
    from src.tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template

    result = fetch_workplace_assessment_template(template_id="risikovurdering-kjokken")

    assert result["lov"] == "arbeidstilsynet-risikovurdering"
    assert result["paragraph"] == "template/risikovurdering-kjokken"
    assert isinstance(result["verbatim_text"], str)
    assert len(result["verbatim_text"]) > 50
    assert len(result["hash"]) == 64
    assert result["hash"].islower()
    assert result["source_url"].startswith("https://")
    # fetched_at must be ISO-8601 parseable
    datetime.fromisoformat(result["fetched_at"].replace("Z", "+00:00"))


def test_fetch_template_hash_matches_verbatim():
    """Hash in returned Citation equals sha256(verbatim_text)."""
    import hashlib

    _reload()
    from src.tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template

    result = fetch_workplace_assessment_template(template_id="risikovurdering-kjokken")
    expected = hashlib.sha256(result["verbatim_text"].encode("utf-8")).hexdigest()
    assert result["hash"] == expected


def test_fetch_template_paragraph_prefix():
    """paragraph field is 'template/{template_id}' per ADR-0242 contract."""
    _reload()
    from src.tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template

    result = fetch_workplace_assessment_template(template_id="risikovurdering-kjokken")
    assert result["paragraph"].startswith("template/")


# ── Error paths ───────────────────────────────────────────────────────────────


def test_fetch_template_unknown_id_raises_value_error():
    """Unknown template_id raises ValueError with 'template-not-found' in message."""
    _reload()
    from src.tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template

    with pytest.raises(ValueError, match="template-not-found"):
        fetch_workplace_assessment_template(template_id="nonexistent-template")


def test_fetch_template_unknown_id_lists_available():
    """Error message for unknown template_id includes list of available templates."""
    _reload()
    from src.tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template

    with pytest.raises(ValueError) as exc_info:
        fetch_workplace_assessment_template(template_id="xyz-does-not-exist")

    assert "risikovurdering-kjokken" in str(exc_info.value)


# ── Network guard ─────────────────────────────────────────────────────────────


def test_network_not_called_for_known_template():
    """In fixture mode, fetch_url is never reached for a known template_id."""
    _reload()
    from src.tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template
    from src import arbeidstilsynet_client

    called = []
    original_fetch = arbeidstilsynet_client.fetch_url

    def spy_fetch(url, **kwargs):
        called.append(url)
        return original_fetch(url, **kwargs)

    arbeidstilsynet_client.fetch_url = spy_fetch

    fetch_workplace_assessment_template(template_id="risikovurdering-kjokken")

    # fetch_url should never have been called (fixture intercepts first)
    assert called == [], f"fetch_url was called unexpectedly: {called}"
