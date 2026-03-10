"""Live snapshot tests — run manually, NOT in CI.

Usage:
    cd services/scrapling
    PYTHONPATH=. python3 -m pytest tests/test_live_snapshots.py -v -m live --tb=short
"""

import json
from pathlib import Path

import pytest

SNAPSHOT_DIR = Path(__file__).parent / "snapshots"

LIVE_URLS = [
    # Add real URLs here when running manually
    # "https://example-restaurant.no",
]


@pytest.mark.live
@pytest.mark.skipif(not LIVE_URLS, reason="No live URLs configured")
@pytest.mark.parametrize("url", LIVE_URLS)
def test_live_extract(url: str):
    from main import app
    from fastapi.testclient import TestClient

    SNAPSHOT_DIR.mkdir(exist_ok=True)

    client = TestClient(app)
    resp = client.post("/extract", json={"url": url})
    assert resp.status_code == 200

    data = resp.json()
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    snapshot_path = SNAPSHOT_DIR / f"{domain}.json"
    snapshot_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    assert data["companyName"] is not None
    assert isinstance(data["openingHours"], list)
    assert isinstance(data["socialLinks"], dict)

    print(f"\n{'='*60}")
    print(f"URL: {url}")
    print(f"Name: {data['companyName']}")
    print(f"Address: {data.get('address')}")
    print(f"Hours: {data.get('openingHours')}")
    print(f"Cuisine: {data.get('cuisine')}")
    print(f"PriceRange: {data.get('priceRange')}")
    print(f"Social: {data.get('socialLinks')}")
    print(f"{'='*60}")
