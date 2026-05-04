---
title: Settlement Artifacts Bucket Migration
status: in_progress
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [billing, settlement, storage, migration]
---

# Plan: Settlement Artifacts Bucket Migration

## Problem

V4 verifier (2026-05-02) found that the `settlement-artifacts` Storage bucket is created lazily via
`ensureBucketExists()` at runtime in `packages/billing/src/server/settlement/run.ts`. This causes:

1. Dev/prod divergence — bucket only exists after first run, never from `supabase db reset`.
2. No `allowed_mime_types` enforced — any content type could be uploaded.
3. No Storage RLS policy — access control is implicit, not declared.
4. `mime_type` column missing from `billing.settlement_artifact` — metadata loss on every artifact.

## Solution

- Migration `20260522010000_settlement_artifacts_bucket.sql`: declarative bucket INSERT + RLS
  policies + `mime_type` column with NOT NULL constraint and artifact_type backfill.
- Delete `ensureBucketExists()` helper from `run.ts`. Bucket is guaranteed by migration.
- Pass `mime_type` (charset-stripped) on every `settlement_artifact` INSERT.
- Regen `database.types.ts` so TypeScript Insert type includes `mime_type: string`.
- pgTAP test file asserts all 5 properties.

## Tasks

- [x] T1 — Migration file
- [x] T2 — Delete ensureBucketExists + call site
- [x] T3 — Pass mime_type on artifact INSERT
- [x] T4 — Regen database.types.ts
- [x] T5 — pgTAP test
- [x] T6 — Typecheck pass

## ADR Reference

ADR-0262 — signed-URL pattern for settlement artifact downloads.
