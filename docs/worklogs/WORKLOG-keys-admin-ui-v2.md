---
title: "Worklog — keys-admin-ui-v2"
status: done
updated: 2026-03-02
created: 2026-03-02
module: platform-admin
tags: [keys, secrets, vault, platform-admin]
---

# Worklog — keys-admin-ui-v2

## Status: ✅ Done

## Done

- [x] Created service-registry.ts — 19 predefined services with tag/tab classification
- [x] Created tag-badge.tsx — colored badges per ServiceTag
- [x] Created keys-table.tsx — reusable table for showing services with vault status
- [x] Created key-settings-popover.tsx — per-key actions (rotate, delete, env toggle)
- [x] Created env-import-dialog.tsx — paste .env, preview matched/unmatched, bulk import
- [x] Created POST /api/platform-admin/secrets/bulk — bulk import + delete via Vault RPCs
- [x] Rewrote keys-page-client.tsx — 4 sub-tabs (Client/Server/Runtime/Webhooks) grouped by tag
- [x] Fixed service-registry.ts readonly type compatibility
- [x] Fixed delete_vault_secret RPC param name (secret_name, not p_name)
- [x] Typecheck passes (18/18 packages)
- [x] PR #21 created to development

## Remaining

- [ ] None — feature complete

## Decisions

| Date       | Decision                                                           | Reason                                                                |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 2026-03-02 | Use discriminated union for bulk endpoint (import vs delete)       | Single endpoint, Zod-validated, cleaner than separate routes          |
| 2026-03-02 | Keep API Keys tab unchanged, add sub-tabs only to External Secrets | API keys already have good UX; external secrets needed categorization |
| 2026-03-02 | Group services by tag within each tab                              | Visual grouping makes it easy to find related keys                    |

## Log

| Date       | Time | Event                                                                                                       |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| 2026-03-02 | —    | Created 5 new components (service-registry, tag-badge, keys-table, key-settings-popover, env-import-dialog) |
| 2026-03-02 | —    | Created bulk secrets API route                                                                              |
| 2026-03-02 | —    | Rewrote keys-page-client with 4-tab layout                                                                  |
| 2026-03-02 | —    | Fixed 2 type errors (readonly array, RPC param name)                                                        |
| 2026-03-02 | —    | Typecheck passed, committed, pushed, PR #21 created                                                         |
