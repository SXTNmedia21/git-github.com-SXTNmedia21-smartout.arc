"""
validation.py — Input validation for Lovsen MCP hash batches.

validate_hashes() is the authoritative implementation of the ADR-0342
Input contract. Both lovsen-nho-reiseliv-mcp and lovsen-lovdata-mcp
delegate to this function so the rules stay in one place.

Reference ADRs: ADR-0342 (Input contract), ADR-0347 (shared module mandate)
"""

from __future__ import annotations

import re
from typing import Any

# Regex for a valid 64-char lowercase hex SHA-256 string
_HEX64_RE = re.compile(r"^[0-9a-f]{64}$")

# Hard limit on batch size (ADR-0342 Behavior contract)
_MAX_BATCH = 100


def validate_hashes(hashes: list[Any]) -> list[str]:
    """
    Validate input hashes list per ADR-0342 Input contract.

    Args:
        hashes: Value provided by the MCP caller. Must be a list of 1–100
                64-character lowercase hex SHA-256 strings.

    Returns:
        The validated list as list[str] (same order as input).

    Raises:
        ValueError: On any of:
          - hashes is not a list
          - empty list (batch size 0)
          - batch size > 100
          - any entry is not a string
          - any entry is not exactly 64 lowercase hex characters
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
                "Each entry must match [0-9a-f]{{64}}."
            )
        validated.append(h)
    return validated
