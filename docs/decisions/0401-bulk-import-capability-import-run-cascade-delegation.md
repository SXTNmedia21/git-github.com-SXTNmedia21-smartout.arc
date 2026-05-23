---
title: "bulk_import Capability — Dedicated import_run Table + Cascade-Delegated Commit Pipeline"
id: ADR_0401
status: accepted
layer: decision
created: 2026-05-23
updated: 2026-05-23
---

# ADR-0401: bulk_import Capability — Dedicated `import_run` Table + Cascade-Delegated Commit Pipeline

## Context and Problem Statement

Pontus needs drag-drop Excel/CSV migration of (1) daily kjøreplan (time + location + tasks) and
(2) vaktliste (employee + start/stop + department) into the live Smartout workspace. Council
2026-05-23 verified that no existing capability covers this surface and that attempting to extend
the four frozen capabilities (per ADR-0173) would violate the boundary. Three architectural
forks were locked by Pontus (Phase 6):

1. **Schema home:** dedicated `import_run` table — NOT a new `change_proposal.kind` value.
   Supervisor evidence: payload size (full row arrays), lifetime (parsed → previewed →
   awaiting_resolution → applied/failed), idempotency pattern (sha256 file + row hashes), and
   RLS pattern (admin-only INSERT) all diverge from existing `change_proposal` consumers.
2. **Cross-namespace writes:** cascade-delegation per ADR-0356 — NOT direct table writes from
   capability tools. Mirrors S2/S3 payroll pattern (`actor_capability` + `delegated_via` in
   `properties.data` JSONB at every delegated emit). Preserves ADR-0173 frozen-4 boundary.
3. **Profile-stub creation:** FORBIDDEN. DB-tracer evidence: FK chain
   `auth.users → user_identity → company_member → profile` requires Supabase Auth Admin API —
   not callable from SQL-only capability. Capability MUST reject any FK-chain attempt and
   route unresolvable employees through invitation flow (Sortie B `requires_onboarding_first`
   bucket).

Council L-0147 self-reversal: 6th precedent (schema placement REVERSED in Phase 5 from Phase 3
chair's "extend change_proposal" verdict after Supervisor evidence; column naming REVERSED
from `payload` to `changes` per DB-tracer; namespace naming REVERSED from `migration` to
`bulk_import` to avoid collision with SQL-migration term in 400+ files).

L-0316 6th + 7th occurrences: ADR slots reserved for this sortie pre-empted twice cross-branch.
(1) 6th: slots 0398+0399 taken by wt-5 (feat/inline-confirm-card-phase1) for InlineConfirmCard +
Channel Platform Descriptors — discovered 2026-05-23 end-of-prior-session via cross-branch grep;
shifted +2 to 0400/0401/0402/0403. (2) 7th: slot 0400 then taken by wt-1
(feat/employee-onboarding-wizard) for Welcome Wizard State Lifecycle Constraints at commit
a9f95d6f4 — discovered during Sortie A Task 1 implementer pre-flight reservation re-check
(implementer correctly reported BLOCKED rather than auto-bumping); shifted +1 more.
Final reservation: 0401 + 0402 + 0404 (with 0403 reserved for Sortie C retroactive
attachment-routing ADR). Total drift from V1 reservation: +3 slots.

## Decision Drivers

- No capability exists for bulk spreadsheet migration; the surface (admin drag-drop, irreversible writes, large payload) is architecturally distinct from all frozen-4 capabilities.
- `change_proposal` diverges on payload size, lifetime, idempotency pattern, and RLS — extending it would conflate governance (C4) with migration tooling semantics.
- Cross-namespace writes (schedule_shift, session_task, profile) require delegation pattern to preserve ADR-0173 frozen-4 boundary.
- Profile stub creation via SQL-only capability is structurally impossible (FK chain requires Auth Admin API).
- Voice and mobile surface bans apply: irreversible writes (ADR-0288) + Compose verb (ADR-0133).

## Considered Options

1. **Extend `change_proposal` with a new `kind` value for bulk import** — Rejected: payload size, lifetime, idempotency, and RLS pattern all diverge from existing consumers; would conflate C4 governance semantics with migration tooling.
2. **Dedicated `import_run` table in a new `bulk_import` capability namespace** — Chosen: matches payload, lifetime, and idempotency requirements; preserves clean capability boundary; cascade-delegation handles cross-namespace writes.
3. **Direct writes from capability tools to `schedule_shift`, `profile`, etc.** — Rejected per ADR-0173 frozen-4 boundary; ADR-0356 delegation pattern is the correct cross-namespace write path.

## Decision Outcome

Chosen option: **"Dedicated `import_run` table + new `bulk_import` capability namespace"**, because payload size, lifetime, idempotency pattern, and admin-only RLS all diverge materially from `change_proposal` consumers, and the frozen-4 boundary (ADR-0173) cannot accommodate direct cross-namespace writes without cascade-delegation (ADR-0356).

## Rules & Consequences

### Positive

- Drag-drop migration unblocked for hospitality go-lives (Pontus's tom-tabell problem).
- Frozen-4 boundary preserved — ADR-0173 still load-bearing.
- Audit trail complete — every delegated write traceable to `bulk_import` actor via `properties.data.actor_capability`.
- Idempotency at two layers — re-uploading same file is a no-op; partial re-import skips already-applied rows by row-hash.

### Negative / cost

- New capability surface = new authority config rows (4) + new intent classifier entry + new system prompt prose. Costs ~150 tokens per agent turn (system prompt overhead).
- `import_run` payload can be large (full row JSONB) — admins migrating 100+ shift files hit storage growth. Mitigation: retention policy in Sortie D (out of v1 scope).
- Sortie C helper tools on sibling capabilities (`scheduler`, `task`, `invitation`) require matching ADR-0356 audit symmetry — easy to miss one. Trust-Gate per-tool check at Sortie C close mandated; explicit emit-symmetry test required.

### Agent Impact

- **Good, because** existing `scheduler`, `task`, `invitation` capabilities receive new delegation-only helper tools in Sortie C — no API surface change for existing consumers.
- **Bad, because** `commit_batch` (Sortie C) must call three separate capability helper tools; any missing emit-symmetry in one tool breaks the audit trail silently.
- **Forbidden patterns (codified):** Direct INSERT to `profile`, `department`, `location` from any `bulk_import` tool — rejected at code-review per ADR-0173. Forwarding raw `workspace_id` from request body — must derive server-side per ADR-0151 + L-0177. Silent FK-resolution fallback — must fail-fast with explicit 4xx per L-0177.

## Detailed Decision Notes

### 1. Register `bulk_import` as a new capability namespace

- Location: `packages/ai/src/capabilities/bulk_import/`
- Authority pattern: `direct_admin` (service_role; per DB-tracer the `api_key` INSERT policies do not exist on department/location/profile, and the capability runs admin+ only)
- Allowed channels: `chat` only. Voice forbidden (ADR-0288 — irreversible writes, largest blast radius capability ever added).
- Mobile: forbidden (ADR-0133 — Compose verb is web-only).
- Tools (final lineup across Sorties A/B/C):
  - `parse_spreadsheet` (Sortie A — read-only)
  - `preview_batch` (Sortie B — write to `import_run` only)
  - `resolve_ambiguity` (Sortie B — patches `import_run.resolver_decisions[]` only)
  - `commit_batch` (Sortie C — calls SECURITY DEFINER RPC `fn_commit_bulk_import`)
- Intent classifier enum entry + system prompt prose landed Sortie 0 (ADR-0112 6th pre-flight check observed). MIME-type deterministic dispatch (`.xlsx`/`.xls`/`.csv`) bypasses the classifier in normal operation per ADR-0403 (Sortie C retroactive).

### 2. Schema — dedicated `import_run` table

Key points (see spec §Data Model for full column list):

- `excel_sha256` UNIQUE per workspace — file-level idempotency
- `row_hashes TEXT[]` — row-level idempotency for partial re-imports
- `parsed_rows JSONB` immutable post-parse
- `resolver_decisions JSONB` + `user_overrides JSONB` mutable via Sortie B
- 3-bucket classification (`ready_to_assign`, `pending_rows`, `rejected_rows`) populated Sortie B
- `status` CHECK: `parsed | previewed | awaiting_resolution | awaiting_approval | applied | failed | cancelled | expired`
- `initiator cascade_initiator NOT NULL DEFAULT 'admin_manual'` — cascade provenance per existing enum
- JWT-only RLS (no api_key path) — capability runs service_role per `direct_admin` pattern
- `UNIQUE (workspace_id, excel_sha256)` — same file in same workspace = same import_run row (idempotency; admin override via Sortie C `force_reimport=true` flag)

### 3. Cross-namespace writes via cascade-delegation (Sortie C)

`commit_batch` MUST NOT write directly to `schedule_shift`, `schedule_day_task`, `profile`,
`department`, or `location`. Instead, it MUST delegate via new helper tools added in Sortie C
on the owning capabilities (per ADR-0356):

- `scheduler.create_shift_via_bulk_import(workspace_id, row)` — owned by `scheduler` capability
- `task.create_day_ad_hoc_via_bulk_import(workspace_id, row)` — owned by `task` capability
- `invitation.send_for_workspace_import(workspace_id, email)` — owned by `invitation` capability (when added; falls back to existing tool if naming clashes)

Every delegated INSERT emits with `actor_capability='bulk_import'` and
`delegated_via='bulk_import.commit_batch'` in `properties.data` JSONB per ADR-0356 audit symmetry.

### 4. Profile-stub creation FORBIDDEN

Capability MUST NOT attempt to insert into `profile` directly. Unresolvable employees route
through `requires_onboarding_first` bucket (Sortie B) → invitation flow (Sortie C). Explicit
confirm gate per Pontus decision: "Invitation = real cost + PII flow; deserves intentional
action, not automatic."

## Implementation References

- Sortie A: foundation migration + parse_spreadsheet tool — this PR
- Sortie B: preview_batch + resolve_ambiguity + composer UI
- Sortie C: commit_batch + fn_commit_bulk_import RPC + cascade-delegation helpers

## References

- ADR-0078 — chat-only PII routing
- ADR-0112 — intent-classifier same-commit gate (this ADR observes 6th pre-flight check)
- ADR-0133 — mobile surface boundary (Compose verbs web-only)
- ADR-0151 — server-derived workspace_id
- ADR-0173 — frozen-4 capability boundaries
- ADR-0204 — gatedMutation wrapper (applies to Sortie B+C mutating tools, N/A Sortie A)
- ADR-0287 — ONE emit per gated mutation
- ADR-0288 — voice forbidden for irreversible writes
- ADR-0356 — cascade-delegation actor_capability + delegated_via pattern
- ADR-0377 — telemetry registry+emit same-commit gate
- ADR-0403 — attachment routing MIME-deterministic dispatch (Sortie C retroactive)
- L-0042 — migration timestamp ordering
- L-0083 — engine_authority_config default deny
- L-0176 — docstring drift ban
- L-0177 — silent fallback ban
- L-0292 — ADR-0112 enum-lag (6th occurrence resolved Sortie 0)
- L-0316 — cross-branch ADR collision rule (6th + 7th occurrences — both observed during this ADR's renumber sequence)
- Spec: `docs/superpowers/specs/2026-05-23-bulk-import-design.md`
- Plan: `docs/superpowers/plans/2026-05-23-bulk-import-sortie-a.md`
