---
title: "Journey — HMS bridge tools resolve unambiguously after L-0258 dedupe"
status: verified
feature: hms-collision-fix
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, collision-fix, ADR-0360, L-0258, council-verified, campaign-ui-shell, M5-prereq]
---

# Journey — HMS bridge tools resolve unambiguously after L-0258 dedupe

> Sub-sortie: `hms-collision-fix`. M5 Sortie 2 of 4, BLOCKER for Sortie 3. Council-verified 2026-05-17.

## Journey: User asks Botsson "vis åpne avvik" on HMS umbrella — consistent answer regardless of route order

**Precondition:** Admin signed in, on `/dashboard/hms` umbrella. Pre-this-sortie, `listOpenDeviations` is defined in 3 bridges (`hms`, `hms-deviations`, `governance`). LLM routes to whichever bridge's implementation Object.assign'd last — depends on mount order. Same prompt returns different shapes from different routes.

1. Admin on `/dashboard/hms` opens chat → types "vis åpne avvik"
2. LLM looks up `listOpenDeviations` in tool registry → exactly ONE definition (in `hms-deviations` bridge)
3. Bridge tool fires: returns summary of open deviations with severity, domain, department
4. Admin asks same question on `/dashboard/hms/deviations` later → same single definition fires → same shape returned
5. Admin navigates to `/dashboard/governance` and asks same question → `listOpenDeviations` NOT available in this scope; LLM either navigates user to `/dashboard/hms/deviations` or returns "Tool unavailable here"

**Postcondition:** Tool resolution deterministic. No mount-order silent drift. L-0258 closed for HMS cluster (3 of 9 instances).

**Error paths:**
- Future PR introduces duplicate tool name → CI detector blocks at lint OR pre-push step → developer sees "Error: tool 'X' registered in 2 files: [...]"
- Bridge tool removed but caller (HMS umbrella page hook input) still passes prop → typecheck error at build time (HmsToolInput shrinks; caller must also shrink)

## Journey: User asks "hvordan går driften" — single owner answers

**Precondition:** Pre-fix, `getDriftStatus` defined in both `hms` umbrella + `hms-drift` sub-tab.

1. Admin on `/dashboard/hms` asks "hvordan går driften" → LLM sees ONE `getDriftStatus` definition (in `hms-drift`)
2. Tool fires only when admin is on or navigates to `/dashboard/hms/drift`
3. From umbrella: LLM uses `switchHmsTab("drift")` first, then `getDriftStatus` — two-tool turn-taking, but consistent

**Postcondition:** No umbrella-level drift query; admin gets nav-first behavior. Documented in HANDOFF as expected change.

## Journey: User asks for protocol detail — `governance` owns the canonical tool

**Precondition:** Pre-fix, `getProtocolDetail` in both `hms-governance` sub-tab + `governance` top-level.

1. Admin asks "vis policy X" → ONE `getProtocolDetail` in `governance` scope
2. Available from both `/dashboard/governance` AND `/dashboard/hms/governance` (sub-tab inherits via mount)
3. Consistent shape returned regardless of route

**Postcondition:** Single source of truth for protocol detail data.

## Journey: CI detector catches future regression

**Precondition:** Developer adds new bridge tool with name colliding with existing tool.

1. `git push` → husky pre-push runs `pnpm turbo lint`
2. Detector script greps all `_tools/use-*-tools.ts` files in `apps/web/src/app/dashboard/`
3. Extracts every `modelToolName: "X"` literal
4. Finds duplicate → exits 1 with "Error: tool 'X' registered in N files: [...]"
5. Push blocked. Developer either renames OR consolidates to single owner per L-0258 protocol.

**Postcondition:** L-0258 regression prevented at PR time, not in production.

**Error paths:**
- Detector false positive on multi-line `modelToolName` literal → robust extraction strategy required (AST-light or careful regex)
- Detector false positive in test fixture files → exclude `**/__tests__/` glob
- Developer uses `--no-verify` → CI workflow catches at PR time (recommend wiring to CI too, not just local hook)

## Verification

- `pnpm turbo typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0
- `pnpm turbo lint` (or pre-push) → 0 collision errors
- `grep -rn 'modelToolName: "listOpenDeviations"' apps/web/src/app/dashboard/ --include='*.ts'` → exactly 1 hit, in `hms/deviations/_tools/use-hms-deviations-tools.ts`
- `grep -rn 'modelToolName: "getDriftStatus"' apps/web/src/app/dashboard/ --include='*.ts'` → exactly 1 hit, in `hms/drift/_tools/use-hms-drift-tools.ts`
- `grep -rn 'modelToolName: "getProtocolDetail"' apps/web/src/app/dashboard/ --include='*.ts'` → exactly 1 hit, in `governance/_tools/use-governance-tools.ts`
- Manually run `scripts/check-tool-name-collisions.ts` → exit 0

## E2E (recommended)

Synthetic test: introduce intentional duplicate in fixture → run detector → assert exit 1 + correct error format. Add to `apps/e2e/` or as unit test next to script. Out of scope for this sortie — defer to detector enhancement sortie.

## Council learning ref

- ADR-0360 (this sortie ships) — L-0258 CI collision detector mandatory
- L-0258 (2026-05-14) — Tool-registry Object.assign collision
- L-0267 (2026-05-14) — Briefing collision counts are spot-checks (3 confirmed today; ~6-8 cross-domain remain for follow-up sortie)
- ADR-0325 Phase 2 (this sortie executes for HMS cluster)
