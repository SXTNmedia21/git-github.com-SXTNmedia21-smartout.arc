---
title: "Handoff — cascade-delegation-tools"
status: done
feature: cascade-delegation-tools
created: 2026-05-17
updated: 2026-05-17
module: MODULE_AGENT_SDK
tags: [handoff, cascade, delegation, capability, payroll, phase-7d]
---

# Handoff — cascade-delegation-tools

## Summary

Sortie 3 of 3 in Phase 7d-followup execution series. Shipped `cascade`
capability with 2 delegation tools per ADR-0356. Generalizes the ADR-0240
journey_authoring → journey.publish_mission delegation precedent across all
cross-namespace capability writes. Commit 326999a1f. 9/9 cascade-specific tests
pass; 582/582 total `@smartout/ai` tests pass; typecheck 8/8 PASS. Authority
seed migration `20260618200000` applied locally. Phase 7f payroll capability
tools (`setup_workspace_tariff`, `change_workspace_tariff`,
`add_supplement_override`) now UNBLOCKED — both required delegation tools exist
with proper gate + emit + L-0177 + ADR-0152 envelope.

---

## Decisions Made

### `cascade` is a new capability, not an addition to an existing one

Named per ADR-0356 naming convention. Justifies new capability creation despite
ADR-0173 frozen-4 freeze on new cross-namespace writes — the delegation pattern
itself is the structural change that makes frozen-4 safe across namespaces.
The cascade capability owns the writes; payroll capability calls the cascade
tools. ADR-0173 frozen-4 boundary is preserved at the delegation layer, not
bypassed.

### `defaultAuthority='autonomous'` on delegation capability

Delegation tools assume the CALLER has already passed its own authority gate per
ADR-0356 §"Gate convention". The cascade tool's gate fires SECOND as an
independent cross-namespace defense — it is NOT a double-confirmation of the
same decision. Documented in capability description in `cascade/index.ts` to
prevent future confusion. Seed migration `20260618200000` sets `autonomous`
authority for both tools. If a workspace requires admin-confirm on
`cascade.bind_workspace_union`, a workspace-scoped row in
`engine_authority_config` overrides the default.

### `addSupplementRuleTool` writes to `public.supplement_rule` (not `payroll`)

Per ADR-0351 amended Decision Outcome target choice (Option C → TRIGGER,
amended code-trace authority). NOT `payroll.supplement_rule`. The
`payroll.` schema hosts provenance + calculation tables; `public.supplement_rule`
is the workspace-configuration table that the calc engine reads. This placement
is consistent with ADR-0351 §A amended (supplement_rule stays in public schema;
tariff enforcement moves from CHECK to TRIGGER).

### Tariff-floor PG exception caught and transformed to ADR-0152 envelope

The BEFORE INSERT trigger (Sortie 2 Part G) raises a PostgreSQL EXCEPTION with
a message matching `supplement_rate_below_tariff_floor` containing `floor=N` and
`rate=M` substrings. The cascade tool catches `insertErr`, regex-parses floor
and proposed values from the message, sets `execResult` to the structured
envelope, then throws to signal exec failure. The outer catch reads `execResult`
FIRST (before `MutateWithGateError` instance check) to surface the ADR-0152
envelope `{ code: 'SUPPLEMENT_BELOW_TARIFF_FLOOR', aml_ref: '§14-15',
floor: N, proposed: M }`. Test T8 covers the round-trip.

### workspace_id in INSERT is always `ctx.workspaceId` (not body)

In `addSupplementRuleTool`, the body-supplied `workspace_id` is used only for
the cross-workspace block check. The actual INSERT value is always
`ctx.workspaceId` (server-derived). This is a final-layer defense against any
residual forgery risk — even if the cross-workspace check were bypassed, the
DB row would still carry the authenticated workspace_id. Same class as
ADR-0151 body-vs-ctx workspace_id anti-pattern.

---

## Learnings Discovered

### mutateWithGate exec-error preservation pattern

When a delegation tool needs to surface a structured ADR-0152 error from a PG
trigger exception that fires inside `gatedMutation`, the inner exec callback
must CAPTURE the structured result into an outer-scope variable (`execResult`)
THEN throw — rather than throw immediately. `mutateWithGate` wraps all exec
callback failures as `MutateWithGateError('execute_failed', message)`, which
erases the structured code. By capturing `execResult` before throwing, the
outer catch can check `execResult !== null` FIRST and surface the original
structured envelope before falling through to the `MutateWithGateError` branch.
Pattern worth promoting if a sibling delegation tool needs the same structured
DB-exception-to-envelope transform.

### Stop-hook scoped-typecheck false failures mid-agent-session

In the agent's editing session, the stop hook scoped-typecheck reported failure
between `pnpm install` completion and the subsequent edit operations — `npx tsc`
printed "This is not the tsc command you are looking for" from a transient
node_modules state. The hook reported failure but the commit succeeded and the
final verification (582/582 tests, 8/8 typecheck) passed. Pattern: agent reports
correct final outcome; stop-hook output mid-session can be misleading when
node_modules is in a transient state. Not a sortie blocker. Same class as the
Turbo cache cross-worktree trap (L-turbo-cache-cross-worktree) — context vs
execution environment mismatch.

---

## Known Issues / Debt

### Phase 7f payroll capability tools not yet written

`setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override` —
all three capability tools remain unshipped. This sortie unblocks them by
providing the required delegation tools. Phase 7f sortie is the next step.

### Frozen-4 boundary enforced by convention + audit, not static analysis

ADR-0173 + ADR-0356 require payroll tools to delegate writes via cascade tools.
The enforcement is: (a) code review verifies payroll files don't reference
`workspace_union_binding` directly, (b) audit-grep `activity_trail WHERE
delegated_via IS NULL AND entity_type='workspace' AND event_type LIKE
'%union_binding%'` surfaces violations post-hoc. A TypeScript lint rule
enforcing capability-namespace table isolation at CI time would close the gap
but is out of scope for this sortie.

### ADR-0355 §A Open Question §2 (created_by NOT NULL vs sentinel UUID)

From Sortie 2 HANDOFF: the question of whether `created_by_profile_id` on
`workspace_union_binding` should be NOT NULL (requiring a sentinel UUID for
platform-seeded rows) vs NULLABLE (allowing NULL for no-profile-context rows)
remains unresolved. Production cutover decision. Does not affect Sortie 3
(delegation tools always have a profileId from ctx).

### Direct INSERT to `workspace_union_binding` is RLS-allowed but ADR-0356 violation

Service-role clients bypass user-facing RLS. A payroll capability tool that
writes directly to `workspace_union_binding` instead of delegating would land
the INSERT in DB without raising an error — the violation is silent. Detection:
audit query `activity_trail WHERE delegated_via IS NULL AND entity_type='workspace'
AND event_type LIKE '%union_binding%'`. Future heartbeat job could automate
daily detection and auto-create Linear ticket tagged `adr-0356-violation`.

### Authority seed migration `20260618200000` sets `autonomous` workspace-agnostic

Default authority is `autonomous` for both delegation tools. If Pontus wants
admin-confirm on `cascade.bind_workspace_union` for any specific workspace (e.g.,
Strøm Mat & Bar requires manager sign-off before tariff switch), a
workspace-scoped row in `engine_authority_config` with `require_approval=true`
overrides the default without code changes.

### 358 cert-cells carry pre-pivot lineage — BOOTSTRAP-BACKFILL Phase 7c follow-on

Per Sortie 1 HANDOFF: 358 certification cells stamped `lovsen-mcp@v1` carry
pre-pivot rate derivation lineage. Re-derive via `derive_supplement_set` MCP
once Phase 7e bridge code + Phase 7f `add_supplement_override` tool land and
Bubble workspace bindings are seeded with real `union_id` values (not
`'non-bound'`). Requires both cascade delegation tools (now shipped) AND the
Phase 7e lovsen-client bridge (next sortie after 7f).

---

## Next Steps

1. **Phase 7f sortie:** Open `feat/payroll-phase-7f-tariff-tools` sub-sortie.
   Write `setup_workspace_tariff` + `change_workspace_tariff` +
   `add_supplement_override` payroll capability tools. Each calls cascade
   delegation per ADR-0356. Onboarding wizard "Tariff" step UI. Admin drift
   inbox per ADR-0354. Load `payroll-engine-developer` skill before authoring.

2. **Phase 7e sortie (parallel candidate):** Open
   `feat/payroll-phase-7e-lovsen-bridge` sub-sortie. Implement
   `packages/ai/src/lib/lovsen-client.ts` + BFF routes `/api/lovsen/*` per
   ADR-0350 HTTP-via-BFF transport contract. No schema dependency on delegation
   tools — can open in parallel with Phase 7f.

3. **Sequencing:** Phase 7e ships first (bridge code); Phase 7f
   `setup_workspace_tariff` body calls `derive_supplement_set` via the Phase 7e
   bridge. Phase 7e and 7f can open in parallel sub-sorties but 7f wizard
   integration tests require 7e bridge live.

4. **BOOTSTRAP-BACKFILL Phase 7c follow-on:** Re-derive 358 cert-cells via
   `derive_supplement_set` once Phase 7e + 7f land and Bubble workspace bindings
   (Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven) carry real `union_id`
   values via Phase 7f `setup_workspace_tariff`.

5. **Production cutover — Sortie 2 + 3 migrations:** Verify all production
   workspaces have ≥1 admin/owner profile (Sortie 2 Part H skip-guard creates
   silent gap otherwise). Verify authority seed `20260618200000` applied. Smoke
   cascade delegation tools end-to-end after production apply.

6. **Optional heartbeat job:** Automate `activity_trail WHERE delegated_via IS
   NULL AND entity_type='workspace' AND event_type LIKE '%union_binding%'`
   daily detection. Auto-create Linear ticket on hit. Closes the ADR-0356
   convention-only enforcement gap.
