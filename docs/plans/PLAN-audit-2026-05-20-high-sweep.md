---
title: "Plan — audit-2026-05-20-high-sweep"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: meta
tags: [plan, audit-closure, high-sweep]
---

# Plan — audit-2026-05-20-high-sweep

> Branch: `feat/audit-2026-05-20-high-sweep` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4` | Base: `development` | Module: meta | Started: 2026-05-20

## Goal

Close 6 of 7 HIGH findings from audit 2026-05-20 in one atomic sortie. Defer F-01 (376 tsx files i18n corpus) to ui-shell-followup M1/M2 (needs ESLint rule + corpus sweep methodology, not single-file fixes).

## Findings to close

| ID | Slice | File / Surface | Fix |
|---|---|---|---|
| **MOB-01** | mobile | `mobile_call_leader` tool args include `leader_phone` (PII) on `botsson-tool-call` wire | Remove `leader_phone` from tool schema + args; mobile re-resolves phone locally from `leader_name`. ADR-0378 R7 + ADR-0078. |
| **EF-01** | edge-fn | `supabase/config.toml` missing `[functions.tariff-amendment-sweep]` entry | Add 1-line config entry mirroring `ops-*` cron functions pattern. |
| **SE-01** | stage-engine | `services/stage-engine/src/mission-pool-slot.ts` emits `journey.*` events directly (4 sites) — ADR-0248 single-producer violation | Move `journey.*` emits to corresponding B5 handlers OR draft ADR-0248 amendment if architectural exception warranted. Default: move emits. |
| **OW-01** | onboarding | `ConfirmPositions.tsx` 100% hardcoded NO (no `t` destructure) | Add `t` from `useTranslations()`, migrate all visible strings to `t()` keys in `onboarding.json`. |
| **OW-02** | onboarding | `ConfirmDepartments.tsx` partial — badge/buttons/placeholder hardcoded | Migrate remaining hardcoded strings to `t()` keys. |
| **OW-03** | onboarding | `ConfirmProcedures.tsx` partial — badges/prose/buttons hardcoded | Migrate remaining hardcoded strings to `t()` keys. |

## Out of scope

- **F-01** (i18n corpus 376 files) — defer to ui-shell-followup M2
- All 30 MEDIUM + 32 LOW findings — separate prioritization

## Tasks

- [ ] MOB-01 fix dispatched + reviewed
- [ ] EF-01 fix dispatched
- [ ] SE-01 fix dispatched + ADR amendment if needed
- [ ] OW-01/02/03 i18n migration dispatched
- [ ] Typecheck 0 errors per package
- [ ] HANDOFF written
- [ ] PR to development

## References

- Audit synthesis: `docs/audits/2026-05-20-adr-contract-validation/00-SYNTHESIS.md`
- ADRs: 0078, 0151, 0204, 0240, 0248, 0378
- L-0177 fail-fast on PII args
