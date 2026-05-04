"""
parsers/regulation.py — Mattilsynet HTML → Citation JSON.

Used ONLY in live mode. Fixture mode bypasses all parsers and reads
pre-seeded JSON directly.

This parser is intentionally minimal: it extracts the main page text from
Mattilsynet.no article pages using BeautifulSoup. In live mode the HTML
structure may change — the parser degrades gracefully by capturing the full
article body as verbatim text rather than crashing.

Reference: docs/decisions/0244-lovsen-mcp-boundary.md (live mode rules)
"""

from __future__ import annotations

import logging
import sys
from typing import Any

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def parse_mattilsynet_page(
    html: str,
    lov: str,
    paragraph: str,
    source_url: str,
    fetched_at: str,
) -> dict[str, Any]:
    """
    Parse a Mattilsynet.no article page into a Citation dict.

    Extracts the main article text using BeautifulSoup. Tries several
    known CSS selectors in order before falling back to body text.

    Parameters
    ----------
    html:        Raw HTML from Mattilsynet.no
    lov:         Law / regulation identifier (e.g. "alkoholloven")
    paragraph:   Paragraph slug (e.g. "guidance/alkohol-aldersgrense")
    source_url:  Original URL fetched
    fetched_at:  ISO-8601 UTC timestamp of the fetch

    Returns
    -------
    dict matching ADR-0242 Citation shape (NOT validated yet — caller validates)
    """
    soup = BeautifulSoup(html, "html.parser")

    # Try main article content selectors in priority order
    text = ""
    selectors = [
        "article.article-body",
        "div.article-body",
        "main article",
        "main",
        "div#main-content",
        "div.page-content",
    ]
    for selector in selectors:
        node = soup.select_one(selector)
        if node:
            text = node.get_text(separator="\n", strip=True)
            logger.debug(f"parse_mattilsynet_page: matched selector {selector!r} ({len(text)} chars)")
            break

    if not text:
        # Last resort — entire body
        body = soup.find("body")
        text = body.get_text(separator="\n", strip=True) if body else ""
        logger.warning(f"parse_mattilsynet_page: no article selector matched — using body text ({len(text)} chars)")

    if not text:
        raise ValueError(
            f"parse_mattilsynet_page: could not extract any text from {source_url!r}. "
            "HTML may be empty or Mattilsynet.no structure changed."
        )

    from ..citation import compute_hash

    verbatim_text = text.strip()
    return {
        "lov": lov,
        "paragraph": paragraph,
        "ledd": None,
        "bokstav": None,
        "verbatim_text": verbatim_text,
        "hash": compute_hash(verbatim_text),
        "fetched_at": fetched_at,
        "source_url": source_url,
        "law_version": None,
    }
