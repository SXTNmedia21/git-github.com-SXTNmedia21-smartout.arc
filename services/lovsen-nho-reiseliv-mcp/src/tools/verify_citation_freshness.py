"""
verify_citation_freshness.py — MCP tool: batch freshness check for Lovsen citation hashes.

Tool contract (ADR-0342):
  verify_citation_freshness(hashes: list[str]) -> list[FreshnessResult]

  hashes: REQUIRED — 1–100 entries, each exactly 64 lowercase hex chars (SHA-256).
  Returns list of FreshnessResult dicts (one per input hash).

Schema-routing note (ADR-0341 §H + ADR-0342 V1 resolution):
  ExpectedCellSchema in packages/payroll-calculate/__tests__/golden-month/expected-cell.schema.ts
  is locked to 16 fields per ADR-0341 §H — it has NO `source` field. The ADR-0342 assumption
  that CI can route per source-field is therefore unworkable against the locked schema for V1.
  RESOLUTION: single-MCP routing — all golden-month cells route to NHO Reiseliv (Riksavtalen §6).
  Lovdata MCP routing is deferred to a future ADR when the first golden-month cell cites a
  non-Riksavtalen source and the schema is extended.
  Reference: ADR-0341 §H, ADR-0342 §"Schema-routing in MCP client".

FreshnessResult TypeScript shape (ADR-0342 Method contract):
  {
    hash: string;                        // 64-char lowercase hex SHA-256
    stale: boolean;                      // true if cited text differs from current
    current_hash?: string;               // present if stale=true; hash of current text
    current_verbatim_text?: string;      // present if stale=true; verbatim text now in force
    paragraph_ref: string;               // mirrors original citation's paragrafRef for audit
    checked_at: string;                  // ISO-8601 timestamp of freshness check
    source: 'nho-reiseliv';             // always this literal for this MCP instance
  }

Fixture-mode determinism (ADR-0258, ADR-0342 Behavior contract):
  LOVSEN_FIXTURE_MODE=true (canonical per ADR-0258) → ALL hashes return stale: false,
  paragraph_ref: "fixture-mode", source: "nho-reiseliv". NO network I/O, NO cache lookup.
  Note: legacy envvar LOVSEN_MCP_FIXTURE (read by nho_reiseliv_client.py) is checked as
  fallback — ADR-0258 canonicalises LOVSEN_FIXTURE_MODE; T2 updates README.

Live path (V1):
  Any hash not seen in the fixture cache → stale: true, current_hash: None,
  current_verbatim_text: None. Real diff-against-live nhoreiseliv.no is Phase 7 — out of scope.

Telemetry stub (stale events):
  When stale: true, emits JSON line to stderr:
    {"event": "lovsen.citation.stale", "payload": {"hash": "...", "paragraph_ref": "..."}}
  This matches the ADR-0256 registered event shape (telemetry/src/registry.ts lines 7275, 12366).
  Python MCP has no @smartout/telemetry SDK; the TypeScript test runner (T5) picks up these
  stderr lines and re-emits through @smartout/telemetry. See ADR-0342 §"Telemetry hand-off".

stdio transport: stdout is reserved for MCP JSON-RPC. ALL logs to stderr.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Optional, TypedDict

logger = logging.getLogger("lovsen.nho_reiseliv.verify_citation_freshness")

# ---------------------------------------------------------------------------
# Fixture-mode detection
# ADR-0258 canonical envvar: LOVSEN_FIXTURE_MODE=true
# Legacy fallback: LOVSEN_MCP_FIXTURE=1 (still read by nho_reiseliv_client.py)
# T2 task: align README to use LOVSEN_FIXTURE_MODE=true.
# ---------------------------------------------------------------------------
_FIXTURE_MODE_NEW = os.environ.get("LOVSEN_FIXTURE_MODE", "").strip().lower() in (
    "true", "1", "yes"
)
# Legacy read — do NOT remove until T2 confirms README+CI updated
_FIXTURE_MODE_LEGACY = os.environ.get("LOVSEN_MCP_FIXTURE", "").strip() in ("1", "true", "yes")
FIXTURE_MODE: bool = _FIXTURE_MODE_NEW or _FIXTURE_MODE_LEGACY

# Regex for a valid 64-char lowercase hex SHA-256 string
_HEX64_RE = re.compile(r"^[0-9a-f]{64}$")

# The literal source identifier for this MCP (ADR-0342 Method contract)
_SOURCE = "nho-reiseliv"

# Hard limit on batch size (ADR-0342 Behavior contract)
_MAX_BATCH = 100


# ---------------------------------------------------------------------------
# TypedDicts — Python mirror of ADR-0342 FreshnessResult
# ---------------------------------------------------------------------------

class FreshnessResult(TypedDict, total=False):
    hash: str                         # REQUIRED
    stale: bool                       # REQUIRED
    current_hash: Optional[str]       # present if stale=True
    current_verbatim_text: Optional[str]  # present if stale=True
    paragraph_ref: str                # REQUIRED
    checked_at: str                   # REQUIRED — ISO-8601
    source: str                       # REQUIRED — always "nho-reiseliv"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    """Current UTC time as ISO-8601 string (reuses citation.py pattern)."""
    return datetime.now(timezone.utc).isoformat()


def _validate_hashes(hashes: list[Any]) -> list[str]:
    """
    Validate input hashes list per ADR-0342 Input contract.

    Raises ValueError on:
      - empty list or >100 entries
      - any entry that is not a 64-char lowercase hex string
    """
    if not isinstance(hashes, list):
        raise ValueError(
            f"'hashes' must be a list, got {type(hashes).__name__!r}. "
            "Pass a JSON array of SHA-256 hex strings."
        )
    if len(hashes) == 0:
        raise ValueError(
            "'hashes' must contain at least 1 entry. "
            "An empty batch is a caller error."
        )
    if len(hashes) > _MAX_BATCH:
        raise ValueError(
            f"'hashes' exceeds maximum batch size of {_MAX_BATCH}. "
            f"Got {len(hashes)}. Split into smaller batches and call again."
        )
    validated: list[str] = []
    for i, h in enumerate(hashes):
        if not isinstance(h, str):
            raise ValueError(
                f"hashes[{i}]: expected string, got {type(h).__name__!r}. "
                "Each entry must be a 64-character lowercase hex SHA-256 string."
            )
        if not _HEX64_RE.match(h):
            raise ValueError(
                f"hashes[{i}]: {h!r} is not a valid 64-character lowercase hex SHA-256. "
                "Each entry must match [0-9a-f]{64}."
            )
        validated.append(h)
    return validated


def _emit_stale_event(hash_val: str, paragraph_ref: str) -> None:
    """
    Emit lovsen.citation.stale telemetry event to stderr.

    Shape matches ADR-0256 registered event (registry.ts lines 7275, 12366).
    Python MCP has no @smartout/telemetry SDK.
    T5 (TypeScript test runner) picks up these stderr lines and re-emits via @smartout/telemetry.
    Do NOT change this event shape without updating telemetry/src/registry.ts + ADR-0256.
    """
    event_line = json.dumps(
        {
            "event": "lovsen.citation.stale",
            "payload": {
                "hash": hash_val,
                "paragraph_ref": paragraph_ref,
            },
        },
        ensure_ascii=False,
    )
    print(event_line, file=sys.stderr)


# ---------------------------------------------------------------------------
# Core handler
# ---------------------------------------------------------------------------

def verify_citation_freshness(hashes: list[str]) -> list[dict[str, Any]]:
    """
    Check freshness of a batch of citation hashes against NHO Reiseliv (Riksavtalen).

    Args:
        hashes: 1–100 SHA-256 hex strings (64 chars, lowercase).

    Returns:
        List of FreshnessResult dicts, one per input hash, in the same order.

    Raises:
        ValueError: Input validation failure (wrong length, wrong format, batch too large).
    """
    validated = _validate_hashes(hashes)
    checked_at = _now_iso()

    # ------------------------------------------------------------------
    # FIXTURE MODE — deterministic early return (ADR-0258, ADR-0342)
    # No network I/O. No cache lookup. No randomness.
    # All hashes → stale: false, paragraph_ref: "fixture-mode".
    # ------------------------------------------------------------------
    if FIXTURE_MODE:
        logger.info(
            "verify_citation_freshness [fixture-mode]: returning stale=false for %d hashes",
            len(validated),
        )
        return [
            {
                "hash": h,
                "stale": False,
                "paragraph_ref": "fixture-mode",
                "checked_at": checked_at,
                "source": _SOURCE,
            }
            for h in validated
        ]

    # ------------------------------------------------------------------
    # LIVE MODE V1 — unknown-hash → stale: true
    # Real diff-against-live nhoreiseliv.no is Phase 7 (out of scope).
    # Any hash not in the local fixture cache is treated as unknown → stale.
    # ------------------------------------------------------------------
    results: list[dict[str, Any]] = []

    for h in validated:
        # V1: we have no live paragraph registry, so all hashes are unknown.
        # Unknown hash → stale: true per ADR-0342 Behavior contract.
        paragraph_ref = "unknown"  # no paragraph lookup in V1

        logger.warning(
            "verify_citation_freshness [live-v1]: hash %s... unknown → stale=true "
            "(Phase 7 live diff deferred; no MCP cache warm-up yet)",
            h[:12],
        )

        # Telemetry stub — T5 re-emits via @smartout/telemetry
        _emit_stale_event(h, paragraph_ref)

        results.append(
            {
                "hash": h,
                "stale": True,
                # current_hash and current_verbatim_text absent in V1
                # (Phase 7 will populate these from live nhoreiseliv.no fetch)
                "paragraph_ref": paragraph_ref,
                "checked_at": checked_at,
                "source": _SOURCE,
            }
        )

    return results
