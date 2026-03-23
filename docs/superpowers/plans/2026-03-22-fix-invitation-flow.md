# Fix Invitation Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 identified gaps in the user invitation and registration flow to ensure data integrity, scalability, and complete admin functionality.

**Architecture:** All fixes target existing Edge Functions (`accept-invitation`, `create-invitation`), one new migration for RLS + resend support, and a server action for the resend UI. No new tables or major schema changes.

**Tech Stack:** Supabase Edge Functions (Deno), PostgreSQL migrations, Next.js server actions, TypeScript

---

## File Structure

| File                                                                  | Action | Responsibility                                                        |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `supabase/functions/accept-invitation/index.ts`                       | Modify | Add company_member upsert, replace listUsers() with email lookup      |
| `supabase/migrations/YYYYMMDDHHMMSS_fix_invitation_gaps.sql`          | Create | company_member INSERT RLS policy, expired invitation cleanup function |
| `apps/web/src/app/dashboard/people/_actions/people-actions.ts`        | Modify | Add `resendInvitation` server action                                  |
| `apps/web/src/app/dashboard/people/_components/people-data-table.tsx` | Modify | Wire resend handler to server action                                  |
| `supabase/functions/create-invitation/index.ts`                       | Modify | Add resend mode (cancel old + create new + dispatch)                  |

---

### Task 1: Fix accept-invitation — Replace listUsers() with email lookup

**Why:** `listUsers()` fetches ALL auth users to find one email. This is O(n) and will break at scale.

**Approach:** Use `listUsers` with page/perPage/filter params to fetch only the matching user. The `filter` param is supported by GoTrue and matches against email. This keeps the same admin API surface (no raw SQL needed).

**Files:**

- Modify: `supabase/functions/accept-invitation/index.ts:113-117`

- [ ] **Step 1: Replace listUsers() with filtered lookup**

In `accept-invitation/index.ts`, replace:

```typescript
// OLD — fetches ALL users (won't scale)
const { data: existingUsers } = await adminClient.auth.admin.listUsers();
const existingUser = existingUsers?.users?.find((u) => u.email === invitation.email);
```

With a filtered, paginated call:

```typescript
// NEW — filtered email lookup, fetches at most 1 user (O(1))
const { data: listResult } = await adminClient.auth.admin.listUsers({
  page: 1,
  perPage: 1,
  filter: invitation.email,
});
const existingUser = listResult?.users?.[0] ?? null;
```

The shape stays the same: `existingUser` is `{ id: string, email: string, ... } | null`, so the downstream `if (existingUser)` / `userId = existingUser.id` logic works unchanged.

- [ ] **Step 2: Verify the change still handles both paths (existing + new user)**

The rest of the function uses `existingUser` to decide whether to create or reuse. Ensure the shape matches: `existingUser` is `{ id: string } | null`.

- [ ] **Step 3: Run local test**

Start Supabase locally, create a test invitation, and hit the Edge Function endpoint:

```bash
curl -X POST http://localhost:54321/functions/v1/accept-invitation \
  -H "Content-Type: application/json" \
  -d '{"token":"<test-token>","first_name":"Test","last_name":"User","password":"testpass123"}'
```

Verify: new user created, profile created, invitation marked accepted.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/accept-invitation/index.ts
git commit -m "fix(invitation): replace listUsers() with filtered email lookup for scalability"
```

---

### Task 2: Fix accept-invitation — Create company_member row

**Why:** When an employee accepts an invitation, a `profile` is created but no `company_member` row. This means the user is in the workspace but not linked to the company entity. Company-level queries (e.g., `company.company_id IN (SELECT ... FROM company_member)`) won't find them.

**Files:**

- Modify: `supabase/functions/accept-invitation/index.ts:193-218` (after profile insert)

- [ ] **Step 1: Add company_member upsert after profile creation**

After the profile insert block (line ~218, after `if (profileError || !profile)`), add:

```typescript
// ── 3b. Ensure company_member exists ──
// Links user to company (cross-workspace). Upsert to handle re-invites.
if (invitation.company_id) {
  await adminClient.from("company_member").upsert(
    {
      user_id: userId,
      company_id: invitation.company_id,
      role: "member",
      is_active: true,
      joined_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" },
  );
}
```

- [ ] **Step 2: Check if company_member has a unique constraint on (user_id, company_id)**

Read `supabase/migrations/00001_identity_tables.sql` to verify. If no unique constraint exists, add one in the migration (Task 4).

```bash
grep -n "company_member" supabase/migrations/00001_identity_tables.sql
```

- [ ] **Step 3: Test the happy path**

After accepting an invitation:

1. Check `profile` table — new row exists
2. Check `company_member` table — new row exists with correct company_id
3. Check `company` RLS policy — user can now read their company

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/accept-invitation/index.ts
git commit -m "fix(invitation): create company_member row on invite acceptance"
```

---

### Task 3: Fix accept-invitation — Handle idempotent path company_member

**Why:** When a user re-clicks an accepted invitation link (existing profile found), the early return at line 166-184 skips company_member creation. This path also needs the company_member check.

**Files:**

- Modify: `supabase/functions/accept-invitation/index.ts:166-184`

- [ ] **Step 1: Add company_member upsert to the idempotent (existing profile) path**

Before the early return at line 173, add the same upsert:

```typescript
if (existingProfile) {
  // Ensure company_member exists even on re-click
  if (invitation.company_id) {
    await adminClient.from("company_member").upsert(
      {
        user_id: userId,
        company_id: invitation.company_id,
        role: "member",
        is_active: true,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "user_id,company_id" },
    );
  }

  // Mark invitation as accepted
  await adminClient
    .from("invitation")
    .update({ status: "accepted" })
    .eq("invitation_id", invitation.invitation_id);

  return new Response(/* ... existing response ... */);
}
```

- [ ] **Step 2: Extract company_member upsert to a helper to avoid duplication**

Create a helper function at the top of the file:

```typescript
async function ensureCompanyMember(
  client: ReturnType<typeof createClient>,
  userId: string,
  companyId: string | null,
) {
  if (!companyId) return;
  await client.from("company_member").upsert(
    {
      user_id: userId,
      company_id: companyId,
      role: "member",
      is_active: true,
      joined_at: new Date().toISOString(),
    },
    { onConflict: "user_id,company_id" },
  );
}
```

Then call `await ensureCompanyMember(adminClient, userId, invitation.company_id)` in both paths.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/accept-invitation/index.ts
git commit -m "refactor(invitation): extract ensureCompanyMember helper, fix idempotent path"
```

---

### Task 4: Migration — company_member unique constraint + RLS INSERT policy + cleanup function

**Why:**

1. company_member needs a unique constraint on (user_id, company_id) for the upsert to work
2. company_member only has a SELECT RLS policy — needs INSERT for completeness (though accept-invitation uses service role, future JWT-based paths may need it)
3. Expired invitations accumulate with no cleanup

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_fix_invitation_gaps.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Fix invitation flow gaps:
-- 1. Unique constraint on company_member (user_id, company_id) for upsert support
-- 2. RLS INSERT policy on company_member (admin can add members)
-- 3. Function to expire stale invitations

-- 1. Unique constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_company_member_user_company'
  ) THEN
    ALTER TABLE public.company_member
      ADD CONSTRAINT uq_company_member_user_company
      UNIQUE (user_id, company_id);
  END IF;
END $$;

-- 2. RLS: Admins in the company's workspaces can insert company_members
-- (accept-invitation uses service role so this is for future JWT-based paths)
CREATE POLICY "Admins can insert company members"
  ON public.company_member FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace w
      JOIN public.profile p ON p.workspace_id = w.workspace_id
      WHERE w.company_id = company_member.company_id
        AND p.user_id = auth.uid()
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  );

-- 3. Expire stale invitations (pending + past expires_at)
CREATE OR REPLACE FUNCTION public.expire_stale_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.invitation
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_invitations()
  IS 'Marks pending invitations past their expiry as expired. Call via cron or watchdog.';
```

- [ ] **Step 2: Generate the migration filename**

```bash
echo "supabase/migrations/$(date +%Y%m%d%H%M%S)_fix_invitation_gaps.sql"
```

- [ ] **Step 3: Apply the migration locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql
```

- [ ] **Step 4: Verify**

```bash
# Check constraint exists
docker exec $(docker ps -q -f name=supabase_db) psql -U postgres -c "\d public.company_member" | grep uq_company

# Check policy exists
docker exec $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT policyname FROM pg_policies WHERE tablename = 'company_member';"

# Check function exists
docker exec $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT proname FROM pg_proc WHERE proname = 'expire_stale_invitations';"
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_fix_invitation_gaps.sql
git commit -m "fix(db): add company_member unique constraint, INSERT RLS, invitation expiry function"
```

---

### Task 5: Implement invitation resend

**Why:** The UI already has a "Resend Invite" button in the people table row actions (`people-row-actions.tsx:108-110`) but it just shows a toast "not yet implemented" (`people-data-table.tsx:168-169`). Admin needs to be able to resend invitation emails when employees lose or miss the original.

**Approach:** Resend = cancel old invitation + create new one with fresh token + dispatch email/SMS again. This reuses the existing `create-invitation` Edge Function in single mode.

**Caution:** The `invitation` table has a UNIQUE constraint on `(workspace_id, email, status)`. The cancel (sets old to 'cancelled') must complete before creating the new one (status='pending'), otherwise a duplicate key violation occurs. The server action does this sequentially, so it's safe.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_actions/people-actions.ts`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx:168-169`

- [ ] **Step 1: Add `resendInvitation` server action**

In `people-actions.ts`, add after `cancelInvitation`:

```typescript
export async function resendInvitation(workspaceId: string, invitationId: string) {
  const supabase = await getClient();

  // 1. Fetch the original invitation details
  const { data: original, error: fetchError } = await supabase
    .from("invitation")
    .select("email, phone, first_name, last_name, role, department_ids, team_ids, invite_type")
    .eq("invitation_id", invitationId)
    .eq("status", "pending")
    .single();

  if (fetchError || !original) {
    throw new Error("Invitation not found or already accepted/cancelled");
  }

  // 2. Cancel the old invitation
  await supabase
    .from("invitation")
    .update({ status: "cancelled" } satisfies TablesUpdate<"invitation">)
    .eq("invitation_id", invitationId);

  // 3. Create a new invitation with fresh token via Edge Function
  const { data, error } = await supabase.functions.invoke("create-invitation", {
    body: {
      workspace_id: workspaceId,
      invite_type: original.invite_type ?? "email",
      email: original.email,
      phone: original.phone,
      role: original.role,
    },
  });

  if (error) throw new Error(`Failed to resend: ${error.message}`);
  return data;
}
```

- [ ] **Step 2: Wire the resend handler in people-data-table.tsx**

**Key insight:** For invited employees, `employee.id` IS the `invitation_id` (mapped at `page.tsx:132` as `id: inv.invitation_id`). And `employee.profileId` is absent for invited rows. No type changes needed — the `id` field already carries the invitation_id.

Replace the stub handler in `people-data-table.tsx`:

```typescript
// OLD
function handleResendInvite(email: string) {
  toast.info(`Resend invite to ${email} — not yet implemented`);
}
```

With:

```typescript
// NEW — uses employee.id which IS invitation_id for invited rows
async function handleResendInvite(invitationId: string, email: string) {
  if (!workspace?.workspace_id) return;
  try {
    await resendInvitation(workspace.workspace_id, invitationId);
    toast.success(`Invitation resent to ${email}`);
    onRefresh?.();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to resend invitation");
  }
}
```

Add the import at the top of the file:

```typescript
import { resendInvitation } from "../_actions/people-actions";
```

Then update the `PeopleRowActions` call (around line 599) to pass `employee.id`:

```typescript
// OLD
onResendInvite = { handleResendInvite };
// The PeopleRowActions component calls: onResendInvite(employee.email)
```

Update `people-row-actions.tsx` to pass both id and email:

```typescript
// In PeopleRowActions props type (line ~40):
onResendInvite: (invitationId: string, email: string) => void;

// In the onClick handler (line ~108):
<DropdownMenuItem onClick={() => onResendInvite(employee.id, employee.email)}>
```

And update the parent call in `people-data-table.tsx`:

```typescript
onResendInvite = { handleResendInvite };
// No change needed — signature already matches (invitationId, email)
```

- [ ] **Step 3: Test manually**

1. Create an invitation from the People page
2. Click the row action "Resend Invite"
3. Verify: old invitation cancelled, new one created with fresh token, email sent (check Supabase logs)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_actions/people-actions.ts
git add apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "feat(people): implement invitation resend (cancel old + create new)"
```

---

### Task 6: Typecheck and final verification

**Files:**

- All modified files

- [ ] **Step 1: Run typecheck**

```bash
cd ~/dev/wt-7 && pnpm turbo typecheck
```

Fix any type errors.

- [ ] **Step 2: Run lint**

```bash
cd ~/dev/wt-7 && pnpm lint
```

Fix any lint errors.

- [ ] **Step 3: Regenerate database types (if migration was applied)**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Verify Edge Function deploys locally**

```bash
npx supabase functions serve accept-invitation --no-verify-jwt
```

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(invitation): typecheck and lint cleanup"
```

---

## Acceptance Criteria

- [ ] `accept-invitation` creates `company_member` row for every accepted invite
- [ ] `accept-invitation` uses filtered email lookup instead of `listUsers()` (O(1) not O(n))
- [ ] `company_member` has unique constraint on `(user_id, company_id)`
- [ ] `company_member` has INSERT RLS policy for admin users
- [ ] `expire_stale_invitations()` function exists and can be called by cron/watchdog
- [ ] "Resend Invite" button in People table works (cancels old, creates new, dispatches email)
- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] `pnpm lint` passes

## Out of Scope

- Scheduled cron job for `expire_stale_invitations()` (function created, hook up later)
- Rate limiting on token acceptance (122-bit UUID entropy is sufficient for now)
- Bulk resend of all pending invitations
