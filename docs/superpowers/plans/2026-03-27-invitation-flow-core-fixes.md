---
title: "Invitation Flow — Core Fixes Implementation Plan"
status: draft
updated: 2026-03-27
created: 2026-03-27
module: onboarding
tags: [plan, invitation, auth, security, email]
---

# Invitation Flow — Core Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the critical invitation path work end-to-end: Admin invites → Email arrives → User clicks link → User is in the app.

**Architecture:** 4 targeted fixes to existing Edge Functions + accept page + 1 new migration. No new tables, no new packages. RPC replaces direct table query for security. Batch dispatch added to existing function.

**Tech Stack:** Supabase Edge Functions (Deno), Next.js App Router, PostgreSQL RPC, SendGrid

**Spec:** `docs/superpowers/specs/2026-03-27-invitation-flow-core-fixes.md`

---

## Task Order

Tasks are ordered by dependency:

1. **Task 1: Migration** (RPC + policy drop) — must exist before page.tsx changes
2. **Task 2: Fix 4** (profile status) — standalone, no dependencies
3. **Task 3: Fix 1** (batch dispatch) — standalone, no dependencies
4. **Task 4: Fix 3 + Fix 2** (accept page rewrite) — depends on Task 1 (RPC must exist)

Tasks 2 and 3 can run in parallel. Task 4 depends on Task 1.

---

### Task 1: Migration — RPC + RLS Policy Fix

**Files:**

- Create: `supabase/migrations/20260327120000_invitation_rls_rpc.sql`

This migration creates the `get_invitation_by_token` RPC and drops the insecure `USING(true)` anon SELECT policy.

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260327120000_invitation_rls_rpc.sql`:

```sql
-- Drop the insecure blanket anon SELECT policy on invitation table.
-- This policy allowed any anonymous user to SELECT all invitation rows
-- including PII (email, phone, names, workspace IDs).
-- Replaced by get_invitation_by_token() RPC for token-scoped lookups.
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitation;

-- RPC: get_invitation_by_token
-- Used by the /invite/[token] accept page to fetch invitation details.
-- SECURITY DEFINER so it can read invitation table and auth.users without RLS.
-- Token (UUID, 122-bit entropy) acts as authorization — no JWT needed.
-- Non-pending invitations return status only (no PII exposure).
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  inv_status text;
BEGIN
  SELECT i.status INTO inv_status
  FROM invitation i
  WHERE i.token = p_token;

  IF inv_status IS NULL THEN
    RETURN NULL;
  END IF;

  IF inv_status != 'pending' THEN
    RETURN json_build_object('status', inv_status);
  END IF;

  SELECT json_build_object(
    'invitation_id', i.invitation_id,
    'email', i.email,
    'phone', i.phone,
    'first_name', i.first_name,
    'last_name', i.last_name,
    'role', i.role,
    'status', i.status,
    'expires_at', i.expires_at,
    'workspace_name', w.name,
    'inviter_name', p.display_name,
    'email_account_exists', EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.email = lower(i.email)
    )
  ) INTO result
  FROM invitation i
  LEFT JOIN workspace w ON w.workspace_id = i.workspace_id
  LEFT JOIN profile p ON p.profile_id = i.invited_by
  WHERE i.token = p_token;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated;
```

- [ ] **Step 2: Run migration against local Supabase**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260327120000_invitation_rls_rpc.sql
```

Expected: No errors. The function is created and the policy is dropped.

- [ ] **Step 3: Verify RLS is tightened**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT policyname FROM pg_policies
  WHERE tablename = 'invitation'
  ORDER BY policyname;
"
```

Expected: The policy `"Anyone can read invitation by token"` should NOT appear. Other admin policies should still be listed.

- [ ] **Step 4: Verify RPC works**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT get_invitation_by_token('00000000-0000-0000-0000-000000000000'::uuid);
"
```

Expected: Returns `NULL` (no invitation with that token).

- [ ] **Step 5: Regenerate database types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260327120000_invitation_rls_rpc.sql packages/supabase/src/database.types.ts
git commit -m "fix(invitation): replace USING(true) RLS with token-scoped RPC

Drop insecure anon SELECT policy that exposed all invitation PII.
Create get_invitation_by_token() SECURITY DEFINER RPC for accept page.
Non-pending invitations return status only (no PII).
Includes email_account_exists for existing-user detection.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Fix 4 — Profile Status Set Active Directly

**Files:**

- Modify: `supabase/functions/accept-invitation/index.ts`

- [ ] **Step 1: Change profile insert status from trainee to active**

In `supabase/functions/accept-invitation/index.ts`, find line 309:

```typescript
        status: "trainee",
```

Change to:

```typescript
        status: "active",
```

- [ ] **Step 2: Remove employee promotion to active**

Find and delete the block at lines 393-397:

```typescript
// 5c. Promote profile to active (payroll profile created = operational employee)
await adminClient.from("profile").update({ status: "active" }).eq("profile_id", profile.profile_id);
```

- [ ] **Step 3: Remove guest promotion to active**

Find and delete the block at lines 398-403 (after the previous deletion, these lines shift up):

```typescript
    } else {
      // Guest invite: set active directly, no contract/payroll
      await adminClient
        .from("profile")
        .update({ status: "active" })
        .eq("profile_id", profile.profile_id);
    }
```

Replace the deleted `} else { ... }` with just a closing brace for the `if (isEmployee)` block. The result should be:

```typescript
if (isEmployee) {
  // 5a. Create draft employment_contract
  const startDate = (meta.start_date as string) || new Date().toISOString().split("T")[0];
  const { data: contract } = await adminClient.from("employment_contract");
  // ... existing contract insert code ...

  // 5b. Create employee_payroll_profile from template or metadata
  // ... existing payroll insert code ...
}
// Guest path: no contract/payroll needed, profile already created as active
```

- [ ] **Step 4: Verify the file is syntactically correct**

```bash
cd supabase/functions && deno check accept-invitation/index.ts 2>&1 | head -20
```

Expected: No syntax errors. (Type errors from imports may appear in local dev — that's OK for Deno Edge Functions.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/accept-invitation/index.ts
git commit -m "fix(invitation): set profile status to active directly

Remove trainee→active two-step. Profile was never observable as trainee.
Trainee mode will be driven by engine_process when built.
Saves one DB round-trip per invitation acceptance.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Fix 1 — Batch Invite Email Dispatch

**Files:**

- Modify: `supabase/functions/create-invitation/index.ts`
- Modify: `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`

- [ ] **Step 1: Add skip_dispatch flag and email dispatch to handleBatchInvites**

In `supabase/functions/create-invitation/index.ts`, modify the `handleBatchInvites` function.

First, update the function signature to accept `skip_dispatch`:

Find:

```typescript
async function handleBatchInvites(
  supabaseClient: ReturnType<typeof createClient>,
  user: { id: string },
  body: {
    workspace_id: string;
    company_id: string;
    invites: Record<string, unknown>[];
  },
) {
```

Replace with:

```typescript
async function handleBatchInvites(
  supabaseClient: ReturnType<typeof createClient>,
  user: { id: string },
  body: {
    workspace_id: string;
    company_id: string;
    invites: Record<string, unknown>[];
    skip_dispatch?: boolean;
  },
) {
```

- [ ] **Step 2: Add email dispatch after successful insert**

Find the return statement in `handleBatchInvites` (around line 102):

```typescript
  return new Response(
    JSON.stringify({
      success: true,
      count: insertedInvites.length,
      invitations: insertedInvites,
    }),
```

Replace with:

```typescript
  // Dispatch emails unless skip_dispatch is set (CSV import skips dispatch)
  let dispatched = 0;
  let dispatchFailed = 0;

  if (!body.skip_dispatch) {
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.smartout.ai";
    const dispatchResults = await Promise.allSettled(
      insertedInvites
        .filter((inv: { email: string | null }) => inv.email)
        .map((inv: { email: string; token: string }) => {
          const inviteUrl = `${siteUrl}/invite/${inv.token}`;
          return sendEmailInvite(inv.email, inviteUrl, body.workspace_id);
        }),
    );

    dispatched = dispatchResults.filter((r) => r.status === "fulfilled").length;
    dispatchFailed = dispatchResults.filter((r) => r.status === "rejected").length;
  }

  return new Response(
    JSON.stringify({
      success: true,
      count: insertedInvites.length,
      dispatched,
      failed: dispatchFailed,
      invitations: insertedInvites,
    }),
```

- [ ] **Step 3: Update invite-member-dialog to pass skip_dispatch for CSV**

In `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`, find the batch invoke call (around line 365):

```typescript
response = await supabase.functions.invoke("create-invitation", {
  body: {
    workspace_id: workspaceData.workspace_id,
    company_id: workspaceData.company_id,
    invites: inviteRecords,
  },
});
```

Replace with:

```typescript
response = await supabase.functions.invoke("create-invitation", {
  body: {
    workspace_id: workspaceData.workspace_id,
    company_id: workspaceData.company_id,
    invites: inviteRecords,
    skip_dispatch: mode === "csv",
  },
});
```

- [ ] **Step 4: Update the toast to reflect dispatch results**

Find the toast at line 405:

```typescript
toast.success(rows.length === 1 ? "Invitasjon sendt" : `${rows.length} invitasjoner sendt`);
```

Replace with:

```typescript
if (mode === "csv") {
  toast.success(`${rows.length} invitasjoner importert`);
} else {
  const data = response.data as { dispatched?: number; failed?: number; count?: number } | null;
  const dispatched = data?.dispatched ?? 0;
  const failed = data?.failed ?? 0;
  if (failed > 0) {
    toast.warning(`${dispatched} invitasjoner sendt, ${failed} feilet`);
  } else {
    toast.success(dispatched === 1 ? "Invitasjon sendt" : `${dispatched} invitasjoner sendt`);
  }
}
```

- [ ] **Step 5: Verify syntax**

```bash
cd supabase/functions && deno check create-invitation/index.ts 2>&1 | head -20
```

And:

```bash
pnpm --filter web typecheck 2>&1 | tail -20
```

Expected: No errors related to the changed files.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/create-invitation/index.ts apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx
git commit -m "fix(invitation): dispatch emails in batch invite mode

Batch handleBatchInvites() now sends emails via SendGrid after insert.
CSV import passes skip_dispatch: true to suppress email sending.
Response includes dispatched/failed counts. Toast reflects actual results.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fix 3 + Fix 2 — Accept Page RPC + Existing User Detection

**Files:**

- Modify: `apps/web/src/app/invite/[token]/page.tsx`

This task rewrites the accept page to:

1. Use the RPC from Task 1 instead of direct table query
2. Detect existing users and show sign-in form instead of create-account form

- [ ] **Step 1: Replace the invitation fetch with RPC call**

In `apps/web/src/app/invite/[token]/page.tsx`, find the `fetchInvite` function inside useEffect (around line 51-103):

```typescript
    async function fetchInvite() {
      const { data, error: fetchError } = await supabase
        .from("invitation")
        .select(
          `email, phone, first_name, last_name, role, status, expires_at,
           workspace:workspace_id(name),
           inviter:invited_by(display_name)`,
        )
        .eq("token", token)
        .single();
```

Replace the entire `fetchInvite` function with:

```typescript
async function fetchInvite() {
  const { data, error: rpcError } = await supabase.rpc("get_invitation_by_token", {
    p_token: token,
  });

  if (rpcError || !data) {
    setInviteState({ status: "invalid", message: "Invitasjonen ble ikke funnet" });
    return;
  }

  // Non-pending invitations return only { status }
  if (data.status !== "pending") {
    setInviteState({
      status: "invalid",
      message:
        data.status === "accepted"
          ? "Denne invitasjonen er allerede brukt"
          : "Denne invitasjonen er ikke lenger gyldig",
    });
    return;
  }

  if (new Date(data.expires_at) < new Date()) {
    setInviteState({ status: "invalid", message: "Denne invitasjonen har utlopt" });
    return;
  }

  // Pre-fill known fields
  if (data.first_name) setFirstName(data.first_name);
  if (data.last_name) setLastName(data.last_name);
  if (data.email) setEmail(data.email);
  if (data.phone) setPhone(data.phone);

  setInviteState({
    status: "valid",
    data: {
      email: data.email,
      phone: data.phone,
      firstName: data.first_name,
      lastName: data.last_name,
      workspaceName: data.workspace_name ?? "en arbeidsplass",
      role: data.role,
      inviterName: data.inviter_name ?? null,
      emailAccountExists: data.email_account_exists ?? false,
    },
  });
}
```

- [ ] **Step 2: Update InviteData type to include emailAccountExists**

Find the `InviteData` type:

```typescript
type InviteData = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  workspaceName: string;
  role: string;
  inviterName: string | null;
};
```

Replace with:

```typescript
type InviteData = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  workspaceName: string;
  role: string;
  inviterName: string | null;
  emailAccountExists: boolean;
};
```

- [ ] **Step 3: Add existing-user sign-in state**

After the existing state declarations (around line 47), add:

```typescript
const [isExistingUser, setIsExistingUser] = useState(false);
```

And in the section after `setInviteState({ status: "valid", ... })` in the fetchInvite function, after the state is set, the `isExistingUser` will be derived from the data. Actually, derive it from the invite data in the render:

No extra state needed — use `inviteState.status === "valid" && inviteState.data.emailAccountExists` directly in the JSX.

- [ ] **Step 4: Update handleSubmit to handle existing user sign-in**

Replace the entire `handleSubmit` function with:

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);

  if (!firstName.trim() || !lastName.trim()) {
    setError("Fullt navn er pakrevd");
    return;
  }

  if (!email.trim()) {
    setError("E-post er pakrevd");
    return;
  }

  const isExisting = inviteState.status === "valid" && inviteState.data.emailAccountExists;

  if (isExisting) {
    // Existing user: sign in with password
    if (!password) {
      setError("Passord er pakrevd");
      return;
    }

    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Feil passord. Prov igjen.");
      setIsSubmitting(false);
      return;
    }

    // Now call accept-invitation with the auth session
    const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
      body: {
        token,
        first_name: firstName,
        last_name: lastName,
        email: email.trim(),
        phone: phone.trim() || undefined,
      },
    });

    if (fnError || !data?.success) {
      setError(data?.error ?? fnError?.message ?? "Kunne ikke godta invitasjonen");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  } else {
    // New user: create account + accept
    if (!phone.trim()) {
      setError("Telefonnummer er pakrevd");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passordene er ikke like");
      return;
    }

    if (password.length < 8) {
      setError("Passordet ma vaere minst 8 tegn");
      return;
    }

    setIsSubmitting(true);

    const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
      body: {
        token,
        first_name: firstName,
        last_name: lastName,
        email: email.trim(),
        phone: phone.trim(),
        password,
      },
    });

    if (fnError || !data?.success) {
      setError(data?.error ?? fnError?.message ?? "Kunne ikke godta invitasjonen");
      setIsSubmitting(false);
      return;
    }

    if (data?.message === "Already a member of this workspace") {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Sign in with newly created credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Konto opprettet, men innlogging feilet. Ga til innloggingssiden.");
      setIsSubmitting(false);
      return;
    }

    const wsName = inviteState.status === "valid" ? inviteState.data.workspaceName : "";
    const welcomeParams = new URLSearchParams({
      workspace: wsName,
      name: firstName,
    });
    router.push(`/welcome?${welcomeParams.toString()}`);
    router.refresh();
  }
}
```

- [ ] **Step 5: Update the form JSX to show different forms for new vs existing users**

In the form section, replace the entire `<form>` content (the section inside `<form className="space-y-5" onSubmit={handleSubmit}>`) with a conditional render:

```tsx
<form className="space-y-5" onSubmit={handleSubmit}>
  {invite.emailAccountExists ? (
    <>
      {/* Existing user: sign-in flow */}
      <div className="rounded-xl bg-[oklch(0.97_0.006_55)] px-4 py-3">
        <p className="text-sm text-[oklch(0.42_0.01_52)]">
          Du har allerede en Smartout-konto. Logg inn for a godta invitasjonen.
        </p>
      </div>

      {/* Name fields — editable so invitee can confirm */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
            Fornavn
          </label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
            Etternavn
          </label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Email — read-only for existing users */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
          E-post
        </label>
        <input
          type="email"
          required
          value={email}
          readOnly
          className={`${inputClass} cursor-not-allowed bg-[oklch(0.97_0.006_55)]`}
        />
      </div>

      {/* Password for sign-in */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
          Passord
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="Ditt eksisterende passord"
        />
      </div>
    </>
  ) : (
    <>
      {/* New user: create account flow (existing form) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
            Fornavn
          </label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            placeholder="Kari"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
            Etternavn
          </label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
            placeholder="Nordmann"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
          E-post
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="kari@example.com"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
          Telefon
        </label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          placeholder="+47 900 00 000"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
          Opprett passord
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="Minst 8 tegn"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-[oklch(0.52_0.01_52)] uppercase">
          Bekreft passord
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
          placeholder="Gjenta passord"
        />
      </div>
    </>
  )}

  {error && (
    <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {error}
    </div>
  )}

  <div className="pt-2">
    <button
      type="submit"
      disabled={isSubmitting}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSubmitting ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <CheckCircle2 className="h-5 w-5" />
          {invite.emailAccountExists ? "Logg inn og godta" : "Godta invitasjon"}
        </>
      )}
    </button>
  </div>
</form>
```

- [ ] **Step 6: Verify typecheck**

```bash
pnpm --filter web typecheck 2>&1 | tail -30
```

Expected: No type errors in the changed file. (Existing errors in other files are pre-existing.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/invite/\\[token\\]/page.tsx
git commit -m "fix(invitation): use RPC for token lookup + existing user sign-in

Replace direct table query with get_invitation_by_token RPC (security fix).
Detect existing users via email_account_exists flag from RPC.
Existing users see sign-in form instead of create-password form.
New users see the same form as before.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck 2>&1 | tail -30
```

Expected: 0 errors (or only pre-existing errors unrelated to invitation files).

- [ ] **Step 2: Verify the accept page renders locally**

Start the dev server if not running:

```bash
pnpm --filter web dev &
```

Open `http://localhost:3060/invite/00000000-0000-0000-0000-000000000000` in a browser.
Expected: Shows "Invitasjonen ble ikke funnet" (invalid token).

- [ ] **Step 3: Verify admin invitation still works**

Open `http://localhost:3060/dashboard/people` (logged in as admin).
Expected: The people table loads. The "Invite" button opens the dialog. No console errors.

- [ ] **Step 4: Verify RLS is locked down**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SET ROLE anon;
  SELECT count(*) FROM invitation;
"
```

Expected: Returns 0 rows or permission denied (anon can no longer read invitation table directly).

- [ ] **Step 5: Final commit if any fixups needed**

Only if previous steps revealed issues that needed fixing.
