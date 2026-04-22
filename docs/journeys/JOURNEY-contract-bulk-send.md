---
title: User Journeys — Contract Bulk-Send
status: verified
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [contracts, bulk-send, templates, maler, journey]
verified_by: council-gate-3 2026-04-22
verified_note: BulkSendDrawer + POST /api/employment-contracts/bulk route live on feat/contract-hub-redesign; E2E spec exists (apps/e2e/tests/contracts/bulk-send.spec.ts). Known deferred: metadata.batch_id column + contract.bulk_send_initiated event (Phase 3b backlog).
---

# User Journeys — Contract Bulk-Send

> Council 2026-04-22 resolution Q5: template-first entry remains SECONDARY to employee-first, exposed via the `Maler` tab as bulk-send. Admin picks a template → selects N employees → composition drawer iterates through each. Solves the legit use case where workspace rolls out a new contract to a cohort (e.g. new deltid agreement to all deltid-ansatte).

## Roles

- **Admin / Owner** — can trigger bulk-send on any published workspace template
- **Manager** — cannot trigger bulk-send (`Maler` tab hidden per role matrix)
- **Employee** — receives individual contracts; unaware of bulk origin
- **Botsson** — can suggest bulk-send but cannot autonomously execute (requires UI confirmation per employee or batch ack)

---

## Journey 1: Admin triggers bulk-send from Maler tab

**Precondition:** Admin on `Maler` tab; at least one published workspace template exists; at least one employee eligible (matches employment_category binding).

1. Admin clicks the `Maler` tab on `/dashboard/contracts`
2. Admin selects a published template in the left zone
3. Workbench right zone renders with `Send til ansatte…` action in the top-right header (only visible when `published_at IS NOT NULL AND deprecated_at IS NULL`)
4. Admin clicks `Send til ansatte…`
   → System opens bulk-send drawer (Sheet, 640px, glass surface)
   → Drawer header: Instrument Serif `Send kontrakt til flere ansatte`
   → Subtitle: Geist Sans `{template_name} — {employment_category} · v{version}`
5. Drawer step 1: employee selection
   → Virtualized employee list filtered to those matching template's employment_category
   → Each row: checkbox, Instrument Serif name, Geist Mono role · department
   → Status chips right-aligned:
     - `Har aktiv kontrakt` (muted) — blocks selection
     - `Mangler personalia` (amber hue 50) — proceeds but flags intake required
     - `Klar til send` (brand hue 40 subtle) — can proceed immediately
   → Header: search + `Velg alle kvalifiserte` ghost button
6. Admin selects checkboxes (e.g. 12 employees)
   → Footer summary updates live: `12 valgt · 3 mangler personalia · 0 har aktive kontrakter`
   → `Neste: gjennomgang` button enables
7. Admin clicks `Neste: gjennomgang`
   → Drawer step 2: batch review
   → Shows template preview (read-only, first employee's placeholders resolved for reference)
   → Shows send-plan table: per-employee row with `status`, `channel`, `auto_intake` flag
   → Confirmation: `Du sender {template_name} til 12 ansatte. 3 vil motta intake-forespørsel. Fortsett?`
8. Admin clicks `Send kontrakter`
   → System fires bulk mutation: `POST /api/employment-contracts/bulk` with `{ template_id, profile_ids: [...] }`
   → Route validates admin/owner role (user-scoped client)
   → Route iterates profile_ids serially (not parallel — to respect contract-service rate limits):
     - For each profile: compose via `resolveComposition` → insert `employment_contract` row → create `contract` signing row → call contract-service `POST /contracts/[id]/send`
     - Partial success tracked per profile
   → Route emits `contract.bulk_send_initiated` event with `workspace_id`, `template_id`, `profile_count`, `actor_id`
   → Route emits `contract created` + `contract sent` per successful profile (existing telemetry)
9. Drawer step 3: results
   → Progress bar during send (live via Server-Sent Events or polling)
   → Each row updates: ✓ sent | ✗ failed (reason)
   → Final state: summary `11 sendt · 1 feilet (se detaljer)`
   → `Lukk` + `Se alle kontrakter` buttons
10. Admin clicks `Se alle kontrakter` → navigates to `Kontrakter` tab with filter `batch_id={just_created}` showing the 11 sent contracts

**Postcondition:** N contracts created and dispatched via DocuSeal. Partial failures surfaced inline. Admin can act on failed ones individually.

**Error paths:**
- Admin not admin/owner: route returns 403 before any insert
- Template deprecated mid-flow: drawer renders deprecated-banner, admin must re-confirm
- Contract-service timeout on individual contracts: that profile marked failed, rest proceed
- Contract-service down entirely: route returns 503 before any insert (atomic check)
- Employee list empty: `Neste` button disabled with tooltip
- Admin closes drawer mid-send: mutation continues server-side (not cancelled); admin sees results on next `Kontrakter` tab visit
- Partial bulk with mixed PII completeness: `Mangler personalia`-employees get `pending_data` status + intake process; others get `sent` status

---

## Journey 2: Admin resumes a failed bulk-send

**Precondition:** Bulk-send initiated; some contracts failed (e.g. contract-service timeout for 3 of 12).

1. Admin on `Kontrakter` tab sees bucket `waiting_employee` = 8 signed, `ready_for_action` = 3 (draft, never dispatched)
2. Admin filters by `batch_id` (set on `employment_contract.metadata.batch_id` by bulk mutation)
3. Admin sees the 3 failed contracts in draft state
4. Admin can:
   - Select individual row → opens standard `CompositionDrawer` preloaded with this contract → clicks `Send` to retry
   - Select all → click `Send valgte` → retries in parallel (via existing multi-action UI on data table)
5. System fires `POST /api/employment-contracts/[id]/send` per contract
6. Success: status transitions to `sent`; failed: stays in `draft` with error message

**Postcondition:** Failed contracts retried individually or in batch; no data lost from bulk-send failure.

**Error paths:**
- Same error again: admin escalates to support or waits for contract-service recovery
- Contract was in `draft` too long (>24h): optional policy to auto-void draft (not implemented in Phase 1)

---

## Journey 3: Botsson suggests bulk-send

**Precondition:** Admin engaging Botsson; workspace has a published template that matches a cohort of employees.

1. Admin says: `Alle deltid-ansatte skal ha ny kontrakt med den nye riksavtalen`
2. Botsson intent classifier → `contract` capability (chat-channel only per ADR-0078)
3. Tool selector surfaces `suggest_bulk_send` tool at `suggest` authority
4. Botsson proposes: `Jeg foreslår å sende 'Arbeidsavtale — Deltid v2' til 12 deltid-ansatte. Vil du se oversikten før vi sender?`
5. Admin says yes
   → Botsson opens bulk-send drawer with pre-filled template + pre-selected matching employees
   → Admin reviews, confirms, sends per Journey 1
6. Botsson does NOT autonomously send without UI confirmation (even at `autonomous` authority — bulk-send irreversibility per send requires explicit admin ack)

**Postcondition:** Botsson routed admin to the right flow; admin remains in control of the send action.

**Error paths:**
- Authority level too low (`read_only`): tool not surfaced
- Botsson attempts direct execute bypass: route returns 400 `bulk_send requires UI confirmation` (defense-in-depth)

---

## Cross-cutting concerns

### Performance gates

- Bulk-send serial iteration must complete within 60s for 20 employees — asserted via `apps/e2e/tests/performance-gates.spec.ts`
- Progress updates streamed via polling (1s interval) — no SSE dependency in Phase 1
- Failure rate threshold: if >50% of profiles fail in a batch, route aborts remaining and returns 500 with partial results

### Telemetry (Gate G2 additions)

- `contract.bulk_send_initiated` — new event, emitted once per batch with `profile_count`, `template_id`
- `contract.bulk_send_completed` — new event, emitted at batch end with `success_count`, `failed_count`
- Plus existing `contract created` + `contract sent` per individual success

### Idempotency

- `POST /api/employment-contracts/bulk` accepts optional `idempotency_key` header
- Key scoped to `(workspace_id, template_id, profile_ids hash)`
- Duplicate request within 24h returns cached batch result

### Authority

- Admin/owner required (same as individual send)
- Route rejects if `profile_ids.length > 100` (hard cap to prevent runaway batches)

### State ownership

| State | Source | Mutated by |
|---|---|---|
| `employment_contract.metadata.batch_id` | Bulk mutation | Set once on insert |
| `employment_contract.status` | per-contract | Normal contract lifecycle (sent → viewed → signed etc.) |
| `contract.status` | per-contract | Normal contract lifecycle |
| Bulk progress state | transient | Route-level only; not persisted to DB |

### Scope boundary

- Bulk-send is workspace-scoped; platform admin does not have bulk-send surface (platform flow is curation, not dispatch)
- Mobile has NO bulk-send surface (ADR-0133 — mobile executes, does not author or dispatch)
- Bulk-send does NOT bypass composition validation — each individual compose runs `resolveComposition`, respects `compliance_overrides`, and can fail on blockers
- Bulk-send does NOT send to employees without email — profiles missing email are filtered at step 1 with tooltip

### Integration with intake flow

- Profiles with missing PII get `pending_data` status and trigger `contract_data_intake` engine_process (per existing `JOURNEY-contract-composition-engine.md` + `JOURNEY-contract-system-phase2-3.md` Feature 2)
- Bulk-send does NOT block on PII — mixed cohort of `ready_to_send` + `pending_data` is expected and handled per profile

### Known debt

- Serial execution limits throughput — future: bounded parallelism (e.g. 5 concurrent) with rate-limit backoff
- No way to schedule bulk-send for a future time in Phase 1 (e.g. "send all contracts at midnight")
- No cohort save/load — admin re-selects employees every time; saved cohorts (`employee_group` integration) deferred
- Progress UI via polling not SSE — migrate when streaming infra is established
