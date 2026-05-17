"""
telemetry.py — Stderr telemetry emitter for Lovsen MCP services.

emit_stale_event_stderr() writes a single JSON line to stderr when a
citation hash is found to be stale. The TypeScript test runner (T5) picks
up these lines and re-emits them through @smartout/telemetry.

Do NOT change the event name or payload shape without updating:
  - packages/telemetry/src/registry.ts (lines 7275, 12366 for ADR-0256 entries)
  - ADR-0256 (registered event contract)

stdio transport rule: stdout is reserved for MCP JSON-RPC. ALL logs go to stderr.

Reference ADRs: ADR-0256, ADR-0342 (§Telemetry hand-off), ADR-0347
"""

from __future__ import annotations

import json
import sys


def emit_stale_event_stderr(hash_val: str, paragraph_ref: str) -> None:
    """
    Emit a lovsen.citation.stale telemetry event to stderr.

    The JSON line shape matches the ADR-0256 registered event (registry.ts
    lines 7275, 12366). Python MCPs have no @smartout/telemetry SDK; T5
    (TypeScript test runner) picks up these stderr lines and re-emits via
    @smartout/telemetry. See ADR-0342 §"Telemetry hand-off".

    Args:
        hash_val:      The 64-char SHA-256 hash that was found stale.
        paragraph_ref: The paragraph reference from the original citation.
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
