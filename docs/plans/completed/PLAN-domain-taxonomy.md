---
title: "Plan — domain-taxonomy"
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-channel
tags: [plan, helpdesk, phase-2]
---

# Plan — domain-taxonomy

> Branch: `feat/helpdesk-domain-taxonomy` | Worktree: /home/sxtnl/dev/smartout.ai-helpdesk-wt-1 | Base: `campaign/helpdesk` | Module: helpdesk-channel | Started: 2026-04-20

## Goal

Deliver the hospitality domain taxonomy as a platform-level (K1a) artifact so the Phase 2 Botsson classifier can route employee questions to the correct helpdesk channel. Prereq #3 from the Phase 2 blocked-list in the progressive-channel spec.

## Tasks

- [x] Extend `@smartout/types` `IndustryPackage` with optional `domains` field + `Domain` + `HospitalityDomain` types
- [x] Add `HOSPITALITY_DOMAINS` constant and `domains` field to `hospitalityPackage`
- [x] Add `domains: []` to `defaultPackage`
- [x] Write 28-test shape + voice-policy test suite
- [x] Typecheck + test green
- [x] Write journey doc (classifier route + admin tag + `other` fallback)
- [x] Write handoff doc

## Acceptance Criteria

- [x] Typecheck passes: `pnpm --filter @smartout/ai typecheck`
- [x] Tests pass: `pnpm --filter @smartout/ai test -- domains.test`
- [x] Journey doc exists at `docs/journeys/JOURNEY-domain-taxonomy.md`
- [x] Handoff doc exists at `docs/HANDOFF-domain-taxonomy.md`
