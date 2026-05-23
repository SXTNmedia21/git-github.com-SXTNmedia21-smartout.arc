---
title: HANDOFF — bulk_import Sortie 0 — Attachment Routing
status: done
updated: 2026-05-23
created: 2026-05-23
module: stage-engine
tags: [bulk-import, sortie-0, attachment-routing, handoff]
---

# HANDOFF — bulk_import Sortie 0 — Attachment Routing

## What Was Built and Why

Sortie 0 is a pure infrastructure prereq. It builds the full attachment pipeline from BotssonChat composer through to stage-engine agent-router so that when a user drops an `.xlsx` or `.csv` file into the chat, the system routes it deterministically to the `bulk_import` capability — no LLM intent-classifier roundtrip needed.

No tools are wired yet (those land in Sortie A). This sortie exists because attaching files to a chat message is architecturally independent of what you do with them — and getting the bucket, BFF, schema forwarding, and MIME dispatch right before Sortie A reduces risk on the harder phase (parsing and storage of import data).

**Council review:** 2026-05-23 APPROVE WITH CHANGES (6/6 reviewers, steward chair). Conditions closed inline before any commit.

## 7 Commits Delivered

| SHA | Description |
|-----|-------------|
| `e14955731` | Storage bucket migration — `botsson-imports` bucket, workspace-scoped RLS |
| `ad52ef3da` | MIME-type deterministic capability dispatch (pure function) |
| `831a67f5a` | `bulk_import` capability skeleton + ADR-0112 4-file-commit (capability + types + registry + intent-classifier) |
| `c9321c73e` | `chatSchema` extended with `attachments?` field + stage-engine receives it |
| `2f04eac45` | BFF upload endpoint `/api/botsson/imports/upload` |
| `4f533eb34` | Wire dispatch into `routeAgentMessage` + register `attachment.routed` telemetry event (ADR-0377 same-commit) |
| `2a6e10ca2` | E2E spec (skipped — needs live infra, see Known Issues below) |

## Decisions Made

### From Pontus (pre-work)
1. **3-bucket architecture** — `botsson-imports` (chat uploads), `botsson-exports` (generated payroll), `botsson-temp` (ephemeral processing). Sortie 0 only creates `botsson-imports`; the others land in Sorties A/B.
2. **BFF upload, not client-to-storage direct** — all storage writes go through `/api/botsson/imports/upload` so the service-role key never reaches the browser. Signed read URLs returned to client.
3. **Delegation-first capability** — `bulk_import` is a delegation-only capability skeleton in Sortie 0. Tools array empty by design. Classifier entry added with prose marking it "MIME-dispatch primary, classifier fallback only" per ADR-0112 pattern.
4. **No import_run table in Sortie 0** — row-level tracking of import jobs is Sortie A scope. Sortie 0 proves the attachment pipeline works before committing to the data model.

### ADR gates applied
- **ADR-0112** (intent enum same-commit): 4 files committed together — `bulk_import/index.ts`, `registry.ts`, `types.ts`, `intent-classifier.ts`. 6th occurrence of this gate; pattern is now muscle memory.
- **ADR-0377** (emit wiring same-commit as registration): `attachment.routed` registered in `packages/telemetry/src/registry.ts` AND wired in `services/stage-engine/src/core/agent-router.ts` in commit `4f533eb34`.

### Namespace
`bulk_import` (underscore). Matches existing capability naming convention in `CapabilityName` union. No dot-notation.

## Learnings Discovered

### L-new-1: Test runner path format matters for pnpm --filter
`pnpm --filter @smartout/ai test packages/ai/src/router/__tests__/attachment-dispatch.test.ts` fails — vitest does not find the file when path is prefixed with `packages/ai/`. Correct invocation: run vitest directly from the package root (`cd packages/ai && npx vitest run src/router/__tests__/...`), or use `pnpm --filter @smartout/ai exec vitest run src/...`. Same pattern applies to web app tests. Document in test-runner notes.

### L-existing (re-surfaced): stale-dist trap
`@smartout/telemetry` and `@smartout/journey-ir` need explicit `build` before typecheck when on a fresh worktree. Fixed via mandatory pre-work step in Wave 4 scope definition. Same class as L-0190 and L-stale-telemetry-dist.

### L-existing (confirmed): wave-isolation works
All implementation Waves (1-3) committed cleanly without cross-contamination. Campaign worktree pattern (Wave per sortie, single feat branch) held. No stash-pop conflicts.

## Known Issues / Debt

| Item | Impact | Resolution |
|------|--------|------------|
| E2E spec skipped (`test.skip`) | No Playwright coverage for upload flow | Unskip in Sortie A when `import_run` table + parsing exists and can produce a verifiable DB row |
| No `import_run` table | File arrives in Storage but no server-side row tracking the import job | Sortie A delivers `import_run` + `import_row` tables |
| `botsson-exports` and `botsson-temp` buckets not created | Not needed until Sortie B/C | Separate migration in the relevant sortie |
| BFF returns signed URL but mobile client not wired | Mobile surface skipped per ADR-0133 (web-compose, mobile-execute) | Sortie B if mobile needs to trigger imports |

## Next Steps — Sortie A

1. Write ADRs 0398-0401 (import_run table design, pg_trgm fuzzy match, parse_spreadsheet edge function, dedup policy)
2. Create `import_run` + `import_row` tables (workspace-scoped, RLS, all standard columns)
3. Build `parse_spreadsheet` Edge Function or equivalent parser
4. Wire `bulk_import` tools: `import.start`, `import.status`, `import.cancel`, `import.list`
5. Unskip E2E spec — add row-count assertion on `import_run`
6. Council review of import data model before schema migration
