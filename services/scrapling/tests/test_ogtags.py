"""Tests for OG-tags extractor."""

import pytest

from extractors.ogtags import extract_og_tags


# ---------------------------------------------------------------------------
# Fixtures (inline — conftest.py may not exist yet)
# ---------------------------------------------------------------------------

OG_ONLY_HTML = """\
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Lille Café">
  <meta property="og:site_name" content="Lille Café">
  <meta property="og:description" content="Koselig kafé med hjemmelagde kaker.">
  <meta property="og:image" content="https://lillecafe.no/hero.jpg">
  <title>Lille Café</title>
</head>
<body><p>Velkommen!</p></body>
</html>
"""

MINIMAL_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Minimal Page</title></head>
<body><p>Hello</p></body>
</html>
"""

RESTAURANT_JSONLD_HTML = """\
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Sjøbris Restaurant">
  <meta property="og:site_name" content="Sjøbris">
  <title>Sjøbris Restaurant</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "Sjøbris Restaurant",
    "address": { "@type": "PostalAddress", "streetAddress": "Strandgata 1" }
  }
  </script>
</head>
<body><p>Velkommen til Sjøbris</p></body>
</html>
"""


@pytest.fixture
def og_only_html() -> str:
    return OG_ONLY_HTML


@pytest.fixture
def minimal_html() -> str:
    return MINIMAL_HTML


@pytest.fixture
def restaurant_jsonld_html() -> str:
    return RESTAURANT_JSONLD_HTML


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestOgTags:
    def test_extracts_og_title(self, og_only_html: str) -> None:
        result = extract_og_tags(og_only_html)
        assert result["title"] == "Lille Café"

    def test_extracts_og_site_name(self, og_only_html: str) -> None:
        result = extract_og_tags(og_only_html)
        assert result["site_name"] == "Lille Café"

    def test_extracts_og_description(self, og_only_html: str) -> None:
        result = extract_og_tags(og_only_html)
        assert result["description"] == "Koselig kafé med hjemmelagde kaker."

    def test_extracts_og_image(self, og_only_html: str) -> None:
        result = extract_og_tags(og_only_html)
        assert result["image"] == "https://lillecafe.no/hero.jpg"

    def test_returns_none_for_missing_tags(self, minimal_html: str) -> None:
        result = extract_og_tags(minimal_html)
        assert result["title"] is None
        assert result["site_name"] is None
        assert result["description"] is None
        assert result["image"] is None

    def test_handles_empty_string(self) -> None:
        result = extract_og_tags("")
        assert result["title"] is None
        assert result["site_name"] is None
        assert result["description"] is None
        assert result["image"] is None

    def test_handles_none(self) -> None:
        result = extract_og_tags(None)
        assert result["title"] is None
        assert result["site_name"] is None
        assert result["description"] is None
        assert result["image"] is None

    def test_extracts_from_page_with_jsonld(self, restaurant_jsonld_html: str) -> None:
        result = extract_og_tags(restaurant_jsonld_html)
        assert result["title"] == "Sjøbris Restaurant"
        assert result["site_name"] == "Sjøbris"
