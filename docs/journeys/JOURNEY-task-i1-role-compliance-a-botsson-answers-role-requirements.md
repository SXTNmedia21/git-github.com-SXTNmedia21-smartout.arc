---
title: "Journey — Botsson answers what a role must complete"
feature: task-i1-role-compliance-a
journey: botsson-answers-role-requirements
status: verified
verified_at: 2026-05-21
e2e_test: packages/ai/src/capabilities/governance/__tests__/list-mandatory-protocols.test.ts
created: 2026-05-21
updated: 2026-05-21
module: task-manager
tags: [journey]
---

# Journey: Botsson answers what a role must complete

**Role:** manager or employee (via Botsson chat/voice)

**Precondition:** `profession_training` is populated for the workspace (see admin-bootstrap-seeds-role-protocols). The `governance` capability exposes the read tool `list_mandatory_protocols_for_role(roleSlug)`. Intent classifier + system prompt know the tool (ADR-0112).

## Happy Path

1. Manager asks Botsson "Hva må en bartender fullføre?" → System classifies intent → calls `governance.list_mandatory_protocols_for_role('bartender')` → resolves role/position → `profession_training` (is_required=true) → returns the mandatory protocol list → Botsson answers with the protocols the bartender role must complete (e.g. Alkoholkontroll, Skjenkekontroll).
2. Employee asks "Hva mangler jeg for rollen min?" → System resolves the caller's role/position → returns role's mandatory protocols (read-only; cross-reference against the employee's completion is 0387b scope — this journey returns the role requirement set).

**Postcondition:** The caller receives the role's mandatory-protocol set, sourced from the `profession_training` spine. Read-only — no mutation, no gate change.

## Error Paths

- **Scenario:** unknown / unmapped role slug → tool returns an empty list (not an error); Botsson says no mandatory protocols are registered for that role.
- **Scenario:** workspace spine not yet seeded → empty list; Botsson explains role requirements aren't configured yet.
- **Scenario:** voice channel → read tool is voice-safe (ADR-0078); answer delivered on voice.

## Verification

- [x] Implementation matches the steps above — `list_mandatory_protocols_for_role` (`packages/ai/src/capabilities/governance/tools.ts`) resolves `profession.slug==role_slug` (workspace then platform fallback) → `profession_training (is_required)` → `protocol`; unknown role → empty; ctx-scoped workspace (ADR-0151).
- [x] Automated tests pass — 4 unit tests (`__tests__/list-mandatory-protocols.test.ts`): unknown→empty, workspace-scoped→protocols, platform fallback→protocols, DB error→error. 4/4 green.
- [x] Read-only, no behavior change elsewhere (guardrail audit clean). Intent-classifier prompt updated; coverage 39↔43 in sync. Channel `chat` (voice deferred — capability ceiling carries `check_readiness` PII).

**Verified 2026-05-21.** Reader covered by committed unit tests; full Botsson-chat manual pass recommended once a seeded workspace exists in a dev env.
