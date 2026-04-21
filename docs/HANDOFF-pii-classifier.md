---
title: "Handoff — PII classifier infrastructure (ADR-0166)"
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-progressive-channel
tags: [pii, classifier, privacy, helpdesk, adr-0166, handoff]
---

# Handoff — PII classifier infrastructure

## Summary

Sub-sortie C of the Progressive Channel work. Delivers the infrastructure
layer specified by ADR-0166:

- A synchronous, regex-based Norwegian PII classifier callable from
  application code.
- Three audit columns on `channel_message` (`classification_metadata`,
  `redacted_at`, `original_content_hash`) plus a partial index for the
  admin log viewer.
- Schema-mock alignment per L-0087 ship-block so unit tests surface any
  future schema drift loudly.

Out of scope (lands with Phase 1A.2):
- The on-insert hook (trigger or Edge Function) that calls the classifier.
- Redaction placeholder rendering in timeline UI.
- Private sub-channel spawning on PII detection.
- Admin PII-detection log viewer.

## What was built

### Classifier module

- `packages/ai/src/classifiers/pii-classifier.ts`
  - `classifyPii(text)` — synchronous, pure, no IO.
  - Detects five Norwegian PII categories with explicit priority order:
    `personnummer > iban > bank_account_nor > phone_nor > email`.
  - Produces `redactedText` by replacing each match with `[PII: <category>]`.
  - Computes SHA-256 hex of the input for the `original_content_hash` column.
  - Stamps `classifierVersion = "1.0.0-regex-nor"` on every result.
  - Measures `durationMs` via `performance.now()` with `Date.now()` fallback.
  - Never logs `matchedText` or the raw input — caller receives match
    substrings to build the redaction but must not persist them.

- `packages/ai/src/classifiers/index.ts`
  - Barrel with narrow public surface: `classifyPii`, `PII_CLASSIFIER_VERSION`,
    `PiiCategory`, `PiiMatch`, `PiiClassificationResult`.

- `packages/ai/package.json`
  - Added `./classifiers` and `./classifiers/pii-classifier` to the exports map.

### Tests

- `packages/ai/src/classifiers/__tests__/pii-classifier.test.ts`
  - 34 passing tests covering:
    - Version/shape invariants.
    - SHA-256 determinism + hex formatting.
    - Per-category positive and negative cases for all five rules.
    - Redaction placement (single match, multiple matches, no-op).
    - Overlap priority (personnummer beats bank_account_nor on 11-digit span).
    - Match-position round-trip (`startIndex`/`endIndex` retrieve `matchedText`).
    - Statelessness across repeated calls.

### Migration

- `supabase/migrations/20260515150000_channel_message_pii_columns.sql`
  - Three `ADD COLUMN IF NOT EXISTS` on `channel_message`, all nullable,
    no default.
  - Partial index on `(redacted_at, workspace_id) WHERE redacted_at IS NOT NULL`
    for the admin log viewer query path.
  - `COMMENT ON COLUMN` for each, all citing ADR-0166 and documenting
    the canonical JSON shape for `classification_metadata`.

- `supabase/migrations/rollback/20260515150000_channel_message_pii_columns_rollback.sql`
  - Drops the index first, then columns in reverse add-order.
  - Idempotent via `DROP ... IF EXISTS`.

### Generated types

- `packages/supabase/src/database.types.ts` regenerated via `pnpm db:gen-types`.
  Contains 9 new references (3 columns × Row/Insert/Update).

### L-0087 ship-block compliance

- `packages/ai/src/capabilities/__tests__/supabase-mock.ts`
  - New `CHANNEL_MESSAGE_SCHEMA` registered in `TABLE_SCHEMAS`.
  - Schema includes the three new audit columns so any future capability
    test asserting `.select('... classification_metadata ...')` or
    `.insert({ redacted_at: ... })` is schema-validated at mock time.

## Decisions made

All decisions trace to the authoritative ADR set. No new ADRs written
this sub-sortie.

- **ADR-0166 Rule 7 (classifier source):** 1.0 is regex-only. LLM is deferred
  to Phase 2+. Implementation confirms: `packages/ai/src/classifiers/pii-classifier.ts`
  is pure synchronous regex with no LLM dependency.
- **ADR-0166 Rule 8 (activity-trail events):** Event registration is
  Phase 1A.2's responsibility. The classifier result shape exposes
  exactly the fields Phase 1A.2 will need (`detected`, categories,
  `classifierVersion`, `durationMs`).
- **Priority ordering on overlap:** Not explicit in ADR-0166 but required
  to avoid double-counting. Chosen: personnummer wins over bank_account_nor
  on the same 11-digit span. Rationale: personnummer is the higher-severity
  disclosure and benign 11-digit strings are extremely rare in Norwegian
  chat contexts.
- **Empty-string input is legal:** Returns `detected=false` + empty-string
  SHA-256. Rationale: simpler contract than throwing; the hook site can
  apply its own guards if empty payloads should be rejected earlier.
- **Node crypto for hashing:** Uses `node:crypto`'s `createHash("sha256")`.
  The classifier is only ever called from server-side contexts (Edge
  Function, Server Action, trigger). No web-crypto polyfill needed.

## Decisions registered

None new this sub-sortie. ADR-0166 already covers the design space.

## Learnings

- **L-0087 in practice:** Adding three columns to `channel_message`
  forced the mock to register that table for the first time — the
  prior tests only needed `channel`, `channel_member`, etc. This
  confirms L-0087's "trap surface scales with each additive migration"
  prediction: the very first column ever added to an untested table
  requires a mock expansion, not just the second or tenth.
- **Regex priority + overlap handling:** Naive "run every rule, collect
  all matches" over-counts when rules share a subpattern. The explicit
  overlap-rejection loop in `collectMatches` is required — not just a
  stylistic choice.
- **Hash function location:** `node:crypto` was chosen over a userland
  polyfill because the classifier only runs server-side. If Phase 2+
  ships an on-device (React Native) classifier, the hash helper moves
  to a platform-aware module; current design does not block that migration.

## Known issues / debt

### Left for Phase 1A.2 (application code)

1. **On-insert hook.** No trigger or Edge Function yet calls `classifyPii`.
   Wire point: `supabase/functions/<TBD>/index.ts` or a `BEFORE INSERT`
   trigger on `channel_message`. The hook must:
   - Check `channel.helpdesk_enabled = true AND channel.privacy_mode = 'public'`
     before classifying (no work on private channels).
   - Apply the 800ms timeout (ADR-0166 Rule 1) with the fallback path
     (ADR-0166 Rule 2).
   - Write `classification_metadata` on every run, not just detection.
   - Trigger `openPrivateTicket` via the existing Server Action path on
     PII detection (ADR-0166 Rule 3).

2. **Activity-trail event registration.** ADR-0166 Rule 8 lists three
   events (`helpdesk.pii.detected`, `helpdesk.pii.classifier_timeout`,
   `helpdesk.pii.false_positive_reported`). These need entries in
   `packages/telemetry/src/registry.ts` before the hook can emit them.

3. **Admin log viewer.** ADR-0166 implementation-plan item 5. The
   partial index `idx_channel_message_redacted` supports the query;
   the UI itself is Phase 2 admin work.

### Classifier known limitations (false-negatives acceptable per ADR-0166)

- **personnummer check-digit validation.** The 11-digit regex does NOT
  verify the MOD11 check digits of a Norwegian personnummer. A valid-format
  but invalid-checksum string (e.g. `00000000000`) triggers a redaction.
  Acceptable: false-positives only hide the message to an admin-visible
  private thread; user re-sends with context if mis-classified.
- **bank_account_nor without separators.** The rule requires optional
  dots or single spaces between the 4-2-5 segments. An 11-digit bank
  account written as pure digits (e.g. `12345678901`) will match
  personnummer first due to priority ordering. This is intentional:
  detection wins over correct categorization when the audit outcome
  is "redact + sub-channel" either way.
- **phone_nor greedy match.** The `(?:\d{2}\s?){3}\d{2}` pattern can
  latch onto strings that aren't phones (e.g. a list of numeric IDs).
  Acceptable false-positive in the soft-hold design.
- **email TLD leniency.** The email regex accepts `.co.uk`-style nested
  TLDs but also e.g. `user@host.a.b.c`. Matches any dot-separated
  multi-part domain. Fine for 1.0.
- **No Unicode support beyond ASCII.** Norwegian letters (æøå) in the
  local part of an email would fail the current `\w` class. Acceptable
  gap — Norwegian emails with æøå are vanishingly rare in corporate
  contexts.

## Next steps

- Phase 1A.2 sub-sortie owner: wire the on-insert hook (trigger or Edge
  Function) that calls `classifyPii` and applies the ADR-0166 rules.
- Phase 1A.2 sub-sortie owner: register the three activity-trail events
  in `packages/telemetry/src/registry.ts`.
- Phase 2 (later): replace the regex classifier with an LLM classifier
  behind the same `classifyPii` signature. Bump `PII_CLASSIFIER_VERSION`
  to `2.0.0-llm-nor`.
- Monitoring (post-1A.2 ship): publish monthly false-negative rate on
  personnummer per ADR-0166 "Consequences → Negative / trade-offs".

## Files changed

```
packages/ai/src/classifiers/pii-classifier.ts                  [new]
packages/ai/src/classifiers/index.ts                           [new]
packages/ai/src/classifiers/__tests__/pii-classifier.test.ts   [new]
packages/ai/src/capabilities/__tests__/supabase-mock.ts        [modified — L-0087]
packages/ai/package.json                                       [modified — exports]
packages/supabase/src/database.types.ts                        [regenerated]
supabase/migrations/20260515150000_channel_message_pii_columns.sql                    [new]
supabase/migrations/rollback/20260515150000_channel_message_pii_columns_rollback.sql  [new]
docs/journeys/JOURNEY-pii-classifier.md                        [new]
docs/HANDOFF-pii-classifier.md                                 [new — this file]
```

## Verification

- `pnpm --filter @smartout/ai typecheck` — 0 errors.
- `pnpm --filter @smartout/ai test` — 142 tests pass (34 new + 108 pre-existing).
- Migration applied locally: `npx supabase migration up --local --include-all`.
- Columns confirmed in DB via `information_schema.columns` query.
- Index confirmed via `pg_indexes` query.
- Types regenerated: 9 new type-member references for the three columns.

## References

- ADR-0166 — `docs/decisions/0166-pii-public-mode-redaction.md`
- ADR-0163 — `docs/decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md`
- ADR-0078 — `docs/decisions/0078-engine-process-channel-restriction.md`
- L-0087 — `docs/learnings/0087-mock-surface-trap-expands-with-additive-columns.md`
