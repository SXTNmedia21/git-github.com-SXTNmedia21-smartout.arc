---
title: "User journeys — PII classifier infrastructure (ADR-0166)"
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-progressive-channel
tags: [pii, classifier, privacy, helpdesk, adr-0166]
---

# User journeys — PII classifier infrastructure

This sub-sortie ships the classifier module + DB columns that ADR-0166
specifies. The actual user-facing redaction flow (sub-channel spawning,
inline placeholder rendering, admin log viewer) lands with the Phase 1A.2
application code in a separate sub-sortie.

The journeys below therefore describe what is TRULY reachable from the
artifacts shipped here:

1. Developer journey — call the classifier from new application code.
2. Operator journey — run the migration on a target DB.
3. Operator journey — roll the migration back.

End-user journeys for redaction UX are deferred to Phase 1A.2's journey
doc.

---

## Journey: Developer calls `classifyPii` from application code

**Precondition:**
- `@smartout/ai` is a workspace dependency of the consuming package.
- Application code has a chat message string available (e.g. the hook
  site on `channel_message.insert` in Phase 1A.2).

1. Developer imports the classifier:
   ```ts
   import { classifyPii, PII_CLASSIFIER_VERSION } from "@smartout/ai/classifiers";
   ```
   → System resolves to `packages/ai/dist/classifiers/index.js`.
   → Developer sees typed surface: `PiiCategory`, `PiiMatch`, `PiiClassificationResult`.

2. Developer calls `classifyPii(message.content)` inside the hook site.
   → System runs each regex rule (personnummer, iban, bank_account_nor,
     phone_nor, email) synchronously.
   → System collects non-overlapping matches in priority order.
   → System computes SHA-256 hex of the original text.
   → System returns a `PiiClassificationResult` with `detected`, `matches[]`,
     `redactedText`, `originalContentHash`, `classifierVersion`, `durationMs`.

3. Developer persists `classification_metadata` / `redacted_at` /
   `original_content_hash` based on the result.
   → System (Phase 1A.2 code) writes `{detected, categories: matches.map(m => m.category), classifier_version, classifier_duration_ms, soft_hold_outcome}`
     to `channel_message.classification_metadata`.
   → System sets `redacted_at = now()` and replaces the visible content
     with the redaction placeholder if `detected=true`.

**Postcondition:**
- `channel_message` row carries audit metadata. Plaintext of any matched
  PII never leaves the original call frame (not logged, not echoed, not
  sent to any external service).
- `originalContentHash` is queryable for dedupe + audit review.

**Error paths:**
- **Empty input:** `classifyPii("")` returns `detected=false, matches=[], redactedText=""` and the SHA-256 of the empty string. Safe to call.
- **Non-string input:** TypeScript compile-time error. Runtime never sees non-string because the hook site validates at the boundary.
- **Classifier throws:** Not expected — pure regex + sync hash. If it ever does (OOM, JS engine bug), the Phase 1A.2 hook must catch and apply the `timeout`-path fallback: publish message as-is with `classification_metadata.soft_hold_outcome='timeout'`, notify admin.

---

## Journey: Operator applies the migration

**Precondition:**
- Target database has all prior migrations up to `20260515135959_channel_progressive_flags.sql` applied.
- Operator has direct DB access (local: `npx supabase migration up --local`; preview/prod: migration runner with correct credentials).
- No concurrent schema change is in flight on `channel_message`.

1. Operator runs the migration.
   → System opens a transaction.
   → System adds `classification_metadata jsonb` column (nullable, no default).
   → System adds `redacted_at timestamptz` column (nullable, no default).
   → System adds `original_content_hash text` column (nullable, no default).
   → System creates the partial index `idx_channel_message_redacted` on `(redacted_at, workspace_id) WHERE redacted_at IS NOT NULL`.
   → System commits.

2. Operator verifies.
   → `SELECT column_name FROM information_schema.columns WHERE table_name='channel_message' AND column_name IN ('classification_metadata', 'redacted_at', 'original_content_hash');` returns 3 rows.
   → `SELECT indexname FROM pg_indexes WHERE indexname='idx_channel_message_redacted';` returns 1 row.

3. Operator regenerates types for consuming packages.
   → `pnpm db:gen-types` writes new `Row`/`Insert`/`Update` shapes to `packages/supabase/src/database.types.ts`.

**Postcondition:**
- DB schema carries the three audit columns + index.
- Zero rows mutated; existing `channel_message` rows unaffected.
- Application code can start writing to the columns (via Phase 1A.2 hook) without further DDL.

**Error paths:**
- **Column already exists:** `ADD COLUMN IF NOT EXISTS` makes the migration idempotent. Safe to re-run.
- **Prior migration missing:** Runner errors with "relation channel_message does not exist" or similar. Operator must apply prior migrations first.
- **Transaction fails mid-flight:** Postgres rolls back all three ALTERs + the CREATE INDEX atomically. DB returns to pre-migration state.

---

## Journey: Operator rolls the migration back

**Precondition:**
- Migration `20260515150000_channel_message_pii_columns.sql` has been applied.
- Phase 1A.2 application code has NOT yet written audit data the organization cares about (rollback is lossy for any `classification_metadata` / `redacted_at` / `original_content_hash` rows).

1. Operator runs `supabase/migrations/rollback/20260515150000_channel_message_pii_columns_rollback.sql`.
   → System drops the partial index `idx_channel_message_redacted`.
   → System drops the three columns in reverse add-order: `original_content_hash`, `redacted_at`, `classification_metadata`.
   → System commits.

2. Operator verifies.
   → `SELECT column_name FROM information_schema.columns WHERE table_name='channel_message' AND column_name IN ('classification_metadata', 'redacted_at', 'original_content_hash');` returns 0 rows.

**Postcondition:**
- `channel_message` schema returned to pre-migration shape.
- Application code that imported from `@smartout/ai/classifiers` still compiles — the classifier module is unaffected by the rollback. Rolling code back is a separate concern.

**Error paths:**
- **Column has dependent objects:** Unlikely in Phase 1A (no FK, no view, no generated column uses these). If it happens, Postgres errors before dropping. Operator investigates the dependency.
- **Already rolled back:** `DROP COLUMN IF EXISTS` makes the rollback idempotent.
