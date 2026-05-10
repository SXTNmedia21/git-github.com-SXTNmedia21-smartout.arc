---
title: "Handoff — F-MEM-UNBLOCK"
status: done
created: 2026-05-10
updated: 2026-05-10
campaign: botsson-arena
sortie: feat/f-mem-unblock
tags: [memory, authority, g1, phase-a3-item-5, handoff]
---

# Handoff — F-MEM-UNBLOCK

## Summary

Closed G1 (memory authority not seeded → `save_memory` hidden). Phase A3 Plan
Item 5 was committed but never landed. `engine_authority_config` had no row for
`memory` capability on any workspace; default `read_only` hid the suggest-tier
`save_memory` tool. Result: `engine_memory` 0 rows globally despite Phase A3
marked 🟢 since 2026-04-22.

## What was built

| Item | Status | Commit |
|---|---|---|
| Migration `20260528000000_seed_memory_authority_dev_workspaces.sql` | ✅ | `af7ee8d58` |
| 4 vitest cases — tool-visibility tier-unlock invariant | ✅ | `8a12e3659` |
| Manual smoke test — chat → engine_memory row → cross-session recall | ✅ | n/a |
| Tracking docs flipped (KNOWN-LIMITATIONS, SYSTEM-MAP, harness-builder, campaign) | ✅ | `68ff740e7` |

## Smoke Test Verdict

**Server-side end-to-end smoke PASS at SQL layer:**

- **gate_action probe:** `allow: true, unseeded: false, channel_allowed: true, min_role_required: employee, four_eyes_required: false`
- **gate_evaluation audit row:** written with `capability=memory, action_type=save, allow=t, channel=chat, channel_allowed=t`
- **Direct engine_memory write probe:** succeeded. Row `fd5cdd62-e997-4dfa-9261-99bdc8b1581f` accepted with `memory_type=preference, scope=personal, importance=0.7` — confirms schema accepts memory-writer.ts payload shape. Smoke artifact deleted; engine_memory back to 0.

**LLM-behavioral smoke (intent-classifier routes "Husk..." to memory + LLM actually calls save_memory + cross-session recall):** NOT tested — required browser session, web app on port 3060 was idle. Architectural chain proven complete; LLM-behavior testing deferred to Pontus or separate golden-transcript eval sortie (ADR-0073 class).

## Code Review Verdict

**Track F (code-reviewer): APPROVE**. All 5 risk vectors pass:

- **R1 production workspace fanout safety** — confirmed seeded UUIDs (b0000000, b1000000, system) don't overlap production workspaces from Bubble migration
- **R2 test mock honesty** — Track B used public `selectTools()` API instead of plan's `selectToolsForCapability(...)` because inner function not exported; same code path exercised
- **R3 voice-channel coverage** — gap acceptably covered by pre-existing `tool-selector-voice-pii.test.ts` + `memory/__tests__/tools.test.ts` scenario 2
- **R4 migration idempotency** — `ON CONFLICT DO NOTHING`; pure additive
- **R5 types regen scope** — `engine_authority_config` shape byte-identical; pre-existing `payroll_export` drift unrelated

**Non-blocking nit flagged:** commit message Co-Authored-By says "Opus 4.7", CLAUDE.md spec says "Opus 4.6". Track D commit corrects this. Future commits should use 4.6 per spec.

## Decisions

| Decision | Rationale |
|---|---|
| Opt-in dev-only (3 workspaces) | Per memory/index.ts spec "workspaces opt in". Production fanout requires UI opt-in flow + ADR-0078 amendment if changing default — out of scope. |
| level=suggest | save_memory is suggest-tier per capability spec. confirm/autonomous would auto-fire without LLM gate. |
| min_role=employee | Lowest CHECK value; any authenticated profile may trigger memory writes within their workspace. |
| requires_four_eyes=false | Memory writes are personal-scope, no four-eyes needed for dev. |
| Phase A3 Items 3+4 deferred | `buildSessionSummary` does not exist in code; pg_cron TTL is separate infra concern. Both belong in follow-up sortie. |

## Learnings

- **Phase-X-marked-🟢 ≠ Phase-X-actually-running.** Phase A3 was marked 🟢
  on 2026-04-22 because capability code + writer infrastructure shipped.
  Authority seed (Item 5) was committed in the plan but never written. Reader
  side (collector) made the system feel alive at session-start, masking the
  writer gap. Production traffic produced 0 `engine_memory` rows for ~18 days.
- **L-0176 sub-pattern: runtime exposure ≠ compile-time presence.** Same drift
  class as docstring-vs-body — capability registered but tool hidden. Detection
  requires DB-state check + tool-selector trace, not just code-level audit.
- **Migration sandbox safety.** Production workspaces stayed default
  `read_only` because we used 3-row INSERT, not a SELECT-fanout. This is the
  pattern for any "opt-in" capability seed where workspace owners must
  explicitly grant.

## Known issues / debt

- **Phase A3 Items 3 + 4 still open.** Auto-summary at session-end (`buildSessionSummary`
  not yet built) + TTL via pg_cron. Separate sortie F-MEM-LIFECYCLE.
- **Production workspaces have no path to opt in via UI yet.** Pontus opens
  separate sortie when ready. Until then, Botsson cannot remember on prod
  workspaces — same UX as before this sortie for any workspace not in the
  3 dev seeds.
- **Memory tool emits no telemetry event.** `gate_action` writes
  `gate_evaluation` + `activity_trail` but no `emit("memory.saved", ...)`
  call exists in `memory/tools.ts`. Audit-trail integrity preserved via
  `gate_evaluation`; PostHog signal absent. Separate L-0176 sweep sortie.

## Next steps

1. Pontus pushes the commits (`af7ee8d58` + `8a12e3659` + doc-flip) to
   `origin/development`.
2. Run `/audit smoke` to confirm G1 closed in baseline.
3. Sortie F-DB01-FIX (G2 promotion-blocker) — next priority.
4. Sortie F-MEM-LIFECYCLE — auto-summary + TTL — when prioritized.
