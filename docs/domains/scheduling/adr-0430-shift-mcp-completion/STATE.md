---
sortie: adr-0430-shift-mcp-completion
domain: scheduling
state: S9
sub_state: closed
tier: T2
test_mode: continuous
design_link: n/a (P0 regression completion — no Cloud Design)
adr: ADR-0430
adr_path: docs/decisions/0430-core-structure-reform-shift-zone-m2m.md
adr_status: implemented
parent_sortie: adr-0430-shift-zone-m2m (S9 closed; this is its L-0348 remediation)
created_at: 2026-05-29T00:10:00Z
updated_at: 2026-05-29T01:00:00Z
closed_at: 2026-05-29T01:00:00Z
merge_sha: f54248574
campaign: development (sortie from main; merged to development @ f54248574 via /close-feature)
worktree: removed (close-feature success)
import_mode: false
structural_block: "suspended — Agent/Task tool NOT exposed this session (per memory feedback_hard_rule_8_vs_tool_layer). Pontus mandate 2026-05-29 'ingen spørsmål, komplett delivery' = Path 1 endemic auth. T2 sortie → Path 1 applies cleanly (orchestrator self-writes via Edit/Write/Bash, atomic per-plan commits). NO sub-agent dispatch possible."
---

# STATE — adr-0430-shift-mcp-completion (P0 regression: 3 unmigrated write surfaces)

> Remediation sortie for ADR-0430 Phase b. Phase b's READ/WRITE rewrite was capability-layer-scoped
> (packages/ai + web add-shift-action.ts) and missed two standalone write surfaces + one public EF.
> **L-0348, 4th occurrence.** The deferred AC-4a.10 live-invoke gate (now MANDATORY here) would have caught all three.

## Tier rationale

**T2** — mechanical completion mirroring an already-shipped, council-vetted pattern (add-shift-action.ts).
No new schema, no new ADR, no irreversible ops. The only non-mechanical part is mirroring the
department_id resolution + zone_ids→shift_zone write that already exists in web. No G8 visual accept (no UI).

## Scope (3 CRITICAL survivors + supporting)

| # | File:line | Defect | Plan |
|---|-----------|--------|------|
| 1 | `services/shift-mcp/src/tools/create-shift.ts:58` | INSERT sets `zone` (dropped col → PGRST204) + NO `department_id` (M1 NOT NULL → null-violation). Doubly broken. | PLAN-1 |
| 2 | `services/shift-mcp/src/tools/update-shift.ts:68` | sets `zone` (dropped col → PGRST204) | PLAN-1 |
| 3 | `supabase/functions/workspace-api/handlers/schedules.ts:40` | public `GET /v1/shifts` raw SQL `SELECT … zone …` (dropped → SQL error). DOCUMENTED ACTIVE. | PLAN-2 |
| 4 | `services/shift-mcp/src/types/shift.ts:54,80` | Zod advertises `zone` → callers keep sending it | PLAN-1 |

## Contract micro-decision (orchestrator, no council — not ontology-grade)

Public `GET /v1/shifts` previously exposed `zone` (scalar). M4 dropped it. **DECISION: expose `zones[]`**
via `shift_zone` → `zone(name)` join (ADR-0430-coherent; the field existed before so silent-drop = breaking).
Update landing API docs (`apps/landing/src/app/docs/api/page.tsx`) to match. Rationale: dropping the field
entirely would silently break documented API consumers; `zones[]` is the M:N-correct successor.

## Canonical pattern to mirror (the only non-mechanical part)

Web `apps/web/src/app/dashboard/_actions/add-shift-action.ts`:
- **dept resolution** (lines ~243-280): `departmentSessionId → department_session.department_id` (strongest) ‖ `departmentId` direct ‖ else 4xx block. The DB trigger `schedule_shift_derive_department_id` fires only on UPDATE OF position_id, NOT on INSERT — so create MUST resolve department_id explicitly.
- **zone forgery defense** (Rule 7, lines ~314-345): per zone_id, verify (a) zone belongs to workspace, (b) zone.location_id ∈ department_location for this dept. Fail-fast, no silent fallback (L-0177).
- **zone write** (Rule 4, lines ~415-470): shift_zone is keyed by `(shift_session_id, day_line_id)`, NOT schedule_shift_id. After INSERT schedule_shift, the `ensure_shift_session` trigger materializes shift_session + shift_session_day_line; query them, then INSERT one shift_zone row per zone with denormalized location_id. Compensating DELETE of schedule_shift if no session/day_line (MF-B).

shift-mcp adapts this WITHOUT `mutateWithGate` (standalone Hono MCP service uses its own `supabaseAdmin`).

## Gate history

| Gate | State | Result | Timestamp | Note |
|------|-------|--------|-----------|------|
| G1 | S1 | PASS | 2026-05-29 | Design-link n/a; source = VERIFIED FINDINGS + add-shift-action canonical pattern. |
| G2 | S2 | PASS | 2026-05-29 | INVENTORY = the 4 verified findings + voice-agent clean (0 zone refs) + mobile create_shift DEPRECATED (ADR-0270). |
| G3 | S3 | PASS | 2026-05-29 | No open questions; pattern is fixed. Contract micro-decision resolved by orchestrator. |
| G4 | S4 | PASS | 2026-05-29 | No SPEC needed — completion sortie. Scope = this STATE.md + plans. |
| G5 | S5 | PASS | 2026-05-29 | 2 plans, continuous mode. Auto-pass (Pontus delegated "complete delivery"). |
| G6 | S6 PLAN-1 | PASS | 2026-05-29 | shift-mcp tsc --noEmit 0 errors @ 8d3624e99; 0 scalar zone survivors; zone_ids + dept resolution present. |
| G6 | S6 PLAN-2 | PASS | 2026-05-29 | EF zones[] subquery @ 1cffdcba4; landing docs; E2E rewrite (my 2 specs 0 tsc errors). |
| MANDATORY live-invoke | S6 | **PASS — 10/10** | 2026-05-29 | @ 952cf3adc. create dept-resolve+2 shift_zone rows; create no-dept→error; create forged-zone→error; update reconcile A,B→{Terrasse}; GET /v1/shifts EF subquery executes+returns zones[]. Caught real update bug (empty updateData coerce) static tsc missed. **L-0348 CLOSED.** Result: reports/live-invoke-result.txt |
| G7 | S7 | AWAITING | — | close-feature.sh turbo typecheck gate. RAM-gated (need >6500Mi). |
| G8 | — | N/A | — | No UI surface. Reduced acceptance met: live-invoke green + my-file tsc clean. |

## MANDATORY GATE (closes L-0348)

Node-script live-invoke against local Supabase (`npx supabase start`):
- `create_shift` with department resolution + zone_ids → assert row created, shift_zone rows present
- `update_shift` with zone_ids reconcile → assert shift_zone updated
- `GET /v1/shifts` → assert returns `zones[]`, no SQL error

Must be GREEN before close. This is the gate AC-4a.10 deferred in Phase b.

## Plans

| # | File | State | Scope |
|---|------|-------|-------|
| 1 | `plans/PLAN-1-shift-mcp-completion.md` | DRAFTED | create-shift.ts + update-shift.ts + types/shift.ts (Zod) — dept resolution, zone_ids→shift_zone, emit zones[] |
| 2 | `plans/PLAN-2-ef-handler-docs-e2e-live.md` | DRAFTED | workspace-api/handlers/schedules.ts (zones[] join) + landing docs + E2E rewrite + MANDATORY live-invoke |

## Next action

READY FOR CLOSE. All gates green:
- PLAN-1 + PLAN-2 built (Path 1 self-write; Agent tool unavailable this session).
- Diff-scoped turbo typecheck: 10/10 tasks exit 0 (apps/e2e, apps/landing, services/shift-mcp).
- MANDATORY live-invoke: 10/10 (L-0348 CLOSED).
- JOURNEY-adr-0430-shift-mcp-completion.md (status: verified) + HANDOFF written.
- No new migrations (timestamp gate trivially clean). ADR-0430 already registered (implemented).

Run /close-feature → merge feat/adr-0430-shift-mcp-completion to development. Pontus pre-authorized.
