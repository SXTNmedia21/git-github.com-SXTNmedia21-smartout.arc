---
title: bulk_import Capability — Design Specification
status: review
updated: 2026-05-23
created: 2026-05-23
module: agents
tags: [bulk-import, capability, cascade, change-proposal, ai-tools, council-verdict]
---

# bulk_import Capability — Design Specification

> **Council verdict 2026-05-23:** APPROVE WITH CHANGES — Reject-in-current-shape, Accept-with-rewrite. Chair Phase 3 reversed-with-refinements (L-0147 6th precedent). 6/6 reviewers (Steward, Supervisor, Agent-Coordinator, Botsson-Harness-Builder, Frontend-Designer, DB-tracer).

## Goal

Enable Pontus (and future admins) to drag-and-drop an Excel/CSV file into BotssonChat → bulk-migrate ~50 shifts (vaktliste) + ~50 daily-plan tasks (kjøreplan) into a workspace, with Botsson dynamically parsing the file, fuzzy-matching employee/department/location names to existing entities (auto-match ≥90% confidence, ask under), and writing all rows atomically via cascade-delegated capability calls.

## Why

Current workflow forces Pontus to manually create 50 shifts + 50 day-tasks through the dashboard UI — minutes per row. A drag-drop bulk pipeline turns a 2-hour data-entry session into a 5-minute confirm-and-commit flow. The capability is the "import" sibling to onboarding's "first-time bootstrap" — onboarding is wizard-scoped, bulk_import is operation-time and re-runnable.

## Locked Decisions (Pontus, Phase 6)

| Decision | Choice | Rationale |
|---|---|---|
| Namespace name | `bulk_import` | Avoids collision with SQL-migration term (400+ files); future-proof for non-spreadsheet bulk operations |
| `schedule_shift.source` value | New `'v3_bulk_import'` | Audit separation between cascade-generated and user-migrated; mirrors `bubble_migration` precedent (ADR-0108) |
| `taskOrigin` tone for imported tasks | Reuse `'adhoc'` violet | Avoids token bloat (ADR-0366); semantically correct (manual origin) |
| `requires_onboarding_first` bucket | Explicit-confirm | Invitation = real cost + PII flow; deserves intentional action, not automatic |
| Stub-employee creation | FORBIDDEN | FK chain `auth.users → user_identity → company_member → profile` technically infeasible from SQL-only capability (DB-tracer evidence) |
| Schema home | Dedicated `import_run` table | Distinct payload size, lifetime, idempotency, RLS pattern from existing `change_proposal` kinds (Supervisor) |
| Cross-namespace writes | Cascade-delegation per ADR-0356 | Preserves ADR-0173 frozen-4 boundaries; mirrors S2/S3 payroll cascade pattern |
| Attachment routing | MIME-type deterministic dispatch (bypass LLM classifier) | File = hard signal; reliable; avoids LLM intent-classifier roundtrip cost |

## Architecture — 5 Layers + 4 Sorties

```
L1 (UI)            BotssonChat composer + button + drag-drop  ────────► Sortie B
                       │ multipart file
                       ▼
L2 (BFF)           /api/botsson/imports/upload (signed URL)   ────────► Sortie 0
                   /api/emma/chat (forward userMessageAttachments)
                       │ signed URL + chat message
                       ▼
L3 (Stage Engine)  chatSchema.attachments → agent-router      ────────► Sortie 0
                   MIME-type deterministic dispatch (.xlsx/.csv → bulk_import)
                       │ tool dispatch
                       ▼
L4 (Capability)    packages/ai/src/capabilities/bulk_import/  ────────► Sortie A+B+C
                   ├── parse_spreadsheet (read)
                   ├── preview_batch (write → import_run)
                   ├── resolve_ambiguity (write → import_run)
                   └── commit_batch (atomic RPC, cascade-delegated)
                       │ delegated calls per ADR-0356
                       ▼
L5 (Persistence)   import_run table (NEW)                     ────────► Sortie A
                   pg_trgm composite GIN indexes
                   fn_commit_bulk_import RPC (SECURITY DEFINER)
                   schedule_shift / schedule_day_task (via delegation)
                   profile / department / location (via invitation, NOT stub)
```

### Sortie 0 — Attachment Routing Infrastructure (PREREQUISITE)

Estimated: 3 days. Blocks Sortie A.

Goal: wire the attachment pipeline that the council verified does not exist today (`userMessageAttachments` is dead-end at `chat_message.attachments`; never reaches stage-engine).

Scope:
- Extend stage-engine `chatSchema` with `attachments?: Attachment[]` field
- BFF `/api/emma/chat` forwards `userMessageAttachments` to stage-engine
- New BFF route `/api/botsson/imports/upload` — multipart upload → Supabase Storage `botsson-imports` bucket → returns signed URL (1h TTL)
- Storage migration creates `botsson-imports` bucket with workspace-scoped RLS
- agent-router: MIME-type deterministic dispatch (`.xlsx` / `.xls` / `.csv` → force `bulk_import` capability, skip intent-classifier LLM call)
- Add `bulk_import` to intent classifier enum + capability registry + system prompt SAME COMMIT (ADR-0112 6th occurrence pre-flight check)

Out of scope for Sortie 0:
- BotssonChat UI (Sortie B)
- Capability tool implementations (Sortie A+B+C)
- Resolver (Sortie B)

### Sortie A — Infrastructure + Schema (Foundation)

Estimated: 4 days. Depends on Sortie 0.

Goal: ship the database foundation + skeleton capability + first read-only tool.

Scope:
- ADR-0401 written: "bulk_import Capability — Dedicated `import_run` Table + Cascade-Delegated Commit Pipeline" (originally 0398; shifted +2 after wt-5 InlineConfirmCard collision then +1 more after wt-1 Welcome Wizard collision — L-0316 6th + 7th occurrences, renumbered 2026-05-23)
- ADR-0402 written: "xlsx Library Adoption (SheetJS) — License, Bundle Size, Zip-Bomb Mitigation"
- ADR-0404 written: "schedule_shift.source — Add 'v3_bulk_import' Value" (extends CHECK constraint)
- Migration `20260624000000_bulk_import_foundation.sql`:
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions`
  - GIN indexes (`<name_col> gin_trgm_ops`) on profile.display_name + department.name + location.name, paired with BTREE indexes on workspace_id (two-index strategy: composite UUID-in-GIN is unsupported — btree_gin extension not installed; planner combines via BITMAP scan; correction surfaced by code-quality review of foundation migration, Sortie A 2026-05-23)
  - `CREATE TABLE import_run (...)` — see data model below
  - `CREATE FUNCTION fn_fuzzy_match_entity(...)` SECURITY DEFINER + active-status filter
  - `ALTER TABLE schedule_shift DROP CONSTRAINT ... ADD CONSTRAINT ... CHECK (source IN ('operational','bubble_migration','v3_engine','v3_bulk_import'))`
- `packages/ai/src/capabilities/bulk_import/` skeleton (index.ts + tools.ts)
- `packages/utils/src/spreadsheet/` — xlsx + papaparse wrapper, returns `Sheet{name, rows[], headers[]}[]`
- `packages/utils/src/hash/` — sha256 for Excel bytes
- `packages/ai/src/resolver/` — `resolveEntity({type, raw_name, workspace_id, threshold})` wrapper around `fn_fuzzy_match_entity`
- `parse_spreadsheet` tool (read-only — fetches signed URL, validates MIME + workspace ownership, returns parsed rows + suggested column mapping)
- Telemetry registry entries: `bulk_import.batch_parsed`, `bulk_import.batch_previewed`, `bulk_import.batch_committed`, `bulk_import.batch_failed` (file:line refs to emit call-sites)
- Authority seed migration: 4 `engine_authority_config` rows SAME COMMIT (else default-deny per L-0083)

### Sortie B — Preview + Resolver + UI

Estimated: 4 days. Depends on Sortie A.

Goal: ship the preview-and-resolve flow + the composer UI.

Scope:
- `preview_batch` tool — calls resolver, populates 3-bucket `import_run.resolution_buckets`, writes single row to `import_run`, ONE emit per ADR-0287
- `resolve_ambiguity` tool — Pontus picks among fuzzy matches, patches `import_run.resolver_decisions[]`
- BotssonChat composer UI per Frontend-Designer Phase 3 spec:
  - Paperclip icon (Lucide) `Button variant="ghost" size="icon"` LEFT of textarea
  - Composer-scoped drop-overlay: `ring-2 ring-ring` on form (NOT full-modal); centered `Paperclip` + `"Slipp filen her"` label using absolute positioning
  - Pill chip (`radius.full`, NOT card) with filename + size + remove-X; aria-live polite wrapper
  - Single-file v1 (array-ready architecture for v2 multi-file)
  - Inline error chip variant (`border-destructive`, no toast)
  - `motionTokens.spring` entrance + `motionTokens.springSnappy` icon swap; `useReducedMotion()` gating on all animations
- Memory cache: resolver decisions ≥95% post-user-confirm → `memory.save_memory` delegation (per Agent-Coord)

3-bucket resolver output (locked):
- `ready_to_assign` — resolver matched ≥90% to existing active profile → eligible to commit
- `requires_onboarding_first` — resolver matched to invitation/inactive profile OR no match + Pontus opts to invite → emit invitation event (NOT profile stub); hold row in `import_run.pending_rows[]`
- `unresolvable` — no match + Pontus declines invite → reject row with audit reason in `import_run.rejected_rows[]`

### Sortie C — Commit Pipeline

Estimated: 5 days. Depends on Sortie B.

Goal: ship the atomic transactional commit pipeline with cascade-delegated writes.

Scope:
- ADR-0403 written: "Attachment Routing in Stage-Engine — MIME-Type Deterministic Capability Dispatch" (retroactive; Sortie 0 patterns codified)
- `commit_batch` tool — calls SECURITY DEFINER RPC `fn_commit_bulk_import(import_run_id uuid)` for atomic write
- RPC implementation:
  - Inside single transaction
  - Per `ready_to_assign` row: delegate to `scheduler.create_shift_via_bulk_import(workspace_id, row)` helper OR `task.create_day_ad_hoc_via_bulk_import(workspace_id, row)` helper (new sibling tools, per ADR-0356)
  - Every delegated INSERT emits with `actor_capability='bulk_import'` + `delegated_via='bulk_import.commit_batch'` in `properties.data` JSONB
  - On any row failure: ROLLBACK transaction; update `import_run.status='failed'`; emit `bulk_import.batch_failed` with row-level error
  - On success: UPDATE `import_run.status='applied'`; emit `bulk_import.batch_committed` (ONE per ADR-0287)
- `requires_onboarding_first` rows: trigger `invitation.send_for_workspace_import` (delegated; explicit confirm gate per Pontus decision)
- Async dispatch via `engine_process` if file > 30 rows (Vercel 10s timeout mitigation)

## Data Model

### `import_run` table (NEW — Sortie A)

```sql
CREATE TABLE import_run (
  import_run_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES profile(profile_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at        TIMESTAMPTZ,
  applied_by        UUID REFERENCES profile(profile_id),

  -- Source artifact
  source_filename   TEXT NOT NULL,
  source_storage_path TEXT NOT NULL,           -- 'botsson-imports/{workspace_id}/{import_run_id}.xlsx'
  source_kind       TEXT NOT NULL CHECK (source_kind IN ('vaktliste','kjoreplan','mixed')),
  excel_sha256      TEXT NOT NULL,             -- file-level idempotency
  row_hashes        TEXT[] NOT NULL DEFAULT '{}', -- row-level idempotency (sha256 per canonical row)

  -- Parsed data (immutable post-parse)
  parsed_rows       JSONB NOT NULL,            -- full row array as-parsed

  -- Resolver state (mutable via resolve_ambiguity)
  resolver_decisions JSONB NOT NULL DEFAULT '[]', -- [{row_idx, raw_name, type, matched_id, confidence, alternatives[]}]
  user_overrides    JSONB NOT NULL DEFAULT '[]', -- [{row_idx, type, chosen_id, override_reason}]

  -- 3-bucket classification (Phase B output)
  ready_to_assign   JSONB NOT NULL DEFAULT '[]', -- [row_idx, ...]
  pending_rows      JSONB NOT NULL DEFAULT '[]', -- requires_onboarding_first
  rejected_rows     JSONB NOT NULL DEFAULT '[]', -- unresolvable

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN (
    'parsed', 'previewed', 'awaiting_resolution', 'awaiting_approval',
    'applied', 'failed', 'cancelled', 'expired'
  )),
  initiator         cascade_initiator NOT NULL DEFAULT 'admin_manual',

  -- Audit
  notes             TEXT,
  failure_reason    TEXT,

  CONSTRAINT unique_workspace_file_hash UNIQUE (workspace_id, excel_sha256)
    -- file-level idempotency: same file in same workspace = same import_run row
);

-- Expression index for status filtering
CREATE INDEX idx_import_run_workspace_status ON import_run (workspace_id, status);

-- Dual-path RLS
CREATE POLICY jwt_read_import_run ON import_run FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY jwt_insert_import_run ON import_run FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY jwt_update_import_run ON import_run FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- (capability runs direct_admin via service_role per DB-tracer; api_key policies not required)
```

### `fn_fuzzy_match_entity` RPC (SECURITY DEFINER)

```sql
CREATE FUNCTION fn_fuzzy_match_entity(
  p_workspace_id UUID,
  p_entity_type TEXT,  -- 'profile' | 'department' | 'location'
  p_raw_name TEXT,
  p_threshold NUMERIC DEFAULT 0.9
)
RETURNS TABLE (
  matched_id UUID,
  matched_name TEXT,
  confidence NUMERIC
)
SECURITY DEFINER
SET search_path = public, extensions
-- Filters: active-only (is_active = true OR status != 'offboarding')
-- Returns top-5 matches sorted by similarity DESC
-- Empty result if no candidate ≥ p_threshold
```

## C4 Authority Model (per-tool)

| Tool | Authority Level | Channels | Rationale |
|---|---|---|---|
| `parse_spreadsheet` | `suggest` / manager+ | chat-only | Read-only; PII-adjacent (file contents) |
| `preview_batch` | `suggest` / manager+ | chat-only | Single-namespace write (import_run only); PII in payload |
| `resolve_ambiguity` | `suggest` / manager+ | chat-only | Decision input, mutates only resolver_decisions[] |
| `commit_batch` | **`confirm` / admin+** | chat-only (voice forbidden per ADR-0288) | Multi-row mutation, largest blast radius capability ever added; one tier above payroll override |

## Risk Assessment

| Risk | Reversibility | Mitigation |
|---|---|---|
| `import_run` schema lock-in | LOAD-BEARING after first import | Schema finalized in ADR-0401 review; pg_trgm composite indexes; nullable resolver_decisions |
| xlsx library bundle bloat / supply-chain | REVERSIBLE | Sortie A ships CSV-only; xlsx ADR-0402 reviewed before Sortie B |
| Cascade-delegation symmetry slips (one helper emits, another doesn't) | LATENT BUG — surfaces in audit weeks later | Trust Gate per-tool check at Sortie C close; explicit emit-symmetry test in close-feature |
| Profile-stub creep ("just this one workspace") | LOAD-BEARING — orphans break D2 permanently | ADR-0401 FORBIDS stubs explicitly; capability rejects on FK-chain attempt |
| RPC `fn_commit_bulk_import` runtime > Vercel 10s timeout | LOAD-BEARING for files > ~30 rows | Async dispatch via `engine_process`; commit_batch returns immediately with import_run_id, polling endpoint returns status |
| Idempotency hash collision (sha256 — astronomically rare) | REVERSIBLE | Admin-only `force_reimport=true` flag in commit_batch signature |
| Attachment-routing change breaks chat composer for non-import paths | REVERSIBLE | Sortie 0 ships with feature-flag default off; flip on after Sortie A green |

## ADRs to Write

| ADR | Title | Sortie | Slot |
|---|---|---|---|
| 0401 | bulk_import Capability — Dedicated `import_run` Table + Cascade-Delegated Commit Pipeline | A Task 1 | reserved (originally 0398; renumbered twice — L-0316 6th + 7th occurrences) |
| 0402 | xlsx Library Adoption (SheetJS) — License, Bundle Size, Zip-Bomb Mitigation | A Task 2 | reserved (originally 0399) |
| 0403 | Attachment Routing in Stage-Engine — MIME-Type Deterministic Capability Dispatch | C Task 1 (retroactive codification) | reserved (originally 0400) |
| 0404 | schedule_shift.source — Add 'v3_bulk_import' Value | A Task 3 | reserved (originally 0401) |

**Cross-branch collision note:** Two concurrent collisions discovered 2026-05-23. (1) L-0316 6th occurrence: ADR-0398 + ADR-0399 committed by wt-5 (feat/inline-confirm-card-phase1) for InlineConfirmCard Primitive + Channel Platform Descriptors — discovered end-of-prior-session via cross-branch grep; bulk_import slots shifted +2 to 0400/0401/0402/0403 on commit `4f0a00afa`. (2) L-0316 7th occurrence: ADR-0400 committed by wt-1 (feat/employee-onboarding-wizard) for Welcome Wizard State Lifecycle Constraints at `a9f95d6f4` — discovered during Sortie A Task 1 implementer dispatch (BLOCKED report); bulk_import slots shifted +1 more to 0401/0402/0403/0404. Reservation check at council Phase 8 Step 0 AND at each ADR-write task Step 1 must include `git log --all` per L-0316. Total drift from V1 reservation: +3 slots. Net positive: re-check protocol caught the collision before commit, not after.

## Learnings to Log (after Sortie C closes)

- **L-NEW-A:** Chair prose-level schema decisions get falsified by code-tracer column-name verification (`payload` vs `changes`). 3rd occurrence pattern. Promote to pre-Phase-3 Chair self-check.
- **L-NEW-B:** Capability-layer entity creation across `auth.users → user_identity → profile` chain technically infeasible from SQL-only — requires Supabase Auth Admin API → EF. Promote to `smartout-database-guide` skill trap section.
- **L-0292 ADR-0112 enum-lag:** 6th occurrence confirmed. Promote to mandatory pre-flight check NOW. New `start-feature.sh` step or husky pre-push hook: "any new capability namespace must add intent enum entry + system prompt prose same commit, else block push."

## Council Reference

- Session: 2026-05-23
- Reviewers: 6/6 (Steward, Supervisor, Agent-Coordinator, Botsson-Harness-Builder, Frontend-Designer, DB-tracer)
- Trust Gate: CONDITIONAL FAIL — 3/4 tools blocked on pipeline (attachment routing, RPC, ADR-0173 delegation lock)
- Final verdict: APPROVE WITH CHANGES — Reject-in-current-shape, Accept-with-rewrite
- L-0147 self-reversal: 6th precedent (schema placement REVERSED, column naming REVERSED, naming REVERSED)
- Full synthesis: this document is the authoritative consolidation; council Phase 5 output supersedes Phase 3 chair claims

## Out of Scope (v1)

- Multi-file upload in single drop (architecture is array-ready for v2)
- Excel binary (.xlsx) parsing — CSV only in Sortie A; xlsx in Sortie B after ADR-0402 approved
- Voice channel (ADR-0288 forbids irreversible writes via voice)
- Mobile composer UI (ADR-0133 — Compose verb is web-only)
- Round-trip resolver memory cache (deferred to v2 after evaluating ≥95% confidence false-positive rate)
- Auto-rollback after commit (admin must manually delete affected rows via separate flow; commit is atomic but post-commit reversal is out of scope)
