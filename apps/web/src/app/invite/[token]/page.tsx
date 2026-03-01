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

  /**
   * Handles form submission: validates passwords, calls the accept-invitation
   * Edge Function, then signs the user in and redirects to the dashboard.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side password validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    // Step 1: Call the accept-invitation Edge Function to create the account
    const { data, error: fnError } = await supabase.functions.invoke("accept-invitation", {
      body: { token, first_name: firstName, last_name: lastName, password },
    });

    if (fnError || !data?.success) {
      setError(data?.error ?? fnError?.message ?? "Failed to accept invitation");
      setIsSubmitting(false);
      return;
    }

    // Step 2: Sign the user in with the newly created credentials
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

    // Step 3: Redirect to dashboard
    router.push("/dashboard");
    router.refresh();
  }

  // --- Loading state ---
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

  // --- Invalid / expired / already accepted state ---
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

  // --- Valid invitation: show the accept form ---
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
