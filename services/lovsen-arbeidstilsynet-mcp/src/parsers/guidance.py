"""
parsers/guidance.py — HTML → Citation-ready text extraction for Arbeidstilsynet.no

Why a separate parser module: keeps HTML stripping logic isolated from tool logic.
In P1.S2+ this can be replaced with a proper BeautifulSoup/lxml parser without
touching the tool files.

This module is NOT called in fixture mode — tools resolve via fixtures.py instead.
"""

from __future__ import annotations

import re


def strip_html(html: str) -> str:
    """
    Strip all HTML tags from a page and collapse whitespace.

    Very basic — adequate for P1.S1c scope. P1.S2 upgrades to BeautifulSoup.
    """
    # Remove script/style blocks entirely (content is not useful)
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    # Remove all remaining HTML tags
    text = re.sub(r"<[^>]+>", " ", html)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_article_text(html: str, query: str, max_chars: int = 700) -> str:
    """
    Extract a relevant text excerpt from an Arbeidstilsynet article page.

    Strategy:
    1. Strip HTML
    2. Find the query term
    3. Return context window around it (or first max_chars if not found)

    Args:
        html: Raw HTML from arbeidstilsynet.no
        query: The search query — used to anchor the excerpt
        max_chars: Maximum excerpt length in characters

    Returns:
        Plain-text excerpt (non-empty, at least 50 chars) or empty string if
        the page is too short to be useful.
    """
    text = strip_html(html)

    if len(text) < 50:
        return ""

    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)

    if idx >= 0:
        # Anchor the excerpt around the query match
        start = max(0, idx - 200)
        end = min(len(text), idx + max_chars)
        excerpt = text[start:end].strip()
    else:
        excerpt = text[:max_chars].strip()

    return excerpt


def extract_template_text(html: str, max_chars: int = 2000) -> str:
    """
    Extract the main body text from an Arbeidstilsynet template page.

    Templates are longer than search results — use a wider max_chars window.

    Returns:
        Plain-text body (min 50 chars) or empty string.
    """
    text = strip_html(html)
    if len(text) < 50:
        return ""
    return text[:max_chars].strip()


def extract_search_result_links(html: str) -> list[str]:
    """
    Extract article path links from an Arbeidstilsynet search results page.

    arbeidstilsynet.no uses <a href="/tema/..."> for guidance article links.

    Returns:
        Deduplicated list of paths (e.g. ['/tema/hms/risikovurdering/']).
    """
    links = re.findall(r'href="(/tema/[^"#?]+)"', html)
    seen: set[str] = set()
    unique: list[str] = []
    for link in links:
        if link not in seen:
            seen.add(link)
            unique.append(link)
    return unique
