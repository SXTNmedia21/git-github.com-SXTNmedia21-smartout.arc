---
title: Contract Composition Engine — Design Spec
status: ready-for-plan
updated: 2026-04-08
created: 2026-04-08
module: contracts
tags: [contract, composition, cascade, engine_process, pii, docuseal]
---

# Contract Composition Engine — Design Spec

> Konsolidert spec for compliance-drevet kontrakt-composition med zero-friction
> data-intake og mobile signing. Resultat av to brainstorm-runder + to council-
> sessioner (2026-04-07 og 2026-04-08). Erstatter tidligere fragmenterte
> designer.

## Source Material

Denne spec-en er byggegrunnlag for implementation plan. Build-agents trenger
bare lese denne filen + de refererte ADRene.

**Accepted ADRs (alle blokkerende er på plass):**

- [ADR-0076](../../decisions/0076-contract-composition-as-cascade-derivation.md) — Composition as Cascade Derivation
- [ADR-0077](../../decisions/0077-contract-intake-pii-handling.md) — Intake PII Handling
- [ADR-0078](../../decisions/0078-engine-process-channel-restriction.md) — Engine Process Channel Restriction
- [ADR-0079](../../decisions/0079-adr-0024-amendment-employment-vs-platform-contracts.md) — ADR-0024 Amendment
- [ADR-0080](../../decisions/0080-compliance-drift-signal-read-only.md) — Compliance Drift Signal
- [ADR-0081](../../decisions/0081-admin-pii-bypass-security-definer-rpc.md) — Admin PII Bypass RPC
- [ADR-0082](../../decisions/0082-contract-drafts-are-not-versions.md) — Drafts Are Not Versions

**Council log entries:** 2026-04-07 runde 1, 2026-04-08 runde 2 i
`docs/council/COUNCIL-LOG.md`.

**Learnings:** 0029, 0030 i `docs/learnings/`.

---

## Vision

Admin skal kunne opprette en ny arbeidsavtale med **null friksjon** — systemet
foreslår alle verdier basert på Cascade (tariff, lov, workspace-rules), admin
justerer hvis nødvendig, og manglende data fra ansatt hentes inn automatisk
via en task-basert flyt som kan utføres via UI eller Botsson chat.

Kontrakter skal automatisk **overholde tariff og lov**: lov-pliktige klausuler
injiseres fra Cascade K1a, lønn valideres mot tariff_rate_table, og avvik fra
tariff krever aktiv begrunnelse fra admin.

Ansatt skal kunne **forstå hva hen signerer**: rettigheter fra framework_rule
vises som side-panel sammen med kontrakt-teksten.

## Scope Phase 2

**In scope:**
1. Compliance-drevet composition wizard (admin)
2. Contract intake engine_process (ansatt data-innhenting)
3. Employee signing task via embedded DocuSeal (Nordic Split-wrapped)
4. Rights panel på signerings-UI (dynamisk per kontrakt)
5. Multi-state lifecycle med pending_data + declined
6. Admin edit + re-send som ny versjon (via parent_contract_id lineage)
7. Compliance drift detection (read-only view)
8. Admin PII bypass (dashboard only)

**Explicitly out of scope (deferred to Phase 3):**
- Cross-device Realtime sync (4.3b) — ingen broadcast-infrastruktur finnes
- Cascade-wide authority config runtime loader — hardcoded auth i
  capability for nå
- Reactive framework-propagation (permanent reject — ADR-0080)
- "Forklart på norsk" AI plain-language toggle — tab-slot reservert men
  disabled
- Workspace template CRUD — fortsatt kun platform-admin
- Native signature pad — embedded DocuSeal beholdes

---

## Architecture

### Cascade placement

Per ADR-0076, composition er en **cascade derivation**:

```
Inputs:
  D2 (employee profile + employment_contract shell)
  K1a (regulatory_framework, framework_rule, tariff_rate_table)
  K1b (workspace_framework_binding, workspace_rule_override)
  D4 (position, workspace parameters)
     │
     ▼
Pure function: resolveComposition(workspaceId, profileId, templateId)
     │
     ▼
Output: ContractDraftProposal
  {
    employment_terms: { position, rate, percentage, start_date, ... },
    framework_snapshot: { framework_id, rule_ids, rules: [...] },
    mandatory_clauses: [...],
    validations: { ok: [], warning: [], blocker: [] },
    placeholder_status: { filled: [...], missing: [...] }
  }
     │
     ▼
Admin review & override (per-block acknowledgement)
     │
     ▼
change_proposal (type: employment_contract_compose)
     │
     ▼
Apply: atomic write of employment_contract + contract rows
     │
     ▼
Event Engine: contract_data_intake (if data missing) OR contract_signing
```

Signed contracts transitioneres ut av cascade derivation path og inn i
execution-layer. `framework_snapshot` er immutable ved sign-time. Drift mot
current K1a overvåkes via read-only materialized view (ADR-0080), aldri via
re-derivation.

### Two engine_process blueprints

**1. `contract_data_intake`** — henter manglende personnummer, bank, adresse

```
process_id: 'contract_data_intake'
allowed_channels: ['chat']  # ADR-0078 enforcement
steps:
  - collect_identity (bundled: personal_number + address)
  - collect_banking (bank_account)
  - [more groups as needed]
```

Per council round 2: **bundled groups, not per-field**. Reduces waiting-state
count by 4x at wave scale.

Hver step er en `assign_task` action med payload som beskriver hvilke felt
som skal fylles. Utføres via:
- **UI lens:** `TaskRunner` shell i `packages/ui/src/task-runner/` + mobile
  `(me)/tasks/[id].tsx` + web `/dashboard/my-profile/complete`
- **Agent lens:** Mr. Botsson `contract_intake` capability (chat-only,
  confirm authority, no-echo tool results)

**2. `contract_signing`** — task-based signering

```
process_id: 'contract_signing'
allowed_channels: ['chat']
steps:
  - review_terms
  - acknowledge_rights
  - sign (via collect_signature action_type, external DocuSeal webhook)
```

Agent kan forklare kontrakten via `explain_contract_clause` tool (read-only,
verbatim quoting only), men aldri signere. Signering fullføres eksklusivt
via DocuSeal webhook på `collect_signature` handler.

### Data model

**Existing (unchanged):**
- `employment_contract` — HR-artefakt (migration 00012)
- `contract` — DocuSeal signing entity (ADR-0024)
- `contract_template` — maler med placeholders
- Cascade K1a tables: `regulatory_framework`, `framework_rule`,
  `tariff_rate_table`, `workspace_framework_binding`

**New columns:**

```sql
-- ADR-0076: framework snapshot + override provenance
ALTER TABLE employment_contract
  ADD COLUMN framework_snapshot JSONB,
  ADD COLUMN compliance_overrides JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN parent_contract_id UUID REFERENCES employment_contract(contract_id),
  ADD COLUMN decline_reason_code TEXT,
  ADD COLUMN decline_reason_text TEXT;

CREATE INDEX idx_employment_contract_parent
  ON employment_contract(parent_contract_id)
  WHERE parent_contract_id IS NOT NULL;

-- ADR-0076: pending_data + declined status (minimal enum extension)
-- MIGRATION A (standalone, must commit before migration B uses it):
ALTER TYPE public.contract_status ADD VALUE 'pending_data';
-- MIGRATION B (second standalone):
ALTER TYPE public.contract_status ADD VALUE 'declined';

-- ADR-0078: channel restriction on engine_process
ALTER TABLE engine_process
  ADD COLUMN allowed_channels TEXT[] NOT NULL
  DEFAULT ARRAY['chat', 'voice', 'sms', 'email', 'autonomous', 'telegram'];

-- ADR-0077: engine_memory PII sensitivity
ALTER TABLE engine_memory
  ADD COLUMN sensitivity TEXT
  CHECK (sensitivity IN ('normal', 'pii', 'legal'))
  DEFAULT 'normal',
  ADD COLUMN expires_at TIMESTAMPTZ;

-- 3.2b escalation: delayed_trigger cancellation
ALTER TABLE engine_delayed_trigger
  ADD COLUMN cancelled_at TIMESTAMPTZ;
-- fire-delayed-triggers predicate: AND cancelled_at IS NULL
```

**Compliance drift materialized view (ADR-0080):**

```sql
CREATE MATERIALIZED VIEW compliance_drift AS
SELECT
  ec.contract_id,
  ec.workspace_id,
  ec.profile_id,
  ec.framework_snapshot,
  public.compute_compliance_diff(
    ec.framework_snapshot,
    current_framework_state_for(ec.framework_snapshot->>'framework_id')
  ) AS drift
FROM employment_contract ec
WHERE ec.status = 'signed';

CREATE INDEX idx_compliance_drift_workspace
  ON compliance_drift(workspace_id);

CREATE TRIGGER framework_rule_refresh_drift
  AFTER INSERT OR UPDATE OR DELETE ON framework_rule
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_compliance_drift();
```

**Admin PII bypass RPC (ADR-0081):**

`admin_submit_employee_pii(profile_id, field, value, reason)` SECURITY DEFINER
function with strict role guard, required justification, audit trail write,
and employee notification trigger.

### Compliance validation layers

Per ADR-0076 + council round 2:

1. **Lov-pliktige regler** (fra `framework_rule` marked as mandatory) →
   **hard blocker**. Admin kan ikke sende kontrakt med lov-brudd. Klausuler
   injiseres automatisk og låses i editoren.

2. **Tariff-regler** (fra `tariff_rate_table`) → **blocker med override**.
   Admin kan skrive lønn under tariff, men må gi begrunnelse som lagres i
   `employment_contract.compliance_overrides` JSONB med provenance (rule_id,
   values, approved_by, timestamp).

3. **Frivillige recommendations** → warning only. Admin ser, kan ignorere.

### Channel enforcement (three layers)

Per ADR-0078, defence in depth:

1. **Process level:** `engine_process.allowed_channels` → dispatcher refuser
   start hvis session.channel ikke er i listen
2. **Capability level:** `CapabilityDefinition.allowedChannels` → tool-selector
   filtrerer ut capability i feil kanal
3. **Tool level:** `AgentToolContext.channel` → sensitive tools self-check

Intake og signing er begge `allowed_channels: ['chat']`.

---

## 13 Product Decisions (Final, Spec-Ready)

| # | Decision | Final Rule |
|---|---|---|
| 3.1 | Intake step granularity | **Bundled groups** (~5: identity, banking, emergency, tax, consent). One step per group. Empathy copy per group. |
| 3.2 | Escalation cadence | Day 3 nudge, day 7 reminder, day 10 escalate to admin. Via `engine_delayed_trigger`. Requires `cancelled_at` column + predicate in fire-delayed-triggers. |
| 3.3 | Admin PII bypass | Dashboard-only. NEVER via Botsson/agent. Behind secondary "Handlinger" menu. Confirmation modal + required reason (min 10 chars) + data-shaming stat. ADR-0081 SECURITY DEFINER RPC. |
| 3.4 | Refusal handling | `contract_status = 'declined'` + `decline_reason_code` + `decline_reason_text`. Engine step goes `failed` with reason in metadata. No step CHECK extension. |
| 4.1 | Signing surface | Embedded DocuSeal (ratified — already implemented). Wrap in Nordic Split chrome via `customCss` prop. Keep DocuSeal attribution as trust signal. |
| 4.2 | Framework snapshot | Snapshot `framework_rule` rows into `employment_contract.framework_snapshot` JSONB on send. Immutable after sign. |
| 4.3 | Multi-device sync | **DEFERRED to Phase 3** — no Realtime broadcast path exists. Users refresh manually in Phase 2. |
| 4.4 | Contract versioning | **Drafts are NOT versions** (ADR-0082). Versioning starts at `sent`. Pre-send draft is single mutable row. Re-send after sent = new row + `parent_contract_id` FK + new DocuSeal envelope (old voided). Idempotency key on send endpoint. |
| 4.5 | Decline UX | Explicit decline button. `contract declined` telemetry event already in registry, needs UI wire-up. |
| 5.1 | State machine | DB enum adds: `declined`, `pending_data`. Dashboard filter groups 9 conceptual states into 3 buckets via pure UI filter: "Venter på ansatt", "Klar til handling", "Fullført". |
| 5.2 | Framework propagation | 5.2c manual "Regenerer fra framework"-button + `compliance_drift` read-only materialized view (ADR-0080). NO reactive fan-out. |
| 5.3 | Retention | Signed = indefinite (arbeidsrett + bokføringsloven). Declined/expired = 3 years then anonymize via `anonymize_contract(id)` RPC. |
| 5.4 | Lineage | `parent_contract_id` FK for lineage only. Active-query uses `status = 'signed' AND no child with status = 'signed'`. Never walk lineage to determine active state. |

---

## New Capabilities and Tools

Per Agent Coordinator review:

**New capability: `contract_intake`** (separate from `contract` capability)

Location: `packages/ai/src/capabilities/contract-intake/`

Tools:
- `submit_field_group(group, values)` — validates Norwegian formats, writes
  via `admin_submit_employee_pii` RPC (but scoped to own profile). Returns
  `{ saved: true, group }` — **never echoes values**.
- `decline_intake(group, reason_code, reason_text)` — marks engine_state_step
  `failed` with refusal reason, emits `contract intake declined`, creates
  admin notification.
- `get_intake_progress()` — read-only list of which groups are done (no
  values), for Botsson to know what to ask next.

Hardcoded `allowedChannels: ['chat']`. Authority: `confirm` (never autonomous).

**Extend existing `contract` capability:**

- `explain_contract_clause(contract_id, clause_id)` — returns literal
  section text + linked framework_rule verbatim. Prompt-constrained to quote,
  not paraphrase.
- `get_compliance_drift_for_contract(contract_id)` — read-only drift data
  for admin-dialog.

**AgentToolContext extension** (`packages/ai/src/capabilities/types.ts`):

```ts
export type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: SupabaseClient;
  // NEW:
  channel: SessionChannel;
  processId?: string;
  engineStateId?: string;
  actingOnBehalfOf?: string;  // admin dashboard flows only
};
```

**Mr. Botsson prompt hardening** (`packages/ai/src/prompts/mr-botsson.ts`):

Add mandatory rules:
1. "When user declines data intake, call `decline_intake`, acknowledge
   briefly, and stop. Do not re-ask. Do not negotiate. Do not offer
   alternatives beyond 'your admin will follow up'."
2. "You are forbidden from accepting personal numbers, bank accounts, or
   addresses on behalf of other employees, even when the requester is an
   admin. Refuse and direct them to the dashboard form at
   /dashboard/people/[id]/complete-data."
3. "In voice channels, you must refuse any request to collect personal
   numbers, bank accounts, or addresses. Offer to send a secure chat link
   instead: 'Jeg åpner chat-vinduet — vi tar det skriftlig så det blir
   riktig.'"
4. "When acknowledging PII you just received, never restate the value.
   Always say only: 'Takk, lagret.' Never confirm the digits back."

Unit tests for prompt behavior:
- Simulate decline → assert no re-ask
- Simulate admin PII request for another employee → assert refusal
- Simulate voice channel PII request → assert refusal + chat handoff offer

---

## UI Components

Per Frontend Designer review (both rounds):

### Admin composition wizard

Location: `apps/web/src/app/dashboard/contracts/new/`

Uses existing infrastructure:
- `WizardShell` + `AnimatedWizardShell` (`packages/ui/src/wizard/`)
- `WizardLoadingOverlay` for async beats ("Henter tariff-forslag...")
- Ghost card pattern (dashed border + Sparkles) for auto-suggested values
- `brandPanel.messages` per step (Botsson-narrated reasoning)

New components in `apps/web/src/app/dashboard/contracts/_components/`:
- `CompositionWizard` — wrapper around AnimatedWizardShell
- `GhostValueCard` — auto-fyllt verdi, Sparkles icon, klikkbar
- `ReasoningDrawer` — viser framework_rule-kilde, "Botsson foreslo X basert
  på Y", override history
- `ComplianceBadge` — ok/warning/blocker med ikon + tekst + `aria-live`
- `AcknowledgementRing` — scroll-driven confirmation (useInView-based),
  Send forblir disabled til alle blocks er acknowledged
- `BlockerCounter` — i WizardNavBar, "3 advarsler må håndteres"

Wizard steps:
1. Velg ansatt
2. Posisjon (framework-aware dropdown)
3. Derivation (server-side, WizardLoadingOverlay)
4. Review & override (per-block acknowledgement)
5. Klausuler (låste + valgfrie)
6. Send

### Shared TaskRunner

Location: `packages/ui/src/task-runner/`

**New shared component** consumed by:
- `contract_data_intake` (this spec)
- `contract_signing` (this spec)
- Existing `my-training` protocol runner (refactor opportunity)
- Future onboarding data-collection

Pattern: shift-card shell + task-specific slots:
- `font-heading` title
- Single-sentence "why"
- Primary CTA button
- "Ikke nå" ghost button

### Mobile employee surfaces

Location: `apps/mobile/app/(me)/`

New screens:
- `contract/index.tsx` — my-contract hero (active) + historikk (collapsed
  with `opacity-60`)
- `contract/[id].tsx` — contract detail with segmented tabs
  (`Kontrakt | Rettigheter | Forklart` — Forklart DISABLED in Phase 1 per
  Frontend review)
- `tasks/[id].tsx` — generic TaskRunner for data-intake and signing

### Web employee surfaces

Location: `apps/web/src/app/dashboard/`

New pages:
- `my-contract/page.tsx` — web equivalent of mobile my-contract
- `my-profile/complete/page.tsx` — web UI lens for `contract_data_intake`
  engine_process

### Admin dashboard additions

Location: `apps/web/src/app/dashboard/contracts/`

New/updated:
- `/new` — composition wizard (CompositionWizard)
- `/[id]` — detail view (fills TODO from current list)
- `/[id]/revise` — trigger new version flow
- `filters.ts` — pure computed mapping for 3 dashboard state buckets
- `/[id]/complete-data` — admin PII bypass entry (behind secondary menu)

---

## Telemetry

New events to register in `packages/telemetry/src/registry.ts`:

| Event | Description | Triggered by |
|---|---|---|
| `contract composed` | Composition wizard completed, change_proposal created | Wizard finish |
| `contract compliance blocked` | Hard blocker hit (law violation) | Server-side validation |
| `contract compliance overridden` | Tariff override with justification | Override save |
| `contract intake started` | engine_process started, status = pending_data | Composition send |
| `contract intake field submitted` | Per field group submission | Intake tool |
| `contract intake completed` | All fields collected, transition to ready | Last group save |
| `contract intake escalated` | Day 10 escalation to admin | fire-delayed-triggers |
| `contract intake admin bypass` | Admin entered PII on behalf | admin_submit_employee_pii RPC |
| `contract intake declined` | Employee refused intake | decline_intake tool |
| `contract framework drift detected` | Compliance drift view refresh | Materialized view |
| `contract regenerated` | Admin clicked regenerate-from-framework | Regenerate button |
| `contract revision created` | Edit-after-send new version | Revise endpoint |
| `contract retention archived` | Anonymization run | anonymize_contract RPC |

**Existing but unwired** (needs UI hookup):
- `contract declined` — register wired for 4.5b decline button

All mutations via `emit()` in `onSuccess` — no mutation without emit.

---

## Ship Order (4 phases)

Per Steward Phase 5 synthesis round 2:

### Phase 2a — Foundation (week 1)

1. Accept ADR-0080, 0081, 0082 (done 2026-04-08)
2. Migration A: `ALTER TYPE contract_status ADD VALUE 'pending_data'` (standalone)
3. Migration B: `ALTER TYPE contract_status ADD VALUE 'declined'` (standalone)
4. Migration C: `employment_contract` columns (framework_snapshot, compliance_overrides, parent_contract_id, decline_reason_code, decline_reason_text) + index
5. Migration D: `engine_process.allowed_channels`, `engine_memory.sensitivity`, `engine_memory.expires_at`, `engine_delayed_trigger.cancelled_at`
6. Migration E: `compliance_drift` materialized view + refresh trigger
7. Migration F: `admin_submit_employee_pii` SECURITY DEFINER RPC + pgsodium setup
8. Telemetry registry: 13 new events + wire existing `contract declined`
9. `fire-delayed-triggers` predicate update for cancelled_at

### Phase 2b — Capability + prompts (week 2)

10. `AgentToolContext` extension (channel, processId, engineStateId, actingOnBehalfOf)
11. New capability `contract_intake` with bundled-group tools
12. Extend `contract` capability with `explain_contract_clause` + `get_compliance_drift_for_contract`
13. Mr. Botsson prompt hardening + unit tests
14. E2E refusal test (voice channel PII attempt → refused)

### Phase 2c — Flows (week 3)

15. Shared `TaskRunner` in `packages/ui/src/task-runner/`
16. Admin composition wizard (`/dashboard/contracts/new`)
17. Contract detail view (`/dashboard/contracts/[id]`)
18. Admin PII bypass form (`/dashboard/people/[id]/complete-data`) behind secondary menu
19. `contract_data_intake` engine_process seed + bundled-group steps
20. Delayed trigger schedule on send (day 3/7/10)
21. `contract_signing` engine_process seed
22. Employee task runner (`apps/mobile/app/(me)/tasks/[id].tsx`)
23. Mobile my-contract surfaces (`apps/mobile/app/(me)/contract/*`)
24. Web my-contract surface (`apps/web/src/app/dashboard/my-contract/`)
25. Web my-profile/complete surface
26. DocuSeal Nordic Split chrome (`customCss` prop + glassmorphism wrap)
27. Dashboard filter bucketing (3 groups) in `contracts/filters.ts`
28. "Regenerer fra framework"-knapp (5.2c)
29. Contract versioning on re-send (idempotency key + new row + new envelope)

### Phase 2d — Closure

30. `anonymize_contract` RPC for retention
31. Scheduled anonymization job via fire-delayed-triggers
32. E2E journey tests per `test-coverage-map.md`:
    - Happy path (admin composes → employee receives task → data intake → signing)
    - Decline path (employee refuses intake or signing)
    - Escalation path (day 3, 7, 10 notifications)
    - Regenerate path (framework drift → admin regenerates)
    - Admin bypass path (dashboard-only PII entry + employee notification)
    - Voice channel PII attempt → refused path
33. Performance gates: wizard step < 500ms, admin contract list < 2s
34. Telemetry assertions via `expectTelemetryEvent()` in tests
35. DB consistency tests: employment_contract ↔ framework_snapshot ↔
    engine_state_step alignment

---

## DEFERRED to Phase 3 (not in this spec)

- **4.3b** multi-device live sync via Supabase Realtime (requires broadcast
  infrastructure on engine_state_step)
- **Cascade-wide authority config runtime loader** — hardcoded auth in
  capability for Phase 2, refactor later
- **Reactive framework-propagation** — permanently rejected
- **"Forklart på norsk"** AI plain-language toggle — tab slot reserved but
  disabled
- **Workspace template CRUD** — separate A-spec
- **Native signature pad** — DocuSeal embedded is sufficient
- **Bulk admin bypass** — each bypass must be per-contract
- **Signed contract labor disputes** — out of scope for contract module

---

## Risks (Top 5, Ranked)

1. **PII leakage via engine_memory or tool-echo** (CRITICAL)
   - Mitigation: ADR-0077 sensitivity column + memory-manager redaction +
     tool no-echo contract + PII-never-returned-to-LLM rule

2. **Parallel cascade engine** (CRITICAL)
   - Mitigation: ADR-0076 locks composition as derivation, not parallel
     pipeline. Steward rejects any PR where composition logic lives outside
     cascade derivation path.

3. **Admin loses agency / "magisk UX" legal risk** (HIGH)
   - Mitigation: Per-block acknowledgement (Frontend review non-negotiable).
     Send button stays disabled until all AI-suggested blocks explicitly
     accepted. Reasoning drawer always accessible.

4. **Voice-channel bypass of text-only intake** (HIGH)
   - Mitigation: Triple-layer defence (ADR-0078) — process allowed_channels,
     capability allowedChannels, tool ctx.channel. Unit tests + E2E refusal.
     Never rely on prompt instructions alone.

5. **Compliance drift view performance at scale** (MEDIUM)
   - Mitigation: Materialized view + workspace_id index. If slow at scale,
     switch to async refresh via fire-delayed-triggers instead of direct
     trigger.

---

## Success Criteria

Phase 2 is complete when:

- [ ] All migrations in Phase 2a deployed cleanly to staging
- [ ] `contract_intake` and `contract` capabilities pass prompt-hardening tests
- [ ] Admin can compose a new employment_contract in < 2 minutes from
      `/dashboard/contracts/new`
- [ ] Employee receives data-intake task and completes via mobile in < 5
      minutes
- [ ] Employee can sign embedded DocuSeal from task surface
- [ ] Rights panel renders framework_rule cards for the specific contract
- [ ] Decline button works end-to-end (declined state + admin notification)
- [ ] Admin PII bypass logs to activity_trail + triggers employee
      notification
- [ ] Compliance drift view refreshes when framework_rule changes
- [ ] Re-send after edit creates new row with parent_contract_id lineage
- [ ] All E2E journey tests pass
- [ ] Performance gates green
- [ ] 13 new telemetry events registered and emitted
- [ ] No hardcoded Norwegian, no raw zinc colors, no emojis in UI

## Next Step

Hand off to `writing-plans` skill to produce implementation plan from this
spec. Plan should organize work by Phase 2a-d shipping order and enforce
the blockers listed in Phase 2a as hard prerequisites before Phase 2b starts.
