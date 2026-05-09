---
title: "HANDOFF — Domain Chat Ownership (ADR-0238)"
status: vapor
type: handoff
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, surface-disambiguation, domain-chat, ADR-0238, vapor, handoff]
decisions: [ADR-0238]
learnings: [L-0178]
---

# HANDOFF — Domain Chat Ownership (ADR-0238)

> **STATUS: VAPOR.** ADR-0238 was accepted (proposed → status preserved) but the
> implementation has NOT shipped. No `DomainChatOwnership` component exists in the
> codebase. No `useDomainChatOwnership` hook exists. Only a TODO comment was found:
> `apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx:24`.
>
> This handoff documents the PLAN and rationale. It will be updated to `done` when
> the implementation lands. Do NOT treat this as a record of shipped work.
>
> Source: Harness audit + R2 Council finding (2026-05-08). Council Hard Rule R-2
> "B2 implement gate" = this is the blocked gate.

## What Was Planned

ADR-0238 describes a surface-disambiguation pattern for pages that host both an
embedded domain-specific chat surface AND the global BotssonShell Orb. The problem:
a user on `/platform-admin/journeys/wizard/[sessionId]` sees two surfaces that both
look like "talk to AI." Sending a journey-authoring message to the Orb silently
misroutes to a general session — the wizard does not advance, no error appears.

### Planned Implementation

| Artifact | Planned Path | Status |
|---|---|---|
| `<DomainChatOwnership>` component | `apps/web/src/app/Botsson/DomainChatOwnership.tsx` | NOT IMPLEMENTED |
| `useDomainChatOwnership()` hook | `apps/web/src/app/Botsson/_hooks/useDomainChatOwnership.ts` | NOT IMPLEMENTED |
| `BotssonProvider` flag reader | `apps/web/src/app/Botsson/BotssonProvider.tsx` | NOT IMPLEMENTED |
| `BotssonShell` passive mode | `apps/web/src/app/Botsson/_components/BotssonShell.tsx` | NOT IMPLEMENTED |
| First page declaration | `/platform-admin/journeys/wizard/[sessionId]` | NOT IMPLEMENTED |

### How It Should Work (per ADR-0238)

1. A page that owns its chat surface mounts `<DomainChatOwnership reason="journey-wizard" />`.
2. `BotssonProvider` context receives the ownership flag.
3. `BotssonShell` reads the flag and renders in **passive mode**:
   - Icon-only (not chat-enterable).
   - Tooltip: "Botsson is watching this page."
   - Optional: voice activation via long-press (ADR-0238 deferred to Phase 2).
4. On all other routes where no ownership is declared, Orb is fully interactive.

## Decisions Made

- **ADR-0238**: Suppress-Orb approach chosen over dual-label or single-surface mode.
  Rationale: structural disambiguation beats copy-engineering for first-time users.
  See ADR-0238 for full option analysis.

## Learnings (captured, not yet learned in production)

- **L-0178**: Dual chat surface UX is silent-failure class (no error, no redirect,
  wrong code path). This class of bug is invisible in reviews and tests — requires
  explicit page checklist. Add to `smartout-page-polish` skill trigger checklist.

## When to Implement

This is a **shipping blocker** for the journey-wizard page as a production surface
for non-Pontus godmode users. Until implemented:
- Do NOT announce journey-wizard as production-ready.
- The TODO at `LonnsprofilSection.tsx:24` is a secondary reminder surface.

## Next Steps

1. Open a sub-sortie: `feat/botsson-domain-chat-ownership`
2. Implement `DomainChatOwnership` component + hook + BotssonShell passive mode.
3. Mount on `/platform-admin/journeys/wizard/[sessionId]` as first consumer.
4. Add to page-checklist in `smartout-page-polish` skill.
5. Update this handoff status to `done` + ADR-0238 status to `accepted`.
