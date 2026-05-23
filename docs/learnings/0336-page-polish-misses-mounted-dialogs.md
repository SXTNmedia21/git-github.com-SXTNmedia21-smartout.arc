---
id: L-0336
title: smartout-page-polish Phase 8 site-map gate misses mounted Dialogs that own a user journey
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: onboarding
tags: [learnings, page-polish, site-map, dialog, wizard, onboarding, a11y]
---

# L-0336 — `smartout-page-polish` Phase 8 site-map gate iterates routes — misses mounted modal Dialogs/Sheets that own a user journey

## Context

`WelcomeWizard` is a Radix `<Dialog>` mounted as a full-screen overlay on `/dashboard` for users where `is_welcome_complete = false`. It owns an 8-step user journey: profile completion, household member, work history, emergency contact, consent/handbook, GDPR, tariff, availability.

`smartout-page-polish` Phase 8 iterates routes in `site-map.json`. The wizard has no route of its own — it renders as an overlay on the `/dashboard` route. Phase 8 did not flag it. The site-map entry for `/dashboard` had `polished_at: 2026-05-14` — stale through 38 commits of wizard development, none of which triggered a site-map bump.

The supervisor caught the gap via explicit "what mounts on /dashboard" inspection, not via the Phase 8 gate.

Surfaced by Council R3 (2026-05-23).

## Discovery

The `smartout-page-polish` Phase 8 site-map scan is route-scoped. A route entry can be fully polished while a journey-owning Dialog/Sheet mounted on that route is completely untracked. The mounted component's existence, a11y attributes, telemetry hooks, and journey documentation are all invisible to the Phase 8 gate.

This is a structural coverage gap — not a one-off miss. Any Dialog or Sheet that:
1. Is mounted unconditionally (or conditionally based on state) on an existing route
2. Owns a multi-step user flow
3. Has no route of its own

...will be invisible to Phase 8 unless the skill is extended.

## Impact

**Forward extension for `smartout-page-polish` SKILL.md (Phase 8 gate):**

Add an explicit pre-check step: scan `apps/web/src/components/**/Dialog*`, `Sheet*`, `Modal*` for components that:
- Mount a multi-step or journey-owning flow
- Are rendered from a page or layout (not just from within another Dialog)

For each found: verify the parent route's site-map entry includes a reference to the mounted component in `purpose` or `common_intents`. If not → site-map update required before Phase 8 passes.

**Immediate fix applied:** site-map updated in Sortie B (`d36a69643`, defect #11) to include `WelcomeWizard` under `/dashboard`.

**Rule for journey-owning Dialog authors:** When shipping a Dialog that owns a user journey, ALWAYS update the parent route's site-map entry in the same PR. Do NOT defer it to a page-polish pass.

## References

- `smartout-page-polish` SKILL.md — Phase 8 gate (extend to include Dialog/Sheet scan)
- site-map: `apps/web/src/app/dashboard/site-map.json` (or equivalent)
- Fixed in Sortie B: `d36a69643` (defect #11)
- Supervisor catch: Council R3 (2026-05-23) Phase 5 review
- Sibling: Phase-3 coverage gap — design+a11y axis (L-0289, HMS R1 2026-05-17)
