---
title: Settlement Bucket Migration
feature: settlement-bucket-migration
branch: feat/order-system-settlement-bucket-migration
status: verified
verified_at: 2026-05-02
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [billing, settlement, storage, migration]
---

# Journey: Settlement Bucket Migration

## Journey: Accountant runs settlement after fresh db reset

**Precondition:** Developer or CI runs `supabase db reset` on a clean local/staging environment.
No prior settlement run has occurred.

1. Developer runs `supabase db reset` → all migrations apply in order including
   `20260522010000_settlement_artifacts_bucket.sql`.
2. Migration creates bucket `settlement-artifacts` (private, 50 MB limit,
   `allowed_mime_types = [application/pdf, text/csv]`).
3. Migration adds `mime_type` column (NOT NULL) to `billing.settlement_artifact`.
4. Migration creates Storage RLS policy `settlement_artifacts_service_role_write`
   (service_role only) and `settlement_artifacts_no_anon_read` (anon denied).
5. Accountant logs in to `/avstemming` and clicks "Kjør avstemming".
6. `executeSettlementRun()` renders 4 artifacts in parallel.
7. Each artifact is uploaded via `uploadArtifact()` to the pre-existing bucket.
8. `settlement_artifact` rows are inserted including `mime_type`
   (charset suffix stripped: `text/csv; charset=utf-8` → `text/csv`).
9. Run status updated to `succeeded`.
10. Accountant sees completed run with download links.

**Postcondition:** All 4 artifact rows have non-null `mime_type`. Bucket was never
created at runtime — it existed from migration. No dev/prod divergence.

**Error paths:**
- If `mime_type` column was missing (pre-migration): Insert would succeed (nullable),
  but downstream type guarantees would be violated. Migration backfills existing rows
  from `artifact_type` before applying NOT NULL.
- If bucket was absent (pre-migration): upload would fail at runtime with no
  bucket-not-found error. Now guaranteed by migration.

## Journey: Admin verifies storage policy in Supabase Studio

**Precondition:** Migration 20260522010000 has been applied.

1. Admin opens Supabase Studio → Storage → Buckets.
2. Sees `settlement-artifacts` bucket listed as private.
3. Opens bucket → Policies → sees `settlement_artifacts_service_role_write` policy.
4. Confirms no anon read policy exists (denied via `settlement_artifacts_no_anon_read`).

**Postcondition:** Bucket policy state is visible and matches migration intent.
