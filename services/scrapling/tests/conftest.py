import sys
from pathlib import Path

# Add extractors/ directly to path so validation.py can be imported
# without triggering extractors/__init__.py (which imports pymupdf etc.)
_extractors_dir = str(Path(__file__).parent.parent / "extractors")
if _extractors_dir not in sys.path:
    sys.path.insert(0, _extractors_dir)

# Add scrapling root to path so intelligence.py can be imported directly
_scrapling_root = str(Path(__file__).parent.parent)
if _scrapling_root not in sys.path:
    sys.path.insert(0, _scrapling_root)

import pytest


@pytest.fixture
def restaurant_jsonld_html() -> str:
    return """
    <html>
    <head><title>Test Restaurant</title></head>
    <body>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": "Havfruen Fiskerestaurant",
        "description": "Trondheims beste sjømatrestaurant siden 1952",
        "telephone": "+47 73 87 40 70",
        "email": "post@havfruen.no",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Kjøpmannsgata 7",
            "postalCode": "7013",
            "addressLocality": "Trondheim",
            "addressCountry": "NO"
        },
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "opens": "11:00",
                "closes": "22:00"
            },
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": "Saturday",
                "opens": "12:00",
                "closes": "23:00"
            },
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": "Sunday",
                "opens": "13:00",
                "closes": "20:00"
            }
        ],
        "servesCuisine": "Seafood",
        "priceRange": "$$$",
        "logo": "https://havfruen.no/logo.png",
        "image": "https://havfruen.no/hero.jpg",
        "sameAs": [
            "https://www.facebook.com/havfruen",
            "https://www.instagram.com/havfruen"
        ]
    }
    </script>
    </body>
    </html>
    """


@pytest.fixture
def yoast_graph_html() -> str:
    return """
    <html>
    <head><title>Yoast Site</title></head>
    <body>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "name": "My WordPress Site",
                "url": "https://example.com"
            },
            {
                "@type": "Organization",
                "name": "Example Corp",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://example.com/org-logo.png",
                    "width": 200,
                    "height": 60
                },
                "sameAs": [
                    "https://www.facebook.com/examplecorp",
                    "https://www.linkedin.com/company/examplecorp"
                ]
            },
            {
                "@type": "LocalBusiness",
                "name": "Example Bistro",
                "telephone": "+47 22 33 44 55",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Karl Johans gate 1",
                    "postalCode": "0154",
                    "addressLocality": "Oslo",
                    "addressCountry": "NO"
                },
                "openingHoursSpecification": [
                    {
                        "@type": "OpeningHoursSpecification",
                        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                        "opens": "10:00",
                        "closes": "18:00"
                    }
                ]
            }
        ]
    }
    </script>
    </body>
    </html>
    """


@pytest.fixture
def multiple_blocks_html() -> str:
    return """
    <html>
    <head><title>Multi Block</title></head>
    <body>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Hotel",
        "name": "Grand Hotel",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Storgata 10",
            "postalCode": "0155",
            "addressLocality": "Oslo",
            "addressCountry": "NO"
        },
        "telephone": "+47 23 21 20 00"
    }
    </script>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": "Grand Café",
        "servesCuisine": ["Norwegian", "French"],
        "priceRange": "$$$$",
        "openingHours": ["Mo-Fr 07:00-22:00", "Sa 09:00-23:00", "Su 10:00-20:00"]
    }
    </script>
    </body>
    </html>
    """


@pytest.fixture
def og_only_html() -> str:
    return """
    <html>
    <head>
        <title>OG Only Page</title>
        <meta property="og:title" content="OG Title" />
        <meta property="og:site_name" content="OG Site" />
        <meta property="og:description" content="OG Description" />
        <meta property="og:image" content="https://example.com/og-image.jpg" />
    </head>
    <body><p>No JSON-LD here</p></body>
    </html>
    """


@pytest.fixture
def malformed_jsonld_html() -> str:
    return """
    <html>
    <head><title>Malformed</title></head>
    <body>
    <script type="application/ld+json">
    { this is not valid JSON at all!!!
    </script>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "name": "Recovered Restaurant"
    }
    </script>
    </body>
    </html>
    """


@pytest.fixture
def minimal_html() -> str:
    return """
    <html>
    <head><title>Minimal Page</title></head>
    <body><p>Just a paragraph.</p></body>
    </html>
    """


@pytest.fixture
def nested_logo_jsonld_html() -> str:
    return """
    <html>
    <head><title>Nested Logo</title></head>
    <body>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Logo Corp",
        "logo": {
            "@type": "ImageObject",
            "url": "https://logocorp.com/brand-logo.png",
            "width": 300,
            "height": 100
        }
    }
    </script>
    </body>
    </html>
    """


@pytest.fixture
def opening_hours_string_html() -> str:
    return """
    <html>
    <head><title>String Hours</title></head>
    <body>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "FoodEstablishment",
        "name": "Quick Bites",
        "openingHours": ["Mo-Fr 08:00-16:00", "Sa 10:00-14:00"]
    }
    </script>
    </body>
    </html>
    """
