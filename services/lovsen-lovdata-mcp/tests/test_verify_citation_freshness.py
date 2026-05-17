"""
test_verify_citation_freshness.py — pytest coverage for verify_citation_freshness handler.

ADR-0347 T5 gate (lovdata-mcp mirror): required paths are fixture-mode contract, live-mode V1
unknown-hash behavior, legacy-envvar backwards compat, input validation, and telemetry stderr
shape. Source discriminator must be 'lovdata' throughout.

All tests are synchronous — the handler is a plain sync function.
Envvar manipulation uses monkeypatch exclusively (never os.environ directly).
"""

from __future__ import annotations

import json
import sys

import pytest


# ---------------------------------------------------------------------------
# Module reload helper — FIXTURE_MODE is read at import time, so tests that
# need a different envvar state must reload the module.
# ---------------------------------------------------------------------------

def _reload_sut():
    """Remove all cached src.* / lovsen / lovdata modules and re-import SUT.

    The SUT lives under the `src` package (no 'lovsen'/'lovdata' in the key),
    so we must also flush any `src.*` entries that survive a narrow filter.
    """
    stale = [
        k for k in sys.modules
        if "lovsen" in k or "lovdata" in k or k == "src" or k.startswith("src.")
    ]
    for mod in stale:
        del sys.modules[mod]
    from src.tools.verify_citation_freshness import verify_citation_freshness
    return verify_citation_freshness


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hex64(char: str) -> str:
    """Return a 64-char lowercase hex string by repeating a single hex char."""
    assert len(char) == 1 and char in "0123456789abcdef", f"Bad seed char: {char!r}"
    return char * 64


_HASH_A = _hex64("a")
_HASH_B = _hex64("b")
_HASH_C = _hex64("c")
_HASH_D = _hex64("d")
_HASH_E = _hex64("e")

_FIVE_HASHES = [_HASH_A, _HASH_B, _HASH_C, _HASH_D, _HASH_E]


def _is_iso8601(ts: str) -> bool:
    """Minimal ISO-8601 check: non-empty string containing T and + or Z."""
    return bool(ts) and ("T" in ts) and ("+" in ts or ts.endswith("Z"))


# ===========================================================================
# 1. Fixture-mode: all hashes return stale=False
# ===========================================================================

def test_fixture_mode_all_fresh(monkeypatch):
    """LOVSEN_FIXTURE_MODE=true → every result has stale=False, paragraph_ref='fixture-mode',
    source='lovdata', and a valid ISO-8601 checked_at."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    monkeypatch.delenv("LOVSEN_LOVDATA_FIXTURE", raising=False)
    fn = _reload_sut()

    results = fn(_FIVE_HASHES)

    assert len(results) == 5
    for r in results:
        assert r["stale"] is False
        assert r["paragraph_ref"] == "fixture-mode"
        assert r["source"] == "lovdata"
        assert _is_iso8601(r["checked_at"]), f"Bad checked_at: {r['checked_at']!r}"


# ===========================================================================
# 2. Fixture-mode: determinism across two calls with same input
# ===========================================================================

def test_fixture_mode_determinism(monkeypatch):
    """Two calls with the same hashes in fixture mode yield identical stale, paragraph_ref,
    and source. checked_at is allowed to differ (audit timestamp)."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    monkeypatch.delenv("LOVSEN_LOVDATA_FIXTURE", raising=False)
    fn = _reload_sut()

    first = fn([_HASH_A, _HASH_B])
    second = fn([_HASH_A, _HASH_B])

    assert len(first) == len(second) == 2
    for r1, r2 in zip(first, second):
        assert r1["stale"] == r2["stale"]
        assert r1["paragraph_ref"] == r2["paragraph_ref"]
        assert r1["source"] == r2["source"]


# ===========================================================================
# 3. Live mode V1: unknown hash → stale=True, no current_hash, no current_verbatim_text
# ===========================================================================

def test_unknown_hash_live_mode(monkeypatch):
    """With LOVSEN_FIXTURE_MODE unset (live V1), any hash → stale=True,
    paragraph_ref='unknown', current_hash absent, current_verbatim_text absent,
    source='lovdata'."""
    monkeypatch.delenv("LOVSEN_FIXTURE_MODE", raising=False)
    monkeypatch.delenv("LOVSEN_LOVDATA_FIXTURE", raising=False)
    fn = _reload_sut()

    results = fn([_HASH_A])

    assert len(results) == 1
    r = results[0]
    assert r["stale"] is True
    assert r["paragraph_ref"] == "unknown"
    assert r["source"] == "lovdata"
    assert "current_hash" not in r
    assert "current_verbatim_text" not in r


# ===========================================================================
# 4. Legacy envvar backwards compat
# ===========================================================================

def test_fixture_mode_legacy_envvar(monkeypatch):
    """LOVSEN_LOVDATA_FIXTURE=1 (legacy) activates fixture mode; behavior identical to canonical."""
    monkeypatch.delenv("LOVSEN_FIXTURE_MODE", raising=False)
    monkeypatch.setenv("LOVSEN_LOVDATA_FIXTURE", "1")
    fn = _reload_sut()

    results = fn([_HASH_A])

    assert len(results) == 1
    r = results[0]
    assert r["stale"] is False
    assert r["paragraph_ref"] == "fixture-mode"
    assert r["source"] == "lovdata"


# ===========================================================================
# 5–8. Input validation — combined into grouped tests for conciseness
# ===========================================================================

def test_rejects_empty_list(monkeypatch):
    """Empty list → ValueError (caller error, batch must have ≥1 entry)."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    fn = _reload_sut()
    with pytest.raises(ValueError, match="at least 1"):
        fn([])


def test_rejects_too_many(monkeypatch):
    """101 hashes → ValueError (max batch is 100 per ADR-0342)."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    fn = _reload_sut()
    # 101 distinct valid hashes: vary the leading digit (0–9 cycle) + index suffix
    too_many = [(str(i % 10) * 64) for i in range(101)]
    with pytest.raises(ValueError, match="maximum batch size"):
        fn(too_many)


def test_rejects_invalid_hex(monkeypatch):
    """64-char string with invalid hex characters → ValueError."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    fn = _reload_sut()
    bad = "z" + "0" * 63  # 'z' is not a hex char
    with pytest.raises(ValueError):
        fn([bad])


def test_rejects_wrong_length(monkeypatch):
    """63-char hex string (one too short) → ValueError."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    fn = _reload_sut()
    with pytest.raises(ValueError):
        fn(["a" * 63])


# ===========================================================================
# 9. Uppercase hex rejected (handler enforces lowercase via [0-9a-f]{64})
# ===========================================================================

def test_rejects_uppercase(monkeypatch):
    """64-char uppercase hex string → ValueError (handler requires lowercase)."""
    monkeypatch.setenv("LOVSEN_FIXTURE_MODE", "true")
    fn = _reload_sut()
    with pytest.raises(ValueError):
        fn(["A" * 64])


# ===========================================================================
# 10. Stale result emits lovsen.citation.stale to stderr
# ===========================================================================

def test_stale_emits_stderr_event(monkeypatch, capfd):
    """Live mode with unknown hash → stale=True emits lovsen.citation.stale JSON to stderr,
    with 'hash' and 'paragraph_ref' in the payload. Matches ADR-0256 telemetry hand-off shape."""
    monkeypatch.delenv("LOVSEN_FIXTURE_MODE", raising=False)
    monkeypatch.delenv("LOVSEN_LOVDATA_FIXTURE", raising=False)
    fn = _reload_sut()

    fn([_HASH_A])

    captured = capfd.readouterr()
    stderr_text = captured.err

    # Must contain the registered event name
    assert '{"event": "lovsen.citation.stale"' in stderr_text
    # Payload must include hash and paragraph_ref
    assert '"hash":' in stderr_text
    assert '"paragraph_ref":' in stderr_text

    # Validate the line is parseable JSON
    for line in stderr_text.splitlines():
        if "lovsen.citation.stale" in line:
            parsed = json.loads(line)
            assert parsed["event"] == "lovsen.citation.stale"
            assert parsed["payload"]["hash"] == _HASH_A
            assert parsed["payload"]["paragraph_ref"] == "unknown"
            break
    else:
        pytest.fail("No lovsen.citation.stale line found in stderr")
