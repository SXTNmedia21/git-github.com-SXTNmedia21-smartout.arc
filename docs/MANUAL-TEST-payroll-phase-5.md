---
title: "Manual Test — payroll-phase-5 (PII Reveal + Tax Card)"
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [manual-test, payroll, phase-5, pii, reveal, tax-card, audit, mobile-boundary]
---

# Manual Test — payroll-phase-5

> Branch: `feat/payroll-payroll-phase-2` (combined Phase 2+3+4+5 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1`
> Precondition: Local Supabase running (`npx supabase start` — without `op run` wrap).

---

## Setup

### Required seed data

Before running any test, verify the following exist in local Supabase:

1. **Admin account** — `admin@smartout.local` / `password123` with role=owner or role=admin in the test workspace
2. **Employee account** — `employee@smartout.local` / `password123` with role=employee in the same workspace
3. **Employee profile row** in `public.profile` with:
   - `personal_number` set to a test personnummer (e.g. `12345678901`)
   - `bank_account` set to a test account number (e.g. `12345678903`)
4. **`employee_payroll_profile` row** for the employee profile (required for LonnsprofilSection to load)

If no test PII exists, insert via Supabase Studio:

```sql
UPDATE public.profile
SET personal_number = '12345678901', bank_account = '12345678903'
WHERE id = '<employee-profile-uuid>'
AND workspace_id = '<test-workspace-uuid>';
```

### Required URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3060/dashboard/people/[id]/complete-data` | Admin view of employee data — replace `[id]` with employee profile UUID |
| `http://localhost:3060/dashboard/my-contract` | Employee self-view |
| `http://localhost:8083` | Mobile PWA (employee self-submit) |

---

## Test 1 — Admin reveals personnummer

**Goal:** Admin reveals an employee's personnummer from the Lønnsprofil section; audit row written.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as admin → navigate to `/dashboard/people/{employee-uuid}/complete-data` | Page loads; Lønnsprofil card visible |
| 2 | Scroll to "Høy-PII felt" subsection in the Lønnsprofil card | Shield icon + "Høy-PII felt" heading visible with ADR-0077 badge |
| 3 | Observe Personnummer row | Label "Personnummer" visible; value shows "••••••••"; Eye icon visible |
| 4 | Click the Eye icon next to Personnummer | Spinner (Loader2) appears briefly |
| 5 | Wait for BFF response (< 1s on local) | Full personnummer (11 digits) renders in monospace font |
| 6 | Verify Network tab in DevTools | `POST /api/payroll/reveal-personal-number` → 200 `{ ok: true, value: "...", has_value: true }` |
| 7 | Wait 5 seconds | Value auto-masks back to "••••••••" |
| 8 | Open Supabase Studio → Table editor → `activity_trail` | New row with `event_name = "payroll.personal_number_revealed"`, non-null `workspace_id` + `actor_id` |
| 9 | Verify the value is NOT in the activity_trail row | The `data` column must NOT contain the actual personnummer — only `target_profile_id`, `is_self`, `gate_evaluation_id` |
| 10 | Click Eye icon a second time (within 5s of first reveal) | Value shows immediately (no second BFF call — fetchedValue cached in component state) |

### Expected activity_trail row structure

```json
{
  "event_name": "payroll.personal_number_revealed",
  "entity_type": "employment_contract",
  "entity_id": "<employee-profile-uuid>",
  "workspace_id": "<workspace-uuid>",
  "actor_id": "<admin-profile-uuid>",
  "data": {
    "target_profile_id": "<employee-profile-uuid>",
    "is_self": false,
    "gate_evaluation_id": "<uuid-or-null>"
  }
}
```

---

## Test 2 — Admin reveals bankkonto

**Goal:** Same pattern as Test 1, for the bank account field.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Same setup as Test 1 | Admin on `/dashboard/people/{id}/complete-data` |
| 2 | Scroll to "Høy-PII felt" → Bankkonto row | Label "Bankkonto"; value "••••••••"; Eye icon |
| 3 | Click Eye icon on Bankkonto | Spinner → 11-digit account number renders |
| 4 | Check Network tab | `POST /api/payroll/reveal-bank-account` → 200 |
| 5 | Wait 5 seconds | Value auto-masks |
| 6 | Check activity_trail | Row with `event_name = "payroll.bank_account_revealed"` |
| 7 | Verify "Endre bankkonto" button below the field | Button is disabled (greyed out); tooltip "PII-inntak-flyt ikke tilgjengelig ennå" |

---

## Test 3 — Employee self-reveals at /dashboard/my-contract

**Goal:** Employee sees their own personnummer and bank account in masked/reveal mode on their contract page.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as employee → navigate to `/dashboard/my-contract` | Contract page loads with active contract info |
| 2 | Scroll to "Personlig informasjon" section | Section visible with Personnummer + Bankkonto rows |
| 3 | Observe Personnummer row | "••••••••" masked; Eye icon visible |
| 4 | Click Eye icon | Value reveals immediately (no BFF call — static mode, value in component props) |
| 5 | Verify Network tab | No `POST /api/payroll/reveal-personal-number` call — this page uses static mode |
| 6 | Wait 5 seconds | Auto-masks |
| 7 | Check activity_trail | Row with `event_name = "contract.pii.revealed"` (legacy event name — this surface emits the old event, not the new payroll-typed event; correct per Q4 in PLAN-payroll-phase-5.md) |

**Note on static vs BFF-fetch mode:** The `/dashboard/my-contract` page server-renders the PII values from the employee's own profile and passes them as React props to the RevealableField (static mode). No BFF call occurs on reveal — the reveal is a client-side show/hide of a value already in the component tree. This is distinct from the admin surface (LonnsprofilSection) which uses BFF-fetch mode and never loads the PII value client-side until the admin explicitly clicks reveal.

---

## Test 4 — Cross-workspace reveal rejected

**Goal:** Verify the workspace-scoped forgery defence; admin in workspace A cannot reveal workspace B's PII.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as admin → open DevTools Network tab | Ready |
| 2 | Navigate to any `/dashboard/people/[id]/complete-data` (any valid employee in own workspace) | Page loads |
| 3 | In DevTools Console, run the following: | |
| | `await fetch("/api/payroll/reveal-personal-number", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: "<uuid-of-profile-from-another-workspace>" }), credentials: "include" }).then(r => r.json())` | |
| 4 | Observe response | `{ ok: false, reason: "not_found", detail: null }` — HTTP 404 |
| 5 | Repeat with a completely random UUID that doesn't exist | Same response — identical to step 4 (no existence oracle) |
| 6 | Check activity_trail | Row with `event_name = "payroll.personal_number_revealed"`, `entity_id = <forged-uuid>`, `actor_id = <admin-profile>` — the attempt IS audited even on rejection |
| 7 | Verify no PII returned | Response body contains no `value` field on `ok: false` responses |

**How to get a workspace-B profile UUID for testing:** insert a second workspace via Supabase Studio and create a test profile in it, or use a randomly generated v4 UUID (it will return the same `not_found` response in either case).

---

## Test 5 — Admin enters tax card manually

**Goal:** Admin fills in the tax-card form and values persist after reload.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as admin → navigate to `/dashboard/people/{id}/complete-data` | Lønnsprofil card loads |
| 2 | Scroll to "Skattekort" subsection | Section visible with "Manuell inntasting" badge |
| 3 | Note current values (likely all empty: "—") | Skattekorttype "—", Kortår "—" |
| 4 | Click "Rediger" button in the Lønnsprofil card header | Form enters edit mode; Skattekorttype becomes a dropdown |
| 5 | Select "Trekkprosent" from Skattekorttype dropdown | "Trekkprosent (%)" field appears |
| 6 | Set Kortår to "2026" | Input accepts the value |
| 7 | Set Trekkprosent to "35" | Input accepts the value |
| 8 | Click "Lagre" | Toast "Lønnsprofil oppdatert" appears; editing mode exits |
| 9 | Verify VIEW mode shows saved values | Skattekorttype: "Trekkprosent"; Trekkprosent: "35 %"; Kortår: "2026" |
| 10 | Reload the page | Values persist — fetched from DB on reload |
| 11 | Check activity_trail | Row with `event_name = "payroll.update_payroll_profile"` |
| 12 | Check "Sist oppdatert" row in the Skattekort section | Shows today's timestamp (tax_card_fetched_at was set by upsertLonnsprofil) |

**Variant — table-based tax card:**
- Step 5: select "Trekktabell" → "Skattetabellnummer" field appears instead of Trekkprosent
- Enter "7100" in Skattetabellnummer
- Save → VIEW shows "Trekktabell", "7100"

**Variant — frikort:**
- Select "Frikort" → neither Trekkprosent nor Skattetabellnummer appears
- Set Kortår, save → VIEW shows "Frikort"

---

## Test 6 — Zod refinement validation errors

**Goal:** Verify that invalid tax-card combinations are blocked with Norwegian error messages.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Enter edit mode for the Lønnsprofil card | Form editable |
| 2 | Select "Trekkprosent" from Skattekorttype | Trekkprosent field appears |
| 3 | Set Kortår: "2026" | Valid |
| 4 | Clear Trekkprosent field (leave empty) | Empty |
| 5 | Click "Lagre" | Red error banner appears: "Trekkprosent (0–100) er påkrevd ved prosent-skattekort" |
| 6 | Editing mode NOT cleared — form still visible | User can fix the value |
| 7 | Now fill Trekkprosent: "150" (invalid — above 100) | Still invalid |
| 8 | Click "Lagre" | Same error shown (0–100 range check) |
| 9 | Repeat with Skattekorttype="Trekktabell", set Skattetabellnummer to "71" (only 2 digits) | Error: "Skattetabellnummer må være 4 sifre ved tabellskattekort" |
| 10 | Repeat with any type set but Kortår = "2099" (out of range) | Error: "Kortår (årstall) er påkrevd ved skattekortendring (2024–2035)" |

---

## Test 7 — Mobile own-data: no PII reveal surface exists by design

**Goal:** Confirm mobile (PWA port 8083) has no PII reveal interaction — only PII submission.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start mobile PWA: `pnpm --filter @smartout/mobile dev` → open `http://localhost:8083` | App loads |
| 2 | Log in as employee | Employee home screen |
| 3 | Navigate to Meg tab → Contract or Profile | Employee sees their profile information |
| 4 | Verify: there is NO "Vis personnummer" / reveal button on mobile | Correct — no reveal surface on mobile by design (ADR-0133 + TE Path A) |
| 5 | Navigate to the PII submission flow (if accessible): tap "Fullfør profil" or equivalent | `(me)/contract/complete-data.tsx` loads |
| 6 | Observe: the screen shows input fields for entering personnummer, NOT a reveal interaction | Correct — this is the submit_own_pii flow, not a reveal |
| 7 | Verify there is no "Vis bankkonto" or reveal-style Eye icon on any mobile screen | Correct |

**ADR reference:** ADR-0133 ("mobile executes") — mobile's PII role is to submit (write) via `submit_own_pii` RPC. Review (reveal, mask/unmask) is a web-only pattern. This is not a bug; it is the designed boundary.

---

## Notes for operator

- **Local Supabase required:** Run `npx supabase start` without `op run` wrap (op run corrupts column names in type-gen; also not needed for DB auth).
- **Mobile testing is PWA on port 8083.** Never use QR scan / Expo Go / iOS simulator for this feature.
- **`tax_municipality_code` not in form:** If you need to verify that field, use Supabase Studio direct edit. The UI form omits it due to type-gen lag (see HANDOFF carry-forward).
- **PostHog exclusion verification:** To verify that PII reveal events do NOT appear in PostHog, check the PostHog EU dashboard under `smartout.ai` project — you should see NO events named `payroll.personal_number_revealed` or `payroll.bank_account_revealed`. The telemetry registry explicitly excludes these from PostHog destinations (ADR-0077).
- **5-second auto-mask is not configurable.** The `REVEAL_DURATION_MS = 5000` constant in `RevealableField.tsx:27` is hard-coded. A second click within the 5-second window hides immediately.
- **Reveal cache:** After first reveal click, the fetched value is cached in React state. If the admin clicks reveal again without reloading the page, no BFF call fires. This is expected and intentional (de-duplicates audit events within a single session view).
