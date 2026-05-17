---
title: lovsen-shared — Shared MCP helpers
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: lovsen
tags: [mcp, lovsen, shared, validation, telemetry]
---

# lovsen-shared

Shared Python module for Smartout's Lovsen MCP services.

## Purpose

Provides the verify-citation infrastructure that is common to both MCPs
so the rules live in one place and both consumers stay in sync.

## Consumers

- `services/lovsen-nho-reiseliv-mcp` — NHO Reiseliv (Riksavtalen)
- `services/lovsen-lovdata-mcp` — Lovdata (regulatory/statutory sources)

## ADR References

| ADR      | Topic                                                            |
| -------- | ---------------------------------------------------------------- |
| ADR-0258 | LOVSEN_FIXTURE_MODE canonical envvar                             |
| ADR-0342 | verify_citation_freshness method + behavior + telemetry contract |
| ADR-0347 | Shared helper mandate (Code-tracer recommendation)               |
| ADR-0348 | Two-hash model — drift_axis + legacy_single_hash extensions      |

## Modules

### `src/types.py` — `FreshnessResult`

TypedDict mirroring the ADR-0342 Method contract. Includes ADR-0348
optional fields (`drift_axis`, `legacy_single_hash`) and the ADR-0347
`source` discriminator.

### `src/validation.py` — `validate_hashes`

Authoritative implementation of the ADR-0342 Input contract. Raises
`ValueError` on batch size 0, batch size >100, non-string entries, and
entries that do not match `[0-9a-f]{64}`.

### `src/telemetry.py` — `emit_stale_event_stderr`

Writes a `lovsen.citation.stale` JSON line to stderr. Shape matches
ADR-0256 registered event (registry.ts). T5 (TypeScript test runner)
picks up these lines and re-emits via `@smartout/telemetry`.

## Usage — lovsen-nho-reiseliv-mcp

```python
from lovsen_shared.types import FreshnessResult
from lovsen_shared.validation import validate_hashes
from lovsen_shared.telemetry import emit_stale_event_stderr

_SOURCE: Literal["nho-reiseliv"] = "nho-reiseliv"

def verify_citation_freshness(hashes: list[str]) -> list[dict]:
    validated = validate_hashes(hashes)
    results = []
    for h in validated:
        emit_stale_event_stderr(h, "unknown")
        results.append(FreshnessResult(
            hash=h,
            stale=True,
            paragraph_ref="unknown",
            checked_at=datetime.now(timezone.utc).isoformat(),
            source=_SOURCE,
        ))
    return results
```

## Usage — lovsen-lovdata-mcp (future, B4/B5)

```python
from lovsen_shared.types import FreshnessResult
from lovsen_shared.validation import validate_hashes
from lovsen_shared.telemetry import emit_stale_event_stderr

_SOURCE: Literal["lovdata"] = "lovdata"
```

Same pattern as above with `source="lovdata"`.

## Import path

The package uses a `src/` layout. When running directly from the repo
(no pip install), Python must be launched from `services/lovsen-shared/`
or the parent directory must be on `sys.path`:

```bash
# From services/lovsen-shared/:
python3 -c "from src.validation import validate_hashes; print(validate_hashes(['a'*64]))"

# After pip install -e services/lovsen-shared/:
python3 -c "from lovsen_shared.validation import validate_hashes; ..."
```

The nho-reiseliv-mcp imports via `sys.path` insertion (see
`verify_citation_freshness.py` header comment) so no pip install is
required in the test environment.
