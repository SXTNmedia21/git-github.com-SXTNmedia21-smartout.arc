---
title: "Worklog — contract-enhancements"
status: done
updated: 2026-03-21
created: 2026-03-20
module: contracts
tags: [contract, placeholder, attachment]
---

# Worklog — contract-enhancements

> Branch: `feat/contract-enhancements` | Worktree: wt-2 | Started: 2026-03-20

## Status: 🟢 Done

## Done

- [x] Shared placeholder utility in `@smartout/utils` (pure functions, no DB deps)
- [x] Contract-service refactored to thin wrapper around shared utils
- [x] Platform-admin contract creation now auto-resolves placeholders
- [x] Bug fix: `company.contact_name` → `company.daglig_leder`
- [x] `contract_attachment` table + migration
- [x] Storage bucket MIME whitelist expanded (PDF + PNG + JPEG)
- [x] Telemetry events: `contract attachment uploaded/deleted`
- [x] Attachment API routes: GET/POST/DELETE
- [x] Attachment UI: collapsible "Bilagor" section in contract editor
- [x] Typecheck fix: strict Record indexing in utils
- [x] Fix: web missing `@smartout/utils` dependency
- [x] Fix: mobile i18n greeting keys + xl avatar size
- [x] Fix: `UserRow.email` nullability in platform-admin users

## Remaining

- (none)

## Decisions

| Date       | Decision                                                                   | Reason                                                                       |
| ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-03-20 | Extract placeholder logic to `@smartout/utils` as pure functions           | Both platform-admin and contract-service need it; avoids code duplication    |
| 2026-03-20 | Platform-admin only for attachments (no RLS policies, service_role access) | Contract attachments are managed by godmode users only                       |
| 2026-03-20 | Dynamic import for `@smartout/utils` in contract route                     | Avoids top-level import issues with workspace packages in Next.js API routes |
| 2026-03-20 | Del 3 (DocuSeal multi-doc delivery) out of scope                           | Higher risk, needs separate branch with manual DocuSeal testing              |

## Log

| Date       | Time  | Event                                                          |
| ---------- | ----- | -------------------------------------------------------------- |
| 2026-03-20 | 15:49 | Feature started                                                |
| 2026-03-20 | 16:00 | Task 1: Shared placeholder utility created                     |
| 2026-03-20 | 16:05 | Task 2: Contract-service refactored (subagent)                 |
| 2026-03-20 | 16:10 | Tasks 4+5+6: Migration, MIME types, telemetry done in parallel |
| 2026-03-20 | 16:15 | Task 3: Platform-admin placeholder fix (subagent)              |
| 2026-03-20 | 16:20 | Task 7: Attachment API routes (subagent)                       |
| 2026-03-20 | 16:30 | Task 8: Attachment UI (subagent)                               |
| 2026-03-20 | 16:35 | Task 9: Final verification — typecheck 22/22, lint 0 errors    |
| 2026-03-20 | 16:40 | Fixed pre-existing mobile + web typecheck errors               |
| 2026-03-20 | 16:45 | Feature closure: all gates verified                            |
| 2026-03-20 | 21:24 | Feature closed and merged to development                       |
| 2026-03-21 | 09:12 | Feature closed and merged to development                       |
| 2026-03-21 | 09:13 | Feature closed and merged to development                       |
| 2026-03-21 | 09:14 | Feature closed and merged to development                       |
