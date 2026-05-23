---
id: L-0337
title: Journey doc status:verified toggled prematurely — references nonexistent columns/actions slipped past review
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: onboarding
tags: [learnings, journey, documentation, verified-flag, column-drift, onboarding]
---

# L-0337 — Journey doc `status: verified` toggled prematurely — references nonexistent columns/actions slipped past doc-tutor + handoff phase

## Context

`docs/journeys/JOURNEY-employee-onboarding-wizard.md` was flipped from `draft` → `verified` at commit `f0d43632d` (Sortie C closure deliverable). The doc contained the following false references:

| Claim in journey doc | Reality |
|---|---|
| `profile.welcome_wizard_completed` (7 occurrences) | Actual column: `profile.is_welcome_complete` |
| `profile.welcome_wizard_dismissed` (nonexistent column) | No such column exists on `profile` |
| `resumeWelcomeWizard` Server Action (nonexistent) | No such action in `_actions/welcome-wizard-actions.ts` |
| `/api/mobile/onboarding/state` (wrong path) | Actual path: `/api/mobile/employee-onboarding/state` |

All four classes of error survived doc-tutor review and the handoff phase. The supervisor caught them in Council R3 via column-name grep against `database.types.ts` and path grep against `app/api/**/route.ts`.

Surfaced by Council R3 (2026-05-23), Supervisor D + agent-coord (confirm).

## Discovery

`status: verified` on a journey doc is a trust signal used by future developers and council agents: the doc is a reliable reference for how the feature actually works. Premature toggle under time pressure (closure deliverables commit) converts a trust signal into a liability — incorrect column names and action names propagate to anyone who reads the doc as authoritative.

The root cause is that the verified-flag toggle was gated on "doc exists and looks structurally complete" rather than on "every claim in the doc is verified against the codebase."

Sibling pattern: build-agent-uncommitted-changes (premature done-flag — agent reports complete before work is fully committed). Same class: a status flag that advances before the underlying state actually satisfies the flag's semantic.

## Impact

**Gate for journey verified-flag toggle (codified as forward rule):**

Before toggling `status: draft → verified` on any journey doc, perform the following per-claim code grep:

1. **Column names** — grep each column reference against `packages/supabase/src/database.types.ts` (or generated types). Zero matches = false claim → fix before verified.
2. **Server Action names** — grep each action reference against `apps/web/src/app/**/_actions/*.ts`. Zero matches = false claim.
3. **BFF paths** — grep each `/api/...` path reference against `apps/web/src/app/api/**/route.ts`. Zero matches = false claim.
4. **Mobile BFF paths** — same for `/api/mobile/**`.

This gate MUST be promoted to:
- Journey template frontmatter (`# verified-gate: column-grep, action-grep, bff-path-grep`)
- `close-feature.sh` pre-merge check (sibling to existing journey existence gate)

**Fix applied:** `JOURNEY-employee-onboarding-wizard.md` corrected in Sortie C (`405051773`, defect #10) — all 4 false-reference classes fixed, status reset to `draft` pending re-verification.

## References

- Journey doc: `docs/journeys/JOURNEY-employee-onboarding-wizard.md`
- Fixed in Sortie C: `405051773` (defect #10)
- Supervisor catch: Council R3 (2026-05-23)
- Sibling: build-agent-uncommitted-changes (L-0291 — premature done-flag pattern)
- Journey template: `docs/templates/journey.md` (extend with verified-gate section)
- `close-feature.sh` gate: add column-grep + action-grep + bff-path-grep pre-merge checks
