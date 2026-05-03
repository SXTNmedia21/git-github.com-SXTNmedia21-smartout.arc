---
title: ADR Coverage Gaps — Slice 9 (Foundation + Uncovered ADRs)
status: done
updated: 2026-05-02
created: 2026-05-02
module: meta
tags: [audit, adr, coverage, foundation]
---

# ADR Coverage Gap Audit — Slice 9

Read-only audit. No code changes. Covers all ADRs not assigned to slices 1-7.

---

## Summary — Top 5 Gaps

1. **ADR-0053 (proposed): Simulator service never built.** `services/simulator/` does not exist. ADR accepted the schema but the dedicated microservice remains unshipped. No code at all.

2. **ADR-0139 (draft): `--color-proposed` token not in design-tokens.** `PendingBadge` component and amber OKLCH token do not exist in `packages/design-tokens/src/` or `apps/web/src/`. Blocks Wave 2C schedule TanStack migration per ADR-0091.

3. **ADR-0122 (proposed): Governance telemetry — only 1 of 7 promised events shipped.** ADR declared 7 domain events replacing "button clicked". Registry has `governance.content_updated` only. The remaining 6 governance telemetry events are phantom.

4. **ADR-0218 (proposed): Operating-hours dual-write — wizard reads only `company_opening_hours`, does NOT dual-write to `workspace_operating_hours`.** `wizard-definition.ts:88` reads `company_opening_hours` and `setupActions.ts:283` has the dual-write, but the path diverges: wizard (onboarding) writes dual, calendar/settings writes only `workspace_operating_hours`. Split truth window still open.

5. **ADR-0260 (proposed): Cabinet Grotesk font not swapped.** `apps/web` still has `Instrument Serif` hardcoded in comments and one WelcomeWizard file (`font-heading` token maps to old font). Cabinet Grotesk referenced only in playground/docs. Grep gate post-cutover (zero `Instrument Serif` refs) not yet passing.

---

## Foundation ADR Table (0001–0050)

| ADR | Title | Log Status | Code Present? | Divergence |
|-----|-------|-----------|---------------|------------|
| 0001 | Turborepo + pnpm workspaces | accepted | ✅ `turbo.json` + `pnpm-workspace.yaml` | None |
| 0002 | State-driven vs hook-driven logic | accepted | ✅ pattern enforced | None |
| 0003 | shadcn/ui + local styling | accepted | ✅ `packages/ui`, `components.json` | None |
| 0004 | Unified telemetry engine | accepted | ✅ `packages/telemetry/src/registry.ts` | Covered slice 7 |
| 0005 | Testing — 4-layer strategy | accepted | ✅ pgTAP in `supabase/tests/pgtap/`, Vitest, Playwright E2E | None |
| 0006 | Secrets + env module boundaries | accepted | ✅ `apps/web/src/env.ts`, `op run` pattern | None |
| 0007 | Dashboard architecture + nav state | accepted | ✅ `DashboardShell.tsx`, Server layout | None |
| 0008 | Dashboard scroll behavior | accepted | ✅ `scrollbar-thin` usage throughout | None |
| 0009 | Tailwind v4 CSS-based config | accepted | ✅ `globals.css` config, no `tailwind.config.ts` | None |
| 0010 | AI SDK + OpenRouter provider | accepted | ✅ `packages/ai/src/adapters/vercel-ai.ts` | None |
| 0011 | `user_identity` table naming | accepted | ✅ All migrations use `user_identity` | Covered slice 7 |
| 0012 | Subscription on company table | accepted | ✅ `company.subscription_*` columns | Covered slice 7 |
| 0013 | DB types auto-generation | accepted | ✅ `packages/supabase/src/database.types.ts` | Covered slice 7 |
| 0014 | PostHog EU instance + proxy | accepted | ✅ `apps/web/src/lib/posthog.ts`, EU endpoint | None |
| 0015 | Bubble.io rebuild strategy | accepted | ✅ Strategy complete — rebuild in progress | None |
| 0016 | Services directory | accepted | ✅ `services/` with 11 services | None |
| 0017 | Enterprise infra + shared configs | accepted | ✅ `packages/eslint-config`, `packages/typescript-config` | None |
| 0018 | TanStack Table + Recharts platform-admin | accepted | ✅ Used in platform-admin tables | None |
| 0019 | Performance + build governance | accepted | ✅ `docs/cross-cutting/performance-governance.md` | None |
| 0020 | Vercel hosting dual-project | accepted | ✅ `smartout-web` + `smartout-landing` projects | None |
| 0021 | Subdomain-based workspace routing | accepted | ✅ Middleware + `x-workspace-slug` | None |
| 0022 | Email/notification service | accepted | ✅ SendGrid via Edge Functions | None |
| 0023 | Global scrollbar via design tokens | accepted | ✅ `scrollbar-thin` token, CSS-based | None |
| 0024 | Contract system architecture | accepted | ✅ `employment_contract` + `contract_template` tables | Covered slice 6 |
| 0025 | Documentation restructuring + frontmatter | accepted | ✅ `docs/` with YAML frontmatter | None |
| 0026 | Template editor + PDF attachments | accepted | ✅ DocuSeal integration | None |
| 0027 | `pricing_terms` table | accepted | ✅ Amended by ADR-0121 | None |
| 0028 | API key management | accepted | ✅ `api_key` table, workspace-api gateway | None |
| 0029 | Workspace API gateway | accepted | ✅ `supabase/functions/workspace-api/` | Covered slice 3 |
| 0030 | Docs in landing app (Nextra removal) | accepted | ✅ `apps/landing/` owns docs | None |
| 0031 | Journey portal system | accepted | ✅ `apps/web/src/app/platform-admin/journeys/` | None |
| 0032 | Schedule local state architecture | accepted | ✅ TanStack Query local state | Covered slice 4 |
| 0033 | Documentation RAG + pgvector | accepted | ✅ Migration `20260301200050`, `match_workspace_docs` RPC | None |
| 0034 | Documentation enforcement pipeline | accepted | ✅ `packages/docs-pipeline` | None |
| 0035 | Docker network infra | superseded | N/A — superseded by ADR-0039 | None |
| 0036 | Shift MCP server | accepted | ✅ `services/shift-mcp/` | None |
| 0037 | Landing page event tracking | accepted | ✅ PostHog landing events | None |
| 0038 | Journey agent + output generators | accepted | ✅ `apps/e2e/generators/` | None |
| 0039 | Infrastructure consolidation | accepted | ✅ `infra/` with Docker Compose + Caddy | Covered slice 3 |
| 0040 | Infrastructure in monorepo | accepted | ✅ `infra/` directory | None |
| 0041 | Onboarding wizard step architecture | accepted | ✅ `apps/web/onboarding/` | Covered slice 10 |
| 0042 | Agent architecture — Stage Engine | accepted | ✅ `services/stage-engine/` | Covered slice 2 |
| 0043 | Emergency contact on `user_identity` | accepted | ✅ `user_identity` has emergency columns | None |
| 0044 | Invitation table named `invitation` | accepted | ✅ Migration uses `invitation` not `workspace_invite` | Covered slice 7 |
| 0045 | SendGrid for transactional email | accepted | ✅ `packages/notifications/` + Edge Functions | None |
| 0046 | Block-based landing builder | superseded | N/A — superseded by ADR-0064 | None |
| 0047 | Schedule DB persistence + TanStack | accepted | ✅ `useShifts`, `useDepartmentShifts` | Covered slice 4 |
| 0048 | DailyCloseEngine architecture | accepted | ✅ `services/stage-engine` daily-close process | None |
| 0049 | `@smartout/agent-sdk` package | accepted | ✅ `packages/agent-sdk/` | None |
| 0050 | Port standardization + vault secrets | accepted | ✅ Port layout enforced, 1Password vault | None |

---

## Mid-Range ADR Deep Dives (0051–0180)

### ADR-0053 — Simulation Schema + Simulator Service (proposed)
Status in log: `proposed`. No `services/simulator/` directory exists. The schema portion (`simulation` schema in migrations) was not found — no simulation schema migration exists. **Conclusion: 🔴 fully unshipped.** No code anywhere. Schema not created. Service not created.

### ADR-0053 to ADR-0091 block (accepted)
ADR-0056 (Cascade Core Foundation Schema — `done` in log): Cascade schema tables confirmed in migrations (`department_operating_hours`, `workspace_operating_hours`, etc.). ADR-0075 (Knowledge system consolidation): DASHBOARD.md + activity-log pattern confirmed. ADR-0084 (telemetry conditional exports): `packages/telemetry/src/index.ts` react-server split confirmed. ADR-0085 (year-wheel governance): `planning_cycle` table + `activate_season` RPC in migrations. ADR-0091 (governance gate RPC): `cascade_gate_write` in `packages/supabase/src/gate-client.ts` confirmed (WP2+WP3 shipped per log).

### ADR-0099 — Unified Authority Gate (accepted)
`gate_action` RPC + `engine_authority_config` confirmed in `services/stage-engine/src/core/authority.ts`. Amended by ADR-0189 (CI seed parity). ✅ shipped.

### ADR-0113 — DashboardContext Decomposition (accepted)
`useDashboard()` facade, `ThemeContext` hoist, `BotssonProvider` split confirmed in `apps/web/src/components/dashboard/DashboardShell.tsx`. ✅ shipped.

### ADR-0115 — RSC Migration Pattern (accepted)
`loading.tsx` files confirmed across `cost/`, `billing/`, `year-wheel/` dashboard routes. NordicSkeleton not present as a named component — pattern implemented via Tailwind skeleton classes directly. ⚠️ partial: pattern live but `NordicSkeleton` component referenced in ADR not a named export.

### ADR-0122 — Governance Telemetry Quad-Destination (proposed)
Registry: only `governance.content_updated` found (2 occurrences in registry). ADR declared 7 domain events. Governance Server Actions exist (`update-policy`, `update-protocol`) but remaining 6 events (`governance.policy_published`, `governance.protocol_completed`, etc.) not registered. 🔴 **majority unshipped.**

### ADR-0139 — `--color-proposed` Token + PendingBadge (draft)
Zero occurrences of `--color-proposed` or `PendingBadge` in `packages/design-tokens/` or `apps/web/src/`. Status in log: `draft`. **🔴 unshipped — blocks Wave 2C per ADR-0091.**

### ADR-0154 — Unified Overlay System (proposed)
`EntityDrawer` ✅ confirmed. `EntityFormDialog` ✅ confirmed (`packages/ui/src/components/entity-form-dialog.tsx`). `WizardForm` not found as a named export. `Sheet` and `AlertDialog` present in shadcn/ui. **⚠️ partial — EntityDrawer + EntityFormDialog shipped; WizardForm and full decision-matrix enforcement not verified.**

### ADR-0192 — Authority Seed Bootstrap Trigger (proposed)
`AFTER INSERT ON workspace` trigger confirmed in `supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql` (AFTER not BEFORE — deliberate deviation from ADR body, documented in migration header). **✅ shipped with documented deviation.** Status in log still `proposed` but migration is live.

### ADR-0218 — Operating-Hours Source-of-Truth + Dual-Write (proposed)
`setupActions.ts:283` confirmed dual-write (completeSignup path). `wizard-definition.ts:88` only reads `company_opening_hours` without dual-write (read-path, not mutating). Calendar `CalendarSettingsSheet.tsx` writes `company_opening_hours` only. Settings `use-workspace-operating-hours.ts` writes `workspace_operating_hours` only. **⚠️ partial: dual-write exists only on initial signup flow; subsequent edits via Calendar/Settings remain single-source. ADR intent ("wizard MUST dual-write") is only partially satisfied.**

### ADR-0228 — Page-Takeover Capability Default-Deny (not in covered list, file exists)
`page_takeover.help.panic_bar_human_button` capability present in `packages/ai/src/capabilities/types.ts:27`. Seed/authority config not verified. Status: not in decision log index above — file `0228-page-takeover-capability-default-deny.md` exists on disk. **⚠️ capability name registered, authority seed status unclear.**

### ADR-0255 — Sixten Stage-Engine Integration (proposed)
`services/stage-engine/src/routes/agent/dispatch.ts` confirmed with Sixten persona support and `dispatchToSixten()` reference. Phase 0 shipped. Correct status: `proposed` (Phase 1+ pending). **✅ Phase 0 shipped per proposal scope.**

---

## Proposed-Status ADR Triage

Per STATE-SUMMARY claim of 12 proposed ADRs. Verified current state:

| ADR | Title | Current Code State | Verdict |
|-----|-------|--------------------|---------|
| 0053 | Simulation schema + microservice | No service dir, no schema migration | 🔴 unshipped |
| 0122 | Governance telemetry quad-destination | 1 of 7 events in registry | 🔴 mostly unshipped |
| 0123 | ADR-0029 amendment — pre-workspace exceptions | Referenced in ADR-0029 file; no distinct migration found | 🟡 partial |
| 0124 | Polymorphic FK documentation convention | `COMMENT ON` used in migrations but not consistently for FK gaps | 🟡 partially adopted |
| 0135 | Mobile voice via LiveKit not Ultravox | `packages/agent-sdk/src/providers/livekit.ts` exists | 🟡 infra present, integration incomplete |
| 0136 | Witness-with-camera evidence model | `evidence_storage_path` columns exist; UI optional per ADR | 🟡 schema present |
| 0139 | `--color-proposed` token + PendingBadge | Zero code presence | 🔴 unshipped |
| 0151 | Stage-engine profile_id server derivation | Bumped to accepted 2026-04-23 — `deriveProfileId()` confirmed | ✅ actually accepted (log stale) |
| 0152 | activity-trail fail-fast contract | `nonEmpty()` in `packages/ai/src/adapters/vercel-ai.ts` (via ADR-0193) | 🟡 partial |
| 0153 | Expo-web surface classification | Referenced in mobile ADR chain; no Expo-web specific guards found | 🟡 policy only |
| 0154 | Unified overlay system | EntityDrawer + EntityFormDialog shipped; WizardForm not found | 🟡 partial |
| 0158 | packages/ui dual-platform `.web.tsx`/`.native.tsx` | No `.web.tsx`/`.native.tsx` files found in `packages/ui/src` | 🔴 not implemented |
| 0168 | Magic link as default auth | `signInWithOtp` confirmed on `/login` + `/signup` | ✅ shipped (status stale) |
| 0169 | Partial unique index pending invitation | Migration `20260515140000` confirms index `workspace_invitation_pending_unique_per_email` | ✅ shipped (status stale) |
| 0191 | Agent capability tool auth-passing pattern | `toolAuthPattern: "bff" | "direct_admin"` in CapabilityDefinition (ADR-0198 delivered field) | ✅ field exists; no `x-agent-actor` header found |
| 0192 | Authority seed bootstrap trigger | AFTER INSERT trigger on workspace confirmed in migration | ✅ shipped (status stale) |
| 0218 | Operating-hours dual-write | Dual-write on signup only; calendar/settings single-source | ⚠️ partial |
| 0260 | Cabinet Grotesk display font | `Instrument Serif` still hardcoded in comments + WelcomeWizard | 🔴 cutover not done |

---

## Critical: Accepted-but-Unshipped or Stale-Status

| ADR | Log Status | Reality | Risk |
|-----|-----------|---------|------|
| 0115 | accepted | ⚠️ `NordicSkeleton` named component in ADR not found as export | Low — pattern applied differently |
| 0151 | proposed (in log) | ✅ Bumped accepted 2026-04-23 per log body | Index row stale — double-entry: both proposed and accepted rows present |
| 0169 | proposed | ✅ Migration confirmed | Log status not updated after merge |
| 0168 | proposed | ✅ `signInWithOtp` confirmed | Log status not updated |
| 0192 | proposed | ✅ Migration confirmed | Log status not updated; deviation from BEFORE→AFTER INSERT not in log body |
| 0197 | proposed AND accepted | Duplicate rows in log (lines 100+109) | Index inconsistency — two rows, both with same ADR-0197 |
| 0190 | proposed AND accepted | Duplicate rows in log (lines 108+113) | Same as above — ADR-0190 appears twice with different statuses |
| 0195 | proposed AND accepted | Duplicate rows (lines 102+111) | Same pattern |
| 0196 | proposed AND accepted | Duplicate rows (lines 101+110) | Same pattern |
| 0204 | duplicate row | Both rows present with identical ADR number | Accepted status is correct; proposed row is stale |
| ADR-0033 | Note: log references as ADR-0031 "Documentation RAG with pgvector" | File `0033-documentation-rag-pgvector.md` exists, ADR-0031 is journey portal | No collision — different ADRs; log references correct files |

**Structural finding:** The decision log has 8+ duplicate rows where the same ADR appears twice — once as `proposed` and once as `accepted`. This is caused by the campaign branch merge pattern where the log was appended twice without deduplication. The accepted rows are authoritative; the proposed rows are historical artifacts that should be removed.
