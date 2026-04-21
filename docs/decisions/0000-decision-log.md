---
title: Decision Log
status: canonical
updated: 2026-04-21
created: 2026-02-27
module: meta
tags: [decisions, adr, index]
---

# Decision Log

> Index of all accepted ADRs. Rebuilt 2026-04-07 after discovering the file had accumulated
> concatenated per-feature tables from multiple merged branches (each feature branch wrote
> its own `0000-decision-log.md` during work, and merges concatenated the frontmatters mid-file).
>
> **Source of truth:** individual `NNNN-*.md` files in this directory. This index is a
> regenerated view — if it disagrees with a file, the file wins.
>
> **Per-feature decision tables** (previously embedded here) have been removed. They live in
> `docs/handoffs/HANDOFF-<feature>.md` and in `activity-log.md` (per ADR-0075).
>
> **2026-04-10 note:** ADR-0037 received an addendum clarifying expanded landing event taxonomy,
> Supabase operational source-of-truth, and Phase 1 Platform Admin -> PostHog bridge ID contract.
>
> Ordered newest first.

| ADR | Date | Title | Status |
|-----|------|-------|--------|
| [ADR-0177](0177-journey-runner-ui-contract.md) | 2026-04-21 | Journey Runner UI contract — Fjernkontroll state machine (6 states, ARIA live region, `useReducedMotion()` guard, spring 35/22/2.2) + store-listing card schema (machine-readable for `close-feature.sh` gate). Nordic Split tokens only — zero hardcoded hex. 44pt minimum touch target. (Council 2026-04-21 Journey Runner Suite v1.6.0 re-review) | proposed |
| [ADR-0176](0176-journey-c4-authority-seed.md) | 2026-04-21 | Journey capability C4 authority seed — mandatory non-default rows in `engine_authority_config` for all four journey capabilities (`journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`: `suggest`; `journey.run_guided`: `autonomous`). Default `read_only` is blocking; default-allow in `gate_action` is CVE-class. Explicit seed migration ships with v1.7.0 in 0a/0b/0c order. | proposed |
| [ADR-0175](0175-journey-telemetry-contract.md) | 2026-04-21 | Journey telemetry contract — five registered emit events (`journey.run_started`, `journey.step_reached`, `journey.completed`, `journey.stuck`, `journey.run_failed`) in `packages/telemetry/src/registry.ts`. All four destinations (PostHog, Logger, activity_trail, engine_event). Resolves phantom emit contracts per ADR-0134 + L-0094. | proposed |
| [ADR-0174](0174-adr-0074-journey-ir-unification-completion.md) | 2026-04-21 | ADR-0074 Protocol Verification Engine unification completion — Mission/Docs/Audit generators in `apps/e2e/generators/` retarget to consume JourneyIR as single primitive. Thin `protocolToJourneyIR()` adapter during migration window, deleted after conversion. ADR-0074 amended with reference to this completion event. | proposed |
| [ADR-0173](0173-journey-capability-model.md) | 2026-04-21 | Journey capability model — four named capabilities registered in `CapabilityName`: `journey.run_dev` (platform-admin, web-only), `journey.publish_mission` (workspace-admin, web-only), `journey.publish_guide` (workspace-admin, web-only), `journey.run_guided` (all roles, mobile-allowed per ADR-0133). | proposed |
| [ADR-0172](0172-journey-version-status-enum-lifecycle.md) | 2026-04-21 | `journey_version_status` enum + journey lifecycle state model — new enum on `journey_version.status` (`draft` → `ready_test` → `ready_publish` → `archived`), separate from runtime `journey_status`. Resolves enum-value collision (`ready_test` already in `journey_status`) and L-0023 dev-tracking/runtime-state mixing. | proposed |
| [ADR-0171](0171-journey-ir-canonical-package-path.md) | 2026-04-21 | JourneyIR canonical package path — `packages/journey-ir` as dedicated shared package. `packages/ai/src/journey` forbidden. Consumed by apps/web BFF, apps/e2e generators, apps/mobile read-path. Capability implementation at `packages/ai/src/capabilities/journey/` imports from `@smartout/journey-ir`. | proposed |
| [ADR-0170](0170-react-context-packages-as-peer-dependencies.md) | 2026-04-21 | React context packages are `peerDependencies` in workspace libs — `packages/*` must never declare `react`, `react-dom`, `@tanstack/react-query` or any other context-provider package as a direct `dependency`. Apps pin the concrete version. Root `package.json` uses `pnpm.overrides` as enforcement backstop. (Council 2026-04-21 QueryClient crash) | accepted |
| [ADR-0166](0166-pii-public-mode-redaction.md) | 2026-04-20 | PII redaction in public-mode helpdesk channels — soft-hold classifier (800ms timeout) runs before publish; on hit, original routed to private sub-channel + author gets clarifying message + public timeline shows redaction placeholder. Amends ADR-0163. Phase 1A ships regex-rules classifier; LLM deferred. (Council 2026-04-20 Progressive Channel, Pontus Q1 b) | accepted |
| [ADR-0165](0165-progressive-channel-discriminator.md) | 2026-04-20 | Progressive Channel Discriminator — `channel.helpdesk_enabled boolean` replaces `channel_type='desk'` as the read-time truth for helpdesk-ness. Legacy `'desk'` rows keep enum value forever (dual-truth window); new helpdesks flip flag on arbitrary `channel_type`. Amends ADR-0161 §Rules-Data-model §1. Ontology invariant (ticket=engine_state, entity_id=channel.id) preserved. Rejects `channel_message.engine_state_id` FK + `channel.domain_tags` + `channel.parent_channel_id`. (Council 2026-04-20 Progressive Channel) | accepted |
| [ADR-0158](0158-packages-ui-dual-platform-strategy.md) | 2026-04-19 | packages/ui Dual-Platform Consumption Strategy — `.web.tsx` + `.native.tsx` platform extensions with shared TS logic primitives. Preserves current apps/web path; mobile adoption additive. Rejects NativeWind + full-separate-package approaches. First consumer: day-control widgets (ADR-0156 §8 Phase 2 complete). | proposed |
| [ADR-0157](0157-server-actions-scope-amendment-adr-0114.md) | 2026-04-19 | Server Actions Scope — Amendment to ADR-0114: new mutations only, existing TanStack mutations grandfathered until scheduled migration. (Council 2026-04-19) | accepted |
| [ADR-0156](0156-day-control-panel-canonical-admin-surface.md) | 2026-04-19 | Day-Control Panel as Canonical D6 Admin Surface — replace `OversiktView` with `WebDayControl`, staged widget placement (apps/web → packages/ui when mobile lands), `locked` phase derived via helper, broadcast type in komm `channel_message.system_data`. (Council 2026-04-19) | accepted |
| [ADR-0163](0163-adr-0078-amendment-pii-allowedchannels-mandatory.md) | 2026-04-19 | ADR-0078 amendment — `allowedChannels` mandatory for PII-handling capabilities; fail-closed at capability registration; documents Layer 1 silence for ad-hoc agent-router path. (Council 2026-04-19 kanaler-som-helpdesk; accepted 2026-04-20 after 8-capability retrofit) | accepted |
| [ADR-0162](0162-helpdesk-query-capability-placement.md) | 2026-04-19 | `helpdesk_query` capability placement — new isolated capability with explicit `allowedChannels: ['chat']` rather than extending `communication` (which has undefined allowedChannels). Five-touchpoint registration template. (Council 2026-04-19; accepted 2026-04-20 via targeted acceptance council — steward + supervisor) | accepted |
| [ADR-0161](0161-helpdesk-ontology-ticket-as-engine-state.md) | 2026-04-19 | Helpdesk ontology — ticket as `engine_state` (Alt D), not a channel with extra columns. Desk = `channel_type='desk'` with `responsible_profile_id` FK; ticket lifecycle = `engine_state(process='helpdesk_query_lifecycle')`; conversation = linked channel thread. Rejects original "desk_query as channel row" proposal and `channel_access_rule` table. (Council 2026-04-19; accepted 2026-04-20) | accepted |
| [ADR-0160](0160-channel-event-vs-engine-event-boundary.md) | 2026-04-19 | `channel_event` vs `engine_event` boundary — `channel_event` is the trigger-populated projection of `engine_event` into Komm UI space; `engine_event` remains single source of truth. Closes 2026-04-13 dead-infra deadline for `channel_event`. (Council 2026-04-19 kanaler-som-helpdesk; accepted 2026-04-20) | accepted |
| [ADR-0169](0169-partial-unique-index-pending-invitation.md) | 2026-04-20 | Partial unique index on `workspace_invitation(workspace_id, lower(email)) WHERE status='pending'` — prevents duplicate pending invitations while allowing re-invite after cancel/expiry. Case-insensitive, race-safe. (Auth & Invitation Spec Council 2026-04-20) | proposed |
| [ADR-0168](0168-magic-link-as-default-auth-method.md) | 2026-04-20 | Magic link as default auth method on both /login and /signup — password tab remains as fallback. Aligns with shift-workforce demographic + Bubble-migrated users + mobile thin-client. Rate-limit + CAPTCHA gate. (Auth & Invitation Spec Council 2026-04-20) | proposed |
| [ADR-0167](0167-invitation-tokens-as-credentials.md) | 2026-04-20 | Invitation tokens classified as session-bootstrap credentials under secrets-protocol. First-8-chars censoring in telemetry, never in AI context, single-use enforced at accept-RPC layer. Extends ADR-0078. (Auth & Invitation Spec Council 2026-04-20) | proposed |
| [ADR-0164](0164-season-namespace-unification-telemetry.md) | 2026-04-20 | Season-namespace unification for year-wheel telemetry events. All canvas-interaction events use `"season "` prefix; UI widget does not define telemetry namespace. (Year Wheel Redesign Council 2026-04-20) | accepted |
| ADR-0159 | 2026-04-19 | **RESERVED — do not reuse.** Slot skipped during 2026-04-19 kanaler-som-helpdesk council mid-session renumber (originally 0156-0159, collided with feat/overview-v2's 0156; renumbered to 0160-0163). Documented so future ADR numbering skips to 0165. See L-0084. | n/a |
| [ADR-0155](0155-livekit-calls-in-expo-web.md) | 2026-04-19 | LiveKit calls are supported in Expo-web via shared `livekit-client` Room lifecycle. Supersedes the "LiveKit voice calls" incapacity clause of ADR-0153. Background Web Push for closed-tab alerts is a follow-up. | proposed |
| [ADR-0153](0153-expo-web-surface-classification.md) | 2026-04-19 | Expo-web classified as third surface; mobile verb boundary applies, native-only features require `isSupported()` capability checks, SDK bumps must be isolated commits. (Council 2026-04-19 null.dispatchEvent audit) | proposed |
| [ADR-0152](0152-activity-trail-fail-fast-contract.md) | 2026-04-19 | activity-trail provider must fail-fast on missing IDs (close L-0038 recurrence) | proposed |
| [ADR-0151](0151-stage-engine-profile-id-server-derivation.md) | 2026-04-19 | Stage-engine must re-derive profile_id server-side (no trust in request body) | proposed |
| [ADR-0154](0154-unified-overlay-system.md) | 2026-04-19 | Unified Overlay System — EntityDrawer (inspect) + EntityFormDialog (write), with Sheet / AlertDialog / WizardForm as narrow-purpose supplements. Five-primitive decision matrix; reviewer-enforceable; ADR-gated against new bespoke overlays. Blocks page-by-page UX pass on `apps/web/`. | proposed |
| [ADR-0140](0140-governance-provenance-jsonb.md) | 2026-04-18 | Governance table provenance convention via `provenance JSONB` — five governance tables; renumbered from 0126 to avoid collision with ADR-0126 (billing integration sync). | accepted |
| [ADR-0150](0150-source-discriminator-trigger-filters.md) | 2026-04-18 | Source Discriminator Pattern + Trigger Filters (renumbered from 0108) | accepted |
| [ADR-0149](0149-strike-mcp-telemetry-boundary.md) | 2026-04-18 | Strike-MCP Telemetry Boundary (renumbered from 0107) | accepted |
| [ADR-0144](0144-invoice-delivery-columns-drop-gate.md) | 2026-04-18 | invoice.delivery_* DROP COLUMN Lifecycle Gate (amends ADR-0128; renumbered from 0135 to avoid collision with mobile ADR-0135) | accepted |
| [ADR-0143](0143-dunning-via-engine-process.md) | 2026-04-18 | Automated Dunning via engine_process, Not n8n (renumbered from 0134 to avoid collision with mobile ADR-0134) | accepted |
| [ADR-0142](0142-invoice-refund-flow-adr-0120-amendment.md) | 2026-04-18 | Invoice Refund Flow — ADR-0120 Amendment for Stripe Refunds (renumbered from 0133 to avoid collision with mobile ADR-0133) | accepted |
| [ADR-0141](0141-payment-attempt-pii-redaction-retention.md) | 2026-04-18 | payment_attempt PII Redaction + Retention Policy (renumbered from 0132 to avoid collision with mobile ADR-0132) | accepted |
| [ADR-0148](0148-ehf-export-csv-pdf-platform-admin.md) | 2026-04-18 | EHF-leveranse via månedlig CSV/PDF-eksport fra platform-admin (renumbered from 0139; supersedes ADR-0145–0147) | accepted |
| [ADR-0147](0147-integration-poll-payments-separate-engine-process.md) | 2026-04-17 | integration_poll_payments as separate engine_process (renumbered from 0138; superseded by ADR-0148) | superseded |
| [ADR-0146](0146-peppol-ehf-transport-via-tickstar.md) | 2026-04-17 | Peppol EHF via Tickstar (renumbered from 0137; superseded by ADR-0148) | superseded |
| [ADR-0145](0145-workspace-oauth-token-storage-supabase-vault.md) | 2026-04-17 | Workspace OAuth — Supabase Vault (renumbered from 0136; superseded by ADR-0148) | superseded |
| [ADR-0139](0139-color-proposed-pending-state-ux.md) | 2026-04-18 | `--color-proposed` Token + Pending-State UX Contract — amber OKLCH (hue ~90) outside brand chroma, mandatory `<PendingBadge />` ("Venter") for WCAG AA + color-blind safety, three-motion contract (commit/hover/lava-lamp retreat), `pendingProposalId: string \| null` on optimistic rows, toast suppression for visual-primary surfaces. Blocks Wave 2C schedule TanStack migration. (Council 2026-04-18 gate-client wave 2) | draft |
| [ADR-0138](0138-agent-tool-result-gate-outcome.md) | 2026-04-18 | Agent Tool Result Contract with Gate Outcomes — discriminated union `ToolGateResult<T>` with four variants (applied / applied_with_exception / proposed / blocked), mandatory Norwegian `user_message` as authoritative LLM copy, `allowed: boolean` for fast branching, prompt-template contract for all four cases. Blocks Wave 2B capability migration. (Council 2026-04-18 gate-client wave 2) | draft |
| [ADR-0137](0137-gate-action-stacking-semantics.md) | 2026-04-18 | Gate Action Stacking Semantics — `gate_action` (ADR-0099) × `cascade_gate_write` (ADR-0091) sequential stacking for capability tool writes to governance-gated entities. Authority deny short-circuits; both gates fire on success; distinct failure semantics per axis. Blocks Wave 2B capability migration. (Council 2026-04-18 gate-client wave 2) | draft |
| [ADR-0136](0136-witness-with-camera-evidence-model.md) | 2026-04-17 | Witness-with-Camera Evidence Model — `evidence_storage_path` + `evidence_kind` on completion entities; Supabase Storage workspace-scoped RLS; PII guidance baked into capture UI; optional by default. (Council 2026-04-17 mobile strategy) | proposed |
| [ADR-0135](0135-mobile-voice-via-livekit-not-ultravox.md) | 2026-04-17 | Mobile Voice via LiveKit (Not Ultravox) — Ultravox lacks RN build path; LiveKit already installed; `packages/agent-sdk/src/providers/livekit.ts` exists. Voice transport = LiveKit; agent control plane = BFF (ADR-0132). (Council 2026-04-17) | proposed |
| [ADR-0134](0134-mobile-telemetry-contract-enforcement.md) | 2026-04-17 | Mobile Telemetry Contract Enforcement — runtime assertion in `emit()` blocks empty-string `workspace_id`/`actor_id`; lint rule + unit tests; backfills 6 broken sites in `use-punch.ts`, `use-swap.ts`, `use-create-shift.ts`. Companions ADR-0116. (Council 2026-04-17) | accepted |
| [ADR-0133](0133-web-composes-mobile-executes.md) | 2026-04-17 | Web Composes, Mobile Executes — Cascade Surface Boundary. Web owns D1–D5 authoring; mobile owns D6 production + C4 acceptance. Verb table codifies in/out-of-scope per surface. Drives MOBILE_IA_CONTRACT.md. (Council 2026-04-17 — two-reviewer convergence) | accepted |
| [ADR-0132](0132-mobile-thin-client-via-web-bff.md) | 2026-04-17 | Mobile is a Thin Client; AI/Capabilities Route Through Web BFF — mobile POSTs to `/api/emma/chat` with JWT; BFF forwards to stage-engine; channel pinning server-side. Companions ADR-0114. Deprecates legacy `chat_message`-direct Botsson by week 6. (Council 2026-04-17) | accepted |
| [ADR-0131](0131-stripe-connect-platform-model.md) | 2026-04-17 | Stripe Connect Platform Model — Smartout-Owned (merchant-of-record for 3A; ingen workspace Connect Accounts; revurderes 3B+ om workspaces etterspør direkte payouts) | accepted |
| [ADR-0130](0130-fase-2-scope-exclusion-contract-onboarding.md) | 2026-04-17 | Fase 2 Scope Exclusion — Contract Onboarding Extracted to Fase 2.5 (billing Fase 2 ships without automatic onboarding provisioning; manual flow in Fase 2, automated flow in Fase 2.5 mini-spec) | accepted |
| [ADR-0129](0129-billing-integration-adapter-pattern.md) | 2026-04-17 | Billing Integration Adapter Pattern + Placeholder Audit-Safety (`IntegrationAdapter` interface + `is_placeholder` column + `integration sync mocked` event gate) | accepted |
| [ADR-0128](0128-invoice-delivery-columns-deprecation-lifecycle.md) | 2026-04-17 | invoice.delivery_* Columns Deprecation Lifecycle (dual-write in B2, read from invoice_dispatch from B3, DROP COLUMN by 2026-07-01 or Fase 3 close) | accepted |
| [ADR-0127](0127-billing-dispatch-rule-2-level-evaluation.md) | 2026-04-17 | Billing Dispatch Rule 2-Level Evaluation with Suppress Semantics (platform ∪ workspace with canonical_json dedup key + `action='suppress'` override primitive) | accepted |
| [ADR-0126](0126-integration-sync-as-event-engine-process.md) | 2026-04-17 | Integration Sync as Event Engine Process, Not Parallel Motor (subsumes proposed billing_integration_sync into engine_process; retry via engine_delayed_trigger; no new Edge Function) | accepted |
| [ADR-0124](0124-polymorphic-fk-documentation-convention.md) | 2026-04-17 | Polymorphic FK Documentation Convention (SQL COMMENT ON for intentional no-FK refs) | proposed |
| [ADR-0123](0123-adr-0029-amendment-pre-workspace-exceptions.md) | 2026-04-17 | ADR-0029 Amendment — Pre-Workspace Edge Function Exceptions + Identity-Boundary Tripwire | proposed |
| [ADR-0122](0122-governance-telemetry-quad-destination.md) | 2026-04-17 | Governance Telemetry Quad-Destination Routing (7 domain events replace "button clicked") | proposed |
| [ADR-0125](0125-billing-activity-log-as-platform-scoped-audit.md) | 2026-04-17 | `billing_activity_log` as platform-scoped audit trail for billing (supersedes ADR-0118's activity_trail dunning claim; company-scoped, `actor_user_id → user_identity` nullable for cron/system, immutable; new telemetry destination + provider) | accepted |
| [ADR-0121](0121-pricing-terms-billing-engine-extension.md) | 2026-04-17 | `pricing_terms` Extension for Billing Engine (amends ADR-0027) — 5 additive columns: `free_users int DEFAULT 10`, `overage_price_per_user decimal(12,2)` nullable, `delivery_channel text DEFAULT 'manual' CHECK IN ('manual','stripe','ehf')`, `invoice_format text DEFAULT 'pdf' CHECK IN ('pdf','ehf')`, `agreement_period daterange` nullable; `agreement_period` = contract duration (display only) vs `effective_from/until` = price validity (computation engine) — must not be collapsed | accepted |
| [ADR-0120](0120-invoice-immutability-credit-note-policy.md) | 2026-04-17 | Invoice Immutability + Credit Note Policy — continuous numbering via `invoice_number_seq` (assigned on `draft → issued`); no DELETE on issued invoices; corrections via credit notes only (`invoice_type = 'credit_note'` + `credits_invoice_id` FK); no nested credit notes; `(status, dunning_status)` CHECK (~8 legal combos); `invoice_id` vs `invoice_number` identity contract; dunning age from `due_at`; credit note amounts positive with explicit type | accepted |
| [ADR-0119](0119-usage-snapshot-reproducibility.md) | 2026-04-17 | Usage Snapshot Reproducibility + active-user = `shift_status = 'completed'`; `counted_profile_ids` + `source_query_hash` on snapshot; drift detection emits `invoice.basis_drift_detected`; platform-admin resolves via ignore/credit-note/reinvoice | accepted |
| [ADR-0118](0118-invoice-engine-as-c3-commercial-consumer.md) | 2026-04-17 | Invoice Engine as C3 Commercial Consumer (reads D6 + K1b, writes invoice/invoice_line_item/usage_snapshot, dunning via `billing_activity_log` — ADR-0125 supersedes the original activity_trail routing) | accepted |
| [ADR-0117](0117-authority-model-after-phase-4.md) | 2026-04-16 | Authority Model after Phase 4 (gate_action as single source) | accepted |
| [ADR-0116](0116-runtime-telemetry-standard.md) | 2026-04-16 | Runtime Telemetry Standard for services/ (pino logger, requestId middleware, typed errors, mandatory emit() via toVercelTools adapter) | accepted |
| [ADR-0115](0115-rsc-migration-pattern-dashboard-routes.md) | 2026-04-16 | RSC Migration Pattern for Dashboard Routes — streaming boundary, NordicSkeleton pairing, ambience invariant, first-chunk heading rule, schedule excluded. **Pattern proven** by Sprint 2 migration (people, handbook, hms, reports). | accepted |
| [ADR-0114](0114-server-actions-canonical-mutation-primitive.md) | 2026-04-16 | Server Actions as Canonical User-Initiated Mutation Primitive + Capability Authority Relation — three-path divergence closed via shared gate RPC + explicit emit contract. **Accepted 2026-04-17** — WP3 prerequisite (`gate-client.ts` + ESLint rule) shipped in `b90dc1f5`. R3 unblocked 2026-04-18 (ADR-0091 WP2 shipped); call-site migration follows. | accepted |
| [ADR-0113](0113-dashboard-context-decomposition-completion.md) | 2026-04-16 | DashboardContext Decomposition Completion — facade `useDashboard()` hook, ThemeContext hoist with synchronous data-theme flip, BotssonProvider above shell split. | accepted |
| [ADR-0111](0111-employment-contract-detail-versioning.md) | 2026-04-15 | Employment Contract Detail — Append-Only Versioning of Tripletex-Canonical Fields (surrogate PK + UNIQUE; 5-column scope; deferred runtime mechanism) | accepted |
| [ADR-0110](0110-payroll-ledger-archive-semantics.md) | 2026-04-15 | Payroll Ledger Archive — Read-Only Bubble Historical Semantics (lean typed columns + raw_json; RLS USING(false) UPDATE/DELETE; operational table deferred) | accepted |
| [ADR-0109](0109-migrated-contract-shell-block-and-supersede.md) | 2026-04-15 | Migrated Contract Shell — Block-and-Supersede Rule (UPDATE on source='bubble_migration' blocked; admin must issue new contract via composition; 'migration_incomplete' enum value) | accepted |
| [ADR-0106](0106-effective-dating-governance-content.md) | 2026-04-15 | Effective-Dating Strategy for Governance Content (valid_from/valid_to on protocol/procedure/knowledge_test/confirmation; no *_version tables) | accepted |
| [ADR-0105](0105-inspection-link-public-access-pattern.md) | 2026-04-15 | inspection_link Public-Access Pattern (hashed token, scope JSONB, justification, default anonymization; MVP schema, UI deferred to Phase 4) | accepted |
| [ADR-0104](0104-notification-consolidation-roadmap.md) | 2026-04-15 | Notification Consolidation Roadmap (notification_policy + notification_sent_log with domain column; consolidation M+3/M+6/M+12) | accepted |
| [ADR-0103](0103-observer-request-c4-decision-layer.md) | 2026-04-15 | observer_request in C4 Decision Layer (parallel to shift_approval, claim/approve/reject via gate_action) | accepted |
| [ADR-0102](0102-evidence-tier-enum.md) | 2026-04-15 | evidence_tier Enum for Protocol Proof Requirements (replaces protocol.risk_level; orthogonal to rule/deviation severity) | accepted |
| [ADR-0101](0101-four-eyes-extension-gate-action.md) | 2026-04-15 | Four-Eyes Extension of gate_action RPC (requires_four_eyes column + extended return shape; UI renders, never re-evaluates) | accepted |
| [ADR-0112](0112-intent-classifier-coverage-invariant.md) | 2026-04-15 | Intent Classifier Coverage Invariant — every registered capability must have an intent-schema entry (Council R2 F5 follow-up) | accepted |
| ADR-0109 | 2026-04-15 | *reserved — Four-Eyes Extension of gate_action RPC (claimed by PR #197 pending rename from 0101)* | reserved |
| ADR-0101 | 2026-04-15 | *reserved — Governance/Training Council ADR (PR #200). Previously also claimed by PR #197; collision resolved by renumbering PR #197 to ADR-0109.* | reserved |
| [ADR-0107](0107-botsson-provider-channel-derivation.md) | 2026-04-15 | BotssonProvider Channel Derivation (closes ADR-0078 mobile gap — derive from session mode, never platform label) | accepted |
| [ADR-0108](0108-use-shift-lifecycle-platform-neutral.md) | 2026-04-15 | useShiftLifecycle Platform-Neutral Contract (web wrapper + DI, closes Council 6.4 audit) | accepted |
| [ADR-0107](0107-botsson-provider-channel-derivation.md) | 2026-04-15 | BotssonProvider Channel Derivation (closes ADR-0078 mobile gap — derive from session mode, never platform label) | accepted |
| [ADR-0108](0108-use-shift-lifecycle-platform-neutral.md) | 2026-04-15 | useShiftLifecycle Platform-Neutral Contract (web wrapper + DI, closes Council 6.4 audit) | accepted |
| [ADR-0101](0101-four-eyes-extension-gate-action.md) | 2026-04-15 | Four-Eyes Extension to gate_action (History-Based) | accepted |
| [ADR-0100](0100-daily-close-as-aggregate-consumer.md) | 2026-04-15 | daily_close as Department-Aggregate Consumer of Settled Shifts | accepted |
| [ADR-0099](0099-unified-authority-gate.md) | 2026-04-15 | Unified Authority-Gate Across agent-router and engine-dispatch (closes ADR-0077/0078 violation) | accepted |
| [ADR-0098](0098-engine-state-as-coordination-spor.md) | 2026-04-15 | engine_state as Coordination Spor, Not Truth Owner | accepted |
| [ADR-0097](0097-time-entry-as-reality-source.md) | 2026-04-15 | time_entry as D6 Reality Source (Immutable) | accepted |
| [ADR-0096](0096-schedule-shift-vs-department-session.md) | 2026-04-15 | schedule_shift vs department_session — 1:N Formal Relation | accepted |
| [ADR-0095](0095-shift-lifecycle-five-layer-architecture.md) | 2026-04-15 | Shift Lifecycle Five-Layer Architecture (Reality/Interpretation/Derivation/Decision/Execution) | accepted |
| [ADR-0094](0094-framework-rule-severity-enum.md) | 2026-04-14 | Framework Rule Severity as Enum (info/warning/hard_block, WP1 retrofit) | accepted |
| [ADR-0093](0093-contract-draft-proposals-unified-cascade.md) | 2026-04-14 | Contract Draft Proposals Flow Through Unified apply_cascade() (amends ADR-0076) | accepted |
| ADR-0092 | — | *reserved — Monitor Mode Graduation Criteria (Phase E / WP6)* | reserved |
| [ADR-0091](0091-governance-gate-placement-postgres-rpc.md) | 2026-04-14 | Governance Gate Placement — Postgres RPC (SECURITY DEFINER), covers service-role. WP2 shipped 2026-04-18 (Option B Smart Trigger Check, commits `2278ef52` + `6a431ce2`); WP3 TS wrapper at `packages/supabase/src/gate-client.ts` now functional end-to-end. WP1 deep rule evaluation still pending. | accepted |
| [ADR-0090](0090-framework-rule-evaluation-config-schema.md) | 2026-04-14 | Framework Rule Evaluation Config JSON Schema (Phase E / WP1 foundation) | accepted |
| [ADR-0089](0089-walkai-bridge-architecture.md) | 2026-04-14 | WalkAi Bridge Architecture — Client vs Server Tools | accepted |
| [ADR-0088](0088-ai-operations-intelligence-capability.md) | 2026-04-14 | AI Operations Intelligence as Capability, Not Daemon | accepted |
| [ADR-0087](0087-communications-as-cascade-consumer.md) | 2026-04-13 | Communications as Cascade Consumer — C2 Contract | accepted |
| [ADR-0086](0086-entity-drawer-surface-pattern.md) | 2026-04-13 | Entity Drawer Surface Pattern (renumbered from ADR-0068 collision on 2026-04-13) | accepted |
| [ADR-0085](0085-year-wheel-governance-policy.md) | 2026-04-10 | Year Wheel Governance Policy — single active cycle per workspace, max 1 active season | accepted |
| [ADR-0084](0084-telemetry-conditional-exports.md) | 2026-04-09 | Telemetry package conditional exports — react-server/default split to isolate posthog-node from client bundle, /api/telemetry proxy for server-only destinations | accepted |
| [ADR-0083](0083-strike-mcp-registration.md) | 2026-04-08 | Strike MCP Registered as Dev-Only Data Source — repo-level .mcp.json with .env.local token, 1Password deferred as debt | accepted |
| [ADR-0082](0082-contract-drafts-are-not-versions.md) | 2026-04-08 | Contract Drafts Are Not Versions — versioning starts at send, idempotency on send endpoint | accepted |
| [ADR-0081](0081-admin-pii-bypass-security-definer-rpc.md) | 2026-04-08 | Admin PII Bypass via SECURITY DEFINER RPC — dashboard-only, never via agent, with employee notification | accepted |
| [ADR-0080](0080-compliance-drift-signal-read-only.md) | 2026-04-08 | Compliance Drift Signal — read-only materialized view, not a cascade derivation | accepted |
| [ADR-0079](0079-adr-0024-amendment-employment-vs-platform-contracts.md) | 2026-04-08 | ADR-0024 Amendment — employment_contract vs contract system separation | accepted |
| [ADR-0078](0078-engine-process-channel-restriction.md) | 2026-04-08 | Engine Process Channel Restriction — allowed_channels + defence in depth for PII | accepted |
| [ADR-0077](0077-contract-intake-pii-handling.md) | 2026-04-08 | Contract Intake PII Handling — personnummer/bank encryption, no-echo, engine_memory sensitivity | accepted |
| [ADR-0076](0076-contract-composition-as-cascade-derivation.md) | 2026-04-08 | Contract Composition as Cascade Derivation — compliance via change_proposal, overrides as JSONB provenance | accepted |
| [ADR-0075](0075-knowledge-system-consolidation.md) | 2026-04-07 | Knowledge System Consolidation — slim DASHBOARD, delete SESSION.md, migrate narrative to activity-log + claude-mem | accepted |
| [ADR-0074](0074-protocol-verification-engine.md) | 2026-03-29 | Protocol Verification Engine Architecture (renumbered from 0071 on 2026-04-07) | accepted |
| [ADR-0073](0073-ai-eval-harness.md) | 2026-04-06 | AI Eval Harness for `packages/ai` — two-layer test surface (unit mocked + evals gated) | accepted |
| [ADR-0072](0072-vercel-multi-service-rejected.md) | 2026-04-07 | Vercel multi-service migration — rejected pending platform investigation | accepted |
| [ADR-0071](0071-preview-environment-architecture.md) | 2026-04-06 | Preview Environment Architecture — 3-branch flow (dev → preview → main) | accepted |
| [ADR-0070](0070-emma-wizard-bridge.md) | 2026-03-28 | Emma-Wizard Bridge — tool-based agent control over wizard flows (supersedes parts of ADR-0049) | accepted |
| [ADR-0069](0069-session-execution-ownership.md) | 2026-03-28 | Session Execution Ownership — Edge Functions own execution, Engine owns side-effects | accepted |
| [ADR-0068](0068-simulation-schema-and-service.md) | 2026-03-28 | Simulation Schema and Dedicated Service | accepted |
| [ADR-0067](0067-smart-cover-via-event-engine.md) | 2026-03-28 | Smart Cover via Event Engine | accepted |
| [ADR-0066](0066-temporal-shift-lock-architecture.md) | 2026-03-28 | Temporal shift lock architecture | accepted |
| [ADR-0065](0065-hospitality-operations-cockpit-v1-contract.md) | 2026-03-28 | Hospitality Operations Cockpit v1 Read/Action Contract | accepted |
| [ADR-0064](0064-dynamic-landing-engine.md) | 2026-03-28 | Dynamic Landing Engine | accepted |
| [ADR-0063](0063-communication-system-consolidation.md) | 2026-03-28 | Communication System Consolidation | accepted |
| [ADR-0062](0062-industry-intelligence-consolidation.md) | 2026-03-28 | Industry Intelligence Consolidation | accepted |
| [ADR-0061](0061-walkai-semantic-tagging.md) | 2026-03-28 | WalkAi Semantic Tagging Convention | accepted |
| [ADR-0060](0060-unified-wizard-shell.md) | 2026-03-28 | Unified Wizard Shell in packages/ui | accepted |
| [ADR-0059](0059-platform-admin-pipeline.md) | 2026-03-28 | Platform Admin Pipeline Separation — routeAdminMessage() vs routeAgentMessage() | accepted |
| [ADR-0058](0058-livekit-as-webrtc-provider.md) | 2026-03-22 | LiveKit as WebRTC Provider | accepted |
| [ADR-0057](0057-payroll-schema-separation.md) | 2026-03-28 | Payroll Schema Separation | accepted |
| [ADR-0056](0056-cascade-core-foundation-schema.md) | 2026-03-21 | Cascade Core Foundation Schema (I1+6D+4C+K1a/K1b) | done |
| [ADR-0055](0055-two-vault-environment-isolation.md) | 2026-03-17 | Two-Vault Environment Isolation (superseded by ADR-0071) | superseded |
| [ADR-0054](0054-edge-functions-own-call-orchestration.md) | 2026-03-22 | Edge Functions Own Call Orchestration (renumbered from 0059 on 2026-04-07) | accepted |
| [ADR-0053](0053-simulation-schema-and-simulator-service.md) | 2026-03-23 | Dedicated simulation schema and simulator microservice for cascade system testing (renumbered from 0058 on 2026-04-07) | proposed |
| [ADR-0052](0052-guardian-websocket-architecture.md) | 2026-03-14 | Guardian Real-Time WebSocket Architecture (renumbered from 0049 on 2026-04-07) | accepted |
| [ADR-0051](0051-unified-ai-runtime-system-definition.md) | 2026-03-14 | Unified AI Runtime System Definition v1 | accepted |
| [ADR-0050](0050-port-standardization-and-vault-secrets.md) | 2026-03-14 | Port Standardization & Vault Secrets Strategy | accepted |
| [ADR-0049](0049-agent-sdk-package.md) | 2026-03-06 | Agent SDK Package — `@smartout/agent-sdk` | accepted |
| [ADR-0048](0048-daily-close-engine.md) | 2026-03-06 | DailyCloseEngine Architecture | accepted |
| [ADR-0047](0047-schedule-db-persistence.md) | 2026-03-06 | Schedule DB Persistence with TanStack Query | accepted |
| [ADR-0046](0046-block-based-landing-page-builder.md) | 2026-03-01 | Block-based Landing Page Builder (superseded by ADR-0064) | superseded |
| [ADR-0045](0045-sendgrid-transactional-email.md) | 2026-03-01 | SendGrid for Transactional Email Over Resend | accepted |
| [ADR-0044](0044-invitation-table-naming.md) | 2026-03-01 | Invitation Table Named `invitation` Not `workspace_invite` | accepted |
| [ADR-0043](0043-emergency-contact-on-user-identity.md) | 2026-03-01 | Emergency Contact Fields on user_identity Table | accepted |
| [ADR-0042](0042-agent-architecture.md) | 2026-03-02 | Agent Architecture — Stage Engine Agent Mode | accepted |
| [ADR-0041](0041-onboarding-wizard-step-architecture.md) | 2026-03-01 | Onboarding Wizard Step Architecture | accepted |
| [ADR-0040](0040-infrastructure-in-monorepo.md) | 2026-03-01 | Infrastructure stays in monorepo | accepted |
| [ADR-0039](0039-infra-consolidation.md) | 2026-03-01 | Infrastructure Consolidation | accepted |
| [ADR-0038](0038-journey-agent-output-generators.md) | 2026-03-01 | Journey Agent & Output Generators | accepted |
| [ADR-0037](0037-landing-event-tracking.md) | 2026-03-01 | Landing Page Event Tracking | accepted |
| [ADR-0036](0036-shift-mcp-server.md) | 2026-03-01 | Shift MCP Server | accepted |
| [ADR-0035](0035-docker-network-infra.md) | 2026-03-01 | Docker Network Infrastructure (superseded by ADR-0039) | superseded |
| [ADR-0034](0034-documentation-enforcement-pipeline.md) | 2026-03-01 | Documentation Enforcement Pipeline | accepted |
| [ADR-0033](0033-documentation-rag-pgvector.md) | 2026-03-01 | Documentation RAG with pgvector | accepted |
| [ADR-0032](0032-schedule-local-state-architecture.md) | 2026-03-01 | Schedule Page Local State Architecture | accepted |
| [ADR-0031](0031-journey-portal-system.md) | 2026-03-01 | Journey Portal System | accepted |
| [ADR-0030](0030-documentation-in-landing-app.md) | 2026-02-28 | Documentation System in Landing App (Nextra Removal) | accepted |
| [ADR-0029](0029-workspace-api-gateway.md) | 2026-02-28 | Workspace API Gateway | accepted |
| [ADR-0028](0028-api-key-management-system.md) | 2026-02-28 | API Key Management System | accepted |
| [ADR-0027](0027-pricing-terms-table.md) | 2026-02-28 | Pricing Terms Table for Workspace Commercial Model | accepted |
| [ADR-0026](0026-template-editor-redesign-attachments.md) | 2026-02-28 | Template Editor Redesign with PDF Attachments | accepted |
| [ADR-0025](0025-documentation-restructuring.md) | 2026-02-28 | Documentation Restructuring — Layered System with YAML Frontmatter | accepted |
| [ADR-0024](0024-contract-system-architecture.md) | 2026-02-28 | Contract System Architecture | accepted |
| [ADR-0023](0023-global-scrollbar-standard.md) | 2026-02-28 | Global Scrollbar Standard via Design Tokens | accepted |
| [ADR-0022](0022-notification-service-architecture.md) | 2026-02-28 | Email/Notification Service Architecture | accepted |
| [ADR-0021](0021-subdomain-workspace-routing.md) | 2026-02-28 | Subdomain-Based Workspace Routing | accepted |
| [ADR-0020](0020-vercel-hosting-strategy.md) | 2026-02-28 | Vercel Hosting with Dual-Project Split | accepted |
| [ADR-0019](0019-performance-build-governance.md) | 2026-02-27 | Performance and Build Governance System | accepted |
| [ADR-0018](0018-tanstack-table-recharts-platform-admin.md) | 2026-02-27 | TanStack Table and Recharts for Platform Admin | accepted |
| [ADR-0017](0017-enterprise-infrastructure.md) | 2026-02-27 | Enterprise Infrastructure — Shared Configs, Design System, Monitoring | accepted |
| [ADR-0016](0016-services-directory.md) | 2026-02-27 | Services Directory for Backend Microservices | accepted |
| [ADR-0015](0015-bubble-rebuild-strategy.md) | 2026-02-27 | Bubble.io Rebuild Strategy | accepted |
| [ADR-0014](0014-posthog-eu-proxy.md) | 2026-02-27 | PostHog EU Instance with Reverse Proxy | accepted |
| [ADR-0013](0013-database-types-generation.md) | 2026-02-27 | Auto-Generated Database Types Workflow | accepted |
| [ADR-0012](0012-subscription-on-company.md) | 2026-02-27 | Subscription Data on Company Table (No Separate Table) | accepted |
| [ADR-0011](0011-user-identity-table-naming.md) | 2026-02-27 | User Table Named `user_identity` (Not `user`) | accepted |
| [ADR-0010](0010-ai-sdk-openrouter.md) | 2026-02-27 | AI SDK with OpenRouter Provider | accepted |
| [ADR-0009](0009-tailwind-v4-css-config.md) | 2026-02-27 | Tailwind CSS v4 with CSS-Based Configuration | accepted |
| [ADR-0008](0008-dashboard-scroll-behavior.md) | 2026-02-27 | Dashboard Scroll Behavior & Dynamic Layout | accepted |
| [ADR-0007](0007-dashboard-architecture.md) | 2026-02-27 | Dashboard App Layout & Navigation State | accepted |
| [ADR-0006](0006-secrets-and-environment.md) | 2026-02-27 | Environment Variables, Secrets & Module Boundaries | accepted |
| [ADR-0005](0005-testing-infrastructure.md) | 2026-02-27 | Testing Infrastructure — Four-Layer Strategy | accepted |
| [ADR-0004](0004-unified-telemetry-engine.md) | 2026-02-27 | Unified Telemetry & Audit Trail Engine | accepted |
| [ADR-0003](0003-shadcn-integration.md) | 2026-02-27 | UI Framework and Local Styling Strategy | accepted |
| [ADR-0002](0002-state-vs-hooks.md) | 2026-02-27 | State-Driven vs Hook-Driven Logic Boundaries | accepted |
| [ADR-0001](0001-use-turborepo-pnpm.md) | 2026-02-27 | Adopt Turborepo & pnpm Workspaces | accepted |

## Integrity

- **96 ADRs** (0001-0139 with 0092 reserved, ADR-0000 is this index) — 2026-04-18 added ADR-0137/0138/0139 (gate-client wave 2 prereqs, status: draft)
- **98 ADRs** (0001-0111 with 0092 reserved, ADR-0000 is this index)
- **0 number collisions** (verified 2026-04-13 — ADR-0068 entity-drawer collision resolved by renumbering to 0086)
- **1 reserved slot:** 0092 — Monitor Mode Graduation Criteria (Phase E / WP6), to be written when WP6 lands
- **0 number gaps** (0052/0053/0054 previously gaps, now occupied by renumbered collision resolvers)
- **Renumbered 2026-04-07:** 0049 guardian-ws → 0052, 0058 simulation → 0053, 0059 edge-functions → 0054, 0071 protocol-verification → 0074 (see ADR-0075 context)
- **Renumbered 2026-04-13:** ADR-0068-entity-drawer-surface-pattern → 0086 (collision with 0068-simulation-schema-and-service)
- **Reserved 2026-04-15 (Council R2 F11):** ADR-0101 double-claimed by PR #197 (`feat/shift-lifecycle-capability-wiring` — Four-Eyes Extension of gate_action) and PR #200 (governance/training council). PR #200 keeps the 0101 slot; PR #197 must rename its ADR file `0101-four-eyes-extension-gate-action.md` → `0109-four-eyes-extension-gate-action.md` during rebase, update its own front-matter and any cross-references, then drop the 0101 placeholder row from this log when it lands on 0109.
- **Archived 2026-04-13:** ADR-DRAFT-core-hierarchy-cascade — superseded by cascade spec
- **Superseded:** 0035 (→0039), 0046 (→0064), 0055 (→0071)
