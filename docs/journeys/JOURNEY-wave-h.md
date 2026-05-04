---
title: "User Journeys — Wave H Auth & Invitation Refactor"
status: done
updated: 2026-04-22
created: 2026-04-22
module: auth
tags: [journey, invitation, auth, wave-h, route-handlers]
---

# User Journeys — Wave H Auth & Invitation Refactor

> **Scope.** Wave H eliminated the browser → Edge Function pattern for invitation creation. The deleted `supabase/functions/create-invitation/index.ts` (~561 LOC) was replaced by:
>
> - Route handler `apps/web/src/app/api/admin/invite/route.ts` (Next.js Node runtime, same-origin)
> - Shared library `apps/web/src/lib/invitations.ts` (`createInvitation()` + Zod schemas)
> - Single dispatch surface `@smartout/notifications` (`sendEmailBatch`, `sendSms`)
> - Telemetry via `@smartout/telemetry` `emit()` to all 4 destinations per registry contract
>
> The accept side (`/invite/[token]` page + `accept-invitation` Edge Function) is **unchanged** — see [`employee-invitation-accept.md`](./employee-invitation-accept.md). Per ADR-0179 (browser → route handler), ADR-0180 (engine_event parity), ADR-0123 amendment (tripwire 3 → 2), ADR-0029 amendment (mutation surface), ADR-0045 clarification (single dispatch surface).

---

## Journey: Admin Invites Single Employee via Email

**Precondition:** Admin is signed in to the dashboard and has admin/owner role in the workspace. `/dashboard/people` is open with `InviteMemberDialog` available.

1. Admin clicks **"Inviter ansatt"** → `InviteMemberDialog` opens (`apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx:594-760`). The dialog hydrates any localStorage draft (`apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx:259-285`) so an accidental close never loses input.
2. Admin types **fornavn**, **etternavn**, **e-post** and selects **rolle** (`employee` / `manager` / `admin`) → System validates client-side via `validateRow` (`invite-member-dialog.tsx:166-180`) — fornavn, etternavn and a valid e-post are required when the email channel is active.
3. Admin toggles the **E-post** channel button on (the **Lenke** channel is always on, locked) → `channels` Set updates in component state (`invite-member-dialog.tsx:210-218`); `email` field is rendered (`invite-member-dialog.tsx:869-882`).
4. Admin clicks **"Send invitasjon"** → Client builds a `SingleInviteSchema` payload and calls `fetch("/api/admin/invite", { method: "POST", body: JSON.stringify(...) })` (`invite-member-dialog.tsx:434-461`). No `Authorization` header is set — the session cookie is sent same-origin.
5. Route handler receives the POST → `runtime="nodejs"` + `maxDuration=60` apply per Trust Gate condition #5 (`apps/web/src/app/api/admin/invite/route.ts:34-35`). Body is detected as single (no `invites[]` array) and parsed via `SingleInviteSchema.safeParse` (`route.ts:78-90`).
6. Route handler invokes `withWorkspaceAdmin(workspaceId, …)` (`route.ts:94-143`) → SECURITY DEFINER `is_admin_in_workspace()` RPC verifies the JWT-scoped user is admin/owner of `workspace_id`. Inside the gate, `inviter profile_id` is resolved from `profile` table (`route.ts:100-113`) — **not** `user_id`, because `invitation.invited_by` is a profile FK.
7. Route handler calls `createInvitation(single, profile.profile_id, client)` (`route.ts:140`) → `apps/web/src/lib/invitations.ts:138-297`:
   - Resolves `workspace.company_id` + `workspace.name` (`invitations.ts:146-156`).
   - INSERTs row into `invitation` with `invite_type="link"`, `status="pending"`, `metadata.channels=["email"]`, `invited_by=profile.profile_id` (`invitations.ts:166-189`).
   - Emits `"invitation created"` to all 4 destinations with `token_preview` censored to first 8 chars per ADR-0167 (`invitations.ts:199-219`).
   - Renders the email body via `renderInvitationEmail()` (`invitations.ts:97-119`) and dispatches via `sendEmailBatch([{ email, subject, html }])` from `@smartout/notifications` (`invitations.ts:225-243`).
   - Pushes outcome `{ channel: "email", outcome: "sent" | "failed" }` to results array.
   - Pushes `{ channel: "link_only", outcome: "sent" }` for the always-on link channel (`invitations.ts:262-264`).
   - Emits `"invitation dispatched"` once per outcome (`invitations.ts:267-289`).
   - Returns `{ invitation_id, token, invite_url, outcomes }`.
8. Route handler returns `200 OK` with the `InvitationResult` JSON → Client receives `response.data` with the new `token` (`invite-member-dialog.tsx:472-474`).
9. Client builds `inviteUrl = ${origin}/invite/${token}` and calls `setGeneratedLink(inviteUrl)` → `GeneratedLinkView` renders with copy button (`invite-member-dialog.tsx:536-550`, `1209-1260`). Toast confirms `"Invitasjon opprettet (e-post + lenke)"`.
10. `resetAfterSuccess()` clears the localStorage draft and the form state (`invite-member-dialog.tsx:299-310`); `onRefresh()` re-queries the invitation list so the new row appears.

**Postcondition:** A `pending` row exists in `invitation` with `metadata.channels=["email"]`. SendGrid has accepted the email payload via `sendEmailBatch`. Telemetry registry has 1× `"invitation created"` event and 2× `"invitation dispatched"` events (one per channel) in PostHog + activity_trail + engine_event + Logger. Admin sees the invite link in the dialog and the new row in the list.

**Error paths:**

- **Not signed in / session expired** → `withWorkspaceAdmin` returns `code: "unauthorized"` → Route handler returns `403` with `{ error, code }` (`route.ts:145-149`). Client throws `Error(errBody.error)` (`invite-member-dialog.tsx:467-470`) → Toast: `"Kunne ikke opprette invitasjoner"`.
- **Not an admin in the target workspace** → `withWorkspaceAdmin` returns `code: "not_workspace_admin"` → Route returns `403`. Client toast as above.
- **Invalid payload (missing fornavn, malformed email)** → `SingleInviteSchema.safeParse` fails → Route returns `400` with `{ error: "Validation failed", details: zodFlattened }` (`route.ts:85-90`). Client toast.
- **Workspace lookup fails inside `createInvitation`** → Throws `Error("Workspace not found …")` (`invitations.ts:151-156`) → Caught by the route handler's try/catch → Returns `500` with the error message (`route.ts:152-158`).
- **`sendEmailBatch` returns `sent: 0`** → Outcome recorded as `{ channel: "email", outcome: "failed", reason }` (`invitations.ts:236-242`) but the route still returns `200` with the invitation row + token. Admin still sees the invite link and can copy it manually. Telemetry `"invitation dispatched"` carries the failure reason.
- **`emit()` throws** → Caught and logged (`console.error`) but never blocks the response (`invitations.ts:217-219, 286-288`). The invitation row exists; only the audit trail is degraded.

---

## Journey: Admin Invites Batch (Multiple Rows via CSV)

**Precondition:** Admin is signed in, has admin/owner role, has a CSV file with at least `fornavn`, `etternavn`, `e-post` columns.

1. Admin clicks **"Importer CSV"** in the dialog footer → File picker opens (`invite-member-dialog.tsx:677-684, 740-746`).
2. Admin selects file → Papa Parse reads it and shows the column-mapping dialog (`invite-member-dialog.tsx:314-339`). Admin maps CSV headers to system fields (firstName / lastName / email / phone / departmentId).
3. Admin confirms mapping → `handleMappingConfirm` builds `InviteRow[]` and switches `mode` to `"csv"` (`invite-member-dialog.tsx:341-386`). Each row is validated with `validateRow(row, new Set(["email"]))` — batch mode forces email-only validation.
4. `CsvImportView` renders the table of parsed rows with per-row error chips (`invite-member-dialog.tsx:1089-1205`).
5. Admin clicks **"Send {N} invitasjoner"** → Client calls `validateRow` again for every row, blocks submit if any row has errors → Toast `"Rett opp feil før du sender invitasjoner"` (`invite-member-dialog.tsx:401-413`).
6. Client builds the batch payload `{ workspace_id, company_id, invites: [...], skip_dispatch: true }` and POSTs to `/api/admin/invite` (`invite-member-dialog.tsx:476-506`). **`skip_dispatch: true` is the CSV-mode default** — CSV import creates rows without sending emails so the admin can review before dispatching.
7. Route handler detects `Array.isArray(body.invites)` → Validates with `BatchPayloadSchema` (`route.ts:52-59, 78-90`). `company_id` in the payload is **accepted but ignored** — the lib resolves it from `workspace_id` (`route.ts:54-56`).
8. Route handler runs `withWorkspaceAdmin` once for the whole batch, resolves `inviter profile_id` once, then **loops `createInvitation` per row** (`route.ts:115-136`). For each row, channels are picked by `pickChannelsForBatchRow`:
   - `skip_dispatch === true` → `["link"]` only (no email or SMS sent).
   - else if `row.email` → `["email"]`.
   - else if `row.phone` → `["sms"]`.
   - else → `["link"]`.
9. Each row's `createInvitation` call inserts its own `invitation` row + emits its own `"invitation created"` and `"invitation dispatched"` events. Results are accumulated into `invitations: InvitationResult[]`.
10. Route returns `200 OK` with `{ invitations: [...] }` (one entry per submitted row) → Client toast `"{N} invitasjoner importert"` (`invite-member-dialog.tsx:553-554`).

**Postcondition:** `N` rows exist in `invitation`, all `pending`, all `metadata.channels=["link"]` when CSV was used (because `skip_dispatch=true`). No emails sent. `2N` telemetry events emitted (`N×"invitation created"` + `N×"invitation dispatched"` with `channel="link_only"`). Admin sees `"{N} invitasjoner importert"` and can dispatch later via resend.

**Partial failure semantics — IMPORTANT:**

The route handler **does not** wrap the per-row loop in a try/catch (`route.ts:117-135`). If any single `createInvitation` call throws (e.g. workspace row vanished mid-batch, or `invitation` INSERT fails), the loop **breaks immediately**, the outer try/catch returns `500`, and **no per-row results are returned to the client**. The earlier rows that succeeded **remain inserted** — the route does not roll them back. The admin sees `Toast: "Kunne ikke opprette invitasjoner"` with no breakdown of which rows succeeded.

This is a known limitation. There is no `Promise.allSettled` and no per-row outcome reporting on the batch path. Wave I or a follow-up should address this if partial-success UX is required.

**Error paths:**

- **Auth failure** → Same as single-invite: `403` from `withWorkspaceAdmin`.
- **Validation failure on the batch envelope** (e.g. `invites: []`, missing `workspace_id`) → `400` with Zod flattened details.
- **Mid-batch exception** → As above, `500` with no per-row breakdown. Earlier successful rows are NOT rolled back. Admin should reload the people page to see what landed.
- **Email parse error in CSV** → Caught at parse time by `Papa.parse` `error` callback → Toast `"Kunne ikke lese filen. Sjekk at det er en gyldig CSV-fil."` (`invite-member-dialog.tsx:333-335`).

---

## Journey: Admin Resends Invitation (Server Action Path)

**Precondition:** Admin is signed in and viewing the `InvitationStatusList`. A `pending` invitation row exists for the workspace. Admin clicks **"Send på nytt"** on a row.

1. Client invokes the `resendInvitation(workspaceId, invitationId)` Server Action (`apps/web/src/app/dashboard/people/_actions/people-actions.ts:395-501`). Because this is a Server Action, it executes server-side directly — **no `fetch` round-trip to `/api/admin/invite`**, and no JSON serialization of the payload.
2. Action SELECTs the original invitation by id, requiring `status='pending'` (`people-actions.ts:402-413`). Pulls every field needed to re-issue with full fidelity: `email, phone, first_name, last_name, role, department_ids, team_ids, invite_type, invite_employment_type, metadata`.
3. Action defensively rejects `system` role rows (`people-actions.ts:417-419`).
4. Action UPDATEs the original row to `status='cancelled'` **before** creating the new one (`people-actions.ts:423-428`) so a mid-flow failure leaves the original cancelled rather than two pending rows.
5. Action resolves the inviter's workspace-scoped `profile_id` from `profile` (same pattern as the route handler — invitation provenance is workspace-scoped per ADR-0123) (`people-actions.ts:430-446`).
6. Action picks channels: `metadata.channels` if present, else falls back to legacy `invite_type` (`"sms"`, `"link"`, or default `"email"`) (`people-actions.ts:448-459`).
7. Action falls back to `"Invitee" / "Pending"` for missing first/last name (historic rows lacked them) (`people-actions.ts:462-464`) — the lib requires non-empty strings.
8. Action calls `createInvitation(input, inviterProfile.profile_id)` directly — **same shared library as the route handler** (`people-actions.ts:484`). `createInvitation` runs steps 7a–7e of "Admin Invites Single Employee via Email" above: INSERT row, emit `"invitation created"`, dispatch via `sendEmailBatch`/`sendSms`, emit `"invitation dispatched"` per outcome.
9. Action emits an additional `"invitation resent"` event carrying the **original** `invitation_id` (`people-actions.ts:490-498`). The new `invitation_id` is captured separately by the lib's `"invitation created"` emit. This preserves resend as a distinct queryable event.
10. Action returns the `InvitationResult` to the client → Caller refreshes the list; the cancelled row + new pending row both appear.

**Postcondition:** Original invitation has `status='cancelled'`. A new `pending` invitation exists with the same email/role/department/metadata. Email/SMS dispatched per the original channels. Telemetry: 1× `"invitation created"`, 1+× `"invitation dispatched"` (per outcome), 1× `"invitation resent"` (with the **original** id, not the new one).

**Why Server Action, not route handler?**

A Server Action already runs server-side with the user's JWT context. There is no browser → server boundary to cross — the workspace membership check is in scope, and `createInvitation` can be called directly. Routing through `/api/admin/invite` would mean: serialize args → HTTP POST → deserialize → re-resolve session cookie → re-resolve profile → call lib. The shared library design (single chokepoint) means both surfaces produce identical telemetry and identical DB state.

**Error paths:**

- **Original row not pending or not found** → Throw `"Invitation not found or already accepted/cancelled"` (`people-actions.ts:411-413`).
- **Original row has `system` role** → Throw `"Cannot resend invitation for system role"` (`people-actions.ts:417-419`).
- **Cancel UPDATE fails** → Throw the underlying error (`people-actions.ts:428`). New invitation NOT created.
- **Inviter profile lookup fails** → Throw `"Inviter profile not found in workspace"` (`people-actions.ts:444-446`). Original is already cancelled — admin must create a fresh invite manually.
- **`createInvitation` throws** → Bubbles up. Original is already cancelled — the row is gone, but no new row exists. Admin must create a fresh invite.

---

## Journey: Admin Invites via SMS

**Precondition:** Admin is signed in, has admin/owner role, has the invitee's phone number in international format (e.g. `+47 900 00 000`).

1. Admin opens `InviteMemberDialog` and toggles the **SMS** channel button on (`invite-member-dialog.tsx:836-866`). The phone input field appears (`invite-member-dialog.tsx:884-897`).
2. Admin types phone number → Client validates that the field is non-empty when SMS channel is active (`invite-member-dialog.tsx:175-177`). **Note:** there is no client-side phone-format validation — any non-empty string passes validation. Format is forwarded as-is to Twilio via `sendSms`. Twilio rejects malformed numbers at dispatch.
3. Admin submits → Same fetch to `/api/admin/invite` with `channels: ["sms", "link"]` (or `["email", "sms", "link"]` if email is also on) and `phone: r.phone.trim()` (`invite-member-dialog.tsx:434-461`).
4. Route handler runs `withWorkspaceAdmin` and calls `createInvitation` exactly as the email path.
5. Inside `createInvitation`, the SMS branch fires (`invitations.ts:245-259`):
   - Builds body: `"You've been invited to join ${workspace.name} on Smartout. Accept here: ${inviteUrl}"`.
   - Calls `sendSms(input.phone, body)` from `@smartout/notifications`.
   - On `result.sent > 0`: pushes `{ channel: "sms", outcome: "sent" }`.
   - Else: pushes `{ channel: "sms", outcome: "failed", reason: result.errors[0]?.error ?? "send_failed" }`.
   - On exception: catches and pushes `{ channel: "sms", outcome: "failed", reason }`.
6. `"invitation dispatched"` event emitted with `channel: "sms"` and the outcome.
7. Route returns `200 OK` with the invitation row → Client toast `"Invitasjon opprettet (SMS + lenke)"`.

**Postcondition:** Invitation row exists with `metadata.channels` including `"sms"`. Twilio has accepted (or rejected) the SMS payload. Telemetry includes the SMS outcome.

**Error paths:**

- **Twilio rejects malformed phone** → `sendSms` returns `sent: 0` with an error → Recorded as `"failed"` outcome with the Twilio reason. Route still returns `200` — invitation row + link exist, admin can copy the link as fallback.
- **Twilio key missing** → `sendSms` throws → Caught at `invitations.ts:255-258`, recorded as failed outcome.
- **Phone field empty client-side** → Submit button is disabled (`invite-member-dialog.tsx:716-718`).

---

## Journey: Admin Avoids CORS Failure (Pre-Wave-H Contrast — Educational)

> This is not a runtime journey; it is the architectural reason `/api/admin/invite` exists. Future devs should understand why before reverting to the simpler `supabase.functions.invoke()` pattern.

**Pre-Wave-H (deleted):**

1. Admin clicks "Send invitasjon" → Client calls `supabase.functions.invoke("create-invitation", { body: ... })` → SDK issues a `POST` to `https://<project>.supabase.co/functions/v1/create-invitation`.
2. Browser performs **CORS preflight**: `OPTIONS` request with `Origin: https://app.smartout.ai` → Edge Function must respond with the right `Access-Control-Allow-Origin` header.
3. **Failure modes observed pre-Wave-H:**
   - Wildcard `*` CORS leaked credentials in some browser/extension combos → cookies not sent, JWT lost.
   - Edge Function cold-start could exceed the preflight timeout in some regions → POST never fires, no error surface beyond `Failed to fetch`.
   - Telemetry `emit()` from inside the Edge Function bypassed 2 of 4 destinations — `engine_event` and Logger were never written for invitations created from the browser path. (See L-0103.)

**Post-Wave-H:**

1. Admin clicks "Send invitasjon" → Client calls `fetch("/api/admin/invite", ...)` → Same-origin POST. **No preflight.** Session cookie sent automatically.
2. Route handler runs in Vercel Node runtime, calls `@smartout/telemetry` `emit()` which writes to all 4 destinations per the registry contract (ADR-0180 parity).
3. CORS issue eliminated. Telemetry parity restored. Trust Gate condition #4 (engine_event parity test) lands `GREEN`.

**See ADRs:** ADR-0179 (the pattern), ADR-0180 (engine_event parity), ADR-0029 amendment (mutation surface table), ADR-0045 clarification (single dispatch surface).

---

## Journey: Employee Accepts Invitation (Delegated — Unchanged)

This flow is **unchanged by Wave H**. The accept side still uses the `accept-invitation` Edge Function because:

- **Pre-auth surface:** the invitee has no JWT — the token in the URL is the credential (token-as-auth, ADR-0167).
- **Mobile dependency:** `apps/mobile/app/(auth)/verify.tsx:289` still calls the Edge Function directly during mobile sign-up. ADR-0123 keeps `accept-invitation` on the pre-workspace exception list (tripwire ratcheted from 3 → 2 endpoints in Wave H).

For the full acceptance journey (new user, existing user, error paths, RLS policies), see [`employee-invitation-accept.md`](./employee-invitation-accept.md). For the post-fix variant covering RLS, password setup, and the `email_account_exists` discriminator, see [`JOURNEY-invitation-rls-fix.md`](./JOURNEY-invitation-rls-fix.md).

---

## File reference index

| Surface | File | Lines |
|---|---|---|
| Route handler | `apps/web/src/app/api/admin/invite/route.ts` | 1–159 |
| Shared lib | `apps/web/src/lib/invitations.ts` | 1–297 |
| Browser caller (dialog) | `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx` | 394–588 (submit), 434, 482, 497 (fetch sites) |
| Server Action (resend) | `apps/web/src/app/dashboard/people/_actions/people-actions.ts` | 395–501 |
| Auth gate | `apps/web/src/lib/billing/withAdmin.ts` | `withWorkspaceAdmin` |
| Notifications | `@smartout/notifications` | `sendEmailBatch`, `sendSms` |
| Telemetry | `@smartout/telemetry` | `emit()` registry routing |
| Parity test | `packages/telemetry/src/__tests__/parity.test.ts` | engine_event contract |
| Handoff (source of truth) | `docs/HANDOFF-wave-h.md` | full Wave H scope |
