---
title: HANDOFF — gatedwrite-pilot (post-WP2 call-site migration reference)
status: ready-for-merge
updated: 2026-04-18
created: 2026-04-18
module: governance
tags: [governance, adr-0091, gatedwrite, call-site-migration, pilot, handoff]
---

## Summary

First call-site migration to `gatedUpdate()` shipped as the reference implementation for the remaining ~90 direct-Supabase-write violations. `people-actions.ts` (6 profile `.update()` sites) now routes through the governance gate, returning `{ok:true, pendingProposal?}` or `{ok:false, error}` per call. Two `packages/supabase/src/gate-client.ts` blockers caught during the pilot were fixed in-flight (hardcoded `.eq("id", ...)` broke `{table}_id` PK convention; `SupabaseGateClient.rpc` type didn't advertise `cascade_gate_write`). Council review caught a consumer-integration gap (component swallowed blocked writes + hid proposal toasts) — fixed via `handleGatedResult` helper + 8 call-site updates in `people-data-table.tsx` before merge.

## Commits

- `1bd63d5d` — docs(plan): add gatedwrite-pilot — call-site migration reference
- `f95ab1df` — refactor(people-actions): migrate 6 profile.update() sites to gatedUpdate + Vitest suite
- `765cccf7` — refactor(people-actions): narrow mock.calls[0] in tests for strict indexing
- `21672fd8` — fix(gate-client): PK column override + typed cascade_gate_write rpc
- `d8eef703` — fix(gatedwrite-pilot): ship handleGatedResult helper + wire consumers

## Decisions made

- **Pilot target:** `people-actions.ts` (profile updates) over `publish-actions.ts` or schedule routes. Self-contained, single gated table, 6 tractable call sites.
- **Error-handling pattern:** Option A from plan — Server Actions return `{ok:true, pendingProposal?}` on propose, `{ok:false, error}` on block. Consumers use `handleGatedResult` helper for uniform three-branch dispatch.
- **Gate-client PK fix:** extend `GateContext` with optional `entityIdColumn` (default `"id"`) rather than rewriting callers to use a different API. Backward-compatible with any existing code that used `.eq("id", ...)` tables.
- **Gate-client RPC typing:** overload union in-file over `Database` interface augmentation — keeps the deliberate structural-typing philosophy of the package.
- **Test co-location:** `gate-client.test.ts` lives at `apps/web/src/app/dashboard/people/_actions/__tests__/` temporarily (packages/supabase has no vitest wiring). Flagged for consolidation in follow-up.

## Learnings

- **Reference patterns get copy-pasted wholesale.** Council rightly insisted on fixing the consumer integration before merge — propagating a bug across 20 migrations would cost 20× the repair.
- **Per-file review misses cross-module contracts.** Supervisor + layer-1 review didn't catch that `people-data-table.tsx` callers didn't destructure the new return shape. Only code-tracer (layer 4 capability-consumer trace) caught it.
- **Hardcoded assumptions in shipped infrastructure.** `gate-client.ts` went through council review in `perf-sprint-wave-1` yet shipped with `.eq("id", ...)` — no callers existed at the time to surface the bug. First pilot is the earliest a runtime-shape assumption gets tested.
- **Plan code sketches are hypotheses, not specs.** The PLAN's sketch used `result.data[0]?.proposal_id` and `result.pendingProposal`; actual `GatedWriteResult<T>` uses `data`, `outcome`, `exceptionReason` with `"proposed"` as a thrown `GateDeniedError` not a returned outcome. Build agent verified before writing — paid off.

## Known issues / debt

- **`capability` strings are free-form.** `"profile:update:role"` etc. can typo silently. Future work: union type exported from `@smartout/supabase/gate-client` so typos become compile errors.
- **`bulkUpdateProfiles` N+1.** Sequential `fetchCurrentProfile` + `gatedUpdate` per profile. RPC is single-entity so N RPC calls is structural; agent opted not to `Promise.all` in this pass to keep error attribution clean. Follow-up can parallelize with per-item try/catch + aggregation.
- **`gate-client.test.ts` location.** Lives in `apps/web/src/app/dashboard/people/_actions/__tests__/` — tests code in `packages/supabase`. Consolidate in a follow-up that adds vitest wiring to `packages/supabase`.
- **418 `no-direct-supabase-write` warnings remain** (down from 424). Next pilots migrate the remaining gated-table sites; non-gated migrations are lower priority.
- **No reusable gate mocks.** `gatedUpdateMock` + `buildClientStub` in the people-actions test file will be copy-pasted by the next migration. Consolidate to `apps/web/src/test-utils/gate-mocks.ts`.

## Next steps

1. **Migrate remaining gated-table call sites** — `schedule_shift` (4 violations in API routes + components), `season` (1 violation in component). Follow the `handleGatedResult` pattern documented in PLAN.
2. **Union `capability` strings** — define `type CapabilityVerb = "profile:update:role" | ...` exported from `@smartout/supabase`.
3. **Parallelize `bulkUpdateProfiles`** — `Promise.all` with per-item aggregation.
4. **Consolidate test mocks** — move `gatedUpdateMock` to `apps/web/src/test-utils/gate-mocks.ts`.
5. **Move `gate-client.test.ts` to `packages/supabase/src/`** — add vitest wiring to the package.
6. **Escalate ESLint rule `warn` → `error`** — only AFTER the remaining 5 gated-table call sites are migrated (schedule_shift + season). Non-gated sites can stay on `warn` until separately migrated.
