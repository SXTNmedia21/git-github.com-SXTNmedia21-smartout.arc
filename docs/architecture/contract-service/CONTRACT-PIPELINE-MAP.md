---
title: "Employee Contract Pipeline — Komplett Kart"
status: reference
updated: 2026-05-06
created: 2026-05-06
module: contract
tags: [contract, pipeline, map, reference, code-index]
---

# Employee Contract Pipeline — Komplett Kart

> Reference map. Code paths + ADRs + flow + gaps. Generated 2026-05-06 from full-codebase scan.

## 1. Source-of-truth dokumenter (les disse først)

| Dok | Path | Innhold |
|---|---|---|
| Architecture | `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md` | 3-lags modell, datamodell, tjenester, cascade-coupling, §8 compliance, §9 PII tier |
| PRD | `docs/architecture/contract-service/PRD-contracts-module.md` | 5 personas, 9 use-cases, 5-fase plan, NFR |
| 5 Journeys | `docs/architecture/contract-service/JOURNEY-contract-module.md` | Definer→Send→Sign→Enforce→Amend ende-til-ende |
| Capability legal | `docs/architecture/contract-service/CAPABILITY-legal.md` | Lovsen-tools (validate_aml_14_6, cite_law, classify_amendment) |
| Components | `docs/architecture/contract-service/CONTRACT_COMPONENTS.md` | UI-komponent kart |
| Plan (canonical) | `docs/plans/PLAN-contract-employee.md` | Phase 0-7 leveranseplan |
| Mobile plan | `docs/plans/PLAN-contract-mobile-employee.md` | Mobile execution per ADR-0245 |

## 2. ADRs (foundation → seneste)

**Accepted:**
- `ADR-0024` — Contract System Architecture (DocuSeal Cloud, Fastify microservice, Tiptap, embedded signing, table-rename `platform_contract_*` → `contract_*`)
- `ADR-0076` — Composition as Cascade Derivation (Phase 1-7: collect → derive → validate → change_proposal → approve → apply → engine dispatch)
- `ADR-0077` — Contract Intake PII Handling (RPC-controlled access for personnummer/bank, no-echo for agent tools)
- `ADR-0078` — Engine Process Channel Restriction (3-layer: process/capability/tool — voice forbidden for PII)
- `ADR-0079` — employment_contract vs platform contract separation
- `ADR-0082` — Contract drafts are not versions
- `ADR-0093` — Contract draft proposals — unified cascade
- `ADR-0109` — Migrated contract shell — block & supersede (`migration_incomplete` enum value)
- `ADR-0111` — Employment contract detail versioning
- `ADR-0182` — Template vs contract lifecycle separation
- `ADR-0133/0134/0135/0136` — Mobile boundaries (web composes, mobile executes; telemetry; voice via LiveKit; camera evidence)

**Proposed (Council 2026-04-29 batch):**
- `ADR-0241` — Contract Schema Migration Foundation (FK fixes, ALTER TYPE additive, RLS denorm, trigger SECURITY DEFINER, 10 Lovsen amendments incl. §15-3 ansiennitet, §15-6 prøvetid-pause, Riksavtalen 5. ferieuke 14.30%, commissionOnly garantilønn, apprentice block)
- `ADR-0242` — Contract / Payroll Capability Split (resurrect dead `payroll` enum, third sibling `legal` for Lovsen, GDPR Art. 9 trade union)
- `ADR-0243` — Obligation Lifecycle (TS const FIELD_CLASSIFICATION map in `packages/contracts/src/field-classification.ts`, SECURITY DEFINER trigger, cascade trigger on start_date)
- `ADR-0244` — Amendment Flow + AcknowledgementRing as §14-6 Legal Evidence (`requires_employee_signature` boolean, per-framework configurable blocks, WCAG AAA, TariffBadge, endringsoppsigelse §15-7 flag, PDF-preview obligatorisk)
- `ADR-0245` — Employee Contract Mobile Flow (mobile-primary D6/C4, 6 mobile screens, WebView DocuSeal, biometric C4 confirmation, 5-event push trigger map, full-screen sequential AcknowledgementRing)

**Superseded:**
- `ADR-0001` (module-local) → 0241/0242/0243/0244

## 3. Database — Tabeller

**Identity layer (workspace-uavhengig):** `user_identity → company → company_member → workspace → profile`

**Contract core:**
```
profile (D2, has tripletex_employee_id, personal_number Høy-PII, bank_account Høy-PII)
   │
   │ 1:N
   ▼
employment_contract (§14-6 fields, status enum, framework_snapshot JSONB,
                     compliance_overrides JSONB, signing_contract_id FK,
                     superseded_by_contract_id self-FK,
                     overtime_cap_policy_id FK, parent_contract_id, biometric_confirmed_at,
                     trial_period_paused_at, trial_period_extended_until)
   ├─→ contract_pay_rule (rule_type, salary_type_code, trigger_condition jsonb,
   │                       framework_rule_id snapshot)
   ├─→ contract_tip_rule (distribution_method, tip_share, tip_pool_id)
   ├─→ contract_obligation (obligation_type, policy_id, protocol_id,
   │                         due_within_days, is_blocker, status enum, due_at)
   └─→ contract_amendment (parent_contract_id, change_summary, field_changes jsonb,
                            requires_employee_signature, is_constructive_dismissal_risk,
                            acknowledged_constructive_dismissal_risk)

employee_payroll_profile (1:1 profile, Tripletex-aligned, has_fagbrev, salary_type,
                          tariff_category, sector_experience_years, seniority_start_date,
                          tax_*, pension_scheme_id, trade_union_member GDPR Art.9)

contract (DocuSeal signing entity, status enum 10 verdier, signing_url, recipient_email,
          docuseal_submission_id, docuseal_submitter_id, signed_pdf_url, audit_log_url)

contract_template (workspace_id NULL = K1a system, lineage: source_template_id +
                   forked_at + published_at + deprecated_at, employment_category,
                   placeholders jsonb, content_html, header_html, footer_html, attachments)

contract_template_binding (workspace_id + employment_category + employee_group_id → template_id)

contract_event (audit trail per contract — created/sent/viewed/signed/declined/cancelled/expired)
contract_reminder (scheduled_at, status, template_key)
contract_attachment (per-contract upload via storage bucket "contract-attachments")
pension_scheme (workspace-level OTP)
regulatory_framework (K1a, workspace_id NULL)
framework_rule (K1a, with effective_from/until + version)
tariff_rate_table (K1a, workspace_id NULL — Riksavtalen 210 faglært / 198.50 ufaglært)
workspace_framework_binding (K1b, framework_id → workspace)
framework_snapshot (frozen on send per ADR-0244)
```

**Status enums:**
- `contract_status` (employment_contract): `draft | sent | viewed | signed | pending_data | declined | ready_to_send | migration_incomplete | pending_signature | active | superseded`
- `obligation_status`: `pending | in_progress | completed | overdue | waived`
- `employment_form`: `permanent | temporary | apprentice | practice | freelance`
- `working_hours_scheme`: `notShiftWork | shiftWork | offshoreWork | continuousShiftWork335 | rotation336`
- `remuneration_type`: `monthlyWage | hourlyWage | commissionOnly`
- `employment_role`: `main | secondary | temporary_supplement` (D2 — kun én aktiv `main` per profil, partial unique index)

## 4. Migrations (relevante, etter dato)

```
20260228140100  seed_contract_message_templates
20260311110000  update_saas_contract_template_v2
20260311111000  contract_template_attachments
20260320120001  contract_attachment
20260414072301  seed_contract_notification_templates
20260417141000  fix_contract_intake_engine_state_filter
20260422120000  contract_template_binding (K1a/K1b resolution)
20260422400200  cascade_contract_payroll_sync (trigger)
20260428210000  employee_contract_signing
20260430182443  employment_contract_activity_trail_trigger
20260501100100  contract_status_declined
20260501100200  employment_contract_composition_columns (compliance_overrides JSONB)
20260501120000  anonymize_contract_rpc (GDPR 5-år)
20260503110000  employment_category_constraint_and_template_column
20260515100200  contract_status_add_migration_incomplete (ADR-0109)
20260515100300  employment_contract_detail (ADR-0111)
20260515100100  employment_contract_tripletex_columns
20260515170400  contract_template_rls_workspace_vs_platform
20260515170500  contract_capability_authority_seed (ADR-0192)
20260518000000  contract_authority_seed_upsert_and_bootstrap
20260519095100  contract_status_enum_values
20260519100001  workspace_active_contract_id_fk
20260519100100  contracts_module_foundation (canonical — supersedes ADR-0001's 0001_*)
20260519150000  contract_text_to_enum_cast
20260520120000  extend_contract_event_trigger
20260520120100  engine_trigger_contract_events
20260520130000  legal_capability_authority_seed
```

## 5. Code — Microservice (`services/contract-service/`)

Standalone Fastify @ port 3100, Docker container.

| File | Role |
|---|---|
| `src/server.ts` | Fastify app, X-Service-Key auth via `validate-api-key` EF + env fallback, decorates request with `workspaceId` |
| `src/config.ts` | Env config |
| `src/secrets.ts` | Loads DocuSeal API key from Vault on boot |
| `src/db-config.ts` | Supabase admin URL + service-role key |
| `src/lib/supabase.ts` | Service-role client |
| `src/lib/docuseal.ts` | DocuSeal SDK wrapper: `createTemplateFromHtml`, `createSubmission`, `getSubmission`, `getSubmissionDocuments`, `updateTemplateDocuments` |
| `src/lib/placeholders.ts` | Server-side `{{key}}` resolution from workspace + company + custom values |
| `src/lib/reminders.ts` | `scheduleReminders` per journey_type, drained by lifecycle EF |
| `src/routes/contracts.ts` | GET/POST `/contracts`, `/contracts/:id`, `/contracts/:id/send` (resolves placeholders → transforms Tiptap signature/date fields → DocuSeal `createTemplateFromHtml` → `createSubmission` 2 parties, sender auto-signs, recipient via embed/email → updates contract row + signing_url + docuseal_submission_id), `/contracts/:id/cancel`, `/contracts/:id/events`, `/contracts/:id/fetch-documents` (audit log + signed PDF) |
| `src/routes/templates.ts` | Template CRUD |
| `src/routes/sync.ts` | Tripletex/payroll sync stubs |
| `src/routes/webhooks.ts` | DocuSeal webhook handler (no auth, signature-validated) — flips contract status, emits `contract.signed` event, updates DB |
| `src/schemas/contracts.ts` | Zod: `createContractSchema`, `listContractsQuery` |

## 6. Code — Web App (`apps/web/src/`)

### Routes (App Router, dashboard side)
- `app/dashboard/contracts/page.tsx` — Hub with `Lag kontrakt` CTA, two-stage drawer (EmployeePickerDrawer → ContractDispatchDrawer)
- `app/dashboard/contracts/[id]/` — Contract detail
- `app/dashboard/contracts/new/` — Empty-state new
- `app/dashboard/contracts/_components/` — KontrakterTab, MalerTab (read-only Lock badge per Fix 1), BindingerTab, ContractSendDrawer, CompositionWizard, AcknowledgementRing, ComplianceBadge, BlockerCounter, BotssonAmbientChip, GhostValueCard, ReasoningDrawer, contract-preview-editor (Tiptap `editable: false`), contracts-data-table, drift-utils
- `app/dashboard/contracts/_hooks/use-employment-contracts.ts` — TanStack Query mutation, `actor_profile_id` required (post Fix from L2)
- `app/dashboard/my-contract/` — Employee-facing read-only fallback per ADR-0245 (mobile-primary)
- `app/platform-admin/contracts/` — Admin Tiptap editor, list, templates
- `app/walt/sign-dev/[contract_id]/` — Dev DocuSeal-stub signing surface (used when `contract-service` unreachable)

### API routes (BFF)
- `app/api/contracts/route.ts` — GET (paginated list), POST (create draft directly via admin client, ADR-0151 forgery defence: workspace_id from JWT, profile_id verified in workspace, sanitizes `clientHtml` via sanitize-html allowlist, generates contract_number via `generate_contract_number` RPC, links via `signing_contract_id`)
- `app/api/contracts/[id]/route.ts` — GET/PATCH/DELETE
- `app/api/contracts/[id]/amend/` — Amendment endpoint
- `app/api/contracts/[id]/cancel/` — Cancel
- `app/api/contracts/[id]/sign-dev/` — Walt dev signing
- `app/api/contracts/[id]/send/` — single-contract send
- `app/api/contracts/send/route.ts` — Bulk-style send used by ContractDispatchDrawer (ADR-0151 server-derived workspace_id, validates 4 ack blocks, freezes `framework_snapshot`, calls `validateAml146.execute()` for §14-6 gate, bridges via `callContractService` to microservice POST `/contracts` → POST `/contracts/:id/send`, falls back to walt dev stub on failure)
- `app/api/contracts/templates/[id]/blank|copy/` — Template fork (legacy UI path)
- `app/api/contracts/employment/upsert/` — People-page inline-save (Phase 2)
- `app/api/contracts/resolve-placeholders/` — Placeholder map preview
- `app/api/employment-contracts/route.ts` — POST compose (calls `resolveComposition` → returns ContractDraftProposal; persist=true inserts draft row)
- `app/api/employment-contracts/[id]/{regenerate,revise,send,route.ts}` — Lifecycle ops
- `app/api/employment-contracts/list/` — List
- `app/api/employment-contracts/bulk/route.ts` — Bulk send (gates correctly per HANDOFF audit)
- `app/api/contract-templates/{[id],bulk,list,route.ts}` — Template CRUD
- `app/api/contract-template-bindings/[id]/route.ts` — Binding CRUD
- `app/api/contract-agent/` — AI capability invoke
- `app/api/onboarding/send-contract/` — Onboarding wizard send
- `app/api/platform-admin/contracts/` — Platform-admin CRUD

### Components
- `components/contract/` — ContractAmendmentDiff, ObligationBlocker (3 variants: sheet/banner/botsson-card per §UI 3 of ARCH), ObligationsList, TariffBadge (3 states green/amber/red per ADR-0244)
- `components/contracts/` — BulkSendDrawer, CompositionDrawer (5-step legacy, retained for reverse flow), ContractDispatchDrawer (2-step canonical, includes AcknowledgementRing), DriftDiffDrawer, EmployeePickerDrawer, SelectEmployeeStep
- `components/contract-editor/` — Tiptap editor + extensions (signature-field, date-field), AI chat panel, attachments-panel, document-outline, placeholder-panel, template-editor, sidebar-panel, status-bar, toolbar, editor-toolbar-v2, diff-overlay, metadata-bar
- `components/RevealableField.tsx` — PII masking (5s reveal + audit emit `payroll.pii_revealed`) per §UI 2 of ARCH

### Hooks + lib
- `hooks/contracts/use-contract-readiness.ts` — Blocker + compliance check
- `lib/contract-service.ts` — `callContractService(path, init)` + `isContractServiceConfigured()` wrapper, sets `X-Service-Key`

### Shared packages
- `packages/utils/src/resolve-composition.ts` — Pure cascade derivation: load profile (D2) → load workspace_framework_binding (K1b) → load framework_rule (K1a) → load tariff_rate_table (K1a, rate_type by `has_fagbrev`) → build mandatory_clauses + validations + placeholder_status → 3-layer template resolution (workspace_group → workspace_category → system)
- `packages/utils/src/contract-placeholders.ts` + `employee-contract-placeholders.ts` — `buildEmployeePlaceholderMap`
- `packages/contracts/src/field-classification.ts` — TS const FIELD_CLASSIFICATION map (per ADR-0243), single source of truth for MATERIAL/ADMIN/DERIVED/SYSTEM
- `packages/contracts/src/amendment-handler.ts` — `classifyChange` / `classifyBatch`, computes `requires_employee_signature` + `is_constructive_dismissal_risk`
- `packages/lovsen-contract/src/` — Citation, confidence, classification-result, validation-result, lovsen-answer (used by `legal` capability)

## 7. Code — AI Capabilities (`packages/ai/src/`)

| Capability | Tools | Channels | min_role | Höy PII |
|---|---|---|---|---|
| `contract` | listEmployeeTemplates, listEmployeeContracts, checkContractStatus, explainContractClause, getComplianceDriftForContract, createEmployeeContract, sendEmployeeContract, forkTemplate, publishWorkspaceTemplate, deprecateWorkspaceTemplate (10) | `["chat"]` | admin/owner for mutations | No |
| `contract_intake` | submitFieldGroup (identity/banking via `submit_own_pii` RPC w/ user-scoped client), declineIntake (`decline_contract_intake` RPC), getIntakeProgress | `["chat"]` only | employee (own profile) | Limited (own) |
| `payroll` (Phase 0c) | update_payroll_profile, query_tax_card, set_pension_scheme, view_personal_number, view_bank_account, view_tax_table, salary_query | `["chat"]` only | admin | Yes |
| `legal` (Phase 0c, Lovsen-branding) | validateAml146 (chat, manager, gate=check), citeLaw (chat+voice, employee, gate=check), classifyAmendment (server-only, admin, gate=enforce default_allow:false) | per-tool | per-tool | No |

**Common pattern:**
- `gateMutation()` → `callGateAction()` with `capability/channel/actionType/entityId` (ADR-0099)
- Defence-in-depth role check (`resolveActorRole`) on top of gate
- Channel guard `if (ctx.channel !== "chat")` per ADR-0078 layer 3
- `emit()` with `nonEmpty(workspaceId, "workspace_id")` + `nonEmpty(actorProfileId, "actor_id")` per ADR-0151 + ADR-0193
- ADR-0151: NEVER trust `profile_id` from body — derive from JWT, verify workspace membership before write

**Tools dir** `packages/ai/src/tools/contract/` — 18 contract template editor tools registered as `CONTRACT_TOOLS` array (document read/edit, design, fields, translation, validation, library search)

## 8. Mobile (`apps/mobile/`)

**Per ADR-0245 Mobile-primary for D6/C4 — 6 net-new screens to build:**
- `screens/contract/ContractInboxScreen.tsx` — push-driven list
- `screens/contract/ContractDetailScreen.tsx` — read active + obligation list + TariffBadge
- `screens/contract/ContractSignScreen.tsx` — DocuSeal WebView + biometric C4 (`expo-local-authentication`)
- `screens/contract/AcknowledgementRingScreen.tsx` — full-screen sequential per-block (`@react-navigation/native` stack)
- `screens/contract/ContractAmendmentReviewScreen.tsx` — diff + re-sign
- `screens/contract/ObligationDetailScreen.tsx` — protocol launcher

**Existing today** (`apps/mobile/app/(app)/(me)/contract/`):
- `index.tsx` (10937 bytes) — list view stub
- `[id].tsx` (14973 bytes) — detail stub
- `complete-data.tsx` (14605 bytes) — PII intake form

**Mobile invariants:**
- ADR-0132: routes via web BFF `/api/emma/chat` → stage-engine, never direct to capabilities
- ADR-0133: web composes / mobile executes — NEVER author UIs on mobile
- ADR-0134: `getProfileContext()` (throws on missing IDs) before EVERY `emit()`, no empty-string fallbacks
- ADR-0135: voice via LiveKit (not Ultravox)
- ADR-0136: camera evidence model
- ADR-0245: WebView DocuSeal (HTTPS-only, ephemeral cookies, postMessage shim), biometric required at sign moment, NEVER personnummer/bank/salary in push body, `<DomainChatOwnership reason="contract-flow">` on enter, voice long-press disabled on contract screens, AcknowledgementRing offline-refused (legal evidence chain integrity)

## 9. Edge Functions

- `supabase/functions/contract-lifecycle/index.ts` — Cron handler (auth via `WATCHDOG_CRON_SECRET`):
  1. Trial expiration → workspace `suspended` + `grace_period_ends = now+14d`
  2. Grace expiration → workspace `deactivated`
  3. Contract signing deadline `expires_at < now` → status `expired` + cancel reminders
  4. Reminder drain → insert into `notification_outbox` with allowed_channels `[email, push]`
- `supabase/functions/validate-api-key/` — Validates `X-Service-Key` for contract-service hook

## 10. Pipeline Flow (END-TO-END)

```
JOURNEY 1 — Define basis (admin, web)
  /dashboard/people/[id] → Ansettelse-section (15 §14-6 fields) + Lønnsprofil + Tipsregel modal
  → POST /api/contracts/employment/upsert
  → INSERT employment_contract (status='draft') + employee_payroll_profile + contract_tip_rule
  → emit('employment_contract.upserted_inline', 'payroll_profile.updated', 'contract.tip_rule_changed')

JOURNEY 2 — Send (admin, web — 2-step drawer)
  ContractsPage → EmployeePickerDrawer → ContractDispatchDrawer (Step 1 mal, Step 2 preview+AcknowledgementRing)
  → POST /api/contracts/send
  → resolveComposition() (D2+K1a+K1b) → freeze framework_snapshot → validate 4 ack blocks
  → validateAml146.execute({contract_id, validation_mode: "strict"}) [Phase 0c+ — Lovsen gate]
  → callContractService POST /contracts (signing entity) + POST /contracts/:id/send
  → contract-service: resolvePlaceholders → transform Tiptap → DocuSeal createTemplateFromHtml + createSubmission(2 parties)
  → contract.signing_url issued, employment_contract.status='sent', signing_contract_id linked
  → scheduleReminders() per journey_type
  → DEV FALLBACK: walt/sign-dev/<id> stub if service unreachable
  → emit('contracts.compose.opened', 'contracts.compose.template_selected', 'contract.send_initiated', 'legal.aml_14_6.validated')

JOURNEY 3 — Sign (employee, mobile per ADR-0245 / web fallback /my-contract)
  Push notification 'Ny kontrakt klar for signering' (smartout://contract/inbox/<id>) — NO PII in payload
  → ContractInboxScreen → ContractDetailScreen → AcknowledgementRingScreen (full-screen sequential, per-block emit)
  → PdfPreviewGateScreen (mandatory PDF view per Aml. §14-5, scroll-to-end detection)
  → ContractSignScreen WebView DocuSeal
  → On signed=true: biometric prompt (Face ID/Touch ID, attestation only) → BFF persists biometric_confirmed_at
  → DocuSeal webhook → contract-service /webhooks → flip contract.status='signed' → emit('contract.signed')
  → DB trigger 'cascade_contract_payroll_sync' → UPDATE employee_payroll_profile
  → engine_event triggers cascade D2 (active) + C4 (authority trainee→active)
  → contract_obligation rows generated (compute_obligation_due_at trigger SECURITY DEFINER, due_at = start_date + due_within_days)
  → emit('contract.signing_link_opened', 'contract.signed', 'contract.mobile.signed', 'contract.mobile.biometric_confirmed', 'contract.mobile.pdf_preview_viewed', 'contract.acknowledgement.block_confirmed' x N, 'contract.obligation_assigned')

JOURNEY 4 — Daily enforce (mobile + system)
  Mobile clock-in → BFF check is_employee_blocked RPC → contract_obligation WHERE is_blocker=true AND status IN (pending,overdue)
  → If blocker: ObligationBlocker (sheet variant) → deep-link to /dashboard/competence/protocol/<id>
  → On protocol completion: contract_obligation.status='completed' → emit('contract.obligation_completed') → re-eval clock-in
  → Shift cost calc reads contract_pay_rule for stacked rates (base × hours + tillegg per trigger_condition jsonb) → shift_cost_snapshot row
  → salary_query capability (chat-only, payroll capability) → Botsson "Ifølge kontrakt §3..."
  → Daily cron: contract_obligation due_within_days <= 3 → push 'contract.obligation_due_soon'
  → tariff version change → trigger amendment offers for affected contracts (Journey 5)
  → emit('contract.obligation_due_soon', 'contract.obligation_overdue', 'shift.cost_calculated')

JOURNEY 5 — Amendment (admin authoring + employee re-sign)
  Admin /dashboard/people/[id] edit → POST /api/contracts/[id]/amend
  → classifyChange() reads packages/contracts/src/field-classification.ts (TS const)
  → If MATERIAL: INSERT contract_amendment(requires_employee_signature=true, change_summary, field_changes jsonb)
                 + check is_constructive_dismissal_risk (job_title AND (tariff_id OR weekly_hours OR salary≥20% reduction))
                 + admin checks 'acknowledged_constructive_dismissal_risk' (legal evidence)
                 + new employment_contract row with parent_contract_id; old row.status='superseded'
  → If ADMIN: requires_employee_signature=false, admin signature only, employee notified (no consent gate)
  → MATERIAL → DocuSeal re-sign flow → mobile ContractAmendmentReviewScreen (diff stacked rows)
  → On accept: contract_amendment.signed_by_employee_at + framework_snapshot updated + activity_trail
  → emit('contract.amendment_initiated', 'contract.amendment_signed' / 'amendment_declined', 'legal.amendment_classified', 'contract.mobile.amendment_signed')

GDPR (anonymize_contract_rpc, lifecycle EF):
  Trigger: 5 år from regnskapsår_slutt (NOT terminated_at, per Lovsen Bokføringsloven §13 amendment)
  → anonymize PII (personal_number, bank_account, tax_*) — soft delete, hard delete after 5 years
```

## 11. Telemetry events (registered i `packages/telemetry/src/registry.ts`)

```
contract.hub_viewed | tab_switched | created | sent | signed | declined | cancelled | viewed | expired
contracts.compose.opened | template_selected | submitted
contracts.send.submitted | bulk.submitted
contracts.cancel.dialog_opened | confirmed | aborted | failed
contracts.resend.submitted
contracts.detail.viewed
contracts.template.viewed | html_copied | opened_in_admin | cloned
contract_template forked | published | deprecated
contract.signing_link_opened
contract.signed
contract.obligation_assigned | completed | due_soon | overdue
contract.acknowledgement.block_confirmed | cancelled
contract.pdf_preview_viewed
contract.amendment_initiated | signed | declined
contract.send_initiated
contract.mobile.viewed | acknowledgement_block_progressed | pdf_preview_viewed | signed | biometric_confirmed | biometric_failed | amendment_reviewed | amendment_signed
contract intake field submitted | completed | declined
employment_contract.upserted_inline
payroll.pii_revealed | gdpr_art_9_write
shift.cost_calculated
legal.aml_14_6.validated | law_cited | amendment_classified
forms.unsaved_guard.shown | kept | discarded
```

## 12. E2E (`apps/e2e/`)

- `contract-employee/` — Phase 4 specs scaffolded 2026-04-29 (5 spec files, 390 lines, all `test.skip` pending seed helper + data-testid + DocuSeal stub)
- `tests/contract-employee/` — Journey-aligned
- `tests/contracts/` — 4 specs from feat/services-employee-contract: employee-contract-{create,send,sign,cancel} (4 PASS, 8 SKIP per HANDOFF)
- `tests/contract-composition/` — Composition derivation tests
- `scripts/journey-runner.ts` — Test executor

## 13. Cross-cutting integrations

| Layer | Surface |
|---|---|
| Tripletex (push) | sync_status enum on entity, push on contract activation + payroll change + employee creation, weekly reconciliation pull (Phase 7) |
| Skatteetaten (pull) | **GO-LIVE BLOCKER** — skattekortforespørsel API, Phase 5+, manual fallback in Phase 0 |
| A-melding | Separate module reads from contracts (occupation_code STYRK-08, end_date_reason A-melding kodeliste) |
| BankID / e-signering | Workspace-configured, DocuSeal supports BankID when enabled (mobile WebView passthrough — no rebuild needed) |
| DocuSeal | Cloud $0.20/doc, embedded via `@docuseal/react`, audit log + signed-PDF snapshot |
| Storage bucket | `contract-attachments` (signed URLs 300s for DocuSeal pickup) |

## 14. RLS + Security

- All workspace-scoped tables: dual-auth RLS policies (JWT `auth.uid()` + API key paths)
- Helpers: `get_workspace_ids_for_user()`, `is_admin_in_workspace()`
- Trigger SECURITY DEFINER `SET search_path = public, pg_temp` on all cross-table SELECTs (per ADR-0243 — fail-closed on cross-workspace silent corruption)
- ADR-0151 forgery defence: `profile_id` derived from JWT or verified workspace membership before any write
- ADR-0078: 3 layers of channel restriction (process / capability / tool)
- Höy-PII (personal_number, bank_account, tax_*) → `RevealableField` 5s reveal + audit emit
- GDPR Art. 9 (`trade_union_*`) → only `payroll` capability, requires DPA reference + `legal_basis` field

## 15. HANDOFFs (closed sub-sorties)

| File | Scope |
|---|---|
| `docs/HANDOFF-contract-intake-gate-fix.md` | A1 — gate restoration |
| `docs/HANDOFF-a1-contract-intake-gate-restore.md` | A1 phase scope |
| `docs/HANDOFF-employee-contract.md` | UX hardening pass 2026-04-28 (Fix 1, 4, 6, 7, 9 + 6 telemetry holes) |
| `docs/HANDOFF-contract-composition-engine.md` | Composition engine |
| `docs/HANDOFF-contract-employee.md` | Employee surface |
| `docs/HANDOFF-contract-0a-pre-frontend.md` | Phase 0a backend pre-FE |
| `docs/HANDOFF-contract-preview-editor.md` | Tiptap editor |
| `docs/handoffs/HANDOFF-employee-contract-management.md` | Older bigger scope |
| `docs/worklogs/WORKLOG-contract.md` | Worklog |
| `docs/worklogs/WORKLOG-contract-enhancements.md` | Enhancements |

## 16. Audits

- `docs/audits/2026-05-02-adr-contract-validation/06-contracts-payroll-lovsen.md` (5 CRITICAL closed)
- `docs/audits/2026-05-06-adr-contract-validation/06-contracts-payroll-lovsen.md`

## 17. Active gaps (per HANDOFF-employee-contract council R1 audit)

- **C4 gate bypass on singular path (RED)** — `/api/employment-contracts` POST + `/[id]/{send,regenerate,cancel}` use only role-check, no `gate_action`. Bulk path gates correctly. Same default-allow CVE class as ADR-0192. Sub-sortie: `feat/contracts-c4-gate-singular-path`
- **I1 niche layer not consulted (RED)** — `packages/ai/src/industry/packages/<niche>.ts` `employmentDefaults` exists but unused at composition. Sub-sortie: `feat/contracts-i1-niche-derivation`
- **ADR-0076 phases 3-5 unimplemented (RED)** — validation is a no-op (every rule pushed to `validations.ok`), `change_proposal` of type `employment_contract_compose` does not exist, `compliance_overrides` JSONB never written. Sub-sortie: `feat/contracts-cascade-derivation-completion`
- **No auto-seed `workspace_framework_binding` (YELLOW)** — fresh workspaces hit 400 on first contract
- **Tariff query missing `framework_id` filter (YELLOW)** — works today (1 framework), breaks silently when 2nd seeded
- **Skatteetaten go-live blocker** for production payroll
- **Mobile screens not built** — only stubs at `(me)/contract/`, ADR-0245 6 screens pending Phase 0c
