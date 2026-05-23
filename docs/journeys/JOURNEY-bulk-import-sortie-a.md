---
title: User Journey — bulk_import Sortie A — Foundation + parse_spreadsheet + fuzzy-match RPC
status: in_progress
updated: 2026-05-23
created: 2026-05-23
module: bulk-import
tags: [bulk-import, sortie-a, journey, parse-spreadsheet, fuzzy-match, foundation]
---

# User Journey — bulk_import Sortie A — Foundation + parse_spreadsheet + fuzzy-match RPC

> **Note:** Sortie A delivers the database foundation + first read-only capability tool + the fuzzy-match resolver primitive. There is still NO user-visible composer UI (that ships Sortie B per ADR-0133 Compose-verbs web boundary). User-visible outcomes in Sortie A are limited to (1) `parse_spreadsheet` returning parsed sheets + suggested column mapping in the chat response payload, and (2) the `fn_fuzzy_match_entity` RPC being callable via SQL / Supabase client. The DB writes that turn parsed rows into actual shifts ship Sortie C.

---

## Journey 1: Admin Uploads .csv → parse_spreadsheet Returns Parsed Sheets + Suggested Mapping (Read-Only)

**Role:** Admin or Owner — `min_role: manager` (Sortie 0 BFF upload requires admin; parse_spreadsheet authority is `suggest`/manager+)
**Surface:** Web dashboard — BotssonChat composer (`apps/web`) → `/api/botsson/imports/upload` (Sortie 0 BFF) → `/api/emma/chat` → stage-engine → `bulk_import.parse_spreadsheet` tool
**Precondition:**
- User authenticated, workspace active, BotssonChat mounted
- Sortie 0 attachment pipeline live (storage bucket + signed-URL upload + MIME dispatcher)
- Sortie A migration applied: `import_run` table exists, `fn_fuzzy_match_entity` RPC callable, `parseSpreadsheetTool` wired into `bulk_import.tools` array

### Happy Path

1. User drags `vaktliste.csv` (≤10 MB) onto BotssonChat composer.
   - Browser uploads via `POST /api/botsson/imports/upload` (Sortie 0 BFF) — returns `{ signedUrl, path: 'botsson-imports/{workspace_id}/{uuid}.csv', filename }`.
2. User types optional message ("parse this vaktliste") and clicks Send.
   - Client calls `POST /api/emma/chat` with `{ message, userMessageAttachments: [{ signedUrl, filename, mimeType: 'text/csv' }] }`.
3. BFF forwards `attachments` to stage-engine `POST /agent/chat`.
4. Stage-engine `chatSchema` validates payload — `attachments` array passes Zod.
5. `routeAgentMessage()` calls `resolveCapabilityFromAttachments()`:
   - `.csv` → `text/csv` → `{ capability: 'bulk_import', source: 'deterministic_attachment' }`
   - Emits `attachment.routed` telemetry once
6. `bulk_import` capability dispatches `parse_spreadsheet` tool (Sortie A: tools array now contains `[parseSpreadsheetTool]`).
7. `parseSpreadsheetTool.execute()`:
   - Derives `workspaceId` + `profileId` from auth context via `getProfileContext()` (ADR-0151 + L-0177 fail-fast)
   - Verifies `source_storage_path` starts with `botsson-imports/{workspaceId}/` — else REJECT 4xx
   - Verifies `.csv` extension (Sortie A is CSV-only per ADR-0402)
   - Fetches signed URL from Supabase Storage (1h TTL)
   - Downloads file bytes
   - Computes `excel_sha256` via `sha256Hex(buf)`
   - Parses CSV via `parseCsv(text, { sheetName: source_kind })` — returns `Sheet[]` with `headers` + `rows`
   - Pattern-matches headers against `vaktliste` canonical fields (name|navn, start|fra, end|til|stop, department|avdeling, location|sted) and returns `suggested_mapping`
   - Emits `bulk_import.batch_parsed` ONCE with `properties.data` containing `workspace_id`, `profile_id`, `source_kind`, `sheet_count`, `row_count`, `excel_sha256`, `suggested_mapping_completeness`
   - Returns `{ sheets, excel_sha256, suggested_mapping }` to caller
8. Stage-engine returns chat response containing the tool result.
9. User sees Botsson's reply with the parsed rows preview + suggested column mapping (text-rendered; the polished composer UI lands Sortie B).

**Postcondition:**
- No row written to `import_run` (Sortie A is read-only; Sortie B's `preview_batch` performs the first write)
- Exactly one `bulk_import.batch_parsed` event in PostHog + logger (no `activity_trail`/`engine_event` destinations per ADR-0377 read-only registration)
- File remains in Supabase Storage at `botsson-imports/{workspace_id}/{uuid}.csv` for Sortie B preview_batch consumption

**Error paths:**
- **Unauthenticated** → BFF returns 401 at step 1; chat call never happens.
- **Non-admin role** → BFF upload returns 403 at step 1 (admin-only INSERT policy on storage bucket per Sortie 0 migration).
- **Path mismatch** (storage path workspace prefix ≠ caller's workspace_id) → `parse_spreadsheet` throws `parse_spreadsheet: storage_path does not belong to workspace {workspace_id}`. Tool surfaces error to user via chat reply. NO silent fallback per L-0177.
- **xlsx upload** → `parse_spreadsheet` throws `parse_spreadsheet: xlsx/xls parsing ships Sortie B per ADR-0402. Use .csv for Sortie A.`
- **Unsupported extension** (.txt, .json, etc.) → `parse_spreadsheet` throws `parse_spreadsheet: unsupported extension; expected .csv` (Sortie 0 MIME allowlist should already block this at upload, but tool defends in depth).
- **Storage signed-URL failure** → throws `parse_spreadsheet: failed to sign storage path: {error}` — user sees error in chat.
- **Download failure** (network, file deleted between upload and parse) → throws `parse_spreadsheet: download {status} from signed URL`.
- **Empty CSV** → `parseCsv` throws `parseCsv: input is empty` — propagated to chat reply.
- **Header-only CSV** (no data rows) → `parseCsv` throws `parseCsv: no data rows (header-only input)`.
- **Malformed CSV** (papaparse parsing errors) → `parseCsv` throws with the first error's row + message.

---

## Journey 2: Resolver Calls fn_fuzzy_match_entity → Ranked Candidate List

**Role:** Developer / capability author / DB consumer — the RPC is workspace-scoped and authority-checked via `SECURITY DEFINER` + `service_role` + `authenticated` grants. In Sortie A there is NO agent-callable tool exposing this RPC; it is consumed by the resolver wrapper (`packages/ai/src/resolver/`) which Sortie B's `preview_batch` will call.
**Surface:** Direct SQL via Supabase client OR via `resolveEntity({ type, raw_name, workspace_id, threshold })` from `@smartout/ai/resolver`
**Precondition:**
- Sortie A migration applied: `pg_trgm` extension live, composite GIN indexes built, `fn_fuzzy_match_entity` function callable
- Workspace has at least one matching entity row (profile / department / location) above the threshold
- Caller has `EXECUTE` grant on `fn_fuzzy_match_entity` (granted to `authenticated` + `service_role` in foundation migration)

### Happy Path

1. Consumer (resolver wrapper or test) calls `fn_fuzzy_match_entity(p_workspace_id, p_entity_type, p_raw_name, p_threshold)`:
   - `p_workspace_id`: UUID of the active workspace
   - `p_entity_type`: `'profile'` | `'department'` | `'location'`
   - `p_raw_name`: text from the imported spreadsheet (e.g. `'Knut Hansne'` — misspelled)
   - `p_threshold`: numeric 0..1 (default 0.9)
2. RPC validates inputs (CHECK constraints: entity_type ∈ valid set, raw_name non-empty, threshold 0..1) — RAISE EXCEPTION on violation.
3. RPC scans the target table (e.g. `profile` for `'profile'` type), filtered by `workspace_id = p_workspace_id` AND active status (`status <> 'offboarding'` for profile) AND `display_name` non-null.
4. For each candidate row, computes `extensions.similarity(display_name, p_raw_name)`.
5. Returns top-5 rows where similarity ≥ threshold, sorted by similarity DESC.
6. Resolver wrapper (`resolveEntity()`) receives `data` array, returns it as `FuzzyMatch[]` (or empty `[]` if zero candidates met threshold).

**Postcondition:**
- Zero side effects — RPC is read-only
- Composite GIN index `idx_profile_workspace_displayname_trgm` (and dept / location equivalents) used to bound the trigram scan to the single workspace's rows (verify via `EXPLAIN ANALYZE` in smoke-check)

**Error paths:**
- **Invalid entity_type** (e.g. `'shift'`) → RPC raises `fn_fuzzy_match_entity: invalid entity_type shift` with ERRCODE `check_violation`. Resolver wrapper rethrows as `resolveEntity(shift): fn_fuzzy_match_entity: invalid entity_type shift` per L-0177 (no silent empty-array fallback).
- **Empty raw_name** → RPC raises `fn_fuzzy_match_entity: p_raw_name required`.
- **Threshold out of range** → RPC raises `fn_fuzzy_match_entity: threshold must be 0..1`.
- **No matches above threshold** → returns empty result set. Resolver returns `[]`. This is NOT an error — consumer interprets empty as "no candidate met threshold" and routes the row to `requires_onboarding_first` bucket (Sortie B classification logic).
- **Workspace has zero entities of that type** → returns empty result set. Same as above.
- **pg_trgm extension missing** → RPC fails with `function extensions.similarity(text, text) does not exist`. This is a deployment integrity bug — foundation migration must have applied. Resolver rethrows fail-fast per L-0177.
- **GIN index missing** (e.g. migration partially applied) → query still runs but slow (sequential scan). Not a functional error; flagged as performance regression in Sortie B preview_batch instrumentation.

---

## Verification Surface for Sortie A Closure

These two journeys are exercised by:

- **Unit tests:**
  - `packages/utils/src/spreadsheet/index.test.ts` (parseCsv contract)
  - `packages/utils/src/hash/index.test.ts` (sha256Hex contract)
  - `packages/ai/src/resolver/index.test.ts` (resolveEntity contract, mocked RPC)
  - `packages/ai/src/capabilities/bulk_import/tools.test.ts` (parseSpreadsheetTool — workspace-prefix enforcement, xlsx rejection, ONE emit)

- **Integration smoke (Sortie A — manual; Sortie B flips to live Playwright):**
  - `apps/e2e/bulk-import/sortie-a-parse-spreadsheet.spec.ts` (test.skip — pending UI in Sortie B; real fixture committed)
  - Direct curl against running stage-engine via `op run ... supabase status` + `pnpm dev` chain (see Task 13 Step 3)

- **DB smoke:**
  - `psql` (or `mcp__plugin_supabase_supabase__execute_sql` if MCP available) running `SELECT * FROM fn_fuzzy_match_entity('{workspace}', 'profile', 'Knut Hansne', 0.7);` against seeded local DB.

---

## Sortie A → Sortie B Handoff (next sortie's preconditions)

When Sortie B starts (`feat/bulk-import-sortie-b`), the following must be green:

- `import_run` table exists with idempotency UNIQUE (workspace_id, excel_sha256)
- `fn_fuzzy_match_entity` RPC returns workspace-scoped active-filtered top-5 candidates
- `parseSpreadsheetTool` returns `{ sheets, excel_sha256, suggested_mapping }`
- `resolveEntity()` wrapper exists in `@smartout/ai/resolver`
- 4 authority rows seeded for parse_spreadsheet / preview_batch / resolve_ambiguity / commit_batch (Sortie B `preview_batch` body lands directly into a pre-authorized slot)
- Telemetry `bulk_import.batch_parsed` registered with live emit site
- ADR-0402 reviewed by Pontus + Council → flipped from `proposed` to `accepted` BEFORE Sortie B installs `xlsx` package
