---
title: "Plan — contract-employee"
status: draft
updated: 2026-04-30
created: 2026-04-29
module: contract
tags: [plan, contract, payroll, paragraf-14-6, docuseal, tripletex]
---

# Plan — contract-employee

> Branch: `feat/services-contract-employee` | Worktree: /home/sxtnl/dev/smartout.ai-services-wt-1 | Base: `campaign/services` | Module: contract | Started: 2026-04-29

## Source of truth

Architecture og foundation lever i `docs/architecture/contract-service/`:

- **`ADR-0001-kontrakt-og-lonnsprofil-fundament.md`** — D1 (Smartout master), D2 (parallelle kontrakter), D3 (overtime hybrid), felt-klassifisering MATERIAL/ADMIN/DERIVED/SYSTEM
- **`ARCHITECTURE-contracts-module.md`** — 3-lags modell, datamodell, tjenester, cascade-coupling, integrasjoner, compliance
- **`PRD-contracts-module.md`** — produktkrav
- **`CONTRACT_COMPONENTS.md`** — komponent-kart
- **`JOURNEY-contract-module.md`** — 5 ende-til-ende journeys (definer, send, signer, enforce, amendment)
- **`schema/`** — 11 reference-DDL filer (enums, lookups, 8 tabeller)
- **`migrations/0001_contracts_module_foundation.sql`** — atomisk deploy-migrasjon (525 linjer)

Denne planen referer til disse dokumentene som canonical. Fungerer som leveranseplan, ikke arkitektur-doc.

## Goal

Implementer Contracts Module Phase 0a + Phase 1 — fra DB-foundation til hverdags-enforcement, slik at:
- Admin definerer §14-6-grunnlag på `/people/[id]`
- Admin sender via forenklet drawer
- Ansatt signerer + ser obligations på `/my-contract`
- System enforce'r blockers + shift-cost via cascade
- Amendment-flow fungerer for material endringer

## Scope

In:
- Phase 0: sprint UX-fixes (fra gamle PLAN-employee-contract: cancel-confirm, unsaved-guard, telemetry holes, actor_id bug)
- Phase 1: kjør atomisk migrasjon `0001_contracts_module_foundation.sql` (kopiér til `supabase/migrations/YYYYMMDDHHMMSS_*.sql`), regen types, RLS-validering
- Phase 2-7: kode + UI per ARCHITECTURE §5 nøkkelflyt + JOURNEY 1-5
- Cascade-coupling per ARCHITECTURE §6
- Tripletex push-sync per §7.1
- Compliance-gates per §8

Out (egne ADR/sub-sortie):
- Skatteetaten-integrasjon (go-live blocker, men separat)
- A-melding-rapportering (egen modul)
- Pension scheme management UI (separat modul, men FK fungerer)
- Lærlinge-kontrakter (egen ADR senere)
- shift_pay_calculation full audit-modul (5 års bokføring — egen ADR)
- BankID e-signering (workspace-konfigurert, ikke i scope)
- Multi-arbeidsgiver-deling (åpent spørsmål per ARCHITECTURE §12)

## ADRs allerede aksepteres / proposed for Phase 1

ADR-0001 er `superseded` (2026-04-29 Council) og delt i fire successor-ADRs, alle `proposed` på development:

- [ ] ADR-0241 — Contract Schema Migration Foundation (`docs/decisions/0241-contract-schema-migration-foundation.md`)
- [ ] ADR-0242 — Contract / Payroll Capability Split (`docs/decisions/0242-contract-payroll-capability-split.md`)
- [ ] ADR-0243 — Obligation Lifecycle — Trigger Semantics (`docs/decisions/0243-obligation-lifecycle-trigger-semantics.md`)
- [ ] ADR-0244 — Amendment Flow + AcknowledgementRing as §14-6 Legal Evidence (`docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`)

(De fire ble renumbert fra 0233-0236 mid-session på grunn av kollisjon med helpdesk-council batch.)

Eksisterende relevante ADRer (allerede accepted):
- 0024 (Contract System Architecture) — foundational
- 0076 (Composition as Cascade Derivation)
- 0077 (PII Handling)
- 0078 (Channel Restriction — ingen stemme for personnr/bank)
- 0079 (employment_contract vs contract separation)
- 0082 (Contract Drafts Are Not Versions)
- 0093 (Draft Proposals — Unified Cascade)
- 0109 (Migrated Contract Shell — Block & Supersede)
- 0111 (Detail Versioning)
- 0182 (Template vs Contract Lifecycle Separation)
- 0133 (Mobile Surface Boundary — web composes, mobile executes)
- 0134 (Mobile Telemetry Contract)

Reconciler ADR-0241-0244 mot eksisterende — sjekk om noen overstyres (Cycle 1 audit fant ingen CONFLICT-verdikter, men `parent_contract_id` vs `superseded_by_contract_id` naming-konflikt i ADR-0241 trenger sign-off).

## Tasks

### Phase 0 — Sprint UX-fix (foldet inn fra PLAN-employee-contract 2026-04-28)

- [ ] Fix 1 — MalerTab editor som read-only (Lock badge + Copy/Open-in-admin)
- [ ] Fix 4 — Cancel confirmation AlertDialog (destructive variant + loading state)
- [ ] Fix 6 — `contract-preview-editor` enforce `editable: false` når `mode==="preview"`
- [ ] Fix 7 — Loading state på Resend / Cancel dropdown menu items
- [ ] Fix 9 — UnsavedChangesGuard på contract-send-drawer + CompositionDrawer + BulkSendDrawer
- [ ] Telemetry: 6 manglende `emit()` calls (template.cloned, contract.resend, contract.cancel, contract.detail.viewed, bulk.submitted, compose.opened)
- [ ] Bug: `use-employment-contracts.ts:97` actor_id (subject's profile_id → admin's profile_id)
- [ ] Extract reusable: `DestructiveConfirmDialog`, `MutationButton`, `MutationDropdownMenuItem`, `UnsavedChangesGuard`

### Phase 1 — Database foundation

- [ ] Reconcile ADR-0001 vs eksisterende ADRer — eventuelt ADR-amendment
- [ ] Reconcile schema/ vs eksisterende `employment_contract`, `employee_payroll_profile`, `contract_template` (audit fant 7 §14-6-felt manglende, ingen contract_amendment/contract_obligation/contract_pay_rule/contract_tip_rule/pension_scheme tabeller)
- [ ] Verifiser at `supabase/migrations/20260519100100_contracts_module_foundation.sql` er applied (supersedes ADR-0001's `0001_contracts_module_foundation.sql` per Council 2026-04-29; running the old `0001` would corrupt DB)
- [ ] Regen `database.types.ts`
- [ ] Kjør lokalt mot Supabase Local: `npx supabase migration up`
- [ ] Verifiser: alle CHECK-constraints, partial unique index (én aktiv main per profil), FK-er
- [ ] RLS-policies: workspace-scoped + employee self-read for nye tabeller
- [ ] activity_trail-trigger på employment_contract INSERT/UPDATE
- [ ] Verifiser at `packages/contracts/src/field-classification.ts` eksisterer per ADR-0243 (klassifisering ligger i TS, ikke DB-tabell)
- [ ] Skriv pgTAP-tester for invariantene (D2 unique-index, MATERIAL-felt-klassifisering)

### Phase 2 — People-page sections (Journey 1)

- [ ] `/dashboard/people/[id]` HR-tab: Ansettelse-section (15 §14-6-felt)
- [ ] HR-tab: Lønnsprofil-section (Tripletex-aligned, framework-rule defaults)
- [ ] HR-tab: Tipsregel-modal (per ARCHITECTURE §3.5 distribution_method)
- [ ] Inline-save endpoint `/api/contracts/employment/upsert`
- [ ] Validation: prøvetid ≤ 6 mnd, sluttdato > startdato, timelønn ≥ tariff-min
- [ ] Status-derivation: "Klar til å sende kontrakt" gate
- [ ] Telemetry: `employment_contract.upserted_inline`, `payroll_profile.updated`, `contract.tip_rule_changed`

### Phase 3 — Send-drawer forenkling (Journey 2)

- [ ] Forenkle CompositionDrawer fra 5 → 2 steg (mal → preview+send)
- [ ] AcknowledgementRing: 4 nøkkelblokker (stilling, lønn, kategori, framework)
- [ ] `framework_snapshot`-freeze ved send (per ADR-0080 + ARCHITECTURE §5.1)
- [ ] DocuSeal `signing_contract_id`-opprettelse — bekreft webhook-flyt
- [ ] Telemetry: `contracts.compose.opened`, `contracts.compose.template_selected`, `contract.send_initiated`

### Phase 4 — Employee my-contract (Journey 3)

- [ ] Verifiser DocuSeal-webhook → `status='active'` (ikke `signed` per ADR-0001 status-enum)
- [ ] `/dashboard/my-contract` page: stilling + lønn + obligations + tariff-info + last-ned-PDF
- [ ] Forpliktelse-router → `/dashboard/competence/protocol/[id]`
- [ ] Hook engine_event for cascade-coupling (D2 update + C4 authority `trainee → active`)
- [ ] Telemetry: `contract.signing_link_opened`, `contract.signed`, `contract.obligation_completed`

### Phase 5 — Daily enforcement (Journey 4)

- [ ] Clock-in middleware: les `contract_obligation` med `is_blocker=true AND status IN ('pending','overdue')`
- [ ] shift_cost calc reading `contract_pay_rule` (per ARCHITECTURE §5.7)
- [ ] Botsson `salary_query` capability (employee-side, channel-restricted per ADR-0078)
- [ ] Cron-job: daglig `obligation.due_within_days <= 3` → `contract.obligation_due_soon` push
- [ ] Engine_event ved 80% av månedlig overtid-tak (per ARCHITECTURE §5.6 + ADR-0001 D3)
- [ ] Telemetry: `contract.obligation_due_soon`, `contract.obligation_overdue`, `shift.cost_calculated`

### Phase 6 — Amendment flow (Journey 5)

- [ ] amendment-handler: `classify_change(field, old, new)` → MATERIAL/ADMIN/DERIVED/SYSTEM (les `field_classification_metadata`)
- [ ] MATERIAL → `contract_amendment`-rad + ny employment_contract-versjon (`superseded_by_contract_id`)
- [ ] Stillingsendring-flow: alternativer (a) amendment vs (b) ny kontrakt per ARCHITECTURE §5.4
- [ ] Side-by-side diff på `/my-contract` for ansatt
- [ ] DocuSeal re-sign for amendment
- [ ] Bulk-flow ved tariff-version_changed (per ARCHITECTURE §5.3 + Journey 4 step 5)
- [ ] Telemetry: `contract.amendment_initiated`, `contract.amendment_signed`, `contract.amendment_declined`

### Phase 7 — Tripletex sync + audit polish

- [ ] Push-sync ved kontrakt-aktivering, lønnsprofil-endring, ansatt-opprettelse
- [ ] Reconciliation-pull ukentlig
- [ ] Konflikt-håndtering: Smartout vinner, admin varsles
- [ ] `sync_status` per entitet (pending/synced/divergent/not_synced)
- [ ] activity_trail dekker hele kontrakt-livssyklus (verify ikke kun signering)

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] All 5 journeys covered by E2E tests i `apps/e2e/contract-employee/`
- [ ] Decision log oppdatert: ADR-0001 promoted Proposed → Accepted, ev. nye ADRer for shift_pay_calculation, Skatteetaten
- [ ] Telemetry registry: alle 15+ events emit + route correctly
- [ ] No new direct-Edge-Function bypassing workspace-api
- [ ] Mobile parity: data layer i packages/, web UI ships first, mobile UI follow-up OK
- [ ] PII handling per ADR-0077 + ADR-0078 (personnr/bank — ingen stemme, ingen AI-context)
- [ ] Cascade-coupling per ARCHITECTURE §6 verifisert per Journey 1-5
- [ ] §14-6 fullstendighetstest passerer (alle påkrevde felt validert ved kontrakt-aktivering)
- [ ] D2 invariant: max én aktiv main-kontrakt per profil (DB-constraint + property-test)
- [ ] D3 invariant: contract overtime-cap aldri over Aml. §10-6 absolutte grenser
- [ ] HANDOFF skrevet ved closure med decisions + learnings + next steps

## Risks / Open Questions

Per ARCHITECTURE §12 + ADR-0001 åpne spørsmål:

1. **Skatteetaten-integrasjon** — go-live blocker. Eier + sertifisering-løype må utpekes før produksjon. Phase 7+ scope.
2. **Riksavtalen-versjonering** — migrering av aktive `contract_pay_rule`-rader når tariff reforhandles. Trenger egen ADR.
3. **Prøvetid-pause ved sykefravær** (Aml. §15-6 4. ledd) — automatisk eller manuell? Out of scope, dokumentér.
4. **Lærlinge-kontrakter** (Opplæringsloven kap. 4) — datamodell må ikke utelukke. Egen ADR senere.
5. **shift_pay_calculation** — egen modul-arkitektur kreves før Botsson-løftet om "kilde-referanse" kan oppfylles. Phase 5 leverer minimum, full audit-trail i egen sortie.
6. **Multi-arbeidsgiver-deling** — konsern-bytte. Out of scope.
7. **Engine-default for overtime-cap** — workspace-nivå eller tariff-nivå? Krever beslutning før Phase 5.

Ekstra risiko fra audit:
- Eksisterende contract_status enum mangler `pending_signature` (ADR-0001 spec) — migration må ALTER TYPE eller fork. Tap av eksisterende `viewed`/`pending_data`/`ready_to_send`/`migration_incomplete` ved omdefinering — verifisér at flow-mapping er kompatibel.
- Eksisterende employment_contract har `framework_snapshot` JSONB (per audit). ADR-0001/ARCHITECTURE forutsetter denne — bra, ingen migrasjon nødvendig der.
- 4 narrow journeys (`JOURNEY-services-employee-contract-{create,send,sign,cancel}.md`) verifisert 2026-04-28 — superseder med canonical JOURNEY-contract-module.md eller marker deprecated i frontmatter.
- `PLAN-employee-contract.md` (sprint UX) — phases foldet inn som Phase 0; gammel plan markeres superseded.

## References

- Canonical: `docs/architecture/contract-service/` (alle 6 doc-filer + schema/ + migrations/)
- ADR-0001: `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md`
- Eksisterende ADR-liste: 0024, 0076, 0077, 0078, 0079, 0082, 0093, 0109, 0111, 0182
- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- §14-6 (Arbeidsmiljøloven), §10-6 (overtid), §15-6 (sykefravær)
- Bokføringsloven §13 (5 års lagring)
- Tripletex API: `/v2/employee`, `/v2/salary/type`
