---
title: "Document Extraction Eval & Prompt Redesign"
status: approved
updated: 2026-03-10
created: 2026-03-10
module: onboarding
tags: [extraction, eval, openrouter, scrapling, prompt]
---

# Document Extraction Eval & Prompt Redesign

## Problem

The `analyze-setup-documents` edge function extracts structured workplace data from uploaded documents via Scrapling + OpenRouter AI. Current issues:

1. **Prompt extracts employee personal data** (names, emails, phones) — not needed, privacy concern
2. **Missing categories** the wizard actually needs: opening hours, departments, menus, holidays, routines, instructions
3. **No few-shot examples** — model guesses formatting
4. **No industry context** — can't map to correct handbook chapters
5. **No validation** — edge function accepts whatever AI returns
6. **No eval tests** — no way to measure prompt quality or detect regressions

## Approach: Test-First

Build eval suite first → measure baseline with current prompt → redesign prompt → measure improvement.

## Design

### Phase 1: Eval Suite (build FIRST)

**Location:** `services/scrapling/tests/test_extraction_eval.py`

#### Level 1: Schema Validation

Validates AI response matches expected JSON structure using Pydantic models.

- All 9 new categories validated against Pydantic models
- Unknown fields ignored (not errors)
- `employees` in AI response filtered out (backward compat)
- Empty categories (`[]`, `{}`, `null`) stripped
- `source` field present on every item

#### Level 2: Category Mapping

Tests content lands in the correct category. Uses fixture documents (markdown simulating scrapling output) + expected categories.

Fixtures:

- `hms_plan.md` → expects `policies`
- `daily_routines.md` → expects `routines`
- `menu_restaurant.md` → expects `menus`
- `tariff_agreement.md` → expects `payroll`
- `mixed_document.md` → expects multiple categories
- `handbook_hospitality.md` → large multi-section document

Fast tests mock AI response. Slow tests (`pytest -m slow`) call OpenRouter with real fixture text.

#### Level 3: Edge Cases

- Empty file → empty result
- Images only, no text → empty result
- Mixed Norwegian/English → correct categorization
- Duplicates in source → deduplicated
- Very long text (100k chars) → truncation handling
- Personal data leak → filtered out
- Unicode edge cases → handled

#### Test Structure

```
services/scrapling/tests/
├── test_extraction_eval.py
├── fixtures/
│   ├── handbook_hospitality.md
│   ├── hms_plan.md
│   ├── daily_routines.md
│   ├── menu_restaurant.md
│   ├── tariff_agreement.md
│   ├── mixed_document.md
│   └── expected/
│       ├── handbook_hospitality.json
│       ├── hms_plan.json
│       └── ...
└── conftest.py
```

**Running:**

- `pytest tests/test_extraction_eval.py` — schema + mapping + edge cases (fast, no AI)
- `pytest tests/test_extraction_eval.py -m slow` — live OpenRouter tests (requires API key)

### Phase 2: New Prompt

#### Categories (9, replaces current 6)

| Category        | What                                 | Wizard Step           |
| --------------- | ------------------------------------ | --------------------- |
| policies        | HMS, rules, guidelines               | Governance            |
| routines        | Daily procedures, checklists         | Governance            |
| instructions    | Recipes, task descriptions, training | Governance / Handbook |
| openingHours    | Hours per day/season                 | Shift Templates       |
| departments     | Departments with roles               | Team Setup            |
| menus           | Dishes, drinks, prices               | Handbook              |
| holidays        | Public holidays, closing days        | Season                |
| payroll         | Tariff, supplements, rates           | Payroll               |
| employmentTerms | Notice period, probation             | Employment            |

**Removed:** `employees` (personal data), `handbookSections` (generated post-AI)

#### Prompt Structure

1. System context with industry type
2. 9 categories with descriptions
3. JSON schema with few-shot examples per category
4. Rules: "Never extract personal names, emails, or phone numbers"

#### handbookSections Mapping (post-AI, deterministic)

Edge function maps AI extraction categories to handbook chapter keys based on `industryPackage`. No AI involved — pure logic, independently testable.

```
AI extracts raw data → edge function maps to chapters → frontend receives both
```

### Phase 3: Type & Frontend Updates

#### New TypeScript Types

```typescript
type AIExtractionResponse = {
  policies?: Array<{ name: string; content: string; source: string }>;
  routines?: Array<{ name: string; steps: string[]; trigger?: string; source: string }>;
  instructions?: Array<{ name: string; content: string; source: string }>;
  openingHours?: { schedule?: Record<string, string>; seasonal?: string; source: string };
  departments?: Array<{ name: string; roles: string[]; source: string }>;
  menus?: Array<{
    category: string;
    items: Array<{ name: string; price?: string }>;
    source: string;
  }>;
  holidays?: Array<{ name: string; date?: string; rule?: string; source: string }>;
  payroll?: { tariff?: string; supplements?: Record<string, string>; source: string };
  employmentTerms?: { noticePeriod?: string; probation?: string; source: string };
};

type DocumentExtractionResult = AIExtractionResponse & {
  handbookSections?: Array<{ chapterKey: string; content: string; source: string }>;
};
```

#### Pydantic Validation Models

New file: `services/scrapling/extractors/validation.py` — mirrors TypeScript types. Used by eval suite and optionally by edge function.

#### Personal Data Filter

Safety net in edge function: strips `employees` and scrubs any leaked personal data from other fields.

### Files Changed

| File                                                  | Change                                      |
| ----------------------------------------------------- | ------------------------------------------- |
| `services/scrapling/extractors/validation.py`         | **New** — Pydantic models                   |
| `services/scrapling/tests/test_extraction_eval.py`    | **New** — 3-level eval suite                |
| `services/scrapling/tests/fixtures/`                  | **New** — test documents + expected results |
| `supabase/functions/analyze-setup-documents/index.ts` | New prompt, types, mapping, PD filter       |
| `apps/web/.../wizard-state.ts`                        | Updated `DocumentExtractionResult`          |
| `apps/web/.../WorkspaceSetupWizard.tsx`               | Map new categories to wizard steps          |
| `apps/web/.../DocumentDropStep.tsx`                   | ExtractionSummary shows new categories      |
| `apps/web/.../GovernanceSetupStep.tsx`                | Accepts `routines` + `instructions`         |
| `apps/web/.../ShiftTemplateSetupStep.tsx`             | Accepts `openingHours`                      |
| `apps/web/.../TeamSetupStep.tsx`                      | Accepts `departments` (without employees)   |

## Implementation Order

1. **Eval suite + Pydantic models** — test infrastructure first
2. **Run baseline** — measure current prompt against eval suite
3. **New prompt** — redesign with 9 categories + few-shot examples
4. **Run eval** — compare against baseline
5. **Edge function** — mapping logic, PD filter, new types
6. **Frontend** — update types and wizard steps

## Success Criteria

- Schema validation: 100% pass rate on valid AI responses
- Category mapping: >90% correct categorization on fixture documents
- Edge cases: 100% pass rate (no crashes, no PD leaks)
- Live eval: measurable improvement over baseline prompt
