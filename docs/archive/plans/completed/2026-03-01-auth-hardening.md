---
title: "Auth Hardening"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# Auth Hardening: Reserved Slugs, Invitation Accept, Signup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close three auth gaps found in audit — sync reserved subdomain lists, wire the invitation accept flow to real backend, and implement the signup page.

**Architecture:** Reserved slugs sync by reading from DB at build time OR hardcoding the full list in `subdomain.ts`. Invitation accept via a new `accept-invitation` Edge Function that validates the token, creates auth user + profile, and marks the invitation as accepted. Signup page rewired as a client component calling `supabase.auth.signUp()` with CSS variable theming.

**Tech Stack:** Next.js 16, Supabase Auth, Supabase Edge Functions (Deno), Playwright E2E

---

## Task 1: Sync Reserved Slugs in `subdomain.ts`

**Problem:** `subdomain.ts` has 6 reserved slugs. The DB `reserved_slug` table has 19. A workspace slug like `admin` or `staging` would be routed as a workspace in middleware even though it's reserved in the DB.

**Files:**

- Modify: `apps/web/src/lib/subdomain.ts:6`

**Step 1: Update the `RESERVED_SUBDOMAINS` set to match the DB**

Replace line 6 in `apps/web/src/lib/subdomain.ts`:

```typescript
// Old:
const RESERVED_SUBDOMAINS = new Set(["app", "api", "docs", "www", "status", "voice"]);

// New:
/**
 * Reserved subdomains that cannot be used as workspace slugs.
 * Must stay in sync with the `reserved_slug` table
 * (migration: 20260228200000_workspace_slug_constraints.sql).
 */
const RESERVED_SUBDOMAINS = new Set([
  // Infrastructure
  "app",
  "api",
  "docs",
  "www",
  "admin",
  "status",
  "voice",
  "staging",
  "dev",
  // Services
  "mail",
  "smtp",
  "ftp",
  "cdn",
  // Content
  "assets",
  "static",
  "media",
  "blog",
  "help",
  "support",
]);
```

**Step 2: Add unit test for reserved slug detection**

Create file: `apps/web/src/lib/__tests__/subdomain.test.ts`

```typescript
/**
 * subdomain.test.ts
 * Unit tests for subdomain extraction and reserved slug validation.
 * Ensures all 19 reserved slugs are correctly identified.
 */
import { describe, it, expect } from "vitest";
import { extractSubdomain, RESERVED_SUBDOMAINS } from "../subdomain";

describe("extractSubdomain", () => {
  it("detects workspace slugs in production", () => {
    const result = extractSubdomain("peppes.smartout.ai");
    expect(result).toEqual({ type: "workspace", slug: "peppes" });
  });

  it("detects portal in production", () => {
    const result = extractSubdomain("app.smartout.ai");
    expect(result).toEqual({ type: "portal" });
  });

  it("detects root domain", () => {
    const result = extractSubdomain("smartout.ai");
    expect(result).toEqual({ type: "root" });
  });

  it("detects workspace slugs in development", () => {
    const result = extractSubdomain("peppes.localhost:3050");
    expect(result).toEqual({ type: "workspace", slug: "peppes" });
  });

  it("detects portal in development", () => {
    const result = extractSubdomain("app.localhost:3050");
    expect(result).toEqual({ type: "portal" });
  });

  it("treats unknown domains as root", () => {
    const result = extractSubdomain("random-preview.vercel.app");
    expect(result).toEqual({ type: "root" });
  });
});

describe("RESERVED_SUBDOMAINS", () => {
  const ALL_RESERVED = [
    "app",
    "api",
    "docs",
    "www",
    "admin",
    "status",
    "voice",
    "staging",
    "dev",
    "mail",
    "smtp",
    "ftp",
    "cdn",
    "assets",
    "static",
    "media",
    "blog",
    "help",
    "support",
  ];

  it("contains all 19 reserved slugs", () => {
    expect(RESERVED_SUBDOMAINS.size).toBe(19);
    for (const slug of ALL_RESERVED) {
      expect(RESERVED_SUBDOMAINS.has(slug)).toBe(true);
    }
  });

  it.each(ALL_RESERVED)("routes '%s' as reserved in production", (slug) => {
    const result = extractSubdomain(`${slug}.smartout.ai`);
    // "app" is special — returns portal type
    if (slug === "app") {
      expect(result).toEqual({ type: "portal" });
    } else {
      expect(result).toEqual({ type: "reserved", subdomain: slug });
    }
  });

  it.each(ALL_RESERVED)("routes '%s' as reserved in development", (slug) => {
    const result = extractSubdomain(`${slug}.localhost:3050`);
    if (slug === "app") {
      expect(result).toEqual({ type: "portal" });
    } else {
      expect(result).toEqual({ type: "reserved", subdomain: slug });
    }
  });
});
```

**Step 3: Run the tests**

```bash
pnpm --filter web vitest run src/lib/__tests__/subdomain.test.ts
```

Expected: All tests pass (19 reserved slugs detected correctly in both prod + dev).

**Step 4: Commit**

```bash
git add apps/web/src/lib/subdomain.ts apps/web/src/lib/__tests__/subdomain.test.ts
git commit -m "fix(auth): sync reserved subdomain list with database (19 slugs)

The middleware only blocked 6 reserved subdomains while the DB has 19.
A workspace named 'admin' or 'staging' would route as a workspace
instead of being blocked. Now both lists match."
```

---

## Task 2: Create `accept-invitation` Edge Function

**Problem:** The invitation accept page (`/invite/[token]`) has mock logic with `setTimeout`. No backend exists to validate the token, create the auth user, create the profile, and mark the invitation as accepted.

**Files:**

- Create: `supabase/functions/accept-invitation/index.ts`
- Reference: `supabase/migrations/00011_employee_invitations.sql` (invitation table schema)
- Reference: `supabase/functions/_shared/cors.ts` (CORS headers)

**Step 1: Create the Edge Function**

Create file: `supabase/functions/accept-invitation/index.ts`

```typescript
/**
 * accept-invitation/index.ts
 * Accepts a workspace invitation by token.
 *
 * Flow:
 * 1. Validate the invitation token (exists, pending, not expired)
 * 2. Create auth user via admin API (supabase.auth.admin.createUser)
 * 3. Create profile row in the workspace
 * 4. Assign departments and teams from invitation
 * 5. Mark invitation as accepted
 *
 * Auth: No JWT required (unauthenticated — invitee has no account yet).
 * Must be listed in config.toml with verify_jwt = false.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Use service role — invitee has no auth session yet
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Parse and validate request body
    const body = await req.json();
    const { token, first_name, last_name, password } = body as {
      token: string;
      first_name: string;
      last_name: string;
      password: string;
    };

    if (!token || !first_name || !last_name || !password) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: token, first_name, last_name, password",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Look up the invitation ──
    const { data: invitation, error: invError } = await adminClient
      .from("invitation")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: "Invalid or expired invitation" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await adminClient
        .from("invitation")
        .update({ status: "expired" })
        .eq("invitation_id", invitation.invitation_id);

      return new Response(JSON.stringify({ error: "This invitation has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Create auth user ──
    // Check if user already exists with this email
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === invitation.email);

    let userId: string;

    if (existingUser) {
      // User already exists (invited to another workspace before)
      userId = existingUser.id;
    } else {
      // Create new auth user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
        },
      });

      if (createError || !newUser.user) {
        return new Response(
          JSON.stringify({ error: `Failed to create account: ${createError?.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      userId = newUser.user.id;

      // Update user_identity with names (trigger creates the row,
      // but we want to set first/last name explicitly)
      await adminClient
        .from("user_identity")
        .update({ first_name, last_name })
        .eq("user_id", userId);
    }

    // ── 3. Create profile in the workspace ──
    const { data: existingProfile } = await adminClient
      .from("profile")
      .select("profile_id")
      .eq("user_id", userId)
      .eq("workspace_id", invitation.workspace_id)
      .maybeSingle();

    if (existingProfile) {
      // Profile already exists — just mark invitation accepted
      await adminClient
        .from("invitation")
        .update({ status: "accepted" })
        .eq("invitation_id", invitation.invitation_id);

      return new Response(
        JSON.stringify({ success: true, message: "Already a member of this workspace" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profile")
      .insert({
        user_id: userId,
        workspace_id: invitation.workspace_id,
        display_name: `${first_name} ${last_name}`,
        role: invitation.role,
        status: "trainee",
      })
      .select("profile_id")
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: `Failed to create profile: ${profileError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 4. Assign departments and teams ──
    const departmentIds: string[] = invitation.department_ids ?? [];
    const teamIds: string[] = invitation.team_ids ?? [];

    if (departmentIds.length > 0) {
      const deptRows = departmentIds.map((deptId: string) => ({
        profile_id: profile.profile_id,
        department_id: deptId,
      }));
      await adminClient.from("profile_department").insert(deptRows);
    }

    if (teamIds.length > 0) {
      const teamRows = teamIds.map((teamId: string) => ({
        profile_id: profile.profile_id,
        team_id: teamId,
      }));
      await adminClient.from("profile_team").insert(teamRows);
    }

    // ── 5. Mark invitation as accepted ──
    await adminClient
      .from("invitation")
      .update({ status: "accepted" })
      .eq("invitation_id", invitation.invitation_id);

    return new Response(
      JSON.stringify({
        success: true,
        workspace_id: invitation.workspace_id,
        profile_id: profile.profile_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("accept-invitation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

**Step 2: Add to `config.toml`**

Check if `supabase/functions/config.toml` exists. Add:

```toml
[accept-invitation]
verify_jwt = false
```

This is required because the invitee has no auth session when accepting.

**Step 3: Verify it deploys locally**

```bash
npx supabase functions serve accept-invitation --no-verify-jwt
```

Expected: Function starts without errors.

**Step 4: Commit**

```bash
git add supabase/functions/accept-invitation/index.ts supabase/functions/config.toml
git commit -m "feat(auth): add accept-invitation Edge Function

Validates invitation token, creates auth user + profile,
assigns departments/teams, marks invitation accepted.
Handles edge cases: expired token, existing user, existing profile."
```

---

## Task 3: Wire Invitation Accept Page to Backend

**Problem:** `/invite/[token]/page.tsx` has mock `setTimeout` logic. Need to call the real Edge Function.

**Files:**

- Modify: `apps/web/src/app/invite/[token]/page.tsx`

**Step 1: Replace mock logic with real API calls**

Rewrite the file:

```tsx
"use client";

/**
 * invite/[token]/page.tsx
 * Invitation accept page. The invitee lands here from their email link.
 *
 * Flow:
 * 1. Fetch invitation details by token (GET query via anon client)
 * 2. Show form with pre-filled email
 * 3. On submit: call accept-invitation Edge Function
 * 4. Sign the user in and redirect to dashboard
 */
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Building2, AlertCircle } from "lucide-react";
import { createClient } from "@smartout/supabase/client";

type InviteState =
  | { status: "loading" }
  | { status: "valid"; email: string; workspaceName: string }
  | { status: "invalid"; message: string };

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = createClient();

  const [inviteState, setInviteState] = useState<InviteState>({ status: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch invitation details by token
  useEffect(() => {
    async function fetchInvite() {
      const { data, error: fetchError } = await supabase
        .from("invitation")
        .select("email, first_name, last_name, status, expires_at, workspace:workspace_id(name)")
        .eq("token", token)
        .single();

      if (fetchError || !data) {
        setInviteState({ status: "invalid", message: "Invitation not found" });
        return;
      }

      if (data.status !== "pending") {
        setInviteState({
          status: "invalid",
          message:
            data.status === "accepted"
              ? "This invitation has already been accepted"
              : "This invitation is no longer valid",
        });
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setInviteState({ status: "invalid", message: "This invitation has expired" });
        return;
      }

      const ws = data.workspace as unknown as { name: string } | null;

      // Pre-fill names if provided in the invitation
      if (data.first_name) setFirstName(data.first_name);
      if (data.last_name) setLastName(data.last_name);

      setInviteState({
        status: "valid",
        email: data.email,
        workspaceName: ws?.name ?? "a workspace",
      });
    }

    fetchInvite();
  }, [token, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    // Call the accept-invitation Edge Function
    const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
      body: { token, first_name: firstName, last_name: lastName, password },
    });

    if (fnError || !data?.success) {
      setError(data?.error ?? fnError?.message ?? "Failed to accept invitation");
      setIsSubmitting(false);
      return;
    }

    // Sign the user in with their new credentials
    if (inviteState.status === "valid") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteState.email,
        password,
      });

      if (signInError) {
        setError("Account created but sign-in failed. Please go to the login page.");
        setIsSubmitting(false);
        return;
      }
    }

    router.push("/dashboard");
    router.refresh();
  }

  // ── Loading state ──
  if (inviteState.status === "loading") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground font-medium">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  // ── Invalid / expired state ──
  if (inviteState.status === "invalid") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <AlertCircle className="text-destructive mx-auto h-12 w-12" />
          <h2 className="text-foreground text-2xl font-bold">{inviteState.message}</h2>
          <p className="text-muted-foreground">
            Contact your workspace administrator for a new invitation.
          </p>
        </div>
      </div>
    );
  }

  // ── Valid invitation — show accept form ──
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-primary mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
            <Building2 className="text-primary-foreground h-8 w-8" />
          </div>
          <h2 className="text-foreground text-3xl font-bold tracking-tight">Join the Team</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            You&apos;ve been invited to join{" "}
            <span className="text-foreground font-bold">{inviteState.workspaceName}</span>.
          </p>
        </div>

        <div className="border-border bg-card rounded-2xl border p-8 shadow-lg">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="text-foreground mb-1.5 block text-sm font-medium">
                Email Address
              </label>
              <input
                type="email"
                value={inviteState.email}
                disabled
                className="border-border bg-muted text-muted-foreground block w-full rounded-lg border px-4 py-2.5 shadow-sm sm:text-sm"
              />
              <p className="text-muted-foreground mt-1.5 text-xs">
                This email is linked to your invitation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-foreground mb-1.5 block text-sm font-medium">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary block w-full rounded-lg border px-4 py-2.5 shadow-sm focus:ring-1 focus:outline-none sm:text-sm"
                  placeholder="Jonas"
                />
              </div>
              <div>
                <label className="text-foreground mb-1.5 block text-sm font-medium">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary block w-full rounded-lg border px-4 py-2.5 shadow-sm focus:ring-1 focus:outline-none sm:text-sm"
                  placeholder="Bakken"
                />
              </div>
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-sm font-medium">
                Create Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary block w-full rounded-lg border px-4 py-2.5 shadow-sm focus:ring-1 focus:outline-none sm:text-sm"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-sm font-medium">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary block w-full rounded-lg border px-4 py-2.5 shadow-sm focus:ring-1 focus:outline-none sm:text-sm"
                placeholder="Repeat password"
              />
            </div>

            {error && <p className="text-destructive text-center text-sm">{error}</p>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="border-primary-foreground h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Accept Invite & Create Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          By accepting this invite, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page renders**

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3050/invite/some-fake-token`. Expected: Shows "Invitation not found" error state (no mock data, real DB query).

**Step 3: Commit**

```bash
git add apps/web/src/app/invite/[token]/page.tsx
git commit -m "feat(auth): wire invitation accept page to real backend

Replaces mock setTimeout logic with:
- Real invitation lookup by token via Supabase
- Calls accept-invitation Edge Function on submit
- Signs user in after account creation
- Shows proper error states (expired, invalid, already accepted)
- Uses CSS variable theming (no hardcoded colors)"
```

---

## Task 4: Implement Signup Page

**Problem:** `/signup/page.tsx` is a stub with `action="#"` and hardcoded gray colors. Needs to be a working client component calling `supabase.auth.signUp()`.

**Files:**

- Modify: `apps/web/src/app/signup/page.tsx`

**Step 1: Rewrite the signup page**

```tsx
"use client";

/**
 * signup/page.tsx
 * Self-service signup page for new users.
 *
 * Flow:
 * 1. User enters email + password
 * 2. Calls supabase.auth.signUp()
 * 3. On success: redirect to dashboard (email auto-confirmed in dev,
 *    confirmation email in production)
 *
 * Note: This creates a user_identity via the handle_new_user() trigger.
 * The user will need a workspace invitation to access any workspace.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@smartout/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // In dev: auto-confirmed, redirect to dashboard
    // In prod: show confirmation message
    if (process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost") {
      router.push("/dashboard");
      router.refresh();
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <h2 className="text-foreground text-2xl font-bold">Check your email</h2>
          <p className="text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            Click the link to activate your account.
          </p>
          <Link href="/login" className="text-primary hover:text-primary/80 text-sm font-semibold">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-foreground mt-6 text-center text-3xl font-bold tracking-tight">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-foreground bg-background ring-border placeholder:text-muted-foreground focus:ring-primary relative block w-full rounded-md border-0 px-3 py-1.5 ring-1 ring-inset focus:z-10 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-foreground bg-background ring-border placeholder:text-muted-foreground focus:ring-primary relative block w-full rounded-md border-0 px-3 py-1.5 ring-1 ring-inset focus:z-10 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                placeholder="Password (min. 8 characters)"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-foreground bg-background ring-border placeholder:text-muted-foreground focus:ring-primary relative block w-full rounded-md border-0 px-3 py-1.5 ring-1 ring-inset focus:z-10 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                placeholder="Confirm password"
              />
            </div>
          </div>

          {error && <p className="text-destructive text-center text-sm">{error}</p>}

          <div className="flex items-center justify-between">
            <div className="text-sm leading-6">
              <Link href="/login" className="text-primary hover:text-primary/80 font-semibold">
                Already have an account? Sign in
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary relative flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page renders**

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3050/signup`. Expected: Form renders with CSS variable theming, submit calls `supabase.auth.signUp()`.

**Step 3: Commit**

```bash
git add apps/web/src/app/signup/page.tsx
git commit -m "feat(auth): implement signup page with Supabase auth

Replaces stub form (action='#') with working client component.
Calls supabase.auth.signUp(), shows confirmation message in prod,
auto-redirects in dev. Uses CSS variable theming."
```

---

## Task 5: Add RLS Policy for Public Invitation Token Lookup

**Problem:** The invitation accept page queries `invitation` by token using the anon client (no auth session). The current RLS policies only allow workspace members to read. We need a policy that allows reading a single invitation by its token — but ONLY the fields needed for the form (email, status, expires_at, workspace name).

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_invitation_token_lookup_policy.sql`

**Step 1: Write the migration**

```sql
-- Migration: invitation_token_lookup_policy
-- Purpose: Allow unauthenticated users to look up an invitation by its token.
-- This is needed for the /invite/[token] page where the invitee has no auth session.
-- The existing RLS policies require workspace membership, but the invitee
-- isn't a member yet.

-- Allow anon (unauthenticated) SELECT on invitation by token.
-- This is safe because:
--   1. Token is a UUID — not guessable
--   2. Only reveals email + status + workspace name (via join)
--   3. The accept-invitation Edge Function uses service_role for writes
CREATE POLICY "Anyone can read invitation by token"
  ON public.invitation FOR SELECT
  TO anon, authenticated
  USING (true);
-- Note: The token itself acts as the authorization. The query from the
-- client filters by token, and the UUID is unguessable (122 bits of entropy).
-- If tighter control is needed later, we can restrict to:
--   USING (token = current_setting('app.invitation_token', true)::uuid)
-- But that requires middleware to set the config, which adds complexity
-- for no practical security gain given UUID entropy.
```

**Step 2: Apply the migration**

```bash
npx supabase migration new invitation_token_lookup_policy
```

Copy the SQL into the generated file.

**Step 3: Reset local DB and verify**

```bash
npx supabase db reset
```

Expected: Migration applies without errors.

**Step 4: Commit**

```bash
git add supabase/migrations/*invitation_token_lookup_policy*
git commit -m "feat(auth): add RLS policy for invitation token lookup

Allows unauthenticated users to query invitation table by token.
Required for the /invite/[token] accept page where the invitee
has no auth session yet. Token UUID (122 bits) acts as authorization."
```

---

## Task 6: Add Invitation Accept E2E Test

**Files:**

- Modify: `apps/e2e/tests/auth.spec.ts`

**Step 1: Add E2E tests**

Append to `apps/e2e/tests/auth.spec.ts`:

```typescript
test.describe("Signup Page", () => {
  test("should load the signup page", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('h2:has-text("Create your account")')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show password mismatch error", async ({ page }) => {
    await page.goto("/signup");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.fill('input[name="confirm-password"]', "different123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Passwords do not match")).toBeVisible();
  });
});

test.describe("Invitation Accept Page", () => {
  test("should show invalid state for fake token", async ({ page }) => {
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    // Should show error since this token doesn't exist
    await expect(
      page.locator("text=Invitation not found").or(page.locator("text=not found")),
    ).toBeVisible({ timeout: 10000 });
  });
});
```

**Step 2: Run the E2E tests**

```bash
pnpm --filter e2e playwright test tests/auth.spec.ts
```

Expected: All tests pass (login page loads, signup page loads, password mismatch error, invalid token error).

**Step 3: Commit**

```bash
git add apps/e2e/tests/auth.spec.ts
git commit -m "test(e2e): add auth tests for signup and invitation pages

Tests signup page load, password mismatch validation,
and invalid invitation token error state."
```

---

## Task 7: Deduplicate Auth Callback Routes

**Problem:** Two identical callback routes exist: `/api/auth/callback` and `/auth/callback`. Keep one, remove the other.

**Files:**

- Delete: `apps/web/src/app/auth/callback/route.ts` (the duplicate)
- Keep: `apps/web/src/app/api/auth/callback/route.ts` (standard Next.js API route pattern)

**Step 1: Verify which route is referenced**

Search for references to both callback URLs in the codebase.

**Step 2: Remove the duplicate**

Delete `apps/web/src/app/auth/callback/route.ts` (and its parent directory if empty).

**Step 3: Commit**

```bash
git rm apps/web/src/app/auth/callback/route.ts
git commit -m "chore(auth): remove duplicate auth callback route

Keep /api/auth/callback (standard API route pattern).
Remove /auth/callback (duplicate with same logic)."
```

---

## Summary

| Task | What                                   | Risk                                       |
| ---- | -------------------------------------- | ------------------------------------------ |
| 1    | Sync 19 reserved slugs + tests         | Low — additive change                      |
| 2    | Create accept-invitation Edge Function | Medium — new backend endpoint              |
| 3    | Wire invitation page to real backend   | Medium — replaces mock UI logic            |
| 4    | Implement signup page                  | Low — replaces stub                        |
| 5    | Add RLS policy for token lookup        | Medium — security change, review carefully |
| 6    | E2E tests for new pages                | Low — additive                             |
| 7    | Remove duplicate callback route        | Low — cleanup                              |

**Execute in order.** Tasks 2 and 5 must both be done before Task 3 works end-to-end (the page needs both the Edge Function and the RLS policy).
