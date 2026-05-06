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
4. **J4 (notif):** Send contract → query `notification` table for 2 rows (employee + admin) → login as recipient → bell badge increments
5. **J5 (local sign):** With `CONTRACT_LOCAL_SIGN_MODE=true`, navigate `/sign/<token>` → LocalSignForm renders → click employer-button → DB shows `signed_by_employer_at` set, `status` still `sent` → click employee-button → `status='signed'`, `employment_contract.status='active'`
6. **J6 (employer-first enforcement):** With local-sign-mode, click employee-button BEFORE employer → 400 "Lederen må signere først"
7. **J7 (leder-samleside):** Send contract as admin → navigate `/dashboard/contracts/awaiting-my-signature` → row visible → click "Signer nå" → `/sign/<token>` opens

---

## Journey 4: Notifikasjon ved kontrakt-send (Phase 4 — addendum 2026-05-06)

**Roles:** Admin (sender) + Ansatt (recipient)

**Precondition:**
- Workspace har minst 1 admin/owner (sender)
- Ansatt-profil eksisterer (recipient)
- Admin har klikket "Send" via `ContractDispatchDrawer`

### Steps

1. **System (`/api/contracts/send`)** — etter `sendSucceeded === true` og før telemetry-emit
2. **System** lookuper actor's email via `admin.auth.admin.getUserById(user.id)` → `actorEmail`
3. **System** INSERTer 2 rader til `notification`-tabell:
   - Recipient = ansatt: `title: "Du har fått en ny arbeidsavtale"`, `action_url: /dashboard/my-contract`
   - Recipient = admin (sender): `title: "Du må signere arbeidsavtalen"`, `action_url: /dashboard/contracts/awaiting-my-signature`
4. **Ansatt** logger inn → bell-icon viser unread count
5. **Ansatt** klikker bell → ser begge notifs → klikker "Du har fått en ny arbeidsavtale" → navigerer til `/dashboard/my-contract`
6. **Admin** ser sin egen notif på sin bell → klikker → navigerer til `/dashboard/contracts/awaiting-my-signature`

**Postcondition:**
- 2 rader i `notification` med `is_read=false`, `metadata.type='contract_received'` + `'employer_signature_required'`
- Bell-badge oppdateres realtime (Supabase Realtime ikke påkrevd; refresh på client)

**Error paths:**

| Scenario | System response |
|----------|-----------------|
| Notif INSERT fails (RLS / FK) | `console.warn` logged; send-flow continues — non-blocking |
| Recipient profile_id NULL | Step skipped med warn (sjelden — guard at lookup) |
| Admin email lookup fails | `actorEmail` falls back til `"post@smartout.no"`; notif body shows "Local Admin" som default |

---

## Journey 5: Lokal signing-flow (Phase 4 — dev-only)

**Role:** Admin OR Ansatt (begge i samme `/sign/<token>` stub)

**Precondition:**
- `CONTRACT_LOCAL_SIGN_MODE === "true"` i `.env`
- Contract sent (signing_url + signing_contract_id eksisterer)
- Web-server har plukket opp ny env

### Steps

1. **Bruker** navigerer til `/sign/<token>` (kommer enten fra DocuSeal-mail i prod, eller direkte URL i lokal)
2. **System (`page.tsx`)** sjekker `env.CONTRACT_LOCAL_SIGN_MODE` → render `LocalSignForm` istedet for `SigningForm`
3. **LocalSignForm** rendrer:
   - Yellow dev-banner: "Lokal-test-modus — ekte DocuSeal-signering bypassed"
   - Title + recipient email
   - 2 buttons: "Signer som arbeidsgiver" + "Signer som arbeidstaker"
   - A4-canvas contract preview (`dangerouslySetInnerHTML` med resolved_html)
4. **Bruker** klikker "Signer som arbeidsgiver" → POST `/api/contracts/[id]/local-sign` body `{role: "employer", token}`
5. **System** validerer:
   - `env.CONTRACT_LOCAL_SIGN_MODE === "true"` (else 403)
   - Token matches `contract.signing_url` AND `contract.contract_id === id` (else 404)
   - Role er "employer" eller "employee" (else 400)
6. **System** updater:
   - `employment_contract.signed_by_employer_at = now()`
   - INSERT `contract_event` med `actor_type='local_dev'`, `event_type='form_completed'`
7. **Toast** "Arbeidsgiver signert. Arbeidstaker kan nå signere." (still on samme page — full_signed false)
8. **Bruker** klikker "Signer som arbeidstaker" → samme route med `role: "employee"`
9. **System** sjekker `signed_by_employer_at IS NOT NULL` → fortsetter; ellers 400 "Lederen må signere først"
10. **System** updater:
    - `contract.status='signed'`, `contract.signed_at=now()`, `signatories=[...]`
    - `employment_contract.signed_by_employee_at=now()`, `signed_at=now()`, `status='active'`
    - INSERT `contract_event`
11. **System** redirecter til `/sign/success?token=<token>` → "Avtalen er signert!"

**Postcondition:**
- `contract.status='signed'`, `signed_at` populated
- `employment_contract.status='active'`, both `signed_by_*_at` populated
- Bruker ser success-page; D2 cascade aktiveres (profile-status reactions)

**Error paths:**

| Scenario | System response |
|----------|-----------------|
| Employee tries before employer | 400 "Lederen må signere først" — UI viser toast |
| Token-id mismatch | 404 — UI viser "Avtalen er ikke lenger tilgjengelig" |
| Already-signed contract re-clicked | Server returns 200 idempotent OR 400 depending on status; UI navigates regardless |
| `CONTRACT_LOCAL_SIGN_MODE === "false"` (prod) | 403 — UI shows DocuSeal embed instead of LocalSignForm |

**Cascade impact:** Same as DocuSeal real-flow — Phase 4 is dev-only path, schema-state on completion is identical.

---

## Journey 6: Leder ser samleside av ventende signaturer (Phase 4)

**Role:** Admin/owner

**Precondition:**
- Admin har sendt minst 1 kontrakt
- Contract status er `sent` AND `signed_by_employer_at IS NULL`

### Steps

1. **Admin** klikker notif "Du må signere arbeidsavtalen" eller navigerer manuelt til `/dashboard/contracts/awaiting-my-signature`
2. **System (Server Component)** querier `contract` JOIN `employment_contract` WHERE `sender_email = current admin's email AND contract_type='employee'`
3. **System** filtrerer client-side `signed_by_employer_at IS NULL` (PostgREST nested `.is()` upålitelig på joins)
4. **System** rendrer Card-list:
   - Empty state: "Ingen kontrakter venter din signatur" + Inbox-icon
   - Eller én Card per pending contract: ansatt-navn, stilling, sendt-dato, employee-signed badge, "Signer nå"-button
5. **Admin** klikker "Signer nå" → navigerer til `/sign/<signing_url>` → vanlig signing-flow (DocuSeal embed eller LocalSignForm avhengig av env)

**Postcondition:**
- Admin har discoverable kø av sine ventende signaturer
- Etter signering forsvinner row fra listen (ny query post-redirect)

**Error paths:**

| Scenario | System response |
|----------|-----------------|
| Admin har ingen pending-rows | Empty-state Card |
| Admin har ikke sender-email-match (sendt fra anonet konto) | Row-mismatch — ingen rows returneres |
| Contract.status='active' (allerede signert) | Filtrert ut via status-filter |
