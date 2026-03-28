---
title: "Handoff — komm-migration"
feature: komm-migration
branch: feat/komm-migration
closed: 2026-03-28
module: komm
---

# Handoff — komm-migration

## Summary

Deleted the legacy `/dashboard/chat/` route (21 files, ~1700 lines) and consolidated all communication to `/dashboard/komm/`. Extracted ~90 hardcoded Norwegian strings from 18 Komm component files into a new `komm` i18n namespace (nb + en). Migrated the AI communication capability from stale `chat_*` table queries to `channel_*` tables.

## What Was Done

- [x] Deleted entire `/dashboard/chat/` directory (10 components, 6 hooks, page, loading, parse.py)
- [x] Updated DashboardShell: removed chat nav button, mission map entry, mobile header label
- [x] Updated WalkAi `DASHBOARD_PAGES`: `chat` -> `komm` with correct path and description
- [x] Updated notifications page filter label: "Chat" -> "Komm" (filter id stays "chat" to match DB)
- [x] Migrated `packages/ai/src/capabilities/communication/tools.ts` from `chat_*` to `channel_*` tables
- [x] Removed orphaned telemetry events: `chat.reaction.toggled`, `chat.read`
- [x] Created `packages/i18n/locales/nb/komm.json` (145 keys, 13 sections)
- [x] Created `packages/i18n/locales/en/komm.json` (full English translations)
- [x] Replaced hardcoded strings in 18 Komm component files with `useTranslation("komm")` + `t()` calls
- [x] Refactored module-level constants (TYPE_LABELS, QUICK_ACTIONS, etc.) to use `labelKey` pattern

## Decisions Made

| Decision                                                         | Reason                                                              | Impact                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Migrate AI tools to channel\_\* tables (not just stub)           | Stale chat\_\* queries would return empty data for Komm users       | AI communication capability now reads live channel data |
| Keep notification filter id as "chat" but change label to "Komm" | DB `icon_type` field stores "chat" — changing it requires migration | Display says Komm, filter works correctly               |
| Leave hook toast strings in Norwegian                            | Hooks can't use `useTranslation` (no React context)                 | 9 strings remain hardcoded — tracked as follow-up       |
| Don't touch `useAgentChat`/`AgentChatPanel`                      | These are AI conversation primitives, not user-to-user messaging    | Agent SDK naming is correct for its domain              |
| Don't drop `chat_*` database tables                              | Mobile and `useShiftChat` still reference them                      | Tables stay until all consumers migrated                |

## Learnings

| Learning                                                | Context                                                                                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel table systems create hidden coupling           | AI tools, mobile hooks, telemetry, WalkAi navigation all created invisible dependencies on legacy Chat tables — survived long after UI was replaced |
| i18n string counts are always underestimated            | Initial estimate was ~30, council found ~42, actual was ~90. Always run a full grep-based inventory before scoping                                  |
| Module-level constants need `labelKey` pattern for i18n | Static arrays/maps defined outside components can't call `t()` — store keys, translate at render time                                               |
| Notification filter ids are DB-coupled                  | Can't rename freely — they match `icon_type` enum values in the database                                                                            |

## Known Issues / Debt

- 9 toast strings in Komm hooks remain hardcoded Norwegian (can't use `useTranslation` in non-component hooks)
- `useShiftChat.ts` (web + mobile) still writes to `chat_*` tables — separate domain, needs its own migration
- Mobile app has 6+ files actively using `chat_*` tables — not addressed
- `packages/ai/src/tools/channels.ts` exists with similar tools but is not registered in capability registry — potential consolidation target
- ADR-0063 phase sequence needs updating to reflect actual execution order
- `ChannelList.tsx` has a structural double-panel container bug (not i18n-related)

## Next Steps

- Register `channels.ts` tools in AI capability registry (or consolidate with updated communication/tools.ts)
- Migrate `useShiftChat.ts` off `chat_*` tables (web + mobile)
- Audit + migrate mobile `chat_*` references
- Create i18n-compatible pattern for hook-level toast messages
- Drop `chat_*` database tables after all consumers migrated
- Update ADR-0063 with actual phase sequence
