---
title: "HANDOFF — billing-polish"
status: done
feature: billing-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, billing, polish, campaign-ui-shell]
---

# HANDOFF — billing-polish

> Sub-sortie inside `campaign/ui-shell`. Closes S12 step 7 of 20 in `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`. M4 cluster **COMPLETE**: contracts ✓ + cost ✓ + billing ✓ (3/3 sub-sorties done).

## Summary

Polished the 3-route billing cluster — `/dashboard/billing`, `/dashboard/billing/[invoice_id]`, `/dashboard/billing/settings` — closing S12 step 7. The surface was already 80% clean per T0 recon (6 gaps identified, 14 Botsson tools verified clean against Tool Compliance Self-Check). Polish scope: 5 new files (error boundaries + loading skeletons), 3 modified files (billing overview header, EHF Server Action emit + before-snapshot, telemetry registry), and 3 journey docs. A G4 sonnet code-review pass caught one blocker — `activity_trail` dead-route for company-scoped events — resolved in a follow-up fix commit (`24e94a0b2`) before close.

M4 cluster (3/3) is the final module in the admin cluster group. Next milestone: M5 HMS cluster (8 routes).

## Files Changed

**New files (5):**
- `apps/web/src/app/dashboard/billing/error.tsx` — client error boundary, Norwegian copy ("Noe gikk galt") + retry button, `bg-background` / `border-border` tokens
- `apps/web/src/app/dashboard/billing/[invoice_id]/error.tsx` — same pattern, invoice-specific Norwegian copy
- `apps/web/src/app/dashboard/billing/[invoice_id]/loading.tsx` — header + line-items skeleton, Nordic Split tokens
- `apps/web/src/app/dashboard/billing/settings/error.tsx` — settings-specific Norwegian error copy
- `apps/web/src/app/dashboard/billing/settings/loading.tsx` — header + form-field skeletons

**Modified files (3):**
- `apps/web/src/app/dashboard/billing/page.tsx` — `font-heading` on h1, Norwegian page instructions added
- `apps/web/src/app/dashboard/billing/settings/_actions/updateCompanyEhfSettings.ts` — `emit('company.ehf_settings_updated', ...)` added; before-snapshot read prior to write (ADR-0204 audit requirement); `workspace_id` + `actor_id` resolved from server session with `nonEmpty()` guards (ADR-0134)
- `packages/telemetry/src/registry.ts` — `CompanyEhfSettingsUpdated` interface; `SmartoutEvent` union extended at 2 sites; `EVENT_ROUTING` entry (`company_ehf_settings_updated → PostHog + logger`); `"company"` added to `EventCategory` union; `"company_ehf"` added to `EntityType` union

**Docs (5 files):**
- `docs/plans/PLAN-billing-polish.md` — plan seed
- `docs/journeys/JOURNEY-ui-shell-billing-polish-admin-overview.md` — primary journey (`status: verified`)
- `docs/journeys/JOURNEY-ui-shell-billing-polish-invoice-detail.md` — secondary journey (`status: verified`)
- `docs/journeys/JOURNEY-ui-shell-billing-polish-settings.md` — secondary journey (`status: verified`)
- `docs/HANDOFF-billing-polish.md` — this file

## Commits

3 commits on `feat/ui-shell-billing-polish` vs `campaign/ui-shell`:

| SHA | Message |
|---|---|
| `1b17b5001` | `docs(billing-polish): seed plan + primary journey` |
| `545561fe6` | `feat(billing-polish): Phase 1 — error + loading + EHF emit + header` |
| `24e94a0b2` | `fix(billing-polish): G4 — drop activity_trail from company.ehf_settings_updated` |

## Decisions

No new ADRs. Polish-only sortie — no architectural changes. The following ADRs were respected and verified by G4 sonnet code-reviewer:

- **ADR-0134** — `workspace_id` + `actor_id` resolved from server session in `updateCompanyEhfSettings.ts`, guarded by `nonEmpty()` before `emit()` call
- **ADR-0151** — server-resolved IDs only; no profile_id or workspace_id passed through body-supplied references
- **ADR-0173** — no cross-namespace writes; billing settings Server Action writes only to `company` table (owned by MODULE_01); `emit()` is the only cross-boundary side effect
- **ADR-0204** — all mutations via Server Actions with full auth gates; before-snapshot read confirmed present; no direct DB writes from client
- **ADR-0238** — billing surfaces declare `owns_chat_surface: false`; BotssonShell passive on all 3 routes; no `DomainChatOwnership` declaration needed
- **ADR-0244** — finance read-only enforced; all 14 Botsson billing tools verified clean (0 direct writes, 0 RLS bypasses) by T0 recon + G4 review
- **EventCategory + EntityType expansion** — `"company"` and `"company_ehf"` added to telemetry registry unions. G4 ruled NOT ADR-worthy: expansion mirrors existing pattern (same rationale as cost-polish's `"cost"` / `"cost_overview"` additions). Documented here.

## Learnings

**L: G4 caught `activity_trail` dead-route for company-scoped events.**
`company.ehf_settings_updated` emits with `workspace_id: null` (company is not workspace-scoped). The telemetry provider at `packages/telemetry/src/providers/activity-trail.ts:99` early-returns on `null workspace_id` — intentional design for user-actor events. Result: EHF mutations reach PostHog + logger but NOT `activity_trail`. G4 flagged as a compliance gap in the first review pass; the fix commit (`24e94a0b2`) dropped `activity_trail` from `EVENT_ROUTING` for this event rather than attempting a provider workaround (which would require an ADR). Documented as known debt below. Compliance reviewers querying `activity_trail` for EHF mutations will not find them.

**L: Track F (site-map registration) is often a no-op when prior sortie's entries persist with `polished_at`.**
T0 recon flagged that the billing routes already had `site-map.json` entries from a prior sortie, with `polished_at` timestamps set. The dispatch plan can safely skip Track F when `site-map:validate` exits 0 and `polished_at` is already populated. Recon should explicitly check and annotate this so the plan omits the Track F agent entirely rather than dispatching and immediately no-op'ing.

**L: T0 recon scope of "6 gaps + 14 tools clean" pre-validated polish-only scope — no ADR or council escalations needed throughout.**
Billing was the most complex M4 sub-sortie (3 routes, tool bridges, EHF Server Action, telemetry extension) but the recon agent's upfront gap enumeration meant every phase had defined scope with no scope creep. Contrast with contracts-polish (4-track, 5 routes) where scope was discovered during build. Investing 1 haiku recon agent before dispatch pays for itself in avoided mid-phase pivots.

## Known Issues / Debt

**Compliance gap (NEW):** `company.ehf_settings_updated` audit-trail not captured in `activity_trail` due to provider design (`workspace_id IS NULL` early-returns at line 99 of `packages/telemetry/src/providers/activity-trail.ts`). PostHog + logger destinations still capture the event, so product analytics are intact, but compliance reviewers querying `activity_trail` directly for EHF mutations will find nothing. Possible follow-ups (not prioritised):

1. ADR proposal for a company-scoped audit-trail provider variant that resolves workspace from `company_id`
2. New `billing_activity_log` destination in `EVENT_ROUTING` that writes to a separate, company-keyed table

Neither option is blocking for polish sortie close. Filed as debt here for the next billing-adjacent sortie to consider.

**Tool description sweep deferred:** T0 recon confirmed all 14 Botsson billing tools have non-trivial descriptions per Tool Compliance Self-Check criteria. No sweep needed; not blocking.

## Next Steps

- Sub-sortie ready for `close-feature.sh` from inside worktree at `/home/sxtnl/wsl/smartout.ai-ui-shell-wt-1` (no arg)
- **M4 admin cluster COMPLETE (3/3).** Next milestone: **M5 HMS cluster** — 8 routes, largest M-block remaining in the campaign plan
- Optional: Playwright E2E spec for billing at `apps/web/e2e/billing/` (deferred; S12 orphan-coverage fulfilled by route-returns-<500 check)
- Optional: ADR proposal for company-scoped audit-trail provider (see Compliance gap above)

## Verification

All gates passed:

- `pnpm --filter web typecheck` → 0 errors (verified post-fix commit `24e94a0b2`)
- `pnpm --filter @smartout/telemetry typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0
- 3/3 journeys verified — `admin-overview`, `invoice-detail`, `settings` all `status: verified`
- G4 code-reviewer (sonnet) → APPROVE WITH MINOR ISSUES; blocker (activity_trail dead-route) fixed in `24e94a0b2`
- Husky pre-commit lint-staged → green on all 3 commits
