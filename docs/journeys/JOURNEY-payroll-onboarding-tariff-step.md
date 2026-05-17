---
title: "Journey — payroll-onboarding-tariff-step"
status: verified
feature: onboarding-tariff-step
updated: 2026-05-17
created: 2026-05-17
module: web
tags: [journey, payroll, onboarding, tariff, phase-7e]
---

# Journey — payroll-onboarding-tariff-step

> Phase 7e Track 2. Tariff section in onboarding wizard.

## Journey: Workspace owner sets up tariff during /onboarding

**Precondition:** Workspace exists, owner authenticated, wizard reached "Tariff" step (between `confirm-procedures` and `summary`).

1. Wizard renders `TariffSection`
2. Owner picks "Ja, vi er tariff-bundet" or "Nei"
3. **Ja path**: UnionPicker shows Fellesforbundet / Parat options → owner selects → LawVersionSelect (2024/2025) → owner submits
4. Form POST to `/api/payroll/tariff/setup` via shared `setupTariffRequestSchema`
5. On 200 → success state with bound union summary → `next()` advances wizard
6. **Nei path**: Section completes without BFF call → state `is_tariff_bound: false` → Lovsen-soft-guide copy explains bransjenorm default → `next()`

**Postcondition:** Either workspace_union_binding exists OR workspace stays unbound with documented default.

**Error paths:**
- BFF returns ADR-0152 envelope → `tariffErrorToNorwegian()` maps to readable Norwegian
- TARIFF_ALREADY_BOUND → wizard explains existing binding, suggests admin tariff page for changes
- MISSING_PROFILE_CONTEXT → wizard explains session issue, suggests re-login
- Skippable: wizard allows `skip` to defer tariff setup to admin page later

## Design

- Nordic Split: bg-background/text-foreground/border-border CSS vars
- Framer Motion spring `{stiffness:35, damping:22, mass:2.2}` with `useReducedMotion()` gate
- Mirrors `ConfirmDepartments` toggle pattern + `ConfirmProcedures` deselect pattern + `ConfirmSummary` success layout
- Lucide `FileText` icon, no emojis
- Native select for law_version (a11y baseline)

## Contract gap (Phase 7g)

Component sends placeholder UUIDs (`00000000-7900-...0079` + `00000000-2260-...0226`) per `setupTariffRequestSchema.union_id: z.string().uuid()` but tool enum is `"taro-79" | "taro-226" | "non-bound"`. BFF will reject until contract + BFF + tool reconciled.
