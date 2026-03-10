"""Extraction eval suite — 3 levels of validation.

Level 1: Schema validation (AI response matches Pydantic models)
Level 2: Category mapping (content lands in correct category)
Level 3: Edge cases (empty, unicode, PD leak, duplicates)

Run fast tests:  pytest tests/test_extraction_eval.py
Run slow tests:  pytest tests/test_extraction_eval.py -m slow
"""

import json
import pytest
from pathlib import Path
from validation import AIExtractionResponse

FIXTURES_DIR = Path(__file__).parent / "fixtures"
EXPECTED_DIR = FIXTURES_DIR / "expected"


# ═══════════════════════════════════════════════════════════
# Level 1: Schema Validation
# ═══════════════════════════════════════════════════════════


class TestSchemaValidation:
    """Validates that AI responses conform to the expected JSON schema."""

    def test_valid_full_response(self):
        """A complete response with all 9 categories validates correctly."""
        data = {
            "policies": [{"name": "HMS", "content": "Bruk hansker", "source": "doc.pdf"}],
            "routines": [{"name": "Åpning", "steps": ["Steg 1", "Steg 2"], "source": "doc.pdf"}],
            "instructions": [{"name": "Oppskrift", "content": "Bland mel og vann", "source": "doc.pdf"}],
            "openingHours": {"schedule": {"mandag-fredag": "11:00-23:00"}, "source": "doc.pdf"},
            "departments": [{"name": "Kjøkken", "roles": ["Kokk", "Lærling"], "source": "doc.pdf"}],
            "menus": [{"category": "Forrett", "items": [{"name": "Suppe", "price": "149kr"}], "source": "doc.pdf"}],
            "holidays": [{"name": "Julaften", "date": "24.12", "rule": "Stengt fra 15:00", "source": "doc.pdf"}],
            "payroll": {"tariff": "Riksavtalen", "supplements": {"kveld": "30kr/t"}, "source": "doc.pdf"},
            "employmentTerms": {"noticePeriod": "3 måneder", "probation": "6 måneder", "source": "doc.pdf"},
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is not None
        assert len(result.policies) == 1
        assert result.payroll.tariff == "Riksavtalen"

    def test_valid_empty_response(self):
        """An empty response (no categories found) is valid."""
        result = AIExtractionResponse.model_validate({})
        assert result.policies is None
        assert result.menus is None

    def test_valid_partial_response(self):
        """A response with only some categories is valid."""
        data = {
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is not None
        assert result.routines is None

    def test_unknown_fields_ignored(self):
        """Unknown fields from AI are silently dropped."""
        data = {
            "policies": [{"name": "X", "content": "Y", "source": "f.pdf"}],
            "completely_unknown": "should be ignored",
            "also_unknown": [1, 2, 3],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is not None
        assert not hasattr(result, "completely_unknown")

    def test_employees_field_ignored(self):
        """The employees field is silently dropped (personal data filter)."""
        data = {
            "employees": [{"firstName": "Ola", "lastName": "Nordmann", "email": "ola@test.no"}],
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert not hasattr(result, "employees")
        assert result.policies is not None

    def test_invalid_policy_missing_name(self):
        """A policy without a name field fails validation."""
        data = {"policies": [{"content": "Regler", "source": "f.pdf"}]}
        with pytest.raises(Exception):
            AIExtractionResponse.model_validate(data)

    def test_invalid_routine_missing_steps(self):
        """A routine without steps field fails validation."""
        data = {"routines": [{"name": "Åpning", "source": "f.pdf"}]}
        with pytest.raises(Exception):
            AIExtractionResponse.model_validate(data)

    def test_invalid_payroll_missing_source(self):
        """Payroll without source field fails validation."""
        data = {"payroll": {"tariff": "HRF"}}
        with pytest.raises(Exception):
            AIExtractionResponse.model_validate(data)

    def test_strip_empty_removes_empty_lists(self):
        """strip_empty() converts empty lists to None."""
        data = {"policies": [], "routines": [], "menus": None}
        result = AIExtractionResponse.model_validate(data).strip_empty()
        assert result.policies is None
        assert result.routines is None
        assert result.menus is None

    def test_strip_empty_preserves_data(self):
        """strip_empty() keeps non-empty data intact."""
        data = {
            "policies": [{"name": "HMS", "content": "X", "source": "f.pdf"}],
            "routines": [],
        }
        result = AIExtractionResponse.model_validate(data).strip_empty()
        assert result.policies is not None
        assert len(result.policies) == 1
        assert result.routines is None


# ═══════════════════════════════════════════════════════════
# Level 2: Category Mapping
# ═══════════════════════════════════════════════════════════


def load_fixture(name: str) -> str:
    """Load a fixture markdown file."""
    path = FIXTURES_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8")


def load_expected(name: str) -> dict:
    """Load expected results for a fixture."""
    path = EXPECTED_DIR / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def validate_extraction_against_expected(
    result: AIExtractionResponse,
    expected: dict,
) -> list[str]:
    """Validate an extraction result against expected categories.

    Returns list of failure messages (empty = pass).
    """
    failures = []

    # Check expected categories are present
    for cat in expected.get("expect_categories", []):
        value = getattr(result, cat, None)
        if value is None:
            failures.append(f"Expected category '{cat}' is missing")

    # Check rejected categories are absent
    for cat in expected.get("reject_categories", []):
        value = getattr(result, cat, None)
        if value is not None and (not isinstance(value, list) or len(value) > 0):
            failures.append(f"Category '{cat}' should not be present but has data")

    # Check minimum counts
    for key, min_count in expected.items():
        if key.endswith("_min_count"):
            cat = key.replace("_min_count", "")
            value = getattr(result, cat, None)
            if value is None:
                failures.append(f"'{cat}' is None but expected min {min_count} items")
            elif isinstance(value, list) and len(value) < min_count:
                failures.append(f"'{cat}' has {len(value)} items, expected >= {min_count}")

    # Check must-contain keywords (case-insensitive in names/content)
    for key, keywords in expected.items():
        if key.endswith("_must_contain") and isinstance(keywords, list):
            cat = key.replace("_must_contain", "")
            value = getattr(result, cat, None)
            if value is None:
                failures.append(f"'{cat}' is None but expected keywords {keywords}")
                continue
            if isinstance(value, list):
                all_text = " ".join(
                    getattr(item, "name", "") + " " + getattr(item, "content", "") + " " + getattr(item, "category", "")
                    for item in value
                ).lower()
                for kw in keywords:
                    if kw.lower() not in all_text:
                        failures.append(f"'{cat}' missing keyword '{kw}'")

    # Check payroll supplements
    if expected.get("payroll_must_have_supplements"):
        if result.payroll is None:
            failures.append("payroll is None but expected supplements")
        elif not result.payroll.supplements:
            failures.append("payroll.supplements is empty but expected data")

    # Check employment fields
    for field in expected.get("employment_must_have", []):
        if result.employmentTerms is None:
            failures.append(f"employmentTerms is None but expected '{field}'")
        elif not getattr(result.employmentTerms, field, None):
            failures.append(f"employmentTerms.{field} is empty")

    return failures


class TestCategoryMapping:
    """Tests that content lands in the correct category.

    These tests use MOCKED AI responses — they validate the mapping logic,
    not the AI prompt itself. See @pytest.mark.slow tests for live AI testing.
    """

    @pytest.fixture
    def hms_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from HMS plan."""
        return AIExtractionResponse.model_validate({
            "policies": [
                {"name": "Mattrygghet og hygiene", "content": "Håndvask minimum hvert 30. minutt, bruk engangshansker, allergener merkes tydelig", "source": "hms_plan.md"},
                {"name": "Brannsikkerhet", "content": "Brannslukkere kontrolleres månedlig, evakueringsplan ved innganger, brannøvelse 2x/år", "source": "hms_plan.md"},
                {"name": "Arbeidsmiljø", "content": "Sklisikre sko påbudt, løfteteknikk, støygrense 85 dB, pauseordning", "source": "hms_plan.md"},
            ],
        })

    @pytest.fixture
    def routines_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from daily routines."""
        return AIExtractionResponse.model_validate({
            "routines": [
                {"name": "Åpningsrutine", "steps": ["Deaktiver alarm", "Slå på ventilasjon", "Tenn ovner"], "trigger": "09:00", "source": "daily_routines.md"},
                {"name": "Stengerutine", "steps": ["Tøm kaffemaskin", "Rengjør flater", "Tell opp kassen"], "source": "daily_routines.md"},
                {"name": "Varemottak", "steps": ["Sjekk følgeseddel", "Kontroller temperatur", "Merk med dato"], "trigger": "07:00-09:00", "source": "daily_routines.md"},
            ],
        })

    @pytest.fixture
    def menu_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from restaurant menu."""
        return AIExtractionResponse.model_validate({
            "menus": [
                {"category": "Forrett", "items": [{"name": "Fiskesuppe", "price": "149 kr"}, {"name": "Kamskjell", "price": "189 kr"}], "source": "menu_restaurant.md"},
                {"category": "Hovedrett", "items": [{"name": "Ovnsbakt torsk", "price": "289 kr"}, {"name": "Entrecôte", "price": "349 kr"}], "source": "menu_restaurant.md"},
                {"category": "Dessert", "items": [{"name": "Sjokoladefondant", "price": "129 kr"}], "source": "menu_restaurant.md"},
                {"category": "Drikke", "items": [{"name": "Husets hvitvin", "price": "119 kr"}, {"name": "Fatøl", "price": "89 kr"}], "source": "menu_restaurant.md"},
                {"category": "Barnemeny", "items": [{"name": "Fiskeburger", "price": "129 kr"}], "source": "menu_restaurant.md"},
            ],
        })

    @pytest.fixture
    def tariff_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from tariff agreement."""
        return AIExtractionResponse.model_validate({
            "payroll": {
                "tariff": "Riksavtalen for serveringssteder 2026",
                "supplements": {"kveld": "30 kr/t", "natt": "55 kr/t", "lørdag": "45 kr/t", "søndag": "90 kr/t", "helligdag": "133%"},
                "source": "tariff_agreement.md",
            },
            "employmentTerms": {
                "noticePeriod": "1 måned (prøvetid), 3 måneder (fast)",
                "probation": "6 måneder",
                "source": "tariff_agreement.md",
            },
            "holidays": [
                {"name": "Julaften", "date": "24.12", "rule": "Stengt fra 15:00", "source": "tariff_agreement.md"},
                {"name": "1. juledag", "date": "25.12", "source": "tariff_agreement.md"},
            ],
        })

    @pytest.fixture
    def mixed_extraction(self) -> AIExtractionResponse:
        """Simulated correct AI extraction from mixed document."""
        return AIExtractionResponse.model_validate({
            "departments": [
                {"name": "Kjøkken", "roles": ["baking", "matproduksjon", "oppvask"], "source": "mixed_document.md"},
                {"name": "Disk/Service", "roles": ["kundebehandling", "kasse", "servering"], "source": "mixed_document.md"},
                {"name": "Lager", "roles": ["varemottak", "renhold", "vedlikehold"], "source": "mixed_document.md"},
            ],
            "openingHours": {
                "schedule": {"mandag-fredag": "08:00-18:00", "lørdag": "09:00-17:00", "søndag": "10:00-16:00"},
                "seasonal": "Julaften og nyttårsaften: 08:00-14:00. Stengt: 1. juledag, 1. nyttårsdag, 1. påskedag",
                "source": "mixed_document.md",
            },
            "routines": [
                {"name": "Morgenrutine", "steps": ["Åpne bakdør", "Slå på ovnene", "Start kaffemaskin"], "trigger": "07:00", "source": "mixed_document.md"},
            ],
            "policies": [
                {"name": "Hygieneregler", "content": "Hår oppsatt eller hette, smykker av, flater desinfiseres hver time", "source": "mixed_document.md"},
            ],
        })

    def test_hms_plan_mapping(self, hms_extraction):
        expected = load_expected("hms_plan")
        failures = validate_extraction_against_expected(hms_extraction, expected)
        assert failures == [], f"HMS plan mapping failures: {failures}"

    def test_daily_routines_mapping(self, routines_extraction):
        expected = load_expected("daily_routines")
        failures = validate_extraction_against_expected(routines_extraction, expected)
        assert failures == [], f"Routines mapping failures: {failures}"

    def test_menu_mapping(self, menu_extraction):
        expected = load_expected("menu_restaurant")
        failures = validate_extraction_against_expected(menu_extraction, expected)
        assert failures == [], f"Menu mapping failures: {failures}"

    def test_tariff_mapping(self, tariff_extraction):
        expected = load_expected("tariff_agreement")
        failures = validate_extraction_against_expected(tariff_extraction, expected)
        assert failures == [], f"Tariff mapping failures: {failures}"

    def test_mixed_document_mapping(self, mixed_extraction):
        expected = load_expected("mixed_document")
        failures = validate_extraction_against_expected(mixed_extraction, expected)
        assert failures == [], f"Mixed document mapping failures: {failures}"


# ═══════════════════════════════════════════════════════════
# Level 3: Edge Cases
# ═══════════════════════════════════════════════════════════


class TestEdgeCases:
    """Tests edge cases: empty input, unicode, PD leaks, duplicates."""

    def test_empty_text_yields_empty_result(self):
        """Empty document text should produce no categories."""
        result = AIExtractionResponse.model_validate({})
        stripped = result.strip_empty()
        # All fields should be None
        for field_name in type(stripped).model_fields:
            assert getattr(stripped, field_name) is None, f"{field_name} should be None for empty input"

    def test_none_values_handled(self):
        """None values in all fields should not crash."""
        data = {k: None for k in AIExtractionResponse.model_fields}
        result = AIExtractionResponse.model_validate(data)
        assert result.policies is None

    def test_unicode_norwegian_characters(self):
        """Norwegian special characters (æøå) are preserved."""
        data = {
            "departments": [{"name": "Kjøkken", "roles": ["Lærling"], "source": "håndbok.pdf"}],
            "policies": [{"name": "Værforhold — uteservering", "content": "Parasollene tas inn ved vind > 15 m/s", "source": "håndbok.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert "ø" in result.departments[0].name
        assert "æ" in result.departments[0].roles[0]
        assert "å" in result.departments[0].source
        assert "—" in result.policies[0].name

    def test_mixed_language_extraction(self):
        """Content in both Norwegian and English validates correctly."""
        data = {
            "policies": [
                {"name": "Food Safety Guidelines", "content": "All employees must wash hands", "source": "safety.pdf"},
                {"name": "HMS-regler", "content": "Alle ansatte skal vaske hender", "source": "hms.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies) == 2

    def test_personal_data_in_employees_field_ignored(self):
        """employees field is silently dropped by Pydantic (extra=ignore)."""
        data = {
            "employees": [
                {"firstName": "Ola", "lastName": "Nordmann", "email": "ola@test.no", "phone": "91234567"},
            ],
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert not hasattr(result, "employees")
        # policies should still be extracted
        assert len(result.policies) == 1

    def test_very_long_content_accepted(self):
        """Very long content strings are accepted (truncation is caller's job)."""
        long_content = "Regel: " + "x" * 100_000
        data = {
            "policies": [{"name": "Lang policy", "content": long_content, "source": "big.pdf"}],
        }
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies[0].content) > 100_000

    def test_duplicate_policies_accepted(self):
        """Duplicate items are accepted by schema (dedup is caller's job)."""
        data = {
            "policies": [
                {"name": "HMS", "content": "Bruk hansker", "source": "f.pdf"},
                {"name": "HMS", "content": "Bruk hansker", "source": "f.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies) == 2  # Schema allows dupes

    def test_empty_lists_stripped(self):
        """Empty lists are converted to None by strip_empty()."""
        data = {"policies": [], "menus": [], "departments": []}
        result = AIExtractionResponse.model_validate(data).strip_empty()
        assert result.policies is None
        assert result.menus is None
        assert result.departments is None

    def test_menu_without_prices(self):
        """Menu items without prices are valid (price is optional)."""
        data = {
            "menus": [
                {"category": "Lunsj", "items": [{"name": "Dagens suppe"}, {"name": "Brød"}], "source": "f.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.menus[0].items[0].price is None
        assert result.menus[0].items[0].name == "Dagens suppe"

    def test_opening_hours_schedule_only(self):
        """Opening hours with only schedule (no seasonal) is valid."""
        data = {
            "openingHours": {"schedule": {"mandag-fredag": "08-18"}, "source": "f.pdf"},
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.openingHours.seasonal is None
        assert "mandag-fredag" in result.openingHours.schedule

    def test_opening_hours_seasonal_only(self):
        """Opening hours with only seasonal info (no schedule) is valid."""
        data = {
            "openingHours": {"seasonal": "Sommertid: utvidet til 01:00", "source": "f.pdf"},
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.openingHours.schedule is None

    def test_holidays_with_rules(self):
        """Holidays with rules (not just dates) are valid."""
        data = {
            "holidays": [
                {"name": "Julaften", "rule": "Stengt fra kl. 15:00", "source": "f.pdf"},
                {"name": "17. mai", "date": "17.05", "source": "f.pdf"},
            ],
        }
        result = AIExtractionResponse.model_validate(data)
        assert result.holidays[0].date is None
        assert result.holidays[1].rule is None

    def test_json_wrapped_in_markdown_codeblock(self):
        """AI sometimes wraps JSON in ```json ... ``` — test the parsing helper."""
        raw = '```json\n{"policies": [{"name": "HMS", "content": "X", "source": "f.pdf"}]}\n```'
        # Extract JSON from code block
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        assert match is not None
        data = json.loads(match.group(1).strip())
        result = AIExtractionResponse.model_validate(data)
        assert len(result.policies) == 1


# ═══════════════════════════════════════════════════════════
# Live Tests (require OPENROUTER_API_KEY)
# ═══════════════════════════════════════════════════════════

import os
import httpx

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

CURRENT_PROMPT = """You are an expert at extracting structured workplace data from Norwegian business documents.

Analyze the provided document text and extract any of the following categories you can find:

1. **policies** — Company policies, rules, guidelines (name + content summary)
2. **routines** — Daily procedures, checklists, opening/closing routines (name + steps)
3. **instructions** — Recipes, task descriptions, training material (name + content)
4. **openingHours** — Opening hours per day, seasonal variations
5. **departments** — Department names and roles within each
6. **menus** — Food/drink menus with items and prices
7. **holidays** — Public holidays, closing days, special hour rules
8. **payroll** — Tariff agreement info, pay supplements (evening, weekend, holiday rates)
9. **employmentTerms** — Notice period, probation period, standard terms

IMPORTANT: Do NOT extract personal information (names, emails, phone numbers, addresses).

Return ONLY valid JSON matching this schema:
{
  "policies": [{"name": "string", "content": "string", "source": "FILENAME"}],
  "routines": [{"name": "string", "steps": ["string"], "trigger": "optional time", "source": "FILENAME"}],
  "instructions": [{"name": "string", "content": "string", "source": "FILENAME"}],
  "openingHours": {"schedule": {"day": "hours"}, "seasonal": "string", "source": "FILENAME"},
  "departments": [{"name": "string", "roles": ["string"], "source": "FILENAME"}],
  "menus": [{"category": "string", "items": [{"name": "string", "price": "string"}], "source": "FILENAME"}],
  "holidays": [{"name": "string", "date": "string", "rule": "string", "source": "FILENAME"}],
  "payroll": {"tariff": "string", "supplements": {"type": "rate"}, "source": "FILENAME"},
  "employmentTerms": {"noticePeriod": "string", "probation": "string", "source": "FILENAME"}
}

Only include categories where you found relevant data. Omit empty arrays/objects.
All text values should be in Norwegian where the source is Norwegian."""


def call_openrouter(text: str, filename: str) -> dict:
    """Call OpenRouter with the extraction prompt and return parsed JSON."""
    prompt = CURRENT_PROMPT.replace("FILENAME", filename)
    response = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        },
        json={
            "model": "anthropic/claude-sonnet-4",
            "max_tokens": 4096,
            "messages": [
                {"role": "user", "content": f"{prompt}\n\n--- DOCUMENT ---\n\n{text}"},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]

    # Parse JSON from potential markdown code block
    import re
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if match:
        return json.loads(match.group(1).strip())
    return json.loads(content)


FIXTURE_NAMES = [
    "hms_plan",
    "daily_routines",
    "menu_restaurant",
    "tariff_agreement",
    "mixed_document",
    "handbook_hospitality",
]


@pytest.mark.slow
@pytest.mark.skipif(not OPENROUTER_API_KEY, reason="OPENROUTER_API_KEY not set")
@pytest.mark.parametrize("fixture_name", FIXTURE_NAMES)
def test_live_extraction(fixture_name: str):
    """Live test: send fixture to OpenRouter, validate result against expected."""
    text = load_fixture(fixture_name)
    expected = load_expected(fixture_name)

    raw_result = call_openrouter(text, f"{fixture_name}.md")
    result = AIExtractionResponse.model_validate(raw_result).strip_empty()

    failures = validate_extraction_against_expected(result, expected)

    # Print detailed result for debugging
    print(f"\n{'='*60}")
    print(f"FIXTURE: {fixture_name}")
    print(f"Categories found: {[k for k in result.model_fields if getattr(result, k) is not None]}")
    if failures:
        print(f"FAILURES: {failures}")
    print(f"{'='*60}")

    assert failures == [], f"Live extraction for '{fixture_name}' failed: {failures}"
