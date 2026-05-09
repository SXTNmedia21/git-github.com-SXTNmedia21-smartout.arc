---
title: "ADR-0063: Communication System Consolidation — Komm Canonical, Chat Frozen"
id: ADR-0063
status: accepted
layer: decision
created: 2026-03-28
updated: 2026-03-28
module: communications
tags: [adr, chat, komm, messaging, architecture]
---

# ADR-0063: Communication System Consolidation

## Context and Problem Statement

Smartout has two parallel messaging systems: **Chat** (simple DM/group/AI conversations, 3 tables, JSONB reactions, no workspace_id on messages) and **Komm/Channels** (org-structure-aware channels with 7 channel types, 10 message types, origin tracking, delivery modes, audio/video/recording policies, 15+ tables, proper reaction join table, full telemetry). Both handle DMs and group messaging with no documented boundary between them.

## Decision Drivers

- Undocumented dualism causes split DM ownership confusion
- Chat uses JSONB reactions (race condition risk), Komm uses proper join table
- Komm has full telemetry coverage, Chat has gaps
- LiveKit voice/video is exclusive to Komm
- Two MessageBubble implementations (4x maintenance)
- AI assistant conversations need a canonical home

## Considered Options

1. **Keep both systems** — Rejected. Undocumented dualism, split DM ownership, divergent quality levels.
2. **Merge Chat into Komm immediately** — Rejected. Data migration is non-trivial and would block current work.
3. **Deprecate Komm, keep Chat** — Rejected. Komm is architecturally superior (proper reactions, telemetry, org-structure, voice).
4. **Freeze Chat, make Komm canonical** — Chosen.

## Decision Outcome

Chosen option: **"Freeze Chat, make Komm canonical"**, because Komm is architecturally superior and already handles all use cases Chat does, plus voice/video, org-structure awareness, and proper telemetry.

### What this means

1. All new messaging features target Komm (channels, channel_message, channel_member)
2. Chat tables remain for backwards compatibility but receive no new development
3. AI assistant conversations will add `channel_type = 'ai_assistant'` to Komm (not use Chat's `type = 'ai'`)
4. Mobile consolidates to Komm screens only; Chat screens are deprecated
5. LiveKit voice/video integration stays exclusive to Komm (current state)

### Migration path (future, not in scope now)

- Phase 1: Freeze Chat. All new work targets Komm. (this ADR)
- Phase 2: Add `channel_type = 'ai_assistant'` to Komm for AI conversations
- Phase 3: Migrate existing Chat data to Komm equivalents
- Phase 4: Remove Chat routes, components, hooks, and tables

## Rules & Consequences

- **Good, because** single source of truth for all messaging, eliminates DM ownership confusion, eliminates JSONB reaction race condition, halves UI surface to maintain
- **Bad, because** Chat data migration effort (future), existing Chat users see no new features until migration
- **Agent Impact:** Never add features to Chat hooks/components. All new messaging work targets Komm. When implementing AI-in-channels, use Komm `channel_type`, not Chat `type`. The `communication` capability in `packages/ai/` currently queries Chat tables and must migrate to Komm before Phase 3.
- **Freeze scope:** Bug fixes, security patches, and telemetry gap closures are permitted on frozen Chat code. No new features or capabilities.

---

> Council verdict: 2026-03-28 Communications Stack Architecture Audit
