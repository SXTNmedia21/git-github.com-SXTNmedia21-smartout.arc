---
id: ADR-0337
title: "ADR-0238 Enforcement: Build DomainChatOwnership Component"
status: accepted
date: 2026-05-16
deciders: [pontus, council]
tags: [botsson, surface-disambiguation, adr-0238, component]
supersedes: null
superseded_by: null
created: 2026-05-16
updated: 2026-05-16
accepted_at: 2026-05-16
implementation_commit: 16b000387
layer: decision
---

# ADR-0337: ADR-0238 Enforcement — Build `<DomainChatOwnership>` Component

**Status:** Accepted (2026-05-16 — implementation merged at `16b000387`)
**Date:** 2026-05-16
**Council:** Chat-WhatsApp Phase 3 priority council — APPROVE WITH CHANGES
**Closes critical gap from:** ADR-0238, L-0178, L-0257

> **API deviation from this ADR:** Implementation uses `reason` prop + counter-based `declareDomainChatOwnership` returning cleanup (multi-owner safe), rather than the spec's `surfaceId` prop + imperative `setOrbMode("passive")`. Counter version is functionally superior — handles concurrent owners (komm/chat + komm/thread + shift-clock chat tab can all declare independently without race). Acceptance criteria still met. See `docs/HANDOFF-domain-chat-ownership.md` Decisions Made table. Future amendment may update spec text to match shipped API.

## Context and Problem Statement

ADR-0238 (Botsson Surface Disambiguation, 2026-04-29) declared the
`<DomainChatOwnership>` pattern: any page hosting an embedded domain chat
surface (e.g. `/dashboard/komm/chat`) must declare chat ownership so Botsson's
Orb suppresses to passive mode. Without this, users see two active AI chat
surfaces simultaneously — a silent dual-surface UX bug.

As of 2026-05-16, `grep -r "DomainChatOwnership" apps/web/src/` returns **zero
component definition hits**. The pattern exists only as JSX comments of the
form `{/* No <DomainChatOwnership> required — this page is X */}` and
`{/* owns_chat_surface: false */}` scattered across ~10+ files.

L-0257 (2026-05-14) identified 40+ comment references without a single real
component, classifying this as a "phantom-contract accumulator" pattern
reaching the build-or-retract threshold.

`/dashboard/komm/chat` is the first confirmed affected page. The Orb is active
(BotssonShell mounted in DashboardShell). No suppression fires. Dual-surface
UX is shipping now.

## Decision Drivers

- **ADR-0238** — pattern mandated; component not built = compliance gap
- **L-0257** — phantom-contract accumulator: 40+ comment refs without real
  component = build-or-retract threshold reached
- **L-0178** — dual chat surface UX disambiguation is load-bearing UX safety
- **ADR-0238 acceptance criteria (this ADR adds):** grep for component
  definition must return ≥1 hit; grep for usage on `/dashboard/komm/chat`
  must return ≥1 hit

## Considered Options

- **Option A** — Build `<DomainChatOwnership>` as a real React component that
  suppresses Orb to passive mode when mounted on a domain-chat page
- **Option B** — Retract ADR-0238: remove all comment stubs, document that
  dual-surface UX is acceptable on chat pages
- **Option C** — Continue comment-convention enforcement indefinitely

## Decision Outcome

**Chosen option: A — Build the component**, because:

1. ADR-0238 is already accepted; retraction requires a new council.
2. The dual-surface bug is actively shipping on `/dashboard/komm/chat`.
3. 40+ comment stubs are now technical debt requiring mechanical replacement
   regardless.
4. The component is small: mount → emit signal → Orb switches to passive.

**Implementation spec:**

File: `apps/web/src/app/Botsson/_components/DomainChatOwnership.tsx`

```typescript
"use client";
import { useEffect } from "react";
import { useBotsson } from "@/app/Botsson/BotssonProvider";

interface DomainChatOwnershipProps {
  surfaceId: string; // e.g. "komm-chat", "helpdesk-channel"
}

/**
 * Mount this component on any page that hosts an embedded domain chat surface.
 * Suppresses Botsson Orb to passive mode for the duration of the page visit.
 * ADR-0337 (enforcement), ADR-0238 (pattern origin).
 */
export function DomainChatOwnership({ surfaceId }: DomainChatOwnershipProps) {
  const { setOrbMode } = useBotsson();
  useEffect(() => {
    setOrbMode("passive", { reason: `domain-chat-ownership:${surfaceId}` });
    return () => setOrbMode("active");
  }, [surfaceId, setOrbMode]);
  return null;
}
```

**Required usage on `/dashboard/komm/chat/page.tsx`:**

```tsx
import { DomainChatOwnership } from "@/app/Botsson/_components/DomainChatOwnership";

export default function KommChatPage() {
  return (
    <>
      <DomainChatOwnership surfaceId="komm-chat" />
      {/* existing page content */}
    </>
  );
}
```

**Migration of comment stubs:**

Replace all comment stubs matching:
- `{/* No <DomainChatOwnership> required */}` → remove comment
- `{/* owns_chat_surface: false */}` → remove comment
- Pages that genuinely own a domain chat surface → add real `<DomainChatOwnership>`

**Acceptance criteria:**
1. `grep -r "DomainChatOwnership" apps/web/src/` returns component definition
   in `Botsson/_components/DomainChatOwnership.tsx`
2. `grep -r "DomainChatOwnership" apps/web/src/app/dashboard/komm/` returns
   usage in `chat/page.tsx`
3. No comment-only references remain in pages without real component usage
4. `pnpm turbo typecheck` passes

## Rules & Consequences enforced for Agents

- **Good, because** dual-surface bug closes; ADR-0238 enforcement moves from
  nominal to real.
- **Bad, because** short-term: ~10 files need comment cleanup (mechanical).
- **Agent Impact:** When building any new page with an embedded domain chat
  surface (ticketing, direct messages, WhatsApp threads), mount
  `<DomainChatOwnership surfaceId="X">` at the page root. Never use comment
  convention as substitute. The component is the enforcement contract.

## Cross-References

ADR-0238 (origin pattern), L-0178 (dual-surface UX), L-0257 (phantom-contract
accumulator — 40+ comment refs), ADR-0337 (this ADR = enforcement mandate)

## Sortie

E2E sortie for ADR-0238 component build: Phase 3 item E in the council verdict
(1-2 day sortie, highest priority — prerequisite for Trust Gate D).
