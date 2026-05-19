---
title: "Journey — hms-cluster-polish-fixup"
status: verified
feature: hms-cluster-polish-fixup
updated: 2026-05-17
created: 2026-05-17
module: hms
tags: [journey, council-followup, a11y, telemetry, security]
---

# Journey — hms-cluster-polish-fixup

> Sub-sortie of campaign/ui-shell. Closes 5 gates from Council R1 verdict on `hms-cluster-polish-read` (APPROVE WITH CHANGES).

## Journey 1: Trainee learns from procedure step content (G3 — XSS prevention)

**Precondition:** Trainer (admin role) has authored markdown content in `procedure_step.training_content` for a protocol step. Trainee is assigned the protocol.

1. Trainee opens `/dashboard/hms/training` → System renders ProtocolList → Trainee sees assigned protocol with status.
2. Trainee clicks protocol → System mounts LearnFlow with first step → User sees step title, description, and training content rendered as sanitized markdown (NOT raw HTML).
3. If `trainingContent` contains malicious payload (`<script>`, `<img onerror>`, `<iframe>`) → System sanitizes via rehype-sanitize → User sees neutralized text only.

**Postcondition:** Trainee progresses through learning flow; no script execution.

**Error path:** If `trainingContent` is null → System renders fallback message "Innhold mangler" (existing behavior preserved).

## Journey 2: Manager navigates HMS sub-routes via keyboard (G2 — ARIA fix)

**Precondition:** Manager has authority for `hms` capability. On `/dashboard/hms`.

1. Manager focuses HmsSubNav via Tab → System highlights first nav link with visible focus ring (Nordic Split ring tokens).
2. Manager presses Arrow keys / Tab → System moves focus across nav items.
3. Manager presses Enter on `Drift` link → System routes to `/dashboard/hms/drift`.
4. Screen reader announces: "HMS navigasjon, Drift, current page" (NOT "tab, selected" — Path A removes incorrect tab semantics).

**Postcondition:** Keyboard + screen-reader users navigate HMS sub-routes correctly. WCAG 4.1.2 (Name, Role, Value) satisfied via `<nav>` + `aria-current="page"`.

**Error path:** None — pure navigation surface.

## Journey 3: Telemetry pipeline records HMS engagement (G1 — emit wiring)

**Precondition:** Manager opens `/dashboard/hms`, `/hms/training`, `/hms/drift`, `/hms/documents` in sequence.

1. Page mounts → `useEffect` resolves workspace_id + actor_id from `getProfileContext()` (fail-fast on empty per L-0177) → System calls `emit({ event: "hms.umbrella.viewed", ... })`.
2. Telemetry pipeline routes to PostHog (adoption funnel) + logger (observability) + `activity_trail` row (manager engagement audit).
3. PostHog dashboard updates engagement count. `activity_trail` query confirms event landed with non-empty IDs.

**Postcondition:** 4 HMS view events fire on each respective route mount. Phantom-contract closed.

**Error path:** If `workspace_id` or `actor_id` is empty → `getProfileContext()` throws → emit never called (fail-fast preserved).

## Journey 4: Botsson resolves HMS route knowledge (G4 — site-map entry)

**Precondition:** User asks Botsson "Hva er HMS-opplæring?" (chat or voice).

1. Botsson queries `site-map.json` → System returns `/dashboard/hms/training` entry with purpose + audience.
2. Botsson explains: "På /dashboard/hms/training ser du protokoller du er tildelt + kompetansematrise (admin)."
3. User clicks/navigates → System loads training route.

**Postcondition:** Botsson route knowledge complete. No "untrained route" gap.

**Error path:** N/A — read-only lookup.

## Journey 5: Council infrastructure self-improves (G5 — meta)

**Precondition:** Future R1 council reviews a page-cluster sortie where one route is a thin-shell delegating page.

1. Phase 1 INTAKE triggers page-polish MANDATORY rule.
2. Supervisor Phase 3 reviews — finds delegating page has no `_tools/`.
3. Per amended Phase 0 carve-out: HANDOFF Decision documenting L-0287 phantom-contract avoidance → tool-bridge skip ACCEPTABLE.
4. Site-map entry checked separately → enforced regardless.

**Postcondition:** Strict-rule-vs-cascade-intent conflict resolved canonically. No false BLOCKED verdicts.
