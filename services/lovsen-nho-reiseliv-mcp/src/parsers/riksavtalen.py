"""
riksavtalen.py — Parse Riksavtalen HTML pages → Citation JSON.

In live mode: fetches nhoreiseliv.no and extracts paragraph text.
In fixture mode: never called (caller returns fixture directly).

Reference: ADR-0242 (Citation Contract), ADR-0244 (MCP Boundary).
"""

from __future__ import annotations

import re
from typing import Optional

# Paragraph anchor patterns used on nhoreiseliv.no (approximate — live fetch not verified)
PARAGRAPH_ANCHOR_RE = re.compile(r"§\s*(\d+[\w.]*)")


def extract_paragraph_text(html: str, paragraph: str) -> Optional[str]:
    """Best-effort extraction of a paragraph from raw Riksavtalen HTML.

    This is a thin parser for live mode (Phase 7). For now it simply
    grabs all visible text between the requested paragraph heading and
    the next §-heading — returns None if not found.
    """
    # Normalise the paragraph reference for matching
    needle = paragraph.replace(" ", "").upper()

    # Strip HTML tags for plain-text extraction (minimal, not production-grade)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()

    # Locate the paragraph heading in the plain text
    pattern = re.compile(
        r"(§\s*" + re.escape(needle.lstrip("§")) + r"[\s\S]*?)(?=§\s*\d|\Z)",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if match:
        snippet = match.group(1).strip()
        # Cap at 2000 chars to avoid bloating the Citation
        return snippet[:2000]
    return None
