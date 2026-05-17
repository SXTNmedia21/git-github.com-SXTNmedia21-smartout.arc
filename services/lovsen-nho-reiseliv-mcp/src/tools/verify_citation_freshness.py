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
  When stale: true, emits JSON line to stderr via lovsen_shared.telemetry.
  Shape: {"event": "lovsen.citation.stale", "payload": {"hash": "...", "paragraph_ref": "..."}}
  This matches the ADR-0256 registered event shape (telemetry/src/registry.ts lines 7275, 12366).
  Python MCP has no @smartout/telemetry SDK; the TypeScript test runner (T5) picks up these
  stderr lines and re-emits through @smartout/telemetry. See ADR-0342 §"Telemetry hand-off".

Shared module (ADR-0347):
  _validate_hashes, _emit_stale_event, and FreshnessResult are extracted to
  services/lovsen-shared/ (lovsen_shared package). This file delegates to:
    lovsen_shared.types.FreshnessResult
    lovsen_shared.validation.validate_hashes
    lovsen_shared.telemetry.emit_stale_event_stderr
  lovsen-lovdata-mcp will import the same shared module (B4/B5).

stdio transport: stdout is reserved for MCP JSON-RPC. ALL logs to stderr.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Shared module path — services/lovsen-shared/ is a sibling service directory.
# It contains the lovsen_shared/ Python package. We insert it into sys.path so
# imports work without pip install. No src.* name collision with this MCP's own
# src package (lovsen_shared.* is a distinct top-level namespace).
#
# Path: services/lovsen-nho-reiseliv-mcp/src/tools/verify_citation_freshness.py
#   parents[0] = .../src/tools
#   parents[1] = .../src
#   parents[2] = .../lovsen-nho-reiseliv-mcp
#   parents[3] = .../services  ← parent of lovsen-shared/
# ---------------------------------------------------------------------------
_SHARED_ROOT = str(Path(__file__).resolve().parents[3] / "lovsen-shared")
if _SHARED_ROOT not in sys.path:
    sys.path.insert(0, _SHARED_ROOT)

from lovsen_shared.types import FreshnessResult  # noqa: E402 — after sys.path patch
from lovsen_shared.validation import validate_hashes as _validate_hashes  # noqa: E402
from lovsen_shared.telemetry import emit_stale_event_stderr as _emit_stale_event  # noqa: E402

logger = logging.getLogger("lovsen.nho_reiseliv.verify_citation_freshness")

# ---------------------------------------------------------------------------
# Fixture-mode detection (per-MCP concern — fixture state is local)
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

# The literal source identifier for this MCP (ADR-0342 Method contract, ADR-0347)
_SOURCE = "nho-reiseliv"


def _now_iso() -> str:
    """Current UTC time as ISO-8601 string (reuses citation.py pattern)."""
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Core handler
# ---------------------------------------------------------------------------

def verify_citation_freshness(hashes: list[str]) -> list[dict[str, Any]]:
    """
    Check freshness of a batch of citation hashes against NHO Reiseliv (Riksavtalen).

    Delegates input validation to lovsen_shared.validation.validate_hashes (ADR-0347).
    Delegates telemetry emission to lovsen_shared.telemetry.emit_stale_event_stderr.

    Args:
        hashes: 1–100 SHA-256 hex strings (64 chars, lowercase).

    Returns:
        List of FreshnessResult dicts, one per input hash, in the same order.

    Raises:
        ValueError: Input validation failure (wrong length, wrong format, batch too large).
                    Raised by lovsen_shared.validation.validate_hashes.
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

        # Telemetry stub — T5 re-emits via @smartout/telemetry (ADR-0347 shared module)
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
