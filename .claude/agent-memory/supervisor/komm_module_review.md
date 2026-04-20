---
name: Komm Module Architecture Review
description: Communications module review findings — AI tool bugs, i18n violations, Event Engine gaps, legacy table debt
type: project
---

## Verified 2026-04-13

### Runtime Bugs
- `packages/ai/src/capabilities/communication/tools.ts:115` uses `sender_profile_id` — actual column is `sender_id`
- `packages/ai/src/capabilities/communication/tools.ts:70` queries `unread_count` on `channel_member` — column doesn't exist
- `getConversations` tool doesn't filter `channel_member` by `workspace_id` — data leak vector

### i18n Violations
- 20+ hardcoded Norwegian strings in hooks (toast messages) and `use-communication-overview.ts` (formatTypeLabel, formatVisibility, formatDate)
- `komm.json` namespace exists in both `en` and `nb` but hooks don't use it

### Dead Infrastructure
- `channel_event` table created but never written to (no triggers, no Edge Function references)
- `channel_ai_policy` table created but never read by any hook or AI tool
- `channel_message.event_id` FK to `channel_event` never populated
- Legacy `chat_*` tables (migration 20260320120000) never dropped — coexist with `channel_*`

### Orphaned AI Tools
- `packages/ai/src/tools/channels.ts` exports `CHANNEL_TOOLS` (get_channel_context, search_knowledge)
- NOT registered in any capability — `search_knowledge` (semantic doc search) is unavailable to Botsson

### Mobile Parity
- All 21 hooks in `apps/web/src/app/dashboard/komm/_hooks/` — same violation as year-wheel hooks

### What Works Well
- All 9 mutation hooks have proper `emit()` calls
- PTT implementation with race condition protection is solid
- AI capability structure follows the pattern (readOnlyTools/suggestTools separation)
- Query key management via `channel-keys.ts`

**Why:** Baseline for any redesign agent. These bugs and gaps must be addressed before or alongside hospitality intelligence integration.
**How to apply:** When reviewing komm redesign agent output, verify these specific issues are resolved. Block merge if AI tool bugs persist.
