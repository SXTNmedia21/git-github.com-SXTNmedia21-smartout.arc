"""Integration tests for /extract endpoint — full pipeline with mocked HTTP."""

import sys
from unittest.mock import patch, MagicMock
from lxml import html as lxml_html
import re

# Mock the scrapling module before main.py is imported, so the
# top-level `from scrapling import Fetcher` doesn't trigger the
# curl_cffi dependency chain (not available outside Docker).
_mock_scrapling = MagicMock()
sys.modules.setdefault("scrapling", _mock_scrapling)

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402


class _MockCssResult:
    """Mimics scrapling's CSS selector result (single item)."""

    def __init__(self, values: list[str]):
        self._values = values

    def get(self, default=""):
        return self._values[0] if self._values else default

    def getall(self):
        return self._values


class _MockElement:
    """Minimal wrapper around lxml element to expose .text and .attrib."""

    def __init__(self, el):
        self._el = el

    @property
    def text(self):
        return self._el.text

    @property
    def attrib(self):
        return dict(self._el.attrib)


class _MockPage:
    """Mimics a scrapling Fetcher response with .css() and .body."""

    def __init__(self, html_str: str):
        self._html = html_str
        self._doc = lxml_html.fromstring(html_str)
        # main.py does str(page.body) — scrapling's real Fetcher stores
        # body as bytes, but str(bytes) produces "b'...'" which breaks
        # regex. Keep body as str so str(page.body) == the HTML string.
        self.body = html_str

    def css(self, selector: str):
        # Handle pseudo-selectors that scrapling supports
        # "tag::text" → get .text_content() of matched elements
        # "tag::attr(name)" → get attribute value

        text_match = re.match(r"^(.+?)::text$", selector)
        attr_match = re.match(r"^(.+?)::attr\(([^)]+)\)$", selector)

        if text_match:
            # May be comma-separated selectors like "p::text, h1::text"
            raw_sel = text_match.group(1)
            parts = [s.strip() for s in raw_sel.split(",")]
            values = []
            for part in parts:
                # Each part may itself end with ::text — strip it
                part = re.sub(r"::text$", "", part)
                try:
                    elements = self._doc.cssselect(part)
                    for el in elements:
                        if el.text:
                            values.append(el.text)
                except Exception:
                    pass
            return _MockCssResult(values)

        if attr_match:
            css_sel = attr_match.group(1)
            attr_name = attr_match.group(2)
            try:
                elements = self._doc.cssselect(css_sel)
                values = [el.get(attr_name) for el in elements if el.get(attr_name)]
            except Exception:
                values = []
            return _MockCssResult(values)

        # Plain selector — return wrapped elements
        try:
            elements = self._doc.cssselect(selector)
            return _MockElementList(elements)
        except Exception:
            return _MockElementList([])


class _MockElementList(_MockCssResult):
    """List of elements that also supports iteration for anchor/img handling."""

    def __init__(self, elements):
        self._elements = [_MockElement(e) for e in elements]
        # For .get()/.getall() — use text content
        super().__init__([e.text or "" for e in self._elements])

    def __iter__(self):
        return iter(self._elements)

    def __len__(self):
        return len(self._elements)


def _make_mock_page(html_str: str):
    """Build a mock page object from raw HTML."""
    return _MockPage(html_str)


class TestExtractWithJsonLd:
    """Tests that JSON-LD structured data flows through the /extract endpoint."""

    def test_returns_address_from_jsonld(self, restaurant_jsonld_html):
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(restaurant_jsonld_html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://havfruen.no"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["address"] is not None
        assert data["address"]["city"] == "Trondheim"
        assert data["address"]["street"] == "Kjøpmannsgata 7"
        assert data["address"]["postalCode"] == "7013"
        assert data["address"]["country"] == "NO"

    def test_returns_opening_hours(self, restaurant_jsonld_html):
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(restaurant_jsonld_html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://havfruen.no"})

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["openingHours"]) > 0
        assert any("Mo-Fr 11:00-22:00" in h for h in data["openingHours"])

    def test_returns_cuisine(self, restaurant_jsonld_html):
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(restaurant_jsonld_html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://havfruen.no"})

        assert resp.status_code == 200
        assert resp.json()["cuisine"] == "Seafood"

    def test_returns_price_range(self, restaurant_jsonld_html):
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(restaurant_jsonld_html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://havfruen.no"})

        assert resp.status_code == 200
        assert resp.json()["priceRange"] == "$$$"

    def test_merges_sameas_into_social_links(self, restaurant_jsonld_html):
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(restaurant_jsonld_html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://havfruen.no"})

        assert resp.status_code == 200
        social = resp.json()["socialLinks"]
        assert "facebook" in social
        assert "instagram" in social
        assert "havfruen" in social["facebook"]
        assert "havfruen" in social["instagram"]

    def test_merges_tripadvisor_from_sameas(self):
        """JSON-LD sameAs with tripadvisor URL should appear in socialLinks."""
        html = """
        <html>
        <head><title>Test Place</title></head>
        <body>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": "Test Place",
            "sameAs": [
                "https://www.facebook.com/testplace",
                "https://www.instagram.com/testplace",
                "https://www.tripadvisor.com/Restaurant_Review-testplace"
            ]
        }
        </script>
        </body>
        </html>
        """
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://testplace.no"})

        assert resp.status_code == 200
        social = resp.json()["socialLinks"]
        assert "tripadvisor" in social
        assert "facebook" in social
        assert "instagram" in social


class TestExtractBackwardCompatibility:
    """Ensures existing fields still work and new fields are null-safe."""

    def test_minimal_page_null_new_fields(self, minimal_html):
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(minimal_html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://minimal.example.com"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["address"] is None
        assert data["openingHours"] == []
        assert data["cuisine"] is None
        assert data["priceRange"] is None
        # Existing fields should still be present
        assert "companyName" in data
        assert "locations" in data
        assert "departments" in data

    def test_og_enriches_name(self):
        """og:site_name should be used as companyName over <title> when no JSON-LD."""
        html = """
        <html>
        <head>
            <title>Lille Café — Kaffe og kaker</title>
            <meta property="og:title" content="Lille Café — Kaffe og kaker" />
            <meta property="og:site_name" content="Lille Café" />
            <meta property="og:description" content="Byens beste kafé" />
            <meta property="og:image" content="https://lillecafe.no/hero.jpg" />
        </head>
        <body><p>Velkommen til Lille Café</p></body>
        </html>
        """
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://lillecafe.no"})

        assert resp.status_code == 200
        data = resp.json()
        # og:site_name ("Lille Café") wins over <title> ("Lille Café — Kaffe og kaker")
        assert data["companyName"] == "Lille Café"

    def test_jsonld_name_wins_over_og(self):
        """JSON-LD name has highest priority over og:site_name and <title>."""
        html = """
        <html>
        <head>
            <title>Page Title</title>
            <meta property="og:site_name" content="OG Name" />
        </head>
        <body>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": "JSON-LD Name"
        }
        </script>
        </body>
        </html>
        """
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://example.com"})

        assert resp.status_code == 200
        assert resp.json()["companyName"] == "JSON-LD Name"

    def test_returns_logo_from_jsonld(self, restaurant_jsonld_html):
        """JSON-LD logo URL should be used for logoUrl."""
        with patch("main.fetch_with_fallback", return_value=_make_mock_page(restaurant_jsonld_html)):
            client = TestClient(app)
            resp = client.post("/extract", json={"url": "https://havfruen.no"})

        assert resp.status_code == 200
        assert resp.json()["logoUrl"] == "https://havfruen.no/logo.png"
