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
