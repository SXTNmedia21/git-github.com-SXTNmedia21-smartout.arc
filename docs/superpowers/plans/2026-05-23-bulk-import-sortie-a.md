---
title: bulk_import Sortie A — Infrastructure + Schema Foundation
status: in_progress
updated: 2026-05-23
created: 2026-05-23
module: bulk-import
tags: [plan, sortie, bulk-import, migration, capability, foundation]
---

# bulk_import Sortie A — Infrastructure + Schema Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the database foundation + read-only first tool (`parse_spreadsheet`) for the `bulk_import` capability, unblocking Sortie B preview/resolver work.

**Architecture:** Three ADRs (0400 capability + import_run + delegation, 0401 xlsx library policy, 0403 schedule_shift.source value) → two migrations same-commit (foundation schema + authority seed per L-0083 default-deny) → two pure-utility packages (CSV parser via papaparse, sha256 helper) → resolver wrapper around new RPC → first read-only capability tool (`parse_spreadsheet`) → telemetry registry entry for the one event that actually emits in Sortie A (per ADR-0377 register-with-emit). Zero DB writes from capability tools in this sortie — Sortie B+C add mutations.

**Tech Stack:** PostgreSQL 17 + pg_trgm extension, Supabase migrations + RLS, TypeScript strict + Zod, papaparse, Node crypto for sha256, Hono (stage-engine), pnpm Turborepo, Playwright (E2E in Sortie B+C — integration smoke only here).

**Spec:** `docs/superpowers/specs/2026-05-23-bulk-import-design.md` (Sortie A section lines 82–104; data model lines 149–227)

**Constraints carried into every task:**
- Caveman mode active for chat — **code, commits, comments written normal English** (CLAUDE.md security boundary).
- Conventional commits: `type(scope): subject` ≤100 chars; scope kebab-case (`bulk-import` not `bulk_import`); body lines ≤100 chars; trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- NEVER `--no-verify`. NEVER push to preview/main. NEVER switch branches without asking.
- All migrations strictly > `20260623100000` (current tip on dev — Sortie 0 storage bucket migration).
- ADR-0287: ONE `emit()` per gated mutation. Sortie A parse_spreadsheet is read-only → exactly ONE `bulk_import.batch_parsed` emit at successful parse.
- ADR-0377: telemetry registry entry MUST land in same commit as the `emit()` call-site that uses it. Sortie A registers ONLY `batch_parsed`; `batch_previewed/committed/failed` registered in Sortie B/C when their emit sites land.
- L-0083: `engine_authority_config` defaults to DENY — seed authority rows in SAME COMMIT as capability tool registration.
- L-0176: write tool body first → verify against `smartout-agent-dev` Tool Compliance Self-Check → THEN write docstring claiming compliance.
- L-0177: NO silent fallbacks. Fail-fast on workspace_id/profile_id resolution.
- L-0042: migration filename timestamp must be strictly greater than every dependency's creation timestamp AND strictly greater than current `development` HEAD max.
- L-0190: regenerate `database.types.ts` AND rebuild `@smartout/telemetry` + `@smartout/utils` dist after migration apply, before any typecheck.
- ADR-0112: intent classifier enum + system prompt entries for `bulk_import` already landed in Sortie 0 (verified at planning: `packages/ai/src/router/intent-classifier.ts:57` + system-prompt prose line 181). DO NOT re-add. DO NOT remove.
- ADR-0173 frozen-4 boundary: `parse_spreadsheet` is read-only — no namespace-crossing concern. Sortie C cascade-delegation tools (Sortie B+C) will follow ADR-0356 helper pattern.

**Out of scope (deferred to Sortie B+C):**
- xlsx binary parsing (CSV-only in Sortie A per spec line 281 — Sortie B after ADR-0401 acceptance)
- BotssonChat composer UI (Sortie B)
- preview_batch / resolve_ambiguity / commit_batch tools
- fn_commit_bulk_import RPC + cascade-delegation helper tools

---

## File Structure

**Create (Sortie A):**
- `docs/decisions/0400-bulk-import-capability-import-run-cascade-delegation.md` — capability + schema + delegation ADR
- `docs/decisions/0401-xlsx-library-adoption-sheetjs.md` — xlsx library policy (adopted in Sortie B; ADR drafted now per spec lock-in)
- `docs/decisions/0403-schedule-shift-source-bulk-import-value.md` — extends CHECK constraint
- `supabase/migrations/20260624000000_bulk_import_foundation.sql` — pg_trgm + GIN indexes + import_run table + RLS + fn_fuzzy_match_entity + ALTER schedule_shift.source CHECK
- `supabase/migrations/20260624000100_bulk_import_authority_seed.sql` — 4 engine_authority_config rows for parse_spreadsheet/preview_batch/resolve_ambiguity/commit_batch (all 4 tools registered in authority now to avoid L-0083 default-deny when later sorties add tool bodies)
- `packages/utils/src/spreadsheet/index.ts` — papaparse wrapper, returns `Sheet[]`
- `packages/utils/src/spreadsheet/index.test.ts` — Vitest unit tests
- `packages/utils/src/hash/index.ts` — sha256 helper (hexdigest)
- `packages/utils/src/hash/index.test.ts` — Vitest unit tests
- `packages/ai/src/resolver/index.ts` — `resolveEntity()` wrapper around `fn_fuzzy_match_entity`
- `packages/ai/src/resolver/index.test.ts` — Vitest unit tests with mocked Supabase client
- `packages/ai/src/capabilities/bulk_import/tools.ts` — parse_spreadsheet tool definition
- `packages/ai/src/capabilities/bulk_import/tools.test.ts` — Vitest unit tests (mock Storage + Supabase client)

**Modify:**
- `packages/ai/src/capabilities/bulk_import/index.ts` — replace empty tools array with `[parseSpreadsheetTool]`
- `packages/telemetry/src/registry.ts` — register `bulk_import.batch_parsed` event (single entry; others come in Sortie B/C)
- `packages/utils/package.json` — add `papaparse` + `@types/papaparse` deps
- `docs/superpowers/specs/2026-05-23-bulk-import-design.md` — ADR-ref drift fix (lines 242/243/279 — already applied in plan-commit prep)
- `docs/decisions/0000-decision-log.md` — register 0400/0401/0403 entries

**Test surfaces:**
- Unit: `packages/utils/src/spreadsheet/index.test.ts`, `packages/utils/src/hash/index.test.ts`, `packages/ai/src/resolver/index.test.ts`, `packages/ai/src/capabilities/bulk_import/tools.test.ts`
- Integration smoke: live stage-engine + local Supabase, drag-drop `.csv` end-to-end (Sortie A verification — Playwright E2E spec lands Sortie B with UI)

---

## Task 1: ADR-0400 — bulk_import Capability + import_run Table + Cascade-Delegated Commit Pipeline

**Files:**
- Create: `docs/decisions/0400-bulk-import-capability-import-run-cascade-delegation.md`
- Modify: `docs/decisions/0000-decision-log.md` (add row)

**Pre-work:** Read spec lines 22–104 (Locked Decisions + Sortie A scope), 149–227 (data model), 229–237 (C4 authority). Read `docs/templates/decision.md` if exists; otherwise mirror format of `docs/decisions/0398-inline-confirm-card-primitive.md`.

- [ ] **Step 1: Verify slot 0400 still free across all branches (L-0316 reservation re-check)**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-4
git fetch --all
git log --all --oneline -- 'docs/decisions/0400-*' | head -5
ls -la docs/decisions/0400-*.md 2>/dev/null
```

Expected: zero results from both. If any branch committed 0400-*, escalate before proceeding (cross-branch collision — bump to 0404).

- [ ] **Step 2: Draft ADR-0400 file**

```bash
touch docs/decisions/0400-bulk-import-capability-import-run-cascade-delegation.md
```

Content (full frontmatter + sections — `Context` cites spec + council 2026-05-23 + L-0316; `Decision` covers capability registration as new namespace, dedicated `import_run` table choice over `change_proposal` extension, cascade-delegation per ADR-0356 for cross-namespace writes, FORBIDDEN profile-stub policy with FK-chain rationale from DB-tracer; `Consequences` lists 3 helper tools to add Sortie C, RLS dual-path retired in favor of JWT-only since capability runs `direct_admin` service_role, schema lock-in load-bearing; `References` ADRs 0078/0112/0133/0173/0204/0287/0356/0377, L-0042/0083/0176/0177/0292/0316; `Status` Accepted 2026-05-23):

```markdown
---
adr: 0400
title: bulk_import Capability — Dedicated import_run Table + Cascade-Delegated Commit Pipeline
status: accepted
date: 2026-05-23
deciders: Pontus, Council 2026-05-23 (Steward, Supervisor, Agent-Coordinator, Botsson-Harness-Builder, Frontend-Designer, DB-tracer)
tags: [capability, cascade, schema, bulk-import, delegation]
supersedes: []
superseded-by: []
---

# ADR-0400: bulk_import Capability — Dedicated `import_run` Table + Cascade-Delegated Commit Pipeline

## Context

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

L-0316 6th occurrence: ADR slots 0398+0399 reserved for this sortie pre-empted cross-branch
by wt-5 (feat/inline-confirm-card-phase1) for InlineConfirmCard + Channel Platform Descriptors.
Discovered 2026-05-23 end-of-session via cross-branch grep. Reservation shifted up to 0400
+ 0401 + 0403 (with 0402 reserved for Sortie C retroactive attachment-routing ADR).

## Decision

### 1. Register `bulk_import` as a new capability namespace

- Location: `packages/ai/src/capabilities/bulk_import/`
- Authority pattern: `direct_admin` (service_role; per DB-tracer the `api_key` INSERT policies
  do not exist on department/location/profile, and the capability runs admin+ only)
- Allowed channels: `chat` only. Voice forbidden (ADR-0288 — irreversible writes, largest blast
  radius capability ever added).
- Mobile: forbidden (ADR-0133 — Compose verb is web-only).
- Tools (final lineup across Sorties A/B/C):
  - `parse_spreadsheet` (Sortie A — read-only)
  - `preview_batch` (Sortie B — write to `import_run` only)
  - `resolve_ambiguity` (Sortie B — patches `import_run.resolver_decisions[]` only)
  - `commit_batch` (Sortie C — calls SECURITY DEFINER RPC `fn_commit_bulk_import`)
- Intent classifier enum entry + system prompt prose landed Sortie 0 (ADR-0112 6th
  pre-flight check observed). MIME-type deterministic dispatch (`.xlsx`/`.xls`/`.csv`)
  bypasses the classifier in normal operation per ADR-0402 (Sortie C retroactive).

### 2. Schema — dedicated `import_run` table

See spec §Data Model (lines 149–206). Key points:

- `excel_sha256` UNIQUE per workspace — file-level idempotency
- `row_hashes TEXT[]` — row-level idempotency for partial re-imports
- `parsed_rows JSONB` immutable post-parse
- `resolver_decisions JSONB` + `user_overrides JSONB` mutable via Sortie B
- 3-bucket classification (`ready_to_assign`, `pending_rows`, `rejected_rows`) populated Sortie B
- `status` CHECK: `parsed | previewed | awaiting_resolution | awaiting_approval | applied | failed | cancelled | expired`
- `initiator cascade_initiator NOT NULL DEFAULT 'admin_manual'` — cascade provenance per existing enum
- JWT-only RLS (no api_key path) — capability runs service_role per `direct_admin` pattern
- `UNIQUE (workspace_id, excel_sha256)` — same file in same workspace = same import_run row
  (idempotency; admin override via Sortie C `force_reimport=true` flag)

### 3. Cross-namespace writes via cascade-delegation (Sortie C)

`commit_batch` MUST NOT write directly to `schedule_shift`, `schedule_day_task`, `profile`,
`department`, or `location`. Instead, it MUST delegate via new helper tools added in Sortie C
on the owning capabilities (per ADR-0356):

- `scheduler.create_shift_via_bulk_import(workspace_id, row)` — owned by `scheduler` capability
- `task.create_day_ad_hoc_via_bulk_import(workspace_id, row)` — owned by `task` capability
- `invitation.send_for_workspace_import(workspace_id, email)` — owned by `invitation`
  capability (when added; falls back to existing tool if naming clashes)

Every delegated INSERT emits with `actor_capability='bulk_import'` and
`delegated_via='bulk_import.commit_batch'` in `properties.data` JSONB per ADR-0356 audit
symmetry.

### 4. Profile-stub creation FORBIDDEN

Capability MUST NOT attempt to insert into `profile` directly. Unresolvable employees route
through `requires_onboarding_first` bucket (Sortie B) → invitation flow (Sortie C). Explicit
confirm gate per Pontus decision (line 29 of spec): "Invitation = real cost + PII flow;
deserves intentional action, not automatic."

## Consequences

### Positive

- Drag-drop migration unblocked for hospitality go-lives (Pontus's tom-tabell problem).
- Frozen-4 boundary preserved — ADR-0173 still load-bearing.
- Audit trail complete — every delegated write traceable to `bulk_import` actor via
  `properties.data.actor_capability`.
- Idempotency at two layers — re-uploading same file is a no-op; partial re-import skips
  already-applied rows by row-hash.

### Negative / cost

- New capability surface = new authority config rows (4) + new intent classifier entry +
  new system prompt prose. Costs ~150 tokens per agent turn (system prompt overhead).
- `import_run` payload can be large (full row JSONB) — admins migrating 100+ shift files
  hit storage growth. Mitigation: retention policy in Sortie D (out of v1 scope).
- Sortie C helper tools on sibling capabilities (`scheduler`, `task`, `invitation`) require
  matching ADR-0356 audit symmetry — easy to miss one. Trust-Gate per-tool check at Sortie C
  close mandated; explicit emit-symmetry test required.

### Forbidden patterns (codified)

- Direct INSERT to `profile`, `department`, `location` from any `bulk_import` tool —
  rejected at code-review per ADR-0173.
- Forwarding raw `workspace_id` from request body — must derive server-side from auth
  context per ADR-0151 + L-0177.
- Silent FK-resolution fallback — must fail-fast with explicit 4xx per L-0177.

## Implementation references

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
- ADR-0402 — attachment routing MIME-deterministic dispatch (Sortie C retroactive)
- L-0042 — migration timestamp ordering
- L-0083 — engine_authority_config default deny
- L-0176 — docstring drift ban
- L-0177 — silent fallback ban
- L-0292 — ADR-0112 enum-lag (6th occurrence resolved Sortie 0)
- L-0316 — cross-branch ADR collision rule (6th occurrence — this ADR's renumber)
- Spec: `docs/superpowers/specs/2026-05-23-bulk-import-design.md`
- Plan: `docs/superpowers/plans/2026-05-23-bulk-import-sortie-a.md`
```

- [ ] **Step 3: Register ADR-0400 in decision log**

Append row to `docs/decisions/0000-decision-log.md` matching existing format (single line entry under the 04xx range or appropriate section header).

- [ ] **Step 4: Commit ADR-0400 + log entry**

```bash
git add docs/decisions/0400-bulk-import-capability-import-run-cascade-delegation.md \
        docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(bulk-import): ADR-0400 bulk_import capability + import_run + cascade-delegation

Council 2026-05-23 APPROVE WITH CHANGES — 3 architectural forks locked:
schema placement (dedicated import_run table), cross-namespace writes
(cascade-delegation per ADR-0356), profile-stub creation (FORBIDDEN per
DB-tracer FK-chain evidence). L-0316 6th occurrence renumber notes inline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: clean commit, husky pre-commit passes (no code changes — docs only).

---

## Task 2: ADR-0401 — xlsx Library Adoption (SheetJS) — Policy Drafted, Adoption Sortie B

**Files:**
- Create: `docs/decisions/0401-xlsx-library-adoption-sheetjs.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Pre-work:** Sortie A ships CSV-only (papaparse, MIT, ~30KB). xlsx adoption deferred to Sortie B — but the ADR is drafted NOW so the constraints (license review, bundle size, zip-bomb mitigation) are locked before Sortie B can install the dep.

- [ ] **Step 1: Verify slot 0401 still free**

```bash
git log --all --oneline -- 'docs/decisions/0401-*' | head -5
ls -la docs/decisions/0401-*.md 2>/dev/null
```

Expected: zero results.

- [ ] **Step 2: Draft ADR-0401**

```bash
touch docs/decisions/0401-xlsx-library-adoption-sheetjs.md
```

Content covers: license analysis (SheetJS Community Edition Apache-2.0 — compatible with our stack; CDN-only Pro edition explicitly REJECTED), bundle-size budget (gzip ≤120KB acceptable; if exceeds budget, dynamic import only), zip-bomb mitigation (`xlsx.read(buf, { dense: true, sheetRows: 10000 })` cap; reject files >10MB at upload per existing storage migration), security (no eval/Function-from-string; document any `dangerouslySetInnerHTML`-equivalent surfaces — none exist in SheetJS), versioning (pin major; renovate excluded until next ADR), adoption phase (Sortie B; parse_spreadsheet tool's MIME branch gains xlsx parsing only after this ADR moves from `proposed` to `accepted`).

Frontmatter status: `proposed` (NOT `accepted` — Pontus + Council re-review at Sortie B start before flipping to `accepted` and installing dep).

- [ ] **Step 3: Register in decision log + commit**

```bash
git add docs/decisions/0401-xlsx-library-adoption-sheetjs.md docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(bulk-import): ADR-0401 xlsx library policy (proposed; adoption Sortie B)

License Apache-2.0, bundle budget ≤120KB gzip, zip-bomb mitigation via dense+sheetRows
cap + existing 10MB upload limit. Status proposed — flips to accepted at Sortie B
start with package install. Sortie A ships CSV-only via papaparse.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ADR-0403 — schedule_shift.source Add 'v3_bulk_import' Value

**Files:**
- Create: `docs/decisions/0403-schedule-shift-source-v3-bulk-import-value.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Pre-work:** Existing CHECK constraint on `schedule_shift.source` allows `operational | bubble_migration | v3_engine`. Sortie C `commit_batch` will insert via delegated `scheduler.create_shift_via_bulk_import(...)` — that helper sets `source='v3_bulk_import'` so the row is auditably distinguishable from cascade-generated (`v3_engine`) and Bubble-migrated (`bubble_migration`). Precedent: `bubble_migration` from ADR-0108.

- [ ] **Step 1: Verify slot 0403 still free**

```bash
git log --all --oneline -- 'docs/decisions/0403-*' | head -5
```

Expected: zero results.

- [ ] **Step 2: Find current CHECK constraint definition**

```bash
grep -rn "source IN (" supabase/migrations/ | grep schedule_shift
```

Expected: single migration defining `CHECK (source IN ('operational','bubble_migration','v3_engine'))`. Note migration filename + line for ADR reference.

- [ ] **Step 3: Draft ADR-0403**

```bash
touch docs/decisions/0403-schedule-shift-source-v3-bulk-import-value.md
```

Content covers: Context (Sortie C cascade-delegated bulk-import writes must be auditably separable from cascade-generated and Bubble-migrated shifts), Decision (add `'v3_bulk_import'` value via ALTER TABLE in Sortie A foundation migration — even though the writer code doesn't ship until Sortie C, the CHECK must allow the value when the seed/test data lands so we don't gate Sortie A green on Sortie C code), Consequences (one-line addition to constraint; backward compatible; existing rows unaffected; consumer queries that filter by source must add `v3_bulk_import` to their allowlists — grep `WHERE.*source.*=.*'` audit at Sortie C close).

Frontmatter status: `accepted` (migration applies in Sortie A).

- [ ] **Step 4: Register in decision log + commit**

```bash
git add docs/decisions/0403-schedule-shift-source-v3-bulk-import-value.md docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(bulk-import): ADR-0403 schedule_shift.source add v3_bulk_import value

Extends CHECK constraint to allow Sortie C cascade-delegated bulk-import writes
to be auditably separable from cascade-generated (v3_engine) and Bubble-migrated
(bubble_migration). Constraint added in Sortie A foundation migration;
writer ships Sortie C. Mirrors ADR-0108 bubble_migration precedent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Foundation migration — pg_trgm + GIN indexes + import_run + RPC + ALTER CHECK

**Files:**
- Create: `supabase/migrations/20260624000000_bulk_import_foundation.sql`

**Pre-work:**
- Read `.claude/skills/smartout-database-guide` if SKILL.md exists — confirm RLS pattern + naming conventions.
- Verify timestamp ordering: dev tip max migration = `20260623100000_botsson_imports_storage_bucket.sql`; `20260624000000` is strictly greater (24h gap, safe).
- Verify `cascade_initiator` enum exists: `grep -rn "CREATE TYPE cascade_initiator" supabase/migrations/`. Expected: at least one CREATE TYPE statement (used in existing import-adjacent code).
- Verify `get_workspace_ids_for_user` + `is_admin_in_workspace` helpers exist: `grep -rn "CREATE FUNCTION get_workspace_ids_for_user\|CREATE FUNCTION is_admin_in_workspace" supabase/migrations/`. Expected: both present (used widely).
- Verify `profile.display_name`, `department.name`, `location.name` columns exist for GIN indexes:
  `grep -rn "ALTER TABLE profile.*display_name\|CREATE TABLE profile" supabase/migrations/ | head -5`
  Expected: `display_name TEXT` or equivalent on profile; `name TEXT` on department + location.

- [ ] **Step 1: Write the migration file**

```bash
touch supabase/migrations/20260624000000_bulk_import_foundation.sql
```

```sql
-- supabase/migrations/20260624000000_bulk_import_foundation.sql
-- bulk_import Sortie A foundation: pg_trgm + GIN indexes + import_run + RPC + ALTER CHECK
-- ADRs: 0400 (capability), 0403 (schedule_shift.source)
-- Council: 2026-05-23

BEGIN;

-- ============================================================================
-- 1. pg_trgm extension (fuzzy matching for resolver)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================================
-- 2. Composite GIN indexes (workspace_id, name) for trigram similarity scans
--    Workspace-first to keep the search bounded to one tenant per query.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profile_workspace_displayname_trgm
  ON profile USING GIN (workspace_id, display_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_department_workspace_name_trgm
  ON department USING GIN (workspace_id, name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_location_workspace_name_trgm
  ON location USING GIN (workspace_id, name extensions.gin_trgm_ops);

-- ============================================================================
-- 3. import_run table (Sortie A schema home; ADR-0400)
-- ============================================================================
CREATE TABLE import_run (
  import_run_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at          TIMESTAMPTZ,
  applied_by          UUID REFERENCES profile(profile_id),

  source_filename     TEXT NOT NULL,
  source_storage_path TEXT NOT NULL,
  source_kind         TEXT NOT NULL CHECK (source_kind IN ('vaktliste','kjoreplan','mixed')),
  excel_sha256        TEXT NOT NULL,
  row_hashes          TEXT[] NOT NULL DEFAULT '{}',

  parsed_rows         JSONB NOT NULL,
  resolver_decisions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_overrides      JSONB NOT NULL DEFAULT '[]'::jsonb,

  ready_to_assign     JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_rows        JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejected_rows       JSONB NOT NULL DEFAULT '[]'::jsonb,

  status              TEXT NOT NULL DEFAULT 'parsed'
                        CHECK (status IN (
                          'parsed','previewed','awaiting_resolution',
                          'awaiting_approval','applied','failed','cancelled','expired'
                        )),
  initiator           cascade_initiator NOT NULL DEFAULT 'admin_manual',

  notes               TEXT,
  failure_reason      TEXT,

  CONSTRAINT unique_workspace_file_hash UNIQUE (workspace_id, excel_sha256)
);

CREATE INDEX idx_import_run_workspace_status ON import_run (workspace_id, status);

-- updated_at trigger (standard pattern)
CREATE OR REPLACE FUNCTION fn_import_run_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_import_run_updated_at
  BEFORE UPDATE ON import_run
  FOR EACH ROW EXECUTE FUNCTION fn_import_run_set_updated_at();

-- Enable RLS
ALTER TABLE import_run ENABLE ROW LEVEL SECURITY;

-- JWT-only policies (capability runs direct_admin/service_role per DB-tracer)
CREATE POLICY jwt_read_import_run ON import_run FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY jwt_insert_import_run ON import_run FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY jwt_update_import_run ON import_run FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY jwt_delete_import_run ON import_run FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

COMMENT ON TABLE import_run IS
  'bulk_import capability state per uploaded file. ADR-0400. JWT-only RLS — capability '
  'tools run direct_admin (service_role) and bypass RLS; policies cover dashboard reads '
  'and admin overrides. Idempotency: UNIQUE (workspace_id, excel_sha256) prevents '
  'duplicate processing of the same file in the same workspace.';

-- ============================================================================
-- 4. fn_fuzzy_match_entity RPC (SECURITY DEFINER + workspace-scoped + active-only)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_fuzzy_match_entity(
  p_workspace_id UUID,
  p_entity_type  TEXT,
  p_raw_name     TEXT,
  p_threshold    NUMERIC DEFAULT 0.9
)
RETURNS TABLE (
  matched_id   UUID,
  matched_name TEXT,
  confidence   NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_entity_type NOT IN ('profile','department','location') THEN
    RAISE EXCEPTION 'fn_fuzzy_match_entity: invalid entity_type %', p_entity_type
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_raw_name IS NULL OR length(trim(p_raw_name)) = 0 THEN
    RAISE EXCEPTION 'fn_fuzzy_match_entity: p_raw_name required'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_threshold < 0 OR p_threshold > 1 THEN
    RAISE EXCEPTION 'fn_fuzzy_match_entity: threshold must be 0..1'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_entity_type = 'profile' THEN
    RETURN QUERY
      SELECT p.profile_id,
             p.display_name,
             ROUND(extensions.similarity(p.display_name, p_raw_name)::numeric, 4)
      FROM profile p
      WHERE p.workspace_id = p_workspace_id
        AND p.status <> 'offboarding'
        AND p.display_name IS NOT NULL
        AND extensions.similarity(p.display_name, p_raw_name) >= p_threshold
      ORDER BY extensions.similarity(p.display_name, p_raw_name) DESC
      LIMIT 5;
  ELSIF p_entity_type = 'department' THEN
    RETURN QUERY
      SELECT d.department_id,
             d.name,
             ROUND(extensions.similarity(d.name, p_raw_name)::numeric, 4)
      FROM department d
      WHERE d.workspace_id = p_workspace_id
        AND d.name IS NOT NULL
        AND extensions.similarity(d.name, p_raw_name) >= p_threshold
      ORDER BY extensions.similarity(d.name, p_raw_name) DESC
      LIMIT 5;
  ELSE -- location
    RETURN QUERY
      SELECT l.location_id,
             l.name,
             ROUND(extensions.similarity(l.name, p_raw_name)::numeric, 4)
      FROM location l
      WHERE l.workspace_id = p_workspace_id
        AND l.name IS NOT NULL
        AND extensions.similarity(l.name, p_raw_name) >= p_threshold
      ORDER BY extensions.similarity(l.name, p_raw_name) DESC
      LIMIT 5;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_fuzzy_match_entity IS
  'Workspace-scoped fuzzy match for bulk_import resolver. ADR-0400. SECURITY DEFINER + '
  'pinned search_path. Filters by active-status (profile.status != ''offboarding''). '
  'Returns top-5 candidates above threshold sorted by similarity DESC. Empty result = no '
  'candidate met threshold.';

-- Grant EXECUTE to authenticated + service_role (capability runs service_role)
GRANT EXECUTE ON FUNCTION fn_fuzzy_match_entity TO authenticated, service_role;

-- ============================================================================
-- 5. ALTER schedule_shift.source CHECK — add 'v3_bulk_import' (ADR-0403)
-- ============================================================================
ALTER TABLE schedule_shift DROP CONSTRAINT IF EXISTS schedule_shift_source_check;

ALTER TABLE schedule_shift ADD CONSTRAINT schedule_shift_source_check
  CHECK (source IN ('operational','bubble_migration','v3_engine','v3_bulk_import'));

COMMENT ON CONSTRAINT schedule_shift_source_check ON schedule_shift IS
  'Source provenance. v3_bulk_import added per ADR-0403 (Sortie A) — writer ships Sortie C '
  'via scheduler.create_shift_via_bulk_import cascade-delegated helper.';

COMMIT;
```

- [ ] **Step 2: Lint the migration locally (sanity)**

```bash
pnpm exec node scripts/migration-lint.mjs supabase/migrations/20260624000000_bulk_import_foundation.sql 2>&1 || true
```

If `scripts/migration-lint.mjs` doesn't exist or path differs, locate it:
`find . -name 'migration-lint*' -type f 2>/dev/null | head`

Expected: zero issues. If lint complains about `WITH SCHEMA extensions`, check repo convention by grepping other migrations that create extensions — match the pattern used.

- [ ] **Step 3: Commit migration (Task 4)**

```bash
git add supabase/migrations/20260624000000_bulk_import_foundation.sql
git commit -m "$(cat <<'EOF'
feat(bulk-import): foundation migration — pg_trgm + import_run + fuzzy-match RPC

ADR-0400 schema home + ADR-0403 schedule_shift.source v3_bulk_import value.
- pg_trgm extension + 3 composite GIN indexes (workspace_id, name) on profile/department/location
- import_run table + JWT-only RLS + updated_at trigger + UNIQUE file-hash idempotency
- fn_fuzzy_match_entity SECURITY DEFINER + pinned search_path + active-only filter
- ALTER schedule_shift.source CHECK to allow v3_bulk_import (writer Sortie C)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Authority seed migration — 4 engine_authority_config rows (L-0083 default-deny)

**Files:**
- Create: `supabase/migrations/20260624000100_bulk_import_authority_seed.sql`

**Pre-work:**
- Read `engine_authority_config` schema: `grep -rn "CREATE TABLE engine_authority_config\b" supabase/migrations/ | head`. Confirm columns (workspace_id is typically NULL for platform-level defaults; tool_name TEXT; authority_level TEXT; allowed_channels TEXT[]; etc.).
- Confirm exact column names + types by reading the create migration directly.
- Note: per L-0083, all 4 tools (parse_spreadsheet, preview_batch, resolve_ambiguity, commit_batch) get authority rows NOW — even though only parse_spreadsheet has a body in Sortie A. Without rows, Sortie B+C builds would hit default-deny when they wire bodies and run integration tests.

- [ ] **Step 1: Find exact engine_authority_config column list**

```bash
grep -rn "CREATE TABLE engine_authority_config" supabase/migrations/ | head -3
```

Read the matching migration file fully — copy the exact column names + types into the seed migration.

- [ ] **Step 2: Write authority seed migration**

```bash
touch supabase/migrations/20260624000100_bulk_import_authority_seed.sql
```

```sql
-- supabase/migrations/20260624000100_bulk_import_authority_seed.sql
-- bulk_import Sortie A authority seed: 4 engine_authority_config rows per L-0083 default-deny
-- ADR-0400 (capability) + ADR-0288 (voice forbidden for irreversible writes)
-- Rows for all 4 tools land NOW; bodies for preview_batch/resolve_ambiguity/commit_batch
-- ship Sortie B+C. Without these rows, default-deny would block integration tests when
-- those bodies land.

BEGIN;

-- Platform-level defaults (workspace_id NULL = applies to all workspaces unless overridden).
-- Adjust column names to match the engine_authority_config schema discovered in pre-work.
-- The structure below is the canonical shape — verify each column exists in your migration
-- file. If schema diverges, adjust the INSERT but PRESERVE the four logical rows.

INSERT INTO engine_authority_config (
  workspace_id,
  capability_name,
  tool_name,
  authority_level,
  allowed_channels,
  min_role,
  created_at,
  updated_at,
  notes
)
VALUES
  -- parse_spreadsheet — read-only, chat-only, manager+ (PII-adjacent file contents)
  (NULL, 'bulk_import', 'parse_spreadsheet', 'suggest',
   ARRAY['chat'], 'manager', now(), now(),
   'ADR-0400 Sortie A. Read-only. PII-adjacent (file contents in payload).'),

  -- preview_batch — single-namespace write to import_run; PII in resolver output
  (NULL, 'bulk_import', 'preview_batch', 'suggest',
   ARRAY['chat'], 'manager', now(), now(),
   'ADR-0400 Sortie B. Writes to import_run only. Body lands Sortie B.'),

  -- resolve_ambiguity — patches resolver_decisions[]; decision input
  (NULL, 'bulk_import', 'resolve_ambiguity', 'suggest',
   ARRAY['chat'], 'manager', now(), now(),
   'ADR-0400 Sortie B. Mutates resolver_decisions[] only. Body lands Sortie B.'),

  -- commit_batch — admin+, confirm gate (largest blast radius capability tool ever added);
  -- voice forbidden per ADR-0288
  (NULL, 'bulk_import', 'commit_batch', 'confirm',
   ARRAY['chat'], 'admin', now(), now(),
   'ADR-0400 Sortie C. Atomic cascade-delegated commit. ADR-0288 voice forbidden. '
   'Body + RPC fn_commit_bulk_import land Sortie C.')
ON CONFLICT DO NOTHING;

COMMIT;
```

> **NOTE for implementer:** the column names above (`capability_name`, `tool_name`,
> `authority_level`, `allowed_channels`, `min_role`, `notes`) MUST be verified against
> the actual `engine_authority_config` schema. If they differ, adjust the INSERT — but
> ensure the 4 logical rows land. Do NOT skip rows for tools whose bodies haven't
> shipped: that's the L-0083 trap.

- [ ] **Step 3: Commit authority seed (Task 5)**

```bash
git add supabase/migrations/20260624000100_bulk_import_authority_seed.sql
git commit -m "$(cat <<'EOF'
feat(bulk-import): authority seed for 4 tools (L-0083 default-deny pre-emption)

Seeds engine_authority_config for parse_spreadsheet (Sortie A) + preview_batch /
resolve_ambiguity (Sortie B) + commit_batch (Sortie C). Rows land NOW so later
sorties don't hit default-deny when their tool bodies arrive. ADR-0288 voice
forbidden on commit_batch. min_role: manager for read/preview; admin for commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Apply migrations + regenerate types (L-0190 + L-0042 hygiene)

**Files:**
- Modify: `packages/supabase/src/database.types.ts` (regenerated; do NOT hand-edit)

- [ ] **Step 1: Verify Supabase local is running**

```bash
op run --env-file=.env.template -- supabase status 2>&1 | head -10
```

Expected: services running. If not, start: `op run --env-file=.env.template -- supabase start`.

- [ ] **Step 2: Reset DB to apply new migrations cleanly**

```bash
op run --env-file=.env.template -- supabase db reset 2>&1 | tail -30
```

Expected: all migrations apply 0..N including the two new bulk_import migrations. Watch for errors on pg_trgm extension creation (should already be enabled in extensions schema by earlier migration); if "already exists", fine. Watch for `cascade_initiator` enum reference errors — if enum missing, that's a blocker before migration applies.

- [ ] **Step 3: Regenerate database types**

```bash
op run --env-file=.env.template -- pnpm --filter @smartout/supabase gen:types 2>&1 | tail -5
```

Expected: `database.types.ts` updated. Verify `import_run` table appears:

```bash
grep -c "import_run:" packages/supabase/src/database.types.ts
```

Expected: ≥1. Also confirm `fn_fuzzy_match_entity` in `Functions`:

```bash
grep -c "fn_fuzzy_match_entity" packages/supabase/src/database.types.ts
```

Expected: ≥1.

- [ ] **Step 4: Build telemetry + utils + supabase dist (L-0190 hygiene before typecheck)**

```bash
pnpm --filter @smartout/telemetry --filter @smartout/utils --filter @smartout/supabase build 2>&1 | tail -10
```

Expected: clean builds, no errors.

- [ ] **Step 5: Commit regenerated types**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
chore(supabase): regenerate types post-bulk-import-foundation migration

import_run table + fn_fuzzy_match_entity RPC now in generated types.
L-0190 hygiene: rebuilt @smartout/{telemetry,utils,supabase} dist before
downstream package typecheck.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: CSV spreadsheet util — `packages/utils/src/spreadsheet/`

**Files:**
- Create: `packages/utils/src/spreadsheet/index.ts`
- Create: `packages/utils/src/spreadsheet/index.test.ts`
- Modify: `packages/utils/package.json` (add papaparse + @types/papaparse)
- Modify: `packages/utils/src/index.ts` (export the new module)

**Pre-work:** Confirm vitest config exists for `@smartout/utils`: `cat packages/utils/vitest.config.ts 2>/dev/null || cat packages/utils/package.json | grep -A2 scripts`. Confirm existing utils export pattern: `head packages/utils/src/index.ts`.

- [ ] **Step 1: Install papaparse**

```bash
pnpm --filter @smartout/utils add papaparse@^5.4.1
pnpm --filter @smartout/utils add -D @types/papaparse@^5.3.14
```

Expected: lockfile updates; pinned versions visible in package.json.

- [ ] **Step 2: Write the failing test first**

```bash
mkdir -p packages/utils/src/spreadsheet
touch packages/utils/src/spreadsheet/index.test.ts
```

```ts
// packages/utils/src/spreadsheet/index.test.ts
import { describe, expect, it } from 'vitest';
import { parseCsv, type Sheet } from './index.js';

describe('parseCsv', () => {
  it('parses headered CSV into one Sheet with headers + rows', () => {
    const csv = 'name,start,end\nKnut,08:00,16:00\nAnna,16:00,00:00\n';
    const sheets: Sheet[] = parseCsv(csv, { sheetName: 'sheet1' });
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.name).toBe('sheet1');
    expect(sheets[0]!.headers).toEqual(['name', 'start', 'end']);
    expect(sheets[0]!.rows).toEqual([
      { name: 'Knut', start: '08:00', end: '16:00' },
      { name: 'Anna', start: '16:00', end: '00:00' },
    ]);
  });

  it('throws on empty input — fail-fast per L-0177', () => {
    expect(() => parseCsv('', { sheetName: 'x' })).toThrow(/empty/i);
  });

  it('throws on header-only input — no data rows', () => {
    expect(() => parseCsv('a,b,c\n', { sheetName: 'x' })).toThrow(/no data rows/i);
  });

  it('preserves cell whitespace (no trimming surprises)', () => {
    const csv = 'a,b\n  x  ,y\n';
    const sheets = parseCsv(csv, { sheetName: 's' });
    expect(sheets[0]!.rows[0]).toEqual({ a: '  x  ', b: 'y' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter @smartout/utils test -- spreadsheet 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement parseCsv**

```bash
touch packages/utils/src/spreadsheet/index.ts
```

```ts
// packages/utils/src/spreadsheet/index.ts
// Sortie A: CSV-only (papaparse). xlsx adoption deferred to Sortie B per ADR-0401.
import Papa from 'papaparse';

export type SheetRow = Record<string, string>;

export type Sheet = {
  name: string;
  headers: string[];
  rows: SheetRow[];
};

export type ParseCsvOptions = {
  sheetName: string;
};

export function parseCsv(input: string, options: ParseCsvOptions): Sheet[] {
  if (!input || input.length === 0) {
    throw new Error('parseCsv: input is empty');
  }

  const parsed = Papa.parse<SheetRow>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0]!;
    throw new Error(`parseCsv: ${first.type} at row ${first.row}: ${first.message}`);
  }

  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data;

  if (rows.length === 0) {
    throw new Error('parseCsv: no data rows (header-only input)');
  }

  return [{ name: options.sheetName, headers, rows }];
}
```

- [ ] **Step 5: Re-run tests to verify pass**

```bash
pnpm --filter @smartout/utils test -- spreadsheet 2>&1 | tail -10
```

Expected: 4 passed.

- [ ] **Step 6: Export from package index**

Edit `packages/utils/src/index.ts` — add: `export * from './spreadsheet/index.js';`

- [ ] **Step 7: Commit (Task 7)**

```bash
git add packages/utils/src/spreadsheet/ packages/utils/src/index.ts \
        packages/utils/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(utils): CSV parser (papaparse) for bulk_import Sortie A

parseCsv(input, {sheetName}) returns Sheet[] with headers + rows. Fail-fast
on empty input + header-only input per L-0177. xlsx parsing deferred to
Sortie B per ADR-0401.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: SHA256 hash util — `packages/utils/src/hash/`

**Files:**
- Create: `packages/utils/src/hash/index.ts`
- Create: `packages/utils/src/hash/index.test.ts`
- Modify: `packages/utils/src/index.ts`

**Pre-work:** Check whether a hash helper already exists: `grep -rn "createHash.*sha256" packages/utils/src/`. If a hex-digest helper already exists, REUSE it; do not duplicate (DRY). If not, proceed.

- [ ] **Step 1: Write failing test first**

```bash
mkdir -p packages/utils/src/hash
touch packages/utils/src/hash/index.test.ts
```

```ts
// packages/utils/src/hash/index.test.ts
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './index.js';

describe('sha256Hex', () => {
  it('returns canonical empty-string hex digest', () => {
    // sha256 of empty string is a well-known constant
    expect(sha256Hex(Buffer.from(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('returns canonical "abc" hex digest', () => {
    expect(sha256Hex(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('accepts Uint8Array input', () => {
    expect(sha256Hex(new Uint8Array([97, 98, 99]))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
pnpm --filter @smartout/utils test -- hash 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

```bash
touch packages/utils/src/hash/index.ts
```

```ts
// packages/utils/src/hash/index.ts
// SHA-256 hex helper for bulk_import file + row idempotency (ADR-0400).
import { createHash } from 'node:crypto';

export function sha256Hex(input: Buffer | Uint8Array | string): string {
  return createHash('sha256').update(input).digest('hex');
}
```

- [ ] **Step 4: Run test, expect 3 passed**

```bash
pnpm --filter @smartout/utils test -- hash 2>&1 | tail -10
```

- [ ] **Step 5: Export + commit (Task 8)**

Add `export * from './hash/index.js';` to `packages/utils/src/index.ts`.

```bash
git add packages/utils/src/hash/ packages/utils/src/index.ts
git commit -m "$(cat <<'EOF'
feat(utils): sha256Hex helper for bulk_import file + row idempotency

ADR-0400 idempotency: file-level (excel_sha256 UNIQUE) + row-level (row_hashes[]).
Wraps node:crypto createHash to hex digest. Accepts Buffer / Uint8Array / string.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Resolver wrapper — `packages/ai/src/resolver/`

**Files:**
- Create: `packages/ai/src/resolver/index.ts`
- Create: `packages/ai/src/resolver/index.test.ts`

**Pre-work:** Read `packages/ai/src/capabilities/types.ts` to find the `AgentToolContext` shape — it has a Supabase client property used to call RPCs. Read one existing tool that calls an RPC (e.g. any tool under `packages/ai/src/capabilities/scheduler/tools.ts`) to copy the exact client invocation pattern.

- [ ] **Step 1: Failing test first**

```bash
mkdir -p packages/ai/src/resolver
touch packages/ai/src/resolver/index.test.ts
```

```ts
// packages/ai/src/resolver/index.test.ts
import { describe, expect, it, vi } from 'vitest';
import { resolveEntity } from './index.js';

const makeClient = (returnValue: unknown, error: unknown = null) => ({
  rpc: vi.fn().mockResolvedValue({ data: returnValue, error }),
});

describe('resolveEntity', () => {
  it('returns ranked candidates from fn_fuzzy_match_entity', async () => {
    const client = makeClient([
      { matched_id: '11111111-1111-1111-1111-111111111111', matched_name: 'Knut Hansen', confidence: 0.98 },
      { matched_id: '22222222-2222-2222-2222-222222222222', matched_name: 'Knut Andersen', confidence: 0.92 },
    ]);
    const res = await resolveEntity({
      client: client as any,
      type: 'profile',
      raw_name: 'Knut Hansen',
      workspace_id: '00000000-0000-0000-0000-000000000000',
      threshold: 0.9,
    });
    expect(client.rpc).toHaveBeenCalledWith('fn_fuzzy_match_entity', {
      p_workspace_id: '00000000-0000-0000-0000-000000000000',
      p_entity_type: 'profile',
      p_raw_name: 'Knut Hansen',
      p_threshold: 0.9,
    });
    expect(res).toHaveLength(2);
    expect(res[0]!.confidence).toBe(0.98);
  });

  it('throws fail-fast on RPC error (no silent fallback per L-0177)', async () => {
    const client = makeClient(null, { message: 'pg_trgm not installed' });
    await expect(
      resolveEntity({
        client: client as any,
        type: 'department',
        raw_name: 'Kjøkken',
        workspace_id: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(/pg_trgm not installed/);
  });

  it('returns empty array when no candidate meets threshold', async () => {
    const client = makeClient([]);
    const res = await resolveEntity({
      client: client as any,
      type: 'location',
      raw_name: 'Filial X',
      workspace_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(res).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (FAIL)**

```bash
pnpm --filter @smartout/ai test -- resolver 2>&1 | tail -10
```

- [ ] **Step 3: Implement**

```bash
touch packages/ai/src/resolver/index.ts
```

```ts
// packages/ai/src/resolver/index.ts
// Resolver wrapper for bulk_import fuzzy-match RPC. ADR-0400.
import type { SupabaseClient } from '@supabase/supabase-js';

export type EntityType = 'profile' | 'department' | 'location';

export type FuzzyMatch = {
  matched_id: string;
  matched_name: string;
  confidence: number;
};

export type ResolveEntityArgs = {
  client: SupabaseClient;
  type: EntityType;
  raw_name: string;
  workspace_id: string;
  threshold?: number; // 0..1, default 0.9
};

export async function resolveEntity(args: ResolveEntityArgs): Promise<FuzzyMatch[]> {
  const { client, type, raw_name, workspace_id, threshold = 0.9 } = args;
  const { data, error } = await client.rpc('fn_fuzzy_match_entity', {
    p_workspace_id: workspace_id,
    p_entity_type: type,
    p_raw_name: raw_name,
    p_threshold: threshold,
  });
  if (error) {
    // Fail-fast per L-0177 — no silent fallback to empty array on RPC failure.
    throw new Error(`resolveEntity(${type}): ${error.message}`);
  }
  return (data ?? []) as FuzzyMatch[];
}
```

- [ ] **Step 4: Run test (3 passed)**

```bash
pnpm --filter @smartout/ai test -- resolver 2>&1 | tail -10
```

- [ ] **Step 5: Commit (Task 9)**

```bash
git add packages/ai/src/resolver/
git commit -m "$(cat <<'EOF'
feat(ai): resolveEntity wrapper around fn_fuzzy_match_entity RPC

ADR-0400 resolver primitive. Calls RPC with (workspace_id, entity_type, raw_name,
threshold). Fail-fast on RPC error per L-0177 — no silent empty-array fallback.
Returns top-5 candidates above threshold (RPC enforces LIMIT 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: parse_spreadsheet tool — `packages/ai/src/capabilities/bulk_import/tools.ts`

**Files:**
- Create: `packages/ai/src/capabilities/bulk_import/tools.ts`
- Create: `packages/ai/src/capabilities/bulk_import/tools.test.ts`

**Pre-work:**
- Read `packages/ai/src/capabilities/types.ts` for `SmartoutTool<AgentToolContext>` definition and emit helpers.
- Read another read-only tool (`grep -rn "readOnlyTools" packages/ai/src/capabilities/ | head`) to mirror parameter shape, Zod schema pattern, and emit call-site.
- Confirm `getProfileContext` helper used elsewhere for workspace/profile resolution. Use it — do NOT accept workspace_id from input arg (ADR-0151 + L-0177).
- File body is written FIRST per L-0176; docstring claiming ADR compliance written LAST after Tool Compliance Self-Check passes.

**Tool design:**
- Input Zod schema: `{ source_storage_path: string, source_kind: 'vaktliste'|'kjoreplan'|'mixed' }`
- Behavior:
  1. Derive workspace_id + profile_id from auth context (ADR-0151 + L-0177; fail-fast)
  2. Verify storage path is workspace-prefixed: `botsson-imports/{workspace_id}/...` — else REJECT with 4xx
  3. Fetch signed URL from Supabase Storage (1h TTL — already returned by Sortie 0 upload endpoint, but verify path matches workspace)
  4. Download file via signed URL
  5. Validate MIME by file extension — Sortie A accepts `.csv` only; `.xlsx`/`.xls` → REJECT with "xlsx support ships Sortie B per ADR-0401"
  6. Compute `excel_sha256` (sha256Hex from Task 8)
  7. Parse via `parseCsv` (Task 7)
  8. Suggest column mapping: pattern-match headers (case-insensitive) against `vaktliste` known fields (name|navn, start|fra, end|til|stop, department|avdeling, location|lokasjon|sted) OR `kjoreplan` fields (time|tid, location|sted, tasks|oppgaver|gjøremål). Return `suggestedMapping: Record<canonicalField, headerName | null>`.
  9. Emit ONCE: `bulk_import.batch_parsed` with `properties.data = { workspace_id, source_kind, sheet_count, row_count, excel_sha256, suggested_mapping_completeness }`
  10. Return `{ sheets, excel_sha256, suggested_mapping }` — do NOT write to import_run (Sortie B does that)

- [ ] **Step 1: Write tool body first (no docstring claim yet — L-0176)**

```bash
touch packages/ai/src/capabilities/bulk_import/tools.ts
```

```ts
// packages/ai/src/capabilities/bulk_import/tools.ts
// bulk_import Sortie A: parse_spreadsheet tool (read-only).
// ADR-0400 (capability), ADR-0151 (server-derived workspace_id), ADR-0287 (ONE emit per
// gated mutation — here: ONE emit per successful parse), L-0177 (fail-fast on workspace
// resolution), L-0176 (body written before docstring).
import { z } from 'zod';
import { parseCsv, sha256Hex, type Sheet } from '@smartout/utils';
import { emit } from '@smartout/telemetry';
import type { SmartoutTool } from '../../types.js';
import type { AgentToolContext } from '../types.js';
import { getProfileContext } from '../../context/profile-context.js'; // adjust path if helper lives elsewhere

const VAKTLISTE_HEADER_MAP: Record<string, RegExp> = {
  employee_name: /^(name|navn|ansatt|employee)$/i,
  start_time: /^(start|fra|start_time|starttid)$/i,
  end_time: /^(end|til|stop|stopp|end_time|slutttid)$/i,
  department: /^(department|avdeling|avd)$/i,
  location: /^(location|lokasjon|sted|filial)$/i,
};

const KJOREPLAN_HEADER_MAP: Record<string, RegExp> = {
  time: /^(time|tid|klokkeslett|kl)$/i,
  location: /^(location|lokasjon|sted)$/i,
  tasks: /^(tasks|oppgaver|gjøremål|gjoremål|gjoremal)$/i,
};

function suggestMapping(
  headers: string[],
  kind: 'vaktliste' | 'kjoreplan' | 'mixed',
): Record<string, string | null> {
  const map = kind === 'kjoreplan' ? KJOREPLAN_HEADER_MAP : VAKTLISTE_HEADER_MAP;
  const result: Record<string, string | null> = {};
  for (const [canonical, pattern] of Object.entries(map)) {
    result[canonical] = headers.find((h) => pattern.test(h.trim())) ?? null;
  }
  return result;
}

const parseSpreadsheetInputSchema = z.object({
  source_storage_path: z.string().min(1),
  source_kind: z.enum(['vaktliste', 'kjoreplan', 'mixed']),
});

export const parseSpreadsheetTool: SmartoutTool<AgentToolContext> = {
  name: 'parse_spreadsheet',
  description:
    'Read-only: download a previously uploaded spreadsheet from the workspace-scoped storage ' +
    'bucket, validate MIME (CSV only in Sortie A — xlsx ships Sortie B per ADR-0401), parse ' +
    'rows, and return parsed sheets + a suggested header→canonical-field mapping. Does NOT ' +
    'write to import_run — that happens in Sortie B preview_batch. Authority: suggest, ' +
    'chat-only, manager+ per ADR-0400. PII-adjacent: file contents reach this tool, but ' +
    'no DB writes occur. Compliance verified against L-0151 (server-derived workspace_id), ' +
    'L-0176 (body-before-docstring), L-0177 (fail-fast on auth context).',
  input: parseSpreadsheetInputSchema,
  async execute(input, ctx) {
    // ADR-0151 + L-0177: derive workspace_id + profile_id server-side; fail-fast.
    const { workspaceId, profileId } = await getProfileContext(ctx);

    // Workspace-scoped path enforcement (L-0177 — no silent fallback).
    const expectedPrefix = `botsson-imports/${workspaceId}/`;
    if (!input.source_storage_path.startsWith(expectedPrefix)) {
      throw new Error(
        `parse_spreadsheet: storage_path does not belong to workspace ${workspaceId}`,
      );
    }

    // Sortie A: CSV-only. xlsx returns explicit rejection (ADR-0401).
    const lower = input.source_storage_path.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      throw new Error(
        'parse_spreadsheet: xlsx/xls parsing ships Sortie B per ADR-0401. Use .csv for Sortie A.',
      );
    }
    if (!lower.endsWith('.csv')) {
      throw new Error(
        `parse_spreadsheet: unsupported extension on ${input.source_storage_path}; expected .csv`,
      );
    }

    // Fetch signed URL (1h TTL). Bucket: botsson-imports (Sortie 0 migration).
    const { data: signed, error: signErr } = await ctx.supabase.storage
      .from('botsson-imports')
      .createSignedUrl(input.source_storage_path.replace(/^botsson-imports\//, ''), 3600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`parse_spreadsheet: failed to sign storage path: ${signErr?.message}`);
    }

    // Download file bytes.
    const res = await fetch(signed.signedUrl);
    if (!res.ok) {
      throw new Error(`parse_spreadsheet: download ${res.status} from signed URL`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const excelSha256 = sha256Hex(buf);

    // Parse CSV.
    const text = buf.toString('utf8');
    const sheets: Sheet[] = parseCsv(text, { sheetName: input.source_kind });

    // Suggest column mapping (per sheet — Sortie A: single sheet).
    const headers = sheets[0]?.headers ?? [];
    const suggestedMapping = suggestMapping(headers, input.source_kind);
    const mappingCompleteness =
      Object.values(suggestedMapping).filter((v) => v !== null).length /
      Object.keys(suggestedMapping).length;

    // ADR-0287: ONE emit per successful parse.
    await emit('bulk_import.batch_parsed', {
      properties: {
        data: {
          workspace_id: workspaceId,
          profile_id: profileId,
          source_kind: input.source_kind,
          sheet_count: sheets.length,
          row_count: sheets.reduce((sum, s) => sum + s.rows.length, 0),
          excel_sha256: excelSha256,
          suggested_mapping_completeness: Number(mappingCompleteness.toFixed(2)),
        },
      },
    });

    return {
      sheets,
      excel_sha256: excelSha256,
      suggested_mapping: suggestedMapping,
    };
  },
};
```

> **Verification before docstring:** run Tool Compliance Self-Check from `smartout-agent-dev`
> skill (workspace-scoped, ADR-0151, ADR-0287 one-emit, L-0176 body-first, L-0177 fail-fast).
> If any row fails, revise body BEFORE the docstring claims compliance.

- [ ] **Step 2: Write failing tests**

```bash
touch packages/ai/src/capabilities/bulk_import/tools.test.ts
```

```ts
// packages/ai/src/capabilities/bulk_import/tools.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseSpreadsheetTool } from './tools.js';

vi.mock('@smartout/telemetry', () => ({ emit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../context/profile-context.js', () => ({
  getProfileContext: vi.fn().mockResolvedValue({
    workspaceId: 'ws-1',
    profileId: 'prof-1',
  }),
}));

const csvBytes = Buffer.from('name,start,end\nKnut,08:00,16:00\n', 'utf8');

const mkCtx = (overrides: any = {}) => ({
  supabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.test/file.csv' },
          error: null,
        }),
      }),
    },
    ...overrides,
  },
});

describe('parseSpreadsheetTool', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(csvBytes.buffer.slice(0)),
    }) as any;
  });

  it('rejects path not prefixed with workspace_id (L-0177 no silent fallback)', async () => {
    await expect(
      parseSpreadsheetTool.execute(
        {
          source_storage_path: 'botsson-imports/OTHER-WS/x.csv',
          source_kind: 'vaktliste',
        },
        mkCtx() as any,
      ),
    ).rejects.toThrow(/does not belong to workspace ws-1/);
  });

  it('rejects xlsx with ADR-0401 reference (Sortie A is CSV-only)', async () => {
    await expect(
      parseSpreadsheetTool.execute(
        {
          source_storage_path: 'botsson-imports/ws-1/file.xlsx',
          source_kind: 'vaktliste',
        },
        mkCtx() as any,
      ),
    ).rejects.toThrow(/ADR-0401/);
  });

  it('parses CSV + emits batch_parsed ONCE + returns sheets + sha256', async () => {
    const { emit } = await import('@smartout/telemetry');
    const result = await parseSpreadsheetTool.execute(
      {
        source_storage_path: 'botsson-imports/ws-1/file.csv',
        source_kind: 'vaktliste',
      },
      mkCtx() as any,
    );
    expect(result.sheets[0]!.headers).toEqual(['name', 'start', 'end']);
    expect(result.excel_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      'bulk_import.batch_parsed',
      expect.objectContaining({
        properties: expect.objectContaining({
          data: expect.objectContaining({
            workspace_id: 'ws-1',
            source_kind: 'vaktliste',
            sheet_count: 1,
            row_count: 1,
          }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 3: Run tests, expect 3 passed**

```bash
pnpm --filter @smartout/ai test -- bulk_import 2>&1 | tail -15
```

If imports fail (paths), adjust to match the actual `getProfileContext` location confirmed in pre-work. If `SmartoutTool.execute` signature differs (e.g. context as 1st arg, input as 2nd), reverse — the test must match the contract.

- [ ] **Step 4: Commit (Task 10)**

```bash
git add packages/ai/src/capabilities/bulk_import/tools.ts \
        packages/ai/src/capabilities/bulk_import/tools.test.ts
git commit -m "$(cat <<'EOF'
feat(bulk-import): parse_spreadsheet tool (read-only Sortie A)

Server-derived workspace_id per ADR-0151. Workspace-prefixed path enforcement
per L-0177 (fail-fast — no silent fallback). xlsx rejection cites ADR-0401.
ONE emit per parse per ADR-0287. Returns parsed sheets + sha256 + suggested
column mapping (vaktliste|kjoreplan|mixed pattern-matched headers). Does NOT
write to import_run — Sortie B preview_batch owns that write.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Wire parse_spreadsheet into capability tools array

**Files:**
- Modify: `packages/ai/src/capabilities/bulk_import/index.ts`

- [ ] **Step 1: Replace empty array with [parseSpreadsheetTool]**

Open `packages/ai/src/capabilities/bulk_import/index.ts`. Replace:

```ts
const allTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
```

with:

```ts
import { parseSpreadsheetTool } from './tools.js';

const allTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [parseSpreadsheetTool];
```

Also update the `readOnlyTools` and `suggestTools` assignments — since parse_spreadsheet is read-only AND has `suggest` authority, both arrays equal `allTools` in Sortie A. Verify the file still matches the existing skeleton's structural pattern after edit.

- [ ] **Step 2: Typecheck the AI package**

```bash
pnpm --filter @smartout/ai typecheck 2>&1 | tail -10
```

Expected: 0 errors. If TS2307 on `@smartout/utils`, rebuild it: `pnpm --filter @smartout/utils build` then retry.

- [ ] **Step 3: Run the AI test suite (bulk_import + capability registry)**

```bash
pnpm --filter @smartout/ai test 2>&1 | tail -20
```

Expected: existing tests pass + new bulk_import tests pass.

- [ ] **Step 4: Commit (Task 11)**

```bash
git add packages/ai/src/capabilities/bulk_import/index.ts
git commit -m "$(cat <<'EOF'
feat(bulk-import): wire parse_spreadsheet into capability tools array

Sortie 0 skeleton's empty array replaced with [parseSpreadsheetTool].
readOnlyTools + suggestTools both reference allTools in Sortie A (single
read-only tool with suggest authority). Sortie B+C extend with
preview_batch / resolve_ambiguity / commit_batch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Telemetry registry — register `bulk_import.batch_parsed` (ADR-0377 same-commit gate)

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

**Pre-work:** Read existing registry entries near where capability events live (e.g. grep `^  'scheduler\.'\|^  scheduler\.` to find pattern). Confirm exact key syntax (object literal? Record entries?) and destination shape (`destinations: ['posthog', 'logger', 'activity_trail', 'engine_event']` — which combination?).

For `bulk_import.batch_parsed`: read-only telemetry. Destinations:
- `posthog` — admin analytics (how often do bulk-imports run, suggested-mapping completeness distribution)
- `logger` — stdout for debugging
- NOT `activity_trail` — Sortie A parse is read-only, no audit-trail entry needed until Sortie B commit
- NOT `engine_event` — no workflow trigger on parse

- [ ] **Step 1: Locate registry entry pattern**

```bash
grep -n "'scheduler\.\|scheduler\." packages/telemetry/src/registry.ts | head -5
```

Note the exact registry shape.

- [ ] **Step 2: Add entry**

Find the logical alphabetical / capability-grouped location and add:

```ts
'bulk_import.batch_parsed': {
  description:
    'parse_spreadsheet tool successfully parsed an uploaded spreadsheet. ' +
    'Read-only telemetry; commit emits batch_committed in Sortie C.',
  destinations: ['posthog', 'logger'],
  properties: {
    data: {
      workspace_id: 'uuid',
      profile_id: 'uuid',
      source_kind: 'vaktliste | kjoreplan | mixed',
      sheet_count: 'number',
      row_count: 'number',
      excel_sha256: 'string (64 hex)',
      suggested_mapping_completeness: 'number 0..1',
    },
  },
  emitted_by: 'packages/ai/src/capabilities/bulk_import/tools.ts:parseSpreadsheetTool.execute',
},
```

Adjust shape to match registry conventions (some registries use different keys).

- [ ] **Step 3: Build telemetry dist + typecheck consumers**

```bash
pnpm --filter @smartout/telemetry build 2>&1 | tail -5
pnpm --filter @smartout/ai typecheck 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 4: Commit (Task 12)**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): register bulk_import.batch_parsed (Sortie A)

ADR-0377 register-with-emit: this entry lands SAME COMMIT cluster as the
emit() call-site in parse_spreadsheet (registered to posthog + logger; no
activity_trail / engine_event — read-only). batch_previewed / batch_committed
/ batch_failed registered in Sortie B/C when their emit sites land.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Integration smoke — parse_spreadsheet end-to-end against local stage-engine

**Files:**
- Create: `apps/e2e/bulk-import/sortie-a-parse-spreadsheet.spec.ts` (Playwright, but smoke-only — full E2E lands Sortie B with UI)

**Pre-work:** Verify local stage-engine + supabase running. Verify a real CSV fixture exists or create one: `apps/e2e/bulk-import/fixtures/vaktliste.csv` with 5 rows.

- [ ] **Step 1: Create fixture**

```bash
mkdir -p apps/e2e/bulk-import/fixtures
```

```csv
name,start,end,department
Knut Hansen,08:00,16:00,Kjøkken
Anna Berg,16:00,00:00,Sal
Lars Olsen,12:00,20:00,Bar
Mia Sundt,08:00,16:00,Kjøkken
Per Vik,16:00,00:00,Sal
```

Save as `apps/e2e/bulk-import/fixtures/vaktliste-sortie-a.csv`.

- [ ] **Step 2: Write smoke test (test.skip pending live infra wiring — flips to test() Sortie B with UI)**

```ts
// apps/e2e/bulk-import/sortie-a-parse-spreadsheet.spec.ts
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Sortie A: capability-layer smoke. Full UI E2E lands Sortie B per spec out-of-scope.
test.skip('parse_spreadsheet (Sortie A) returns parsed sheets + sha256 + suggested mapping', async ({
  request,
}) => {
  // Upload via Sortie 0 BFF endpoint /api/botsson/imports/upload (requires authenticated session).
  const csvBytes = readFileSync(
    resolve(__dirname, 'fixtures/vaktliste-sortie-a.csv'),
  );
  const uploadRes = await request.post('/api/botsson/imports/upload', {
    multipart: {
      file: {
        name: 'vaktliste-sortie-a.csv',
        mimeType: 'text/csv',
        buffer: csvBytes,
      },
    },
  });
  expect(uploadRes.status()).toBe(200);
  const { storage_path } = await uploadRes.json();
  expect(storage_path).toMatch(/^botsson-imports\/[0-9a-f-]{36}\//);

  // Dispatch chat with attachment → MIME dispatcher → bulk_import.parse_spreadsheet
  const chatRes = await request.post('/api/emma/chat', {
    data: {
      message: 'Parse this vaktliste',
      userMessageAttachments: [
        {
          storage_path,
          filename: 'vaktliste-sortie-a.csv',
          mime_type: 'text/csv',
          size: csvBytes.length,
          sha256: '',
          kind: 'vaktliste',
        },
      ],
    },
  });
  expect(chatRes.status()).toBe(200);
  const body = await chatRes.json();
  // Shape: tool result includes sheets[0].headers + excel_sha256 + suggested_mapping
  expect(body.toolResults?.[0]?.sheets?.[0]?.headers).toEqual(
    expect.arrayContaining(['name', 'start', 'end', 'department']),
  );
  expect(body.toolResults?.[0]?.excel_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(body.toolResults?.[0]?.suggested_mapping).toMatchObject({
    employee_name: 'name',
    start_time: 'start',
    end_time: 'end',
    department: 'department',
    location: null,
  });
});
```

- [ ] **Step 3: Manual smoke (without flipping skip) — verify unit-test path stack works against running stage-engine**

```bash
# Confirm services running (or skip and document as deferred-to-Sortie-B)
op run --env-file=.env.template -- supabase status 2>&1 | grep "API URL"
curl -s http://localhost:54321/rest/v1/import_run?limit=1 \
  -H "apikey: $(op read 'op://smartout_ai_dev/supabase-local/anon-key')" 2>&1 | head -5
```

If 200 (or even 401 without auth) — table exists. If 404 — migration didn't apply.

- [ ] **Step 4: Commit (Task 13)**

```bash
git add apps/e2e/bulk-import/
git commit -m "$(cat <<'EOF'
test(bulk-import): smoke spec for parse_spreadsheet (skip pending Sortie B UI)

apps/e2e fixture + Playwright spec scaffolded. test.skip until Sortie B
lands the composer UI + authenticated session helper. Sortie A code path
verified manually via curl + unit tests (Tasks 7-10).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Pre-close verification + handoff prep

- [ ] **Step 1: Run full typecheck across affected packages**

```bash
pnpm turbo typecheck --filter=@smartout/utils --filter=@smartout/telemetry \
  --filter=@smartout/ai --filter=@smartout/supabase 2>&1 | tail -20
```

Expected: 0 errors. If OOM: `TURBO_CONCURRENCY=1 pnpm turbo typecheck ...` (L-0190 family).

- [ ] **Step 2: Run full test suite for the same packages**

```bash
pnpm --filter @smartout/utils test 2>&1 | tail -10
pnpm --filter @smartout/ai test 2>&1 | tail -10
```

Expected: green.

- [ ] **Step 3: Lint commit history (commitlint sanity)**

```bash
git log --oneline development..HEAD | head -20
```

Verify every commit header ≤100 chars; scope kebab-case (`bulk-import`); Co-Authored-By trailer present.

- [ ] **Step 4: Cross-branch ADR collision re-check (L-0316 final gate before close)**

```bash
git fetch --all
for n in 0400 0401 0403; do
  echo "=== $n ==="
  git log --all --oneline -- "docs/decisions/${n}-*.md" | head -3
done
```

Expected: each shows only THIS branch's commit. If any other branch surfaces with an `${n}-*` commit, halt and escalate (renumber dance).

- [ ] **Step 5: HANDOFF prep — note for /close-feature**

Per CLAUDE.md /close-feature step: HANDOFF written automatically by `close-feature.sh`. Prepare bullets for the HANDOFF "Summary / Decisions / Learnings / Known Issues / Next Steps" sections:

- Summary: bulk_import Sortie A foundation shipped — 3 ADRs + 2 migrations + 2 utils + resolver + 1 read-only tool + 1 telemetry registry entry.
- Decisions registered: 0400/0401/0403.
- Learnings to flag for ADR-grade promotion (queued for Sortie C HANDOFF per spec line 261):
  - L-NEW-A (chair prose vs code-tracer column-name verification) — 3rd occurrence
  - L-NEW-B (capability-layer entity creation across auth.users chain infeasible) — promote to smartout-database-guide trap
  - L-0292 (ADR-0112 enum-lag) — 6th occurrence resolved Sortie 0; promote to mandatory pre-flight check
  - L-0316 (cross-branch ADR collision) — 6th occurrence resolved Sortie A; renumber dance documented in 0400 ADR Context
- Known issues / debt: Authority seed migration column names verified at implementation (engine_authority_config schema match); if seed migration adjusted, note exactly which column names were used.
- Next steps: Sortie B (preview_batch + resolve_ambiguity + composer UI) depends on this sortie green + ADR-0401 review-and-accept gate before xlsx adoption.

---

## Self-Review (run before handing to executor)

**1. Spec coverage scan (lines 88–104):**
- ADR-0400 written → Task 1 ✓
- ADR-0401 written → Task 2 ✓
- ADR-0403 written → Task 3 ✓
- Foundation migration (pg_trgm, GIN, import_run, fn_fuzzy_match_entity, ALTER CHECK) → Task 4 ✓
- Skeleton capability → already shipped Sortie 0; tools array updated in Task 11 ✓
- `packages/utils/src/spreadsheet/` → Task 7 ✓
- `packages/utils/src/hash/` → Task 8 ✓
- `packages/ai/src/resolver/` → Task 9 ✓
- parse_spreadsheet tool → Task 10 + Task 11 ✓
- Telemetry registry entries → Task 12 (Sortie A registers ONLY batch_parsed per ADR-0377) ✓
- Authority seed migration (4 rows SAME COMMIT) → Task 5 ✓

**2. Placeholder scan:** No "TBD", "implement later", or vague "add error handling". Every code step shows actual code.

**3. Type consistency:**
- `Sheet` type defined Task 7 → consumed Task 10 ✓
- `FuzzyMatch` type defined Task 9 → not yet consumed in Sortie A (preview_batch in Sortie B consumes) — OK forward-declared in resolver module
- `sha256Hex` signature consistent Task 8 → Task 10 ✓
- `parseSpreadsheetTool.execute(input, ctx)` signature matches mock in test (Task 10 Step 2)

**4. Commit hygiene:** every commit step shows the exact `git add` + HEREDOC commit message. All headers ≤100 chars. Scope kebab-case (`bulk-import`). Co-Authored-By trailer in every commit.

**5. Migration ordering:** `20260624000000` < `20260624000100` < everything-Sortie-B (which will use `20260625...` or later). All > current dev tip `20260623100000`.

**6. Risk gates honored:**
- L-0083 default-deny: Task 5 seeds ALL 4 tools' authority rows now ✓
- L-0316 cross-branch collision: Step 1 of every ADR task re-checks slot ✓
- ADR-0287 ONE emit: Task 10 emits exactly once at successful parse ✓
- ADR-0377 register-with-emit: Task 12 registers ONLY the event with a live emit site ✓
- L-0042 timestamp ordering: Task 4 + Task 5 both > dev tip ✓
- L-0176 docstring drift: Task 10 explicitly writes body first ✓
- L-0177 fail-fast: parse_spreadsheet rejects on path mismatch + RPC error ✓
- ADR-0151 server-derived: getProfileContext used; no body workspace_id ✓
- ADR-0173 frozen-4: parse_spreadsheet is read-only — no namespace-crossing ✓

---

## Execution Handoff

After self-review passes, offer execution choice (per writing-plans skill):

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-bulk-import-sortie-a.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
