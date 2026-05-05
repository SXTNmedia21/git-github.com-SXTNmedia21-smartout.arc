"""
citation.py — Python mirror of ADR-0242 Citation shape.

Every tool in this MCP server returns Citation-shaped dicts.
The Zod schema lives in packages/lovsen-contract/src/citation.ts —
this Pydantic model must stay in sync.

Fields:
  lov          — law/regulation abbreviation, e.g. "internkontrollforskriften"
  paragraph    — human-readable reference, e.g. "§5" or "template/risikovurdering-kjokken"
  ledd         — optional subsection
  bokstav      — optional letter sub-point
  verbatim_text — exact source text — never summarised
  hash         — SHA-256 of verbatim_text (64-char lowercase hex)
  fetched_at   — ISO-8601 UTC timestamp
  source_url   — canonical URL for human verification
  law_version  — optional version/date string
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


class Citation(BaseModel):
    """ADR-0242 Citation — verbatim paragraph + hash + fetched_at."""

    lov: str
    paragraph: str
    ledd: Optional[str] = None
    bokstav: Optional[str] = None
    verbatim_text: str
    hash: str
    fetched_at: str
    source_url: str
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
        # Parse to verify; allow Z-suffix or +00:00 offset
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"fetched_at must be ISO-8601 datetime: {exc}") from exc
        return v

    @model_validator(mode="after")
    def hash_matches_verbatim(self) -> "Citation":
        expected = hashlib.sha256(self.verbatim_text.encode()).hexdigest()
        if self.hash != expected:
            raise ValueError(
                f"hash mismatch: expected {expected[:12]}…, got {self.hash[:12]}…"
            )
        return self


def compute_hash(text: str) -> str:
    """Return SHA-256 hex digest of text."""
    return hashlib.sha256(text.encode()).hexdigest()


def now_utc_iso() -> str:
    """Return current UTC time as ISO-8601 string with +00:00 offset."""
    return datetime.now(tz=timezone.utc).isoformat()


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
