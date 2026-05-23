---
title: "Contracts — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: verified
last_verified: 2026-05-23
tags: [contracts, gaps, debt, overlap, deviations]
---

# Contracts — Gaps and Debt

## Deviations (spec vs code)

### D1 — Route migration pending

**Spec:** Plan `docs/superpowers/plans/2026-05-19-sm-2fu-contracts-move.md` specifies moving all routes from `/dashboard/contracts/*` → `/dashboard/people/contracts/*`.
**Code:** Both paths exist. `apps/web/src/app/dashboard/people/contracts/` is the canonical new location; `apps/web/src/app/dashboard/contracts/` also exists. 132 hard refs not yet updated.
**Risk:** Navigation confusion; Botsson site-map references stale paths.
**Severity:** High (plan is "Highest Risk Sortie in SM-2 campaign").

### D2 — ADR-0241/0243/0244/0245 proposed but not accepted

Four ADRs from the 2026-04-29 council batch are "proposed" not "accepted". Code may have partial implementation (e.g., `requires_employee_signature` column referenced). Any code that claims these ADRs as accepted is aspirational.

### D3 — Platform-admin create path bypasses placeholder resolution

`apps/web/src/app/api/platform-admin/contracts/route.ts` stores raw template HTML without calling `resolvePlaceholders` (the contract-service Fastify route resolves correctly). Flagged in ADR-0024 enhancements spec (2026-03-20). Not yet fixed.

### D4 — ADR-0001 (module-local) superseded but file still present

`docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md` has `status: superseded` frontmatter pointing to ADR-0241/0242/0243/0244. Content is largely covered by `docs/decisions/0024-contract-system-architecture.md` + the 4 proposed ADRs. Unique content: early D2/D3 field classification map. Archived with pointer in this run (see Absorptions below).

## Gaps (features not yet built)

### G1 — Amendment classifier UI + AcknowledgementRing

`classify_amendment` tool exists in `packages/ai/src/capabilities/legal/`. A full UI for employee-visible amendment flow with per-clause acknowledgement (ADR-0244 proposed) is not built.

### G2 — Phantom contracts promotion UI

ADR-0197 promotion logic exists. No management UI for bulk-promotion of pre-Smartout legacy contracts.

### G3 — Lærling-kontrakter full flow (ADR-0253)

Block is enforced (cannot create lærling contract without correct template type). Full flow per Opplæringsloven kap. 4 (opplæringskontor integration, practice period plan, competence documentation) is deferred.

### G4 — Tripletex push-sync for contracts

Columns exist. Bidirectional push-sync to Tripletex not implemented (same as payroll domain phase 7).

### G5 — Mobile contract UI (ADR-0245)

Plan complete, partial implementation. 6 screens defined. WebView DocuSeal embedded signer + biometric C4 confirmation not fully wired.

### G6 — A-Melding / Skatteetaten integration

Explicit non-goal for Fase 0. Deferred post-go-live.

### G7 — Capability `legal` (lovsen tools) not classified under contracts

`packages/ai/src/capabilities/legal/` contains `validate_aml_14_6`, `cite_law`, `classify_amendment`. These are referenced in `docs/architecture/contract-service/CAPABILITY-legal.md`. They are NOT part of the `contract` capability — they live in `legal` (a separate capability). Contracts CONSUMES legal tools; it does not own them. No capability consolidation needed; clarification only.

## Overlap Edges

### O1 — payroll ↔ contracts (ADR-0242) — RESOLVED

`employment_contract` (ansiennitet source) + `employee_payroll_profile` PII boundary governed by ADR-0242.
- Contracts own: `employment_contract` lifecycle (draft → active → amending → archived), `contract_pay_rule`, `contract_tip_rule`.
- Payroll owns: `employee_payroll_profile` rate columns, tariff resolution, seniority calculation from `start_date`.
- Seam: `cascade_contract_payroll_sync` trigger propagates `start_date`, `employment_percentage`, `monthly_salary`, `hourly_rate` → `employee_payroll_profile` at signing.
- **No dual ownership. ADR-0242 governs.**

### O2 — lovsen ↔ contracts (ADR-0256) — RESOLVED

Lovsen-mcp provides Aml/Riksavtalen citations + §14-6 validation. Contract-intake CONSUMES via `legal` capability (citation contract ADR-0256). The `packages/lovsen-contract/` package is a Zod-schema type-contract package authored by the lovsen domain (see O3 below).
- **lovsen-mcp is upstream; contracts is downstream consumer.**

### O3 — `packages/lovsen-contract/` ownership — DEVIATION LOGGED

**Finding:** `packages/lovsen-contract/` exports Zod schemas for lovsen citation/confidence/classification (ADR-0256 + ADR-0257). Zero import sites in `packages/ai/src/capabilities/contract/` or `services/contract-service/`. Actual consumers: `services/lovsen-nho-reiseliv-mcp/src/citation.py`, `services/lovsen-arbeidstilsynet-mcp/src/citation.py`, `services/lovsen-mattilsynet-mcp/src/citation.py`, `services/lovsen-lovdata-mcp/src/citation.py` — all lovsen-domain services.
- **Classification: `packages/lovsen-contract/` belongs to the lovsen domain, not the contracts domain.** It was created as shared type infrastructure for lovsen-mcp services, not for the employment contract system.
- **Action taken:** Logged as deviation. Do NOT move code or claim ownership. When lovsen domain is created, this package should transfer.

### O4 — billing ↔ contracts (ADR-0384) — RESOLVED

Billing reads `employment_contract.signed_at` to determine when a workspace becomes billable. Billing owns `pricing_terms` and billing logic; contracts provides the signal.
- **Keep** — clear author/consumer. Billing reads; contracts provides `signed_at`.

### O5 — day-session ↔ contracts — RESOLVED

Active employment contract = readiness gate for day-session. `contract_obligation` rows (training/certification) are checked before employee is cleared for shifts. Day-session reads obligations; contracts owns them.
- **Keep** — day-session consumes; contracts authors.

### O6 — core-structure ↔ contracts — RESOLVED

`employment_contract.workspace_id` FK → `workspace` (D1 envelope). `company_id` FK → `company` (D1 company). Contracts are workspace-scoped D2 resources.
- **Keep** — standard D1/D2 consumer pattern.

### O7 — onboarding ↔ contracts — RESOLVED

Onboarding wizard has a contract-sign step (`apps/e2e/tests/journey-onboarding-step-contract.spec.ts`). The contracts capability is called from the wizard but contracts does not own the wizard flow.
- **Keep** — onboarding orchestrates; contracts provides the capability.

### O8 — cross-cutting certifications

`docs/architecture/cross-cutting/SMARTOUT_CROSSCUT_CONTRACTS_CERTIFICATIONS.md` covers both contracts AND certifications. Certifications (HMS training records, safety certifications) are partially distinct from employment contracts (they link to `contract_obligation` rows but have their own entity). A future "certifications" domain split is possible. For now: certifications-as-obligations live inside the contracts domain.

## Debt

### Debt-1 — Schema-shadow files at `docs/architecture/contract-service/{schema,migrations}/` are SQL drift risk

`docs/architecture/contract-service/schema/` contains 11 SQL files (00-enums → 09-amendment + seed + README + `0001_contracts_module_foundation.sql`). These are SQL snapshots from early design, NOT real migrations. The real migrations are in `supabase/migrations/`. Verified: `docs/architecture/contract-service/schema/03-employment_contract.sql` uses `employment_contract.id` as PK; real migration `00012:57` uses `contract_id`. **Schema drift confirmed — these files are pre-ADR design artifacts.**
- **Classification:** `mirror: source` (historical reference). NOT authoritative. Flagged drift risk: same class as L-0150.
- **Action:** Applied `mirror: source` frontmatter in archive step. Point at real migrations in DATA-MODEL. Do NOT absorb SQL into spine.

### Debt-2 — MODULE_CONTRACT_COMPONENTS.md is a flat pre-domain file

`docs/modules/MODULE_CONTRACT_COMPONENTS.md` was a component inventory (status-code per component per page). Some status codes are stale (🟢/🟡/🔴 as of 2026-04-29). Absorbed as archived in this run (see Absorptions).

### Debt-3 — `capability_default_registry` table classification unclear

Table created in `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:132`. Used for default authority config per capability. Not clearly documented as contracts-owned vs platform-owned. May belong to C4 governance domain. Flagged.

### Debt-4 — `message_template` table co-ownership risk

`message_template` (created `20260228140000:137`) is seeded with contract notification templates. The communication domain may have its own notification template system. If communication domain formalizes, this table may need a home. Flagged for future domain audit.

### Debt-5 — Intake path bypasses composition in platform-admin

See D3. Platform-admin route stores raw HTML. This is a known unresolved gap from ADR-0024 enhancements (2026-03-20 spec). Creates inconsistent contract bodies between platform-admin and contract-service paths.

### Debt-6 — E2E skipped tests in contracts-compliance

`apps/e2e/tests/contracts-compliance/journey-a-singular-bypass.spec.ts` and `journey-d-pdf-gate-bypass.spec.ts` may have `test.skip` annotations from audit remediation. Verify before claiming compliance coverage.
