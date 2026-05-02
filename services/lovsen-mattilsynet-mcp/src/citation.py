"""
citation.py — Pydantic mirror of ADR-0242 Citation Contract.

Mirrors packages/lovsen-contract/src/citation.ts so tests can validate
MCP output without a Node.js runtime. Keep field names and validation
rules in sync with the Zod schema.

Copied verbatim from services/lovsen-lovdata-mcp/src/citation.py on campaign/lovsen
(identical contract — ADR-0242 is shared across all Lovsen MCP servers).
"""

import hashlib
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


class Citation(BaseModel):
    """ADR-0242 Citation — verbatim paragraph + SHA-256 + ISO-8601 timestamp + source URL."""

    lov: str
    paragraph: str
    ledd: Optional[str] = None
    bokstav: Optional[str] = None
    verbatim_text: str
    hash: str  # 64-char lowercase hex SHA-256 of verbatim_text.encode('utf-8')
    fetched_at: str  # ISO-8601 datetime (UTC)
    source_url: str
    law_version: Optional[str] = None

    @field_validator("lov")
    @classmethod
    def lov_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("lov must not be empty")
        return v

    @field_validator("paragraph")
    @classmethod
    def paragraph_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("paragraph must not be empty")
        return v

    @field_validator("verbatim_text")
    @classmethod
    def verbatim_text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("verbatim_text must not be empty")
        return v

    @field_validator("hash")
    @classmethod
    def hash_is_sha256_hex(cls, v: str) -> str:
        if not re.fullmatch(r"[0-9a-f]{64}", v):
            raise ValueError("hash must be a 64-character lowercase hex SHA-256 string")
        return v

    @field_validator("fetched_at")
    @classmethod
    def fetched_at_is_iso8601(cls, v: str) -> str:
        # Accept UTC ISO-8601 with trailing Z or +00:00
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(f"fetched_at must be ISO-8601 datetime, got: {v!r}")
        return v

    @field_validator("source_url")
    @classmethod
    def source_url_is_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError(f"source_url must be an HTTP/HTTPS URL, got: {v!r}")
        return v

    @model_validator(mode="after")
    def hash_matches_verbatim_text(self) -> "Citation":
        """Verify the stored hash matches the verbatim_text — catches fixture corruption."""
        expected = hashlib.sha256(self.verbatim_text.encode("utf-8")).hexdigest()
        if self.hash != expected:
            raise ValueError(
                f"fixture corruption detected: hash mismatch. "
                f"expected={expected[:16]}… got={self.hash[:16]}…"
            )
        return self


def compute_hash(text: str) -> str:
    """Return SHA-256 hex digest of text encoded as UTF-8."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def now_utc_iso() -> str:
    """Return current UTC time as ISO-8601 string with Z suffix."""
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
