"""Pydantic models for AI extraction response validation.

These models define the schema for what the OpenRouter AI prompt should return.
Used by: eval test suite, edge function validation.

Categories (9):
  policies, routines, instructions, openingHours, departments,
  menus, holidays, payroll, employmentTerms

NOT included: employees (personal data — never extracted)
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class PolicyItem(BaseModel):
    name: str
    content: str
    source: str


class RoutineItem(BaseModel):
    name: str
    steps: list[str]
    trigger: str | None = None
    source: str


class InstructionItem(BaseModel):
    name: str
    content: str
    source: str


class OpeningHoursItem(BaseModel):
    schedule: dict[str, str] | None = None
    seasonal: str | None = None
    source: str


class DepartmentItem(BaseModel):
    name: str
    roles: list[str]
    source: str


class MenuItem(BaseModel):
    name: str
    price: str | None = None


class MenuSection(BaseModel):
    category: str
    items: list[MenuItem]
    source: str


class HolidayItem(BaseModel):
    name: str
    date: str | None = None
    rule: str | None = None
    source: str


class PayrollInfo(BaseModel):
    tariff: str | None = None
    supplements: dict[str, str] | None = None
    source: str


class EmploymentTermsInfo(BaseModel):
    noticePeriod: str | None = None
    probation: str | None = None
    source: str


class AIExtractionResponse(BaseModel):
    """Validated AI extraction response. Unknown fields are silently ignored."""

    model_config = ConfigDict(extra="ignore")

    policies: list[PolicyItem] | None = None
    routines: list[RoutineItem] | None = None
    instructions: list[InstructionItem] | None = None
    openingHours: OpeningHoursItem | None = None
    departments: list[DepartmentItem] | None = None
    menus: list[MenuSection] | None = None
    holidays: list[HolidayItem] | None = None
    payroll: PayrollInfo | None = None
    employmentTerms: EmploymentTermsInfo | None = None

    def strip_empty(self) -> AIExtractionResponse:
        """Return a copy with empty lists/None values set to None."""
        data = {}
        for field_name in type(self).model_fields:
            value = getattr(self, field_name)
            if isinstance(value, list) and len(value) == 0:
                data[field_name] = None
            else:
                data[field_name] = value
        return AIExtractionResponse.model_validate(data)
