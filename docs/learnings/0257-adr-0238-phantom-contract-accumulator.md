---
title: "ADR-0238 phantom-contract accumulator — 40+ JSX comment refs to non-existent DomainChatOwnership component"
id: L-0257
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: agent-harness
tags: [botsson, adr-0238, phantom-component, DomainChatOwnership, technical-debt, harness]
---

# L-0257: ADR-0238 phantom-contract accumulator

## The Trap

ADR-0238 (Botsson surface disambiguation) mandates that any page hosting both `BotssonShell` and an embedded domain chat surface MUST declare `<DomainChatOwnership>` to suppress Orb to passive mode. The problem: **the `DomainChatOwnership` component does not exist.**

The 2026-05-14 Polish-Wave QA Council (botsson-harness-builder agent, confirmed by frontend-designer inference) counted 40+ JSX comment references of the form:
```jsx
{/* <DomainChatOwnership /> — ADR-0238: suppress Orb when domain chat active */}
```

These appear across bridge files and page components. Each polish wave adds more. The component has never been built.

## Why it Accumulates

The pattern is self-reinforcing:
1. Council or agent cites ADR-0238 as required
2. Author adds the JSX comment as a "placeholder" to comply with the ADR reference
3. Comment makes the page look ADR-compliant at code-review time
4. No test can catch a missing component when it's in a comment
5. Next wave repeats the comment pattern because "other pages do it"

After the 2026-05-14 wave, the comment count crossed 40+ — the threshold the council established as requiring build-or-retract escalation.

## The Rule: Build-or-Retract at 10+ Refs

When the count of `DomainChatOwnership` comment references (not actual JSX usage) exceeds 10 without the component existing: **escalate to build-or-retract**.

Two valid resolutions:
1. **Build** `DomainChatOwnership` as a real component (in `apps/web/src/app/Botsson/_components/`) — replaces all comment stubs with actual usage. Council agreed this is the correct long-term path.
2. **Retract** ADR-0238 or narrow its scope — if the dual-surface UX problem it addresses is not actually present at the sites being commented.

**Hybrid is not valid**: comments as indefinite placeholders = silent technical debt accumulation with false compliance signal.

## Escalation Threshold Reached (2026-05-14)

The 2026-05-14 council declared threshold reached. M1 action item: build-or-retract decision, with "build" preferred. Sortie scope: create `DomainChatOwnership`, replace all 40+ comment stubs with actual JSX, verify Orb passive-mode suppression logic.

## Detection

```bash
# Count comment-only refs vs real component usage
grep -r "DomainChatOwnership" apps/web/src --include="*.tsx" | grep -c "^.*<[^/]"
# vs
grep -r "DomainChatOwnership" apps/web/src --include="*.tsx" | grep -c "{/\*"
```

If (comment count) >> (real usage count) and component doesn't exist → accumulator active.

## Cross-references

- ADR-0238 (Botsson surface disambiguation — the ADR mandating DomainChatOwnership)
- L-0178 (silent-misroute — root problem ADR-0238 addresses: dual-surface chat routing without ownership declaration)
- Polish-Wave QA Council 2026-05-14 (M1 blocker — build-or-retract escalation)
- `apps/web/src/app/Botsson/_components/` (target location for component)
