"""
citation.py — Python mirror of ADR-0242 Citation schema.

Every Lovsen answer must cite verbatim paragraph text with a SHA-256 hash,
fetch timestamp, and source URL for legal-grade provenance.

Reference: packages/lovsen-contract/src/citation.ts (TypeScript canonical).
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


class Citation(BaseModel):
    """ADR-0242 Citation — verbatim paragraph + hash + fetched_at on every answer."""

    # Law abbreviation, e.g. "riksavtalen", "aml", "ferielov"
    lov: str
    # Human-readable reference, e.g. "§6.1", "riksavtalen_2024/kveldstillegg"
    paragraph: str
    # Sub-paragraph identifiers (optional)
    ledd: Optional[str] = None
    bokstav: Optional[str] = None
    # Exact text fetched from source — NEVER summarised or paraphrased
    verbatim_text: str
    # SHA-256 of verbatim_text as 64-char lowercase hex — enables staleness detection
    hash: str
    # ISO-8601 UTC timestamp when the MCP server fetched this text
    fetched_at: str
    # Canonical URL for human verification
    source_url: str
    # Law version or agreement year, e.g. "2024", "2025"
    law_version: Optional[str] = None

    @field_validator("hash")
    @classmethod
    def hash_must_be_sha256_hex(cls, v: str) -> str:
        if not (len(v) == 64 and all(c in "0123456789abcdef" for c in v)):
            raise ValueError("hash must be a 64-character lowercase hex SHA-256 string")
        return v

    @field_validator("fetched_at")
    @classmethod
    def fetched_at_must_be_iso8601(cls, v: str) -> str:
        # Must be parseable ISO-8601; pydantic does not auto-parse strings
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"fetched_at must be ISO-8601 datetime: {exc}") from exc
        return v

    @model_validator(mode="after")
    def hash_matches_verbatim(self) -> "Citation":
        """Verify stored hash equals SHA-256 of verbatim_text — detects fixture corruption."""
        expected = hashlib.sha256(self.verbatim_text.encode("utf-8")).hexdigest()
        if self.hash != expected:
            raise ValueError(
                f"hash mismatch: expected {expected[:12]}…, got {self.hash[:12]}…"
            )
        return self


def compute_hash(text: str) -> str:
    """SHA-256 of verbatim_text as lowercase hex, as required by ADR-0242."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def now_utc_iso() -> str:
    """Current UTC time as ISO-8601 string with +00:00 offset."""
    return datetime.now(timezone.utc).isoformat()


# Backwards-compat alias
now_iso = now_utc_iso


def make_citation(
    *,
    lov: str,
    paragraph: str,
    verbatim_text: str,
    source_url: str,
    fetched_at: Optional[str] = None,
    ledd: Optional[str] = None,
    bokstav: Optional[str] = None,
    law_version: Optional[str] = None,
) -> Citation:
    """Build a valid Citation, computing hash automatically."""
    return Citation(
        lov=lov,
        paragraph=paragraph,
        ledd=ledd,
        bokstav=bokstav,
        verbatim_text=verbatim_text,
        hash=compute_hash(verbatim_text),
        fetched_at=fetched_at or now_utc_iso(),
        source_url=source_url,
        law_version=law_version,
    )
