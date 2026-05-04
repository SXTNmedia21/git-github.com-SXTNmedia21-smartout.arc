---
name: Auth & Invitation Wave H Council (Phase 5 synthesis)
description: 2026-04-22 Wave H verdict APPROVE WITH CHANGES, rescoped as remediation amendment (not new wave). Briefing's L-0083 4th-occurrence claim falsified by code-trace; real issues are engine_event parity gap + fail-open emit + ADR-0045 silent violation.
type: project
---

# Auth & Invitation Wave H Council — 2026-04-22 (Phase 5 synthesis)

## Final Verdict

**APPROVE WITH CHANGES.** Rescoped as remediation amendment to the 2026-04-20 P1 spec, NOT a new feature wave.
**Trust Gate:** CONDITIONAL PASS (3 conditions enumerated below).
**Mode:** Full quorum (4/4 reviewers + Phase 2.5 fact-check).

## Briefing correction — what changed in synthesis

My Phase 3 review (saved as predecessor in this file's history) accepted the briefing's claim that Wave H was a **4th occurrence of L-0083 (telemetry registered without producers)** and that invitation events had **0 emit sites**. Phase 2.5 + Supervisor + Agent-Coord independently falsified this:

- **Code truth:** 9 event types registered in `packages/telemetry/src/registry.ts`, **13 emit sites** = 6 app-side `emit()` + 4 Edge direct-inserts to `activity_trail` + 3 Server Actions
- **Briefing missed Edge direct-insert pattern** (Deno cannot import `packages/notifications/`, verified via deno.json scan)
- **Real issues are different from L-0083:** engine_event parity gap (5 of 9 events skip `engine_event`), fail-open `.catch` swallows on `emit()`, ADR-0045 silent violation in `create-invitation` Edge Function

This makes Wave H a **remediation amendment**, not a new pipeline. Smaller, safer, more focused scope.

## Three Trust Gate conditions (must close before Wave H lands)

1. **engine_event parity gate** — All 9 invitation event types must write to `engine_event` OR have documented exclusion in `packages/telemetry/src/registry.ts` with rationale. Phase 8 verifies via `packages/telemetry/__tests__/parity.test.ts`.
2. **Fail-open emit audit** — Every `.catch` around `emit()` in invitation paths classified as either intentional per Hybrid C (fail-open on `engine_event` only) or bug-to-fix. Phase 8 verifies via grep + manual classification log.
3. **ADR-0045 amendment landed BEFORE `create-invitation` refactor** — Without amendment, the fix re-violates ADR-0045 in a different way.

## Resolved conflicts (semantic resolution, not duplication)

| Conflict | Resolution |
|---|---|
| Spec form: "v2" vs "amendment" | SAME outcome — new file `docs/superpowers/specs/2026-04-22-auth-invitation-wave-h-amendment.md` with `amends:` frontmatter |
| L-0083 framing | DIFFERENT — code-truth wins. Withdraw L-0083 4th occurrence. New L-0094 = engine_event parity gap |
| Outbox storage: extend `notification_outbox` vs new `dev` schema | PARTIAL OVERLAP — chose extend with `dispatch_mode` enum. RLS + `DEFAULT 'production'` mitigate Agent-Coord's leak concern |
| Dev-outbox UI: stub utility vs full Nordic Split admin | Frontend Designer wins — stub utility with 3 affordances + `notFound()` in prod |
| Dispatch placement: `packages/notifications/` vs `_shared/dispatch.ts` | Agent-Coord wins — Deno cannot import packages/. ADR-0045 amendment recognizes two-surface dispatch (Node + Deno) |
| Q7 emit failure semantics | Adopt Agent-Coord Hybrid C — fail-fast on `activity_trail`, fail-open on `engine_event` + ADR-0152 amendment |
| Q15 reverify-OTP | Adopt Supervisor flag — must be existing-credential confirmation, not new-credential issuance |
| CORS sweep size: "24+" vs 48-occurrence/~23-function | Treat as 48-occurrence/~23-function sweep. Bundle as 3 PRs in Wave H, not single PR |

## Wave H scope — what ships

| Item | Phase 8 gate |
|---|---|
| Spec doc `docs/superpowers/specs/2026-04-22-auth-invitation-wave-h-amendment.md` | Steward writes |
| ADR-0045 amendment (two-surface dispatch: Node + Deno) | Phase 8 registers |
| ADR-0152 amendment (Hybrid C emit failure semantics) | Phase 8 registers |
| ADR-0171 NEW — engine_event parity contract | Phase 8 registers |
| Migration: extend `notification_outbox` with `dispatch_mode` enum | Migration review |
| `supabase/functions/_shared/dispatch.ts` Deno-native dispatcher | Trust Gate condition 3 |
| Refactor `create-invitation` to use `_shared/dispatch.ts` | Trust Gate condition 3 |
| `engine_event` parity fix on 5 gap events | Trust Gate condition 1 |
| Fail-open audit + Hybrid C classification log | Trust Gate condition 2 |
| Dev-outbox stub utility (3 affordances, `notFound()` in prod) | Design review |
| `/update-password` ghost route closure (carry from prior council) | Phase 8 |

## Defers (NOT Wave H)

- 48-occurrence / ~23-function CORS sweep — separate sub-sortie, 3 sequenced PRs
- Real-time view-tracking on dev-outbox — backlog
- Inbucket-polling UI — backlog
- Q15 reverify-OTP if it issues new credentials — separate spec

## Knowledge to capture (Phase 8)

**ADRs:**
- ADR-0045 amendment — two-surface notification dispatch
- ADR-0152 amendment — Hybrid C emit failure semantics
- ADR-0171 NEW — engine_event parity contract

**Learnings:**
- L-0094 — engine_event parity gap on partial telemetry adoption
- L-0095 — Briefing staleness blind spot for Edge direct-inserts (Deno can't import packages/)
- L-0096 — ADR-0045 silent violation pattern (runtime-constraint violations evade import-graph audits)
- L-0097 — 4th confirmed audit-inflation occurrence (Web Perf, Gate Migration, Year Wheel Redesign, Auth-Invitation Wave H)

## Risk highlights

- **High:** ADR-0045 amendment landing AFTER refactor would re-violate. Trust Gate condition 3 enforces ordering.
- **High:** Hybrid C misapplied — someone fail-opens on `activity_trail`. Lint rule + Phase 8 grep on `\.catch.*activity_trail`.
- **Medium:** Two dispatch surfaces drift. Shared schema + integration test round-tripping invitation through both surfaces.
- **Medium:** L-0083 framing leaks into other councils. L-0094 distinguishes "missing producers" from "parity gap" explicitly.

## Carry-forward from Phase 3 (still load-bearing)

- Wave H must be separate spec doc, NOT in-place edit of accepted P1 (alignment with Agent-Coord)
- ADR-0045 silent violation in `create-invitation` Edge Function — confirmed and amplified
- 6 prior preconditions from 2026-04-20: Wave H closes 2, leaves 1 open (`/update-password`, 30-min task), 3 moot
- Existing `notification_outbox` + `process-notifications` pipeline is the canonical path; bypass = forbidden parallel system

## Phase 3 findings now superseded

- L-0083 4th occurrence claim — WITHDRAWN
- "Edge Functions explicitly cannot emit() — 0 emit sites" — FALSE (4 Edge direct-insert sites verified by Phase 2.5)
- "9 events registered, 0 emit sites" — FALSE (13 emit sites)
