"""Extract Open Graph meta tags from HTML."""

import re
from typing import Optional

# Matches <meta property="og:X" content="Y"> in both attribute orders.
_OG_PATTERN = re.compile(
    r"<meta\s+"
    r"(?:"
    r'property="og:(?P<prop1>[^"]+)"\s+content="(?P<val1>[^"]*)"'
    r"|"
    r'content="(?P<val2>[^"]*)"\s+property="og:(?P<prop2>[^"]+)"'
    r")"
    r"\s*/?>",
    re.IGNORECASE,
)

_OG_KEYS = ("title", "site_name", "description", "image")


def extract_og_tags(html: Optional[str]) -> dict:
    """Extract og:title, og:site_name, og:description, og:image from HTML.

    Returns dict with keys: title, site_name, description, image.
    All values are Optional[str].
    """
    result: dict[str, Optional[str]] = {k: None for k in _OG_KEYS}

    if not html:
        return result

    for match in _OG_PATTERN.finditer(html):
        prop = match.group("prop1") or match.group("prop2")
        val = match.group("val1") if match.group("prop1") else match.group("val2")
        if prop in _OG_KEYS:
            result[prop] = val

    return result
