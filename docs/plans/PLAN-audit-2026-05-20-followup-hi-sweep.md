---
title: "Plan — audit-2026-05-20-followup-hi-sweep"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: audit
tags: [plan, audit-closure, high-sweep, post-pr-432]
---

# Plan — audit-2026-05-20-followup-hi-sweep

> Branch: `feat/audit-2026-05-20-followup-hi-sweep` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-6` | Base: `development` | Module: audit | Started: 2026-05-20

## Goal

Close 4 HIGH findings from audit run-02 (`docs/audits/2026-05-20-adr-contract-validation-02/00-SYNTHESIS.md`) in one atomic sortie. Mirror PR #432 pattern (closed 6 baseline HIGHs in single PR). MEDIUMs deferred to next sortie.

## Findings to close

| ID | Severity | File / Surface | Fix | ETA | Agent |
|---|---|---|---|---|---|
| **WH-01** | HIGH | `apps/web/src/app/api/webhooks/docuseal/route.ts:320-334` — engine_event insert uses 4 non-existent columns (`entity_type`, `entity_id`, `event_name`, `created_at`) with `as never` cast + silent `.catch(()=>{})`. Every employee contract signing silently fails to fire `contract.signed` → cascade D2/C4 trainee→active transition never runs. | Replace columns with `event_type` + `fired_at`. Move entity fields into `payload` JSONB. Add `idempotency_key: \`docuseal:${data.submission_id}:signed\``. Remove `as never` cast. Surface error via logger.warn (not silent swallow). | 1d | W |
| **CT-01** | HIGH | `packages/ai/src/capabilities/shift-lifecycle/tools.ts:177-180,350-362` — `publishShift` + `approveShift` call `callGateAction()` then direct `.update()` (Pathway A only). ADR-0204 §4 mandates Pathway B (cascade_gate_write) produces `change_proposal` row on blocked path. | Wrap both mutations in `gatedMutation()` orchestrator (see `timeline-template/tools.ts` for reference pattern — that capability migrated correctly in earlier sortie). | 1d | S |
| **CT-02** | HIGH | `packages/ai/src/capabilities/payroll/tools.ts:200-206,370-379` — `updatePayrollProfile` + `setPensionScheme` operate gate-then-update. File header docstring claims "established payroll convention" — L-0176 trap (informal ADR override without accepted amendment). | DEFAULT: same `gatedMutation()` wrap as CT-01. If structural impediment found, draft ADR amendment formally accepting "gate-then-update payroll convention" — strict criteria + rationale required. | 1d | P |
| **F-09-01** | HIGH | `docs/decisions/0000-decision-log.md` — slot 0322 silently skipped. 3 of 4 ADR gaps (0092, 0159, 0232) documented; 0322 alone undocumented. | Add row: `\| ADR-0322 \| — \| RESERVED — slot skipped, no ADR drafted \| n/a \|`. Verify via `git blame` no prior ADR-0322 entry existed. | <15min | inline (orchestrator) |

## Out of scope

- 17 MEDIUM findings — deferred to next sortie / ui-shell-followup M-series
- 20 LOW + 10 INFO findings — separate prioritization
- F-04-03 regression — separate sortie (ADR-0156 ESLint enforcement first)

## Dispatch

3 parallel build agents (sonnet) per chunk:

- **Agent W (WH-01)**: webhook schema fix + idempotency key + error surfacing
- **Agent S (CT-01)**: shift-lifecycle gatedMutation wrap, model `timeline-template/tools.ts`
- **Agent P (CT-02)**: payroll pathway decision — default execute, else ADR amendment

F-09-01 handled inline by orchestrator (<15min trivial doc edit).

## Tasks

- [ ] F-09-01 — ADR-0322 RESERVED row added to decision log (inline)
- [ ] WH-01 — docuseal route schema fix shipped + verified
- [ ] CT-01 — shift-lifecycle gatedMutation wrap shipped + typecheck
- [ ] CT-02 — payroll pathway decision + execute (code OR ADR amendment)
- [ ] Typecheck 0 errors per affected package
- [ ] No regression in PR #432 closures (audit slice cross-check)
- [ ] HANDOFF written
- [ ] PR to development

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors on `@smartout/ai` + `web`
- [ ] WH-01: `engine_event` insert columns match `database.types.ts` exactly; `.catch` logs error
- [ ] CT-01: `publishShift` + `approveShift` use `gatedMutation()` like timeline-template reference
- [ ] CT-02: either `gatedMutation()` wrap shipped OR ADR amendment accepted + linked
- [ ] F-09-01: `0000-decision-log.md` shows ADR-0322 RESERVED row
- [ ] Decision log updated (any ADR amendments)
- [ ] HANDOFF-audit-2026-05-20-followup-hi-sweep.md written

## References

- Audit synthesis: `docs/audits/2026-05-20-adr-contract-validation-02/00-SYNTHESIS.md`
- ADRs: 0079 (DocuSeal webhook), 0156 (cascade portability), 0173 (capability boundary), 0204 (gated mutation), 0240 (delegation), 0322 (RESERVED)
- L-0176 (docstring lying about gate compliance)
- L-0177 (silent fallback on row-not-found)
- Reference pattern: `packages/ai/src/capabilities/timeline-template/tools.ts` (correct gatedMutation usage)
- Previous sortie: PR #432 (`docs/handoffs/HANDOFF-audit-2026-05-20-high-sweep.md`)
