---
title: "Progressive Save Pattern"
id: LEARNING_0015
status: canonical
layer: learning
created: 2026-03-03
updated: 2026-03-03
tags: [pattern, onboarding, wizard, ux]
---

# Learning-0015: Progressive Save Pattern With Debounce + JSONB

## Context

The onboarding wizard has 15 steps. Users could lose all progress if they close the browser mid-wizard. We needed a save strategy that persisted state without requiring the user to manually save.

## Discovery

The `useOnboardingWizard` hook implements a progressive save pattern:

1. **JSONB column** on `onboarding_session` stores entire wizard state as a single JSON blob
2. **500ms debounce** on state changes prevents excessive writes
3. **Step index** saved separately as `current_step` integer for quick resume
4. **Resume logic** on mount: detect incomplete session → restore state → skip transient steps (crawling, finalizing)
5. **Transient step handling**: steps that involve async operations (crawl, finalize) are skipped on resume since their state can't be meaningfully restored

**Key insight:** Storing structured data as JSONB in a single column is simpler and more resilient than normalized tables for wizard state. Schema changes to the wizard only require frontend changes, not migrations.

## Impact

- **Reusable pattern** for any multi-step form or wizard in Smartout
- JSONB + debounce + step index = simple, resilient save strategy
- Always identify and handle transient steps (async operations) separately on resume
- Consider this pattern before building normalized state tables for wizard flows

## References

- `apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts`
- `supabase/migrations/00009_onboarding_v3.sql` — `onboarding_session` table
- ADR-0041 — Onboarding Wizard Step Architecture
