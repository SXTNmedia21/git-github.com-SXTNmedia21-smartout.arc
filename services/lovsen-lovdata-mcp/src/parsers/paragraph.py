"""
parsers/paragraph.py — Lovdata HTML → Citation JSON.

Parses Lovdata.no paragraph pages to extract verbatim text, metadata,
and constructs an ADR-0242 Citation dict ready for serialization.
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def _now_utc_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def parse_paragraph_html(
    html: str,
    lov: str,
    paragraph: str,
    ledd: str | None = None,
    source_url: str = "",
    law_version: str | None = None,
) -> dict[str, Any]:
    """
    Parse Lovdata HTML for a specific paragraph and return an ADR-0242 Citation dict.

    Parameters
    ----------
    html:         Raw HTML from Lovdata
    lov:          Law abbreviation, e.g. "aml"
    paragraph:    Paragraph reference, e.g. "14-6"
    ledd:         Optional ledd (sub-section) to filter text
    source_url:   Canonical Lovdata URL for human verification
    law_version:  Optional law version string

    Returns
    -------
    dict conforming to ADR-0242 Citation shape
    """
    soup = BeautifulSoup(html, "html.parser")

    # Lovdata marks paragraphs with class "paragraf" or via id anchors like "§14-6"
    verbatim = _extract_paragraph_text(soup, paragraph, ledd)

    if not verbatim:
        raise ValueError(
            f"Paragraph §{paragraph} not found in Lovdata HTML for law '{lov}'"
        )

    return {
        "lov": lov,
        "paragraph": f"§{paragraph}",
        "ledd": ledd,
        "verbatim_text": verbatim,
        "hash": _sha256(verbatim),
        "fetched_at": _now_utc_iso(),
        "source_url": source_url or f"https://lovdata.no/dokument/NL/{lov}/§{paragraph}",
        "law_version": law_version,
    }


def parse_search_results_html(
    html: str,
    lov: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    """
    Parse Lovdata search results HTML into a list of partial Citation dicts.
    Returns at most `limit` results. Results are stubs — verbatim_text is from
    the snippet in the result list, not the full paragraph text.
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []

    # Lovdata search result items are typically in .result-item or article elements
    items = soup.select(".result-item, article.search-result, li.hit")
    if not items:
        # Fallback: any h2/h3 with links that look like law paragraph links
        items = soup.find_all("a", href=re.compile(r"/dokument/NL/"))

    for item in items[:limit]:
        try:
            result = _parse_search_item(item, lov)
            if result:
                results.append(result)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[paragraph] skipping malformed search result: %s", exc)

    return results


def parse_law_metadata(html: str, lov: str) -> dict[str, Any]:
    """
    Parse Lovdata law index page for metadata.

    Returns dict with: name, version, last_updated, total_paragraphs, source_url
    """
    soup = BeautifulSoup(html, "html.parser")

    # Try to extract law name from <title> or <h1>
    name = ""
    if soup.title:
        name = soup.title.get_text(strip=True).split(" - ")[0]
    if not name:
        h1 = soup.find("h1")
        name = h1.get_text(strip=True) if h1 else lov.upper()

    # Version / last updated — often in a <time> element or metadata table
    version = None
    last_updated = None
    time_el = soup.find("time")
    if time_el:
        last_updated = time_el.get("datetime") or time_el.get_text(strip=True)

    # Count paragraph anchors (§ links)
    para_anchors = soup.find_all("a", href=re.compile(r"#§"))
    total_paragraphs = len(para_anchors)

    return {
        "name": name,
        "version": version,
        "last_updated": last_updated,
        "total_paragraphs": total_paragraphs,
        "source_url": f"https://lovdata.no/dokument/NL/{_lov_path(lov)}/",
    }


# ── Internal helpers ──────────────────────────────────────────────────────────


_LOV_PATHS: dict[str, str] = {
    "aml": "lov/2005-06-17-62",
    "ferielov": "lov/1988-04-29-21",
    "otp-loven": "lov/2005-12-21-124",
    "ftrl": "lov/1997-02-28-19",
}


def _lov_path(lov: str) -> str:
    return _LOV_PATHS.get(lov.lower(), lov.lower())


def _extract_paragraph_text(
    soup: BeautifulSoup, paragraph: str, ledd: str | None
) -> str | None:
    """
    Try multiple Lovdata HTML structures to extract paragraph text.

    Lovdata uses several HTML layouts depending on law type:
    - Modern: <section id="§14-6"> or <div id="para-14-6">
    - Legacy: anchor tags within <div class="paragraf">

    Returns stripped verbatim text or None if not found.
    """
    para_ref = f"§{paragraph}"

    # Strategy 1: section/div with id matching §14-6 or para-14-6
    for selector in [
        f'[id="{para_ref}"]',
        f'[id="para-{paragraph}"]',
        f'[id="paragraf-{paragraph}"]',
    ]:
        el = soup.select_one(selector)
        if el:
            return _clean_text(el.get_text(separator=" "))

    # Strategy 2: anchor tag with name="§14-6", then take sibling content
    anchor = soup.find("a", attrs={"name": para_ref})
    if anchor:
        container = anchor.find_parent(["section", "div", "article"])
        if container:
            return _clean_text(container.get_text(separator=" "))

    # Strategy 3: search for text containing §{paragraph} heading
    for tag in soup.find_all(["h2", "h3", "h4"]):
        if para_ref in tag.get_text():
            # Take the next sibling element as the paragraph body
            sibling = tag.find_next_sibling(["div", "p", "ul", "ol"])
            if sibling:
                return _clean_text(tag.get_text(separator=" ") + " " + sibling.get_text(separator=" "))
            return _clean_text(tag.get_text(separator=" "))

    return None


def _parse_search_item(item: Any, lov: str | None) -> dict[str, Any] | None:
    """Parse a single search result element into a partial Citation dict."""
    # Extract href and title
    link = item if item.name == "a" else item.find("a", href=True)
    if not link:
        return None

    href = link.get("href", "")
    if not href:
        return None

    # Extract paragraph ref from href, e.g. /dokument/NL/lov/2005-06-17-62/§14-6
    para_match = re.search(r"§(\d[\d\-]+)", href)
    paragraph = para_match.group(1) if para_match else "unknown"

    # Derive lov from href path if not provided
    detected_lov = lov
    if not detected_lov:
        for abbr, path in _LOV_PATHS.items():
            if path in href:
                detected_lov = abbr
                break
        if not detected_lov:
            detected_lov = "unknown"

    # Extract snippet text
    snippet = item.get_text(separator=" ", strip=True)[:500]
    if not snippet:
        return None

    full_url = href if href.startswith("http") else f"https://lovdata.no{href}"

    return {
        "lov": detected_lov,
        "paragraph": f"§{paragraph}",
        "verbatim_text": snippet,
        "hash": _sha256(snippet),
        "fetched_at": _now_utc_iso(),
        "source_url": full_url,
    }


def _clean_text(text: str) -> str:
    """Normalize whitespace in extracted paragraph text."""
    # Collapse multiple whitespace/newlines into single spaces
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned
