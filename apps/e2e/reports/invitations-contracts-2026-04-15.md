---
title: E2E audit — Invitations + Employment Contracts
status: draft
updated: 2026-04-15
created: 2026-04-15
module: e2e
tags: [e2e, invitations, contracts, docuseal, audit]
---

# E2E audit — Invitations + Employment Contracts

Addendum to the ongoing E2E coverage push. Scope: regression coverage for
employee invitation creation/acceptance and for the employment contract
creation + send lifecycle.

## What was added

Two new journey specs in `apps/e2e/tests/`:

| Spec | Surface |
|------|---------|
| `journey-employee-invitation.spec.ts` | `create-invitation` Edge Function + UI dialog at `/dashboard/people` + `accept-invitation` error paths + non-admin authz |
| `journey-employee-contract-e2e.spec.ts` | `POST /api/employment-contracts?persist=true` → `POST /api/contracts` → `POST /api/contracts/[id]/send` → employee `/dashboard/my-contract` |

Both specs follow the existing style (service-role DB assertions via
`helpers/seed.ts`, telemetry via `helpers/telemetry.ts`, serial describe blocks).

## Existing coverage audited

Before writing these specs I reviewed:

- `apps/e2e/tests/contracts-api.spec.ts` — **unit-scope** checks on `POST /api/contracts` for schema shape (B1 regression: `overrides` vs `field_values`) and auth gates. Uses placeholder UUIDs, does not exercise DB persistence.
- `apps/e2e/tests/contract-composition/happy-path.spec.ts` — **UI-scope** wizard flow (5-step) and employee contract view. Happy-path oriented, gracefully skips derivation failures.
- `apps/e2e/tests/journey-onboarding-step-contract.spec.ts` — part of onboarding flow, not a standalone contract lifecycle test.
- `apps/e2e/tests/contract-composition/` — single spec (`happy-path.spec.ts`).

No overlap on invitations — there is no existing invitation spec file (despite the
`invite/[token]` route and `create-invitation` function being long-present).

## What the new specs add

### Invitation spec
- Direct `create-invitation` Edge Function call using admin access token (bypasses UI hydration flake).
- DB shape assertions on `public.invitation` (workspace_id, company_id, email, status, token, expires_at).
- UI-driven invitation through `/dashboard/people` Invite dialog with DB verification poll.
- Error paths:
  - Missing `email` on email-channel invite → 400.
  - Expired token → `accept-invitation` returns 404/410.
  - Already-accepted token → 404.
  - Non-admin caller (Anna the employee) → rejected with permissions error.
- Telemetry check for `invitation created` in `activity_trail` with documented
  "telemetry-gap" annotation if the registry doesn't route the event.

### Contract spec
- Full path through: compose (`/api/employment-contracts`) → DocuSeal draft (`/api/contracts`) → send (`/api/contracts/[id]/send`).
- Verifies `employment_contract.status='draft'` after create.
- Verifies `contract.status='draft'` after DocuSeal row creation.
- Verifies send returns 202 and transitions to `sent` OR `queued` (degraded path when contract-service is down).
- Error path: sending non-draft rejected with 400.
- Error path: missing required fields on compose rejected by Zod with 400.
- Employee-side view — `/dashboard/my-contract` renders either hero card or empty state.
- Telemetry checks for `contract created` and `contract sent`.

## Gaps NOT closed

- **DocuSeal webhook round-trip** — we never drive a DocuSeal `submission.completed` webhook back into the system. Signing → `signed_at` transition is not covered. The existing `happy-path.spec.ts` explicitly `test.skip`s this; we retain that boundary.
- **SendGrid email dispatch** — `create-invitation` calls SendGrid if `SENDGRID_API_KEY` is set; test runs assume the key is absent in dev and the function logs and continues. No HTTP mock for SendGrid.
- **Twilio SMS** — same: `sendSmsInvite` is never exercised.
- **Resend / cancel invitation** — the `resendInvitation` / `cancelInvitation` server actions in `people-actions.ts` are not covered. Candidate for a follow-up spec.
- **PII intake flow (ADR-0077)** — when `pii_complete=false`, the send route forks into a `contract_data_intake` engine state with day 3/7/10 escalations. We do not exercise this branch; covering it requires seeding a profile without `personal_number`.
- **Contract revise / regenerate** — `/api/employment-contracts/[id]/revise` and `/regenerate` not touched.
- **Idempotency guard** — the "signing_contract_id already set → return success" short-circuit is not explicitly tested (would need an existing signed contract in seed data).
- **E-mail channel payload contents** — we do not snapshot the outgoing SendGrid body.
- **Activity-trail negative assertions** — we don't assert that `contract sent` is NOT emitted when send fails; the route emits regardless which may itself be a finding to investigate in a follow-up.

## Services required to run

| Service | Required for | Start command |
|---------|--------------|---------------|
| Supabase local | All DB + Edge Function calls | `npx supabase start` |
| Next.js `web` | Invitation UI + contracts routes | `pnpm --filter @smartout/web dev` (port 3060) — Playwright `webServer` auto-starts |
| contract-service (5012) | Happy-path `contract sent` status | `cd infra && docker compose up -d contract-service` — if unreachable, tests take the documented degraded path and still pass |

Contract-service requires `CONTRACT_SERVICE_URL` + `CONTRACT_SERVICE_KEY` (1Password `op://smartout_ai/…`) + DocuSeal sandbox creds. When missing, route returns `status: "queued"` with `send_error` populated — spec handles this.

## DocuSeal mocking approach

- `page.route("**/docuseal.co/**", fulfill-mock)` is registered before the send call. This only catches **browser-originated** requests.
- The actual DocuSeal request happens server-side (Next → contract-service → DocuSeal) and cannot be intercepted from Playwright.
- Safety net: we rely on contract-service being absent from local dev (degraded path = no external call). When the service *is* running, it should point at DocuSeal sandbox credentials, never production.
- Full DocuSeal mocking would require either (a) a WireMock/MSW-like HTTP proxy at the contract-service level, or (b) an env flag in contract-service to skip upstream calls. Neither exists today — recommend ADR to add `CONTRACT_SERVICE_MOCK=1` toggle.

## Known flakes / expected skips

- `admin creates invitation via UI` — skips if dashboard redirects to `/setup`/`/onboarding`. The setup wizard skip helper in `helpers/auth.ts` sometimes loses against race conditions; this is already a known flake seen in other UI specs.
- `admin creates draft employment_contract via API` — skips if `workspace_framework_binding` is missing from seed (same failure mode documented in `contract-composition/happy-path.spec.ts`).
- `admin creates contract draft via POST /api/contracts` — skips if no `contract_template` where `contract_type='employee'` is seeded.
- `admin sends draft contract` — asserts `queued` when contract-service is offline, `sent` when online. Will false-positive-`sent` if contract-service responds OK but DocuSeal call silently fails upstream (we don't verify `docuseal_submission_id` because the column exists on `contract` metadata, not as a first-class column in all schema versions).
- `non-admin caller cannot create invitation` — skips if Anna's credentials are not in seed.

## Pass/skip expectations on a clean local stack

With `npx supabase start` + `pnpm --filter @smartout/web dev` and contract-service **offline**:

| Test | Expected outcome |
|------|------------------|
| invitation — Edge Function create | pass (telemetry may annotate a gap) |
| invitation — UI create | pass (unless setup wizard races) |
| invitation — invalid email | pass |
| invitation — expired token | pass |
| invitation — already-accepted token | pass |
| invitation — non-admin gate | pass |
| contract — compose persist | pass OR skip if framework binding missing |
| contract — POST /api/contracts | pass OR skip if template missing |
| contract — send (queued) | pass, status=queued |
| contract — non-draft rejected | pass |
| contract — Zod gate | pass |
| contract — employee my-contract | pass (either hero or empty state) |

## Changes to app code

None. No files under `apps/web/`, `packages/`, or `services/` were modified.
All changes are confined to `apps/e2e/tests/` and `apps/e2e/reports/`.

## Next steps

1. Add resend-invitation + cancel-invitation coverage (server actions in `people-actions.ts`).
2. Add PII-incomplete branch coverage for the send route (engine_state = `contract_data_intake`).
3. ADR for `CONTRACT_SERVICE_MOCK=1` toggle so DocuSeal can be locked out cleanly.
4. Investigate whether `create-invitation` and send routes emit telemetry reliably to `activity_trail` — two `telemetry-gap` annotations in the specs should be diagnosed.
