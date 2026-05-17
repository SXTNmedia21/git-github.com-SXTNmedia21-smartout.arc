"""
types.py — Shared TypedDicts for Lovsen MCP services.

FreshnessResult mirrors the ADR-0342 Method contract (Python side).
ADR-0348 adds drift_axis + legacy_single_hash optional fields.
ADR-0347 mandates `source` so the TypeScript test runner (T5) can route
telemetry events to the correct registry entry without MCP-level coupling.

Reference ADRs: ADR-0342, ADR-0347, ADR-0348
"""

from __future__ import annotations

from typing import Literal, Optional, TypedDict


class FreshnessResult(TypedDict, total=False):
    """
    Python mirror of the ADR-0342 FreshnessResult shape.

    REQUIRED fields (always present):
      hash          — 64-char lowercase hex SHA-256 of the cited text
      stale         — True if cited text differs from current
      paragraph_ref — mirrors original citation's paragrafRef for audit
      checked_at    — ISO-8601 timestamp of the freshness check
      source        — MCP identity; 'nho-reiseliv' or 'lovdata' (ADR-0347)

    OPTIONAL fields (present when stale=True):
      current_hash          — SHA-256 of the text currently in force
      current_verbatim_text — verbatim text currently in force

    OPTIONAL fields added by ADR-0348 (two-hash model):
      drift_axis       — which axis changed: 'structure', 'rate', or 'both'
      legacy_single_hash — True if the hash was produced by the pre-ADR-0348
                           single-hash scheme (needed during transition period)
    """

    # --- REQUIRED ---
    hash: str
    stale: bool
    paragraph_ref: str
    checked_at: str
    source: Literal["nho-reiseliv", "lovdata"]

    # --- OPTIONAL: present when stale=True ---
    current_hash: Optional[str]
    current_verbatim_text: Optional[str]

    # --- OPTIONAL: ADR-0348 two-hash model extensions ---
    drift_axis: Optional[Literal["structure", "rate", "both"]]
    legacy_single_hash: Optional[bool]
