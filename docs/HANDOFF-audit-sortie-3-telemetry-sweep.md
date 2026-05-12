---
title: HANDOFF — Audit Sortie 3, Telemetry Coverage Sweep
status: review
created: 2026-05-06
updated: 2026-05-06
module: telemetry
tags: [audit, telemetry, adr-0004, sortie, handoff]
sortie: feat/audit-sortie-3-telemetry-sweep
worktree: ~/dev/smartout.ai-wt-8
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# HANDOFF: Audit Sortie 3 — Telemetry Coverage Sweep

## Summary

Closes ADR-0004 enforcement gaps from audit Top-10 #7+#8: capability tools and tables shipped post-baseline without telemetry registry coverage. 5 new events registered, 1 zero-emit gap closed.

## Fixes shipped

| # | Commit | What |
|---|---|---|
| F1+F2+F3 | `c67bd7d47` | Registered 5 events: `outreach sms_sent`, `outreach call_initiated`, `engine_world observation_written`, `engine_world status_changed`, `gate_evaluated`. All 3 steps: interface declaration + SmartoutEvent union + EVENT_ROUTING record. |
| F4 | `37a091f0c` | `sendEmployeeContract` emit() in success branch with workspace_id, actor_id, entity_id, recipient_email, expires_at (sentAt + 14 days, mirrors contract-service formula). |
| F5 | SKIPPED | Docker daemon not running, Supabase Local unavailable. Pontus runs post-merge. |

Branch: `feat/audit-sortie-3-telemetry-sweep`. Worktree: `~/dev/smartout.ai-wt-8`. Base: plan + journeys at `18eaa9c88`.

## Architectural decision

**`gate_evaluated` (underscore) is distinct from `gate evaluated` (space).** Existing `gate evaluated` event covers per-capability `callGateAction()` (Pathway A). New `gate_evaluated` covers orchestrator-level `gatedMutation()` composite decision (Pathway B / SS-5). Two distinct emit sites with different payloads. Naming convention follows the codebase pattern of underscore for orchestrator-level vs space-separated for direct call.

**F4 expires_at computed locally.** Contract service response body is not currently captured by `sendEmployeeContract`. Formula `sentAt + 14 days` mirrors contract-service `routes/contracts.ts:382` exactly. If contract-service ever returns a different expiry, capability tool would drift — flag if SS-3 (lifecycle alignment) finds this.

## Verification

```bash
cd ~/dev/smartout.ai-wt-8
pnpm turbo typecheck
# → 46/46 tasks pass, 0 errors
```

## Learnings

### L-NEW-1 — Telemetry registry is 3-step add, not 1-step

When adding a new event to `packages/telemetry/src/registry.ts`:
1. Declare the typed interface (e.g. `interface OutreachSmsSent extends BaseEvent { event: "outreach sms_sent"; ... }`)
2. Add the interface to the `SmartoutEvent` union (line ~7148)
3. Add the EVENT_ROUTING Record entry keyed by the literal event-name string

Skipping step 1 or 2 produces TS2353 "Object literal may only specify known properties" — the Record's key type is `SmartoutEvent["event"]`, derived from the union. Build agent attempted only step 3 multiple times before being directed to all 3.

**Why:** Registry uses closed-union typing for compile-time enforcement of "every emit() call has a registered event". Step 3 alone never typechecks because the literal isn't in the key union.

**How to apply:** Future build agents touching `registry.ts` should be told the 3-step pattern in the dispatch prompt. Add a header comment to `registry.ts` documenting this for future readers (sortie deferral — not done in this sortie). Or extract a `registerEvent()` builder function that does all 3 atomically (architectural change — needs ADR).

### L-NEW-2 — Telemetry events with ambiguous "data field" semantics

`recipient_email` was added as `contract.recipient_email ?? ""` in F4 — empty-string fallback if contract has no email. ADR-0193 governs `workspace_id` + `actor_id` as `NonEmptyString`, but does NOT govern arbitrary data fields. The empty-string fallback is acceptable for non-load-bearing context fields (logs/audit) but propagates "" through PostHog where it may pollute analytics.

**How to apply:** When emit() includes contextual fields beyond the BaseEvent contract, prefer `null` over `""` for explicit "absent" signaling. Future telemetry registry conventions ADR should formalize this (sortie deferral).

## Known issues / debt

- **F5 deferred** — `database.types.ts` still missing `engine_world` table type. Type-unsafe access for any code that touches the table. Pontus runs post-merge:
  ```bash
  supabase start  # or npx supabase start
  pnpm db:gen-types
  git add packages/supabase/src/database.types.ts
  git commit -m "chore(types): regenerate to include engine_world (audit S3-F5)"
  ```
- **`gate_evaluated` registered but no producer wired** — orchestrator `gatedMutation()` is supposed to emit this per ADR-0204 SS-5, but the wire-up is part of SS-5 work which is a separate (larger) sortie. F3 only registers the destination; the emit call site is queued for the SS-5 sortie.
- **`outreach` capability tool not yet built** — F1 registers events for a capability whose tool body doesn't exist yet (only authority seed shipped). When the producer ships, it should emit these events. Until then, registry is forward-declared.

## Next steps

### Pre-merge (Pontus)
1. Review `c67bd7d47` — confirm `gate_evaluated` (underscore) is acceptable vs reusing `gate evaluated` (space). Decision: keep as distinct events.
2. Review `37a091f0c` — confirm `recipient_email: contract.recipient_email ?? ""` empty-fallback is acceptable for this audit-trail field.
3. `pnpm turbo typecheck` — already passing.
4. `close-feature.sh 8` to merge to development.

### Post-merge (Pontus)
1. Run `supabase start` + `pnpm db:gen-types` + commit regenerated `database.types.ts`. Closes audit finding H-01 (slice 07).
2. Optionally wire `emit({ event: "gate_evaluated", ... })` inside `gatedMutation()` — that work is part of SS-5 atomicity sortie, separate scope.

## Closure deliverable status

- [x] Plan: `docs/plans/PLAN-audit-sortie-3-telemetry-sweep.md`
- [x] Journeys: `docs/journeys/JOURNEY-audit-sortie-3-telemetry-sweep.md`
- [x] F1+F2+F3 + F4 shipped + verified
- [x] F5 deferred to post-merge with explicit Pontus runbook
- [x] Typecheck 46/46 pass
- [x] HANDOFF (this file)
- [ ] No new ADRs needed; skip
- [ ] `close-feature.sh 8` — Pontus runs after pre-merge checks above
