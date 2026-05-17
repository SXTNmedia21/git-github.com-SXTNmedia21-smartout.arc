---
title: "Route-group absorption requires inbound-importer audit, not just route-tree audit"
id: L-0250
status: accepted
created: 2026-05-14
updated: 2026-05-14
module: governance
related_adrs:
  - ADR-0268
related_learnings:
  - L-0147
  - L-0249
tags: [audit, mobile, route-absorption, inbound-importer, council-g2]
---

# L-0250: Route-group absorption requires inbound-importer audit

## Context

Discovered during Council G2 review of mobile-phase-3f-home-absorption sortie 2026-05-14. Audit A1 (haiku Explore) reported "0 cross-folder route importers" after grepping for `from "@/app/(app)/(home)"` and similar patterns. Audit A2 (opus code-tracer) said "no inbound `router.push` to shift-hub.tsx". Both true narrowly; both **misleading about the route group as a whole**.

System-steward Phase 3 review (Council G2) reversed this with explicit code-trace at Phase 5 §1.5 (**7th codified L-0147 precedent**): 25+ external sites target `(home)/*` paths via 7 distinct importer-class patterns. None were caught by the original grep patterns.

## Class of trap

**Route-group absorption surface area** is wider than `import` statements. Routes are referenced by:

1. **Push deeplink registry** (`packages/notifications/src/deep-links.ts` event → path map). Pure string literals, no `import`.
2. **Nav tables** (`ActionBar.tsx`, `HomeHeader.tsx`). Hardcoded `router.push("/(app)/(home)/X")` strings.
3. **Phase-view + sheet components** (`DuringShiftView`, `NoShiftView`, `SettingsSheet`). Body `router.push` calls.
4. **Capability tool route tables** (`apps/mobile/src/lib/botsson-tools.ts` voice-tool deep-link table). String values in capability metadata.
5. **Prioritize-actions / recommendation engines** (`apps/mobile/src/lib/prioritize-actions.ts`). String paths in scoring engine.
6. **Cross-tab `router.push`** (sibling tabs invoking `(home)/X` directly).
7. **Page context literals** (`apps/mobile/src/hooks/queries/use-botsson-chat.ts` pageContext: `"(app)/(home)"`). Stage-engine page-context.

A grep for `import.*from.*home` catches **zero** of these. They are all **string literals**.

## Rule

Before approving any route-group absorption or deletion, audit must include grep for:

```
# All deeplink/push targets
grep -rn 'router.push.*\(home\)' apps/ packages/
grep -rn '"/\(app\)/\(home\)' apps/ packages/
grep -rn "'/\(app\)/\(home\)" apps/ packages/

# Push deeplink map
grep -n '\(home\)' packages/notifications/src/deep-links.ts

# Capability tool route tables
grep -rn '\(home\)' apps/mobile/src/lib/

# Page context literals
grep -rn 'pageContext.*home' apps/mobile/

# Server-side push triggers
grep -rn '\(home\)' supabase/migrations/ supabase/functions/
```

Then group results by **importer class** (7 patterns above) and produce a retarget map per class. Each class has its own risk profile (push deeplinks = mid-rollout 404 risk; capability tool tables = voice-tool failure; prioritize-actions = recommendation engine miss).

## Why this matters

A1/A2 in this sortie ran the standard `import` grep and reported "clean". Council G2 caught the gap by Steward's explicit Phase 5 self-reversal — without that reversal, build-phase would have shipped deleting routes that 25+ live external sites still call. Push notifications, nav buttons, voice tools, and recommendation engines would all 404 mid-rollout.

## Application

When auditing a route-group for absorption/deletion:

1. **Class taxonomy first.** Enumerate the 7 importer classes; don't assume one grep covers all.
2. **String-literal grep, not just import-statement grep.** Routes are referenced as strings in many infrastructure layers.
3. **Server-side migrations + Edge Functions.** Push triggers in `supabase/migrations/` can hardcode mobile paths via `dispatch_push_notification()` payload — these are also "importers".
4. **Capability tool metadata.** Voice tools (`botsson-tools.ts`) carry route literals in capability definitions; agent runtime depends on them.
5. **Audit doc as deliverable.** The audit table itself ships as a build-phase handoff doc (e.g. `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md`).

When reviewing a route-group audit:

- Reject "0 inbound importers" claims unless the audit explicitly lists the 7 importer classes scanned.
- Force the audit to produce a **retarget map per class**, not just a flat count.

## Pattern frequency

1st observed instance (Council G2 2026-05-14). Council G2 verdict captured it as a new learning. Watch for 2nd occurrence; if 3rd observed, promote to SKILL.md `run-council` Phase 2 briefing requirement: "For route-group absorption topics, briefing MUST include 7-class inbound importer matrix."

## Related
- L-0147 — Chair Self-Reversal Protocol (caught this gap; 7th codified precedent in this session)
- L-0249 — ADR cross-reference content-drift (similar shape — narrow grep misses content)
- ADR-0268 §"Tab removal sequence" — Phase 3f mandate that triggered this audit
- `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md` — concrete output of this rule applied to (home) absorption
