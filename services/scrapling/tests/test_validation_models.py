"""Tests for extraction validation models."""

import pytest
from validation import (
    AIExtractionResponse,
    PolicyItem,
    RoutineItem,
    InstructionItem,
    OpeningHoursItem,
    DepartmentItem,
    MenuSection,
    HolidayItem,
    PayrollInfo,
    EmploymentTermsInfo,
)


class TestPolicyItem:
    def test_valid(self):
        p = PolicyItem(name="HMS", content="Bruk hansker", source="doc.pdf")
        assert p.name == "HMS"

    def test_missing_name_raises(self):
        with pytest.raises(Exception):
            PolicyItem(content="Bruk hansker", source="doc.pdf")


class TestRoutineItem:
    def test_valid_with_steps(self):
        r = RoutineItem(
            name="Åpningsrutine",
            steps=["Slå på ovner", "Klargjør salat"],
            source="rutiner.pdf",
        )
        assert len(r.steps) == 2

    def test_optional_trigger(self):
        r = RoutineItem(
            name="Test", steps=["a"], source="x.pdf", trigger="07:00"
        )
        assert r.trigger == "07:00"

    def test_trigger_defaults_none(self):
        r = RoutineItem(name="Test", steps=["a"], source="x.pdf")
        assert r.trigger is None


class TestAIExtractionResponse:
    def test_empty_is_valid(self):
        r = AIExtractionResponse()
        assert r.policies is None

    def test_unknown_fields_ignored(self):
        r = AIExtractionResponse.model_validate({"unknown_field": "value"})
        assert not hasattr(r, "unknown_field")

    def test_employees_field_ignored(self):
        r = AIExtractionResponse.model_validate(
            {"employees": [{"firstName": "Ola"}]}
        )
        assert not hasattr(r, "employees")

    def test_full_valid_response(self):
        data = {
            "policies": [{"name": "HMS", "content": "Regler", "source": "f.pdf"}],
            "routines": [{"name": "Åpning", "steps": ["Steg 1"], "source": "f.pdf"}],
            "departments": [{"name": "Kjøkken", "roles": ["Kokk"], "source": "f.pdf"}],
            "payroll": {"tariff": "HRF", "supplements": {"kveld": "30kr"}, "source": "f.pdf"},
        }
        r = AIExtractionResponse.model_validate(data)
        assert len(r.policies) == 1
        assert r.payroll.tariff == "HRF"

    def test_strip_empty_categories(self):
        data = {"policies": [], "routines": None, "menus": []}
        r = AIExtractionResponse.model_validate(data)
        stripped = r.strip_empty()
        assert stripped.policies is None
        assert stripped.routines is None
        assert stripped.menus is None
