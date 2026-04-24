---
title: "Journey — Alle gjenværende flater konsistent med Nordic Split"
feature: nordic-split-final
journey: admin-alle-flater-konsistent
status: verified
verified_at: 2026-04-23
e2e_test: null
created: 2026-04-23
updated: 2026-04-23
verification_notes: |
  Grep-gate post-commit: 0 zinc/gray/slate in apps/web/src AND apps/mobile/src.
  Typecheck: pnpm --filter web typecheck → 0 errors.
  Lint: 0 errors, 41 pre-existing warnings (unused imports, setState-in-effect — none introduced).
  Mobile boundary: 0 mobile files touched (verified via git diff --name-only).
  Channel/chat safety: 0 logic-pattern diff lines (useChannels, ChatPanelProvider,
    useMutation, emit(), supabase.from, gate_action, workspace_id, actor_id) — pure className swap.
  Code review: PASS (feature-dev:code-reviewer, 7 spot-checks across clusters).
  Yellow flag (pre-existing, not introduced): StaffingSection.tsx:96 has hex color pair
    "#3f3f46"/"#e4e4e7" as chart color strings — never in className scope, Phase 2.5 debt.
  Commit: a40c5dc9 (86 files, -164 net lines after prettier normalization).
  Visual QA: deferred to pre-merge gate (recommend dev server + screenshot diff before
    campaign → development promotion).
module: Dashboard
tags: [journey, design-system, nordic-split, final-sweep]
---

# Journey: Alle gjenværende flater konsistent med Nordic Split

**Role:** admin / employee / platform-admin

**Precondition:** Phase 1–3d tokens aktive (1135 refs allerede migrert).

## Happy Path

Admin/employee/platform-admin navigerer alle gjenværende flater (settings, AI config, voice-assistant, dialogs, platform-admin pages, onboarding, scattered components) → alt renderer med Nordic Split tokens. Ingen kald zinc-tone noensteds.

**Postcondition:**
- 0 zinc/gray/slate i `apps/web/src`
- Nordic Split-migrasjonen er 100% komplett

## Verification

- [x] `grep -rEn "(zinc|gray|slate)-[0-9]+" apps/web/src` returnerer 0
- [x] Typecheck 0 errors
- [x] Lint 0 nye errors (41 pre-existing warnings, none introduced)
- [x] 0 mobile-filer endret
- [x] 0 channel/chat-logikk endret
- [x] Code review PASS (feature-dev:code-reviewer)
- [ ] Visual QA (deferred to pre-merge gate)

## Notes

Final sweep — completes Nordic Split Phase 3 entirely. Phase 2.5 (brand-signal semantic tokens, card-elevated, oklch cleanup) remains as separate council-driven work.
