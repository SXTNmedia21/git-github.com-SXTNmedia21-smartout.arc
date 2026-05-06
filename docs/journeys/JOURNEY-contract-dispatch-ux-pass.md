---
title: "Journey — Contract Dispatch UX Pass"
feature: contract-dispatch-ux-pass
status: verified
updated: 2026-05-06
created: 2026-05-06
module: contract
linear: SMA-303, SMA-305, SMA-307
tags: [journey, contract, dispatch, popup, preview-edit, prod-safety]
---

# Journey: Contract Dispatch UX Pass — 3 sub-journeys

3 ticket-aligned journeys på samme dispatch-overflate.

---

## Journey 1: Admin redigerer kontrakt-tekst i preview før send (SMA-303)

**Role:** Admin (workspace owner)

**Precondition:**
- `employment_contract` exists with status `draft` for target ansatt
- Template + binding seeded (per SMA-309)
- Admin opens `ContractDispatchDrawer` from `/dashboard/contracts`

### Steps

1. **Admin** velger mal i Step 1 → klikker "Neste" → Step 2 mounter
2. **System** loader template HTML + resolved placeholders → renders i `ContractPreviewEditor` med `mode="edit"`
3. **Admin** redigerer tekst direkte i preview (Tiptap editor) — f.eks. legger til ekstra klausul, retter typo, tilpasser per ansatt
4. **System** capturer `editor.getHTML()` på hver edit → `setEditedHtml(html)` state
5. **Admin** klikker "Jeg har lest gjennom" → `pdfPreviewViewedAt` settes (per ADR-0244)
6. **Admin** acker 4 blokker → klikker "Send til signering"
7. **System** sender POST `/api/contracts/send` med `resolved_html: editedHtml`
8. **System (`SendBodySchema`)** aksepterer `resolved_html?` (ADR-0151 verifiserer workspace, sanitiserer via eksisterende `sanitize-html` allowlist)
9. **System** sender `editedHtml` til contract-service som `resolved_html`-override
10. **DocuSeal** mottar editert HTML → ansatt signerer på det Admin redigerte

**Postcondition:**
- `contract.resolved_html` matcher Admin's editerte versjon
- `framework_snapshot` JSONB inneholder hash av editert HTML (SMA-310 prereq)
- Telemetry: `contract.preview.edited` + `contract.send_initiated`

**Error paths:**

| Scenario | System response |
|----------|-----------------|
| Sanitize stripper Tiptap custom node | Server logger warning, sender stripped HTML — admin må verifisere via PDF preview før Aml. §14-5 ack |
| Edit etter PDF-view-ack | UI invaliderer ack, krever ny "Jeg har lest gjennom" (hash mismatch) |
| Network feil ved send | Toast error, edit-state preserveres i drawer-state |

---

## Journey 2: Admin fyller manglende ansatt-info i popup ved kontrakt-send (SMA-305 Flow A)

**Role:** Admin (workspace owner)

**Precondition:**
- Admin prøver å sende kontrakt for ansatt som mangler PII (personnummer ELLER bank ELLER adresse) eller ansettelse-felt (`agreed_weekly_hours` etc.)
- Ingen `employment_contract` med `status='draft'` eller `pending_data` finnes for target

### Steps

1. **Admin** klikker "Send til signering" i `ContractDispatchDrawer`
2. **System** kaller `/api/contracts/send` → `resolveComposition()` returnerer `placeholder_status.missing[]` ikke-tom
3. **System** returnerer 422 med:
   ```json
   {
     "error": "missing_employment_data",
     "user_message_no": "Mangler 5 felt for å kunne sende kontrakt",
     "missing_fields": [
       { "field": "personal_number", "label_no": "Personnummer", "section": "personal_info", "tier": "høy" },
       { "field": "agreed_weekly_hours", "label_no": "Ukentlig arbeidstid", "section": "ansettelse", "tier": "lav" }
     ]
   }
   ```
4. **Drawer** detekterer 422 + `missing_fields[]` → åpner `MissingInfoSheet` (nested popup eller swap stage)
5. **MissingInfoSheet** rendrer alle felt som inputs, gruppert per `section`, med tier-indikator (Høy = lock-icon + advarsel)
6. **Admin** fyller inn felt → for Høy-PII får advarsel-modal: "Bekreft at ansatt har gitt eksplisitt tillatelse — dette logges i audit-trail"
7. **Admin** klikker "Fyll inn" → POST `/api/contracts/admin-fill-pii`
8. **Backend** kaller `admin_submit_employee_pii(workspace_id, target_profile_id, field_group, values)` RPC:
   - SECURITY DEFINER + locked search_path (L-0172)
   - Verifiserer `auth.uid()` er admin/owner (`is_admin_in_workspace()`)
   - Verifiserer target_profile er i samme workspace (ADR-0151, L-0177 fail-fast)
   - Skriver til `profile`-tabellen med audit-trail
   - Emit `payroll.admin_filled_pii` per felt
9. **MissingInfoSheet** lukker → drawer auto-retry POST `/api/contracts/send` med samme params
10. **System** validerer på nytt → `placeholder_status.missing` tom → fortsetter til DocuSeal-dispatch
11. **Admin** ser toast "Kontrakt sendt"

**Postcondition:**
- Manglende felt utfylt på `profile` med admin-attribusjon
- `activity_trail` har rad per Høy-PII-felt med `admin_actor_id` + `target_profile_id` + begrunnelse
- Kontrakt sendt
- Telemetry: `contract.send_blocked.missing_fields` + `payroll.admin_filled_pii` × N + `contract.send_retry_after_fill`

**Error paths:**

| Scenario | System response |
|----------|-----------------|
| Admin avbryter `MissingInfoSheet` | Drawer forblir på Step 2; missing fields banner vises; admin kan retry når som helst |
| Validering feiler (personnummer mod 11) | Inline error, `MissingInfoSheet` forblir åpen |
| Admin er ikke admin/owner | RPC returnerer "Forbidden — admin rolle påkrevd"; toast viser melding |
| Cross-workspace target | RPC returnerer "Profilen tilhører ikke ditt arbeidsområde" (ADR-0151 + L-0177); toast viser melding |
| "Be ansatt fylle ut selv"-knapp | (SMA-312 — out of scope; viser "Kommer snart" disabled-knapp) |

---

## Journey 3: Admin sender kontrakt når contract-service er nede (SMA-307)

**Role:** Admin (workspace owner)

**Precondition:**
- `employment_contract` `status='draft'`
- `contract-service` Docker-container nede ELLER nettverksfeil mot service
- `NODE_ENV=production` (eller `CONTRACT_SERVICE_DEV_FALLBACK !== "true"`)

### Steps

1. **Admin** klikker "Send til signering" → POST `/api/contracts/send`
2. **System** prøver `callContractService('/contracts')` + `/contracts/:id/send` → fail (timeout, 502, ECONNREFUSED)
3. **System (etter SMA-307 fix)** sjekker:
   ```ts
   const isDev = process.env.NODE_ENV !== "production";
   const fallbackEnabled = process.env.CONTRACT_SERVICE_DEV_FALLBACK === "true";
   if (!sendSucceeded && (!isDev || !fallbackEnabled)) {
     return NextResponse.json({
       error: "Kontrakt-tjenesten er utilgjengelig. Prøv igjen om 1 minutt eller kontakt support.",
       code: "CONTRACT_SERVICE_DOWN"
     }, { status: 503 });
   }
   ```
4. **Drawer** mottar 503 → toast.error med tydelig melding + retry-knapp
5. **Admin** kan klikke "Prøv igjen" om 1 min — IKKE fake-success med `/walt/sign-dev/`-link i prod
6. **Admin** kontakter support / venter på service-recovery
7. **System** logger feil til Sentry / structured logger → ops-alert ved 503-rate > 1/min

**Postcondition:**
- `employment_contract.status` IKKE flippet til `sent` ved service-feil
- Ingen stub-`contract`-rad i DB
- Telemetry: `contract.send_initiated` IKKE emit ved fail (eller emit med `outcome: "service_down"`)
- Audit-trail intakt — admin kan re-prøve etter recovery

**Dev-fallback (når aktivert):**

| Scenario | System response |
|----------|-----------------|
| `NODE_ENV !== "production"` AND `CONTRACT_SERVICE_DEV_FALLBACK === "true"` | Walt-stub fortsetter å virke for E2E-test mot dev uten contract-service |
| `NODE_ENV === "production"` AND `CONTRACT_SERVICE_DEV_FALLBACK === "true"` | Walt-fallback IKKE aktivert (prod overrider env-flag) |

**Error paths:**

| Scenario | System response |
|----------|-----------------|
| Dev mode uten fallback-flag | Returner 503 (samme som prod) — admin må sette flag eksplisitt |
| Service recovers mid-retry | Vanlig flow — ingen lekkasje av stub-data |

---

## Cross-cutting

**Telemetry events** (alle nye må registreres i `packages/telemetry/src/registry.ts`):

| Event | Routing | Fra |
|---|---|---|
| `contract.preview.edited` | PostHog + activity_trail | SMA-303 |
| `contract.send_blocked.missing_fields` | PostHog + activity_trail + engine_event | SMA-305 |
| `payroll.admin_filled_pii` | PostHog + activity_trail | SMA-305 |
| `contract.send_retry_after_fill` | PostHog | SMA-305 |
| `contract.send_failed.service_down` | PostHog + sentry | SMA-307 |

**Cascade-touchpoints:**

| Cascade dimension | Affected |
|---|---|
| K1b (workspace_framework_binding) | Read-only |
| D2 (profile, employment_contract) | Write — admin-fill RPC writes profile fields |
| C4 (engine_authority_config) | Read — `is_admin_in_workspace()` check |

## Manual test cases

After deploy, verify each journey end-to-end:

1. **J1:** Edit preview text → send → query `contract.resolved_html` matches edited
2. **J2:** Pick employee w/ no PII → send → fill in popup → re-send → success
3. **J3:** Stop contract-service docker → send in dev w/o fallback flag → 503; set flag → walt success; verify `NODE_ENV=production` overrides flag
