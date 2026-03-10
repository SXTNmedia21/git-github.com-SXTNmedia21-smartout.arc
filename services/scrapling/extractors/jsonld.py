"""JSON-LD / Schema.org extractor for structured business data."""

import json
import re
from typing import Optional

# Lower number = higher priority (wins merge conflicts)
TYPE_PRIORITY = {
    "Restaurant": 1,
    "FoodEstablishment": 2,
    "BarOrPub": 2,
    "CafeOrCoffeeShop": 2,
    "Hotel": 3,
    "LodgingBusiness": 3,
    "LocalBusiness": 4,
    "Organization": 5,
}

# Day abbreviation map for ISO opening hours
DAY_ABBREV = {
    "Monday": "Mo",
    "Tuesday": "Tu",
    "Wednesday": "We",
    "Thursday": "Th",
    "Friday": "Fr",
    "Saturday": "Sa",
    "Sunday": "Su",
}

# Ordered list for consecutive-day compression
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _empty_result() -> dict:
    return {
        "name": None,
        "description": None,
        "telephone": None,
        "email": None,
        "address": None,
        "openingHours": [],
        "cuisine": None,
        "priceRange": None,
        "logo": None,
        "image": None,
        "sameAs": [],
    }


def _parse_address(addr) -> Optional[dict]:
    """Parse a PostalAddress object or plain string into a flat dict."""
    if not addr:
        return None
    if isinstance(addr, str):
        return {"street": addr, "postalCode": None, "city": None, "country": None}
    if not isinstance(addr, dict):
        return None
    return {
        "street": addr.get("streetAddress"),
        "postalCode": addr.get("postalCode"),
        "city": addr.get("addressLocality"),
        "country": addr.get("addressCountry"),
    }


def _compress_days(day_names: list[str]) -> str:
    """Compress consecutive days: ['Monday','Tuesday',...,'Friday'] -> 'Mo-Fr'."""
    if not day_names:
        return ""
    if len(day_names) == 1:
        return DAY_ABBREV.get(day_names[0], day_names[0])

    # Sort by day order
    indices = []
    for d in day_names:
        if d in DAY_ORDER:
            indices.append(DAY_ORDER.index(d))
    indices.sort()

    if not indices:
        return ", ".join(DAY_ABBREV.get(d, d) for d in day_names)

    # Check if consecutive
    is_consecutive = all(indices[i] + 1 == indices[i + 1] for i in range(len(indices) - 1))
    if is_consecutive and len(indices) > 1:
        first = DAY_ORDER[indices[0]]
        last = DAY_ORDER[indices[-1]]
        return f"{DAY_ABBREV[first]}-{DAY_ABBREV[last]}"

    return ", ".join(DAY_ABBREV.get(DAY_ORDER[i], DAY_ORDER[i]) for i in indices)


def _parse_opening_hours_spec(specs: list) -> list[str]:
    """Parse openingHoursSpecification array into ISO strings."""
    hours = []
    for spec in specs:
        if not isinstance(spec, dict):
            continue
        days = spec.get("dayOfWeek", [])
        opens = spec.get("opens", "")
        closes = spec.get("closes", "")
        if not opens or not closes:
            continue

        if isinstance(days, str):
            days = [days]

        day_str = _compress_days(days)
        hours.append(f"{day_str} {opens}-{closes}")

    return hours


def _parse_logo(logo) -> Optional[str]:
    """Extract logo URL from string or ImageObject."""
    if isinstance(logo, str):
        return logo
    if isinstance(logo, dict):
        return logo.get("url")
    return None


def _parse_cuisine(cuisine) -> Optional[str]:
    """Normalize servesCuisine to a comma-separated string."""
    if isinstance(cuisine, list):
        return ", ".join(str(c) for c in cuisine)
    if isinstance(cuisine, str):
        return cuisine
    return None


def _get_type_priority(obj: dict) -> Optional[int]:
    """Get priority for a JSON-LD object. None if not a relevant type."""
    obj_type = obj.get("@type", "")
    if isinstance(obj_type, list):
        # Use the most specific (lowest priority number)
        priorities = [TYPE_PRIORITY[t] for t in obj_type if t in TYPE_PRIORITY]
        return min(priorities) if priorities else None
    return TYPE_PRIORITY.get(obj_type)


def extract_jsonld(html: Optional[str]) -> dict:
    """Extract structured business data from JSON-LD blocks in HTML.

    Finds all <script type="application/ld+json"> blocks, parses them,
    and merges data with type-priority ordering (Restaurant > Hotel > LocalBusiness > Organization).

    Returns a dict with keys: name, description, telephone, email, address,
    openingHours, cuisine, priceRange, logo, image, sameAs.
    """
    result = _empty_result()

    if not html:
        return result

    # Find all JSON-LD script blocks
    pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    blocks = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)

    if not blocks:
        return result

    # Parse and flatten all blocks into typed objects
    typed_objects: list[dict] = []

    for block_text in blocks:
        try:
            data = json.loads(block_text.strip())
        except (json.JSONDecodeError, ValueError):
            continue

        # Flatten: single object, array, or @graph
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    typed_objects.append(item)
        elif isinstance(data, dict):
            if "@graph" in data:
                graph = data["@graph"]
                if isinstance(graph, list):
                    for item in graph:
                        if isinstance(item, dict):
                            typed_objects.append(item)
            else:
                typed_objects.append(data)

    # Filter to relevant types and sort by priority
    relevant = [(obj, _get_type_priority(obj)) for obj in typed_objects]
    relevant = [(obj, p) for obj, p in relevant if p is not None]
    relevant.sort(key=lambda x: x[1])

    if not relevant:
        return result

    # Collect sameAs from ALL blocks (merged)
    all_same_as: list[str] = []
    all_opening_hours: list[str] = []

    for obj, _priority in relevant:
        # sameAs — merge from all
        same_as = obj.get("sameAs", [])
        if isinstance(same_as, str):
            same_as = [same_as]
        for url in same_as:
            if url not in all_same_as:
                all_same_as.append(url)

        # openingHoursSpecification — take from first that has it
        if not all_opening_hours:
            specs = obj.get("openingHoursSpecification")
            if specs:
                if isinstance(specs, list):
                    all_opening_hours = _parse_opening_hours_spec(specs)

        # openingHours (simple string array fallback)
        if not all_opening_hours:
            simple_hours = obj.get("openingHours")
            if simple_hours:
                if isinstance(simple_hours, str):
                    all_opening_hours = [simple_hours]
                elif isinstance(simple_hours, list):
                    all_opening_hours = [str(h) for h in simple_hours]

    # Merge fields — first non-None value per field wins (by priority order)
    for obj, _priority in relevant:
        if result["name"] is None:
            result["name"] = obj.get("name")
        if result["description"] is None:
            result["description"] = obj.get("description")
        if result["telephone"] is None:
            result["telephone"] = obj.get("telephone")
        if result["email"] is None:
            result["email"] = obj.get("email")
        if result["address"] is None:
            addr = _parse_address(obj.get("address"))
            if addr:
                result["address"] = addr
        if result["cuisine"] is None:
            cuisine = _parse_cuisine(obj.get("servesCuisine"))
            if cuisine:
                result["cuisine"] = cuisine
        if result["priceRange"] is None:
            result["priceRange"] = obj.get("priceRange")
        if result["logo"] is None:
            logo = _parse_logo(obj.get("logo"))
            if logo:
                result["logo"] = logo
        if result["image"] is None:
            image = obj.get("image")
            if isinstance(image, str):
                result["image"] = image
            elif isinstance(image, dict):
                result["image"] = image.get("url")

    result["openingHours"] = all_opening_hours
    result["sameAs"] = all_same_as

    return result
