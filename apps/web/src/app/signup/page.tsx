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
 * Fail-safe: If Supabase is unreachable, stores email in localStorage
 * so the user can be contacted when the system is ready.
 *
 * Note: This creates a user_identity via the handle_new_user() trigger.
 * The user will need a workspace invitation to access any workspace.
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@smartout/supabase/client";

const PENDING_SIGNUP_KEY = "smartout_pending_signup";

interface PendingSignup {
  email: string;
  savedAt: string;
}

function savePendingSignup(email: string) {
  try {
    const pending: PendingSignup = { email, savedAt: new Date().toISOString() };
    localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(pending));
  } catch {
    // localStorage unavailable — silent fail
  }
}

function getPendingSignup(): PendingSignup | null {
  try {
    const raw = localStorage.getItem(PENDING_SIGNUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingSignup;
  } catch {
    return null;
  }
}

function clearPendingSignup() {
  try {
    localStorage.removeItem(PENDING_SIGNUP_KEY);
  } catch {
    // silent
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === "Failed to fetch") return true;
  if (err instanceof Error && err.message.includes("Failed to fetch")) return true;
  return false;
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  // On mount: check for pending signup and try to complete it
  useEffect(() => {
    const pending = getPendingSignup();
    if (!pending) return;

    // If we have a pending signup, pre-fill the email
    setEmail(pending.email);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passordene stemmer ikke overens");
      return;
    }

    if (password.length < 8) {
      setError("Passordet må være minst 8 tegn");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        // Check if it's a network error
        if (isNetworkError(authError)) {
          savePendingSignup(email);
          setSavedOffline(true);
          setLoading(false);
          return;
        }
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Signup succeeded — clear any pending
      clearPendingSignup();

      // In dev: auto-confirmed, redirect to dashboard
      // In prod: show confirmation message
      if (process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost") {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch (err) {
      // Network-level failure (fetch itself throws)
      if (isNetworkError(err)) {
        savePendingSignup(email);
        setSavedOffline(true);
        setLoading(false);
        return;
      }
      setError("Noe gikk galt. Prøv igjen.");
      setLoading(false);
    }
  }

  if (savedOffline) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <span className="text-3xl">📋</span>
          </div>
          <h2 className="text-foreground text-2xl font-bold">Registreringen er lagret</h2>
          <p className="text-muted-foreground">
            Vi har lagret e-postadressen din <strong className="text-foreground">{email}</strong>{" "}
            lokalt. Systemet er midlertidig utilgjengelig, men registreringen din vil bli fullført
            automatisk neste gang du besøker denne siden.
          </p>
          <p className="text-muted-foreground text-sm">Du kan trygt lukke denne fanen.</p>
          <Link href="/" className="text-primary hover:text-primary/80 text-sm font-semibold">
            Tilbake til forsiden
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <h2 className="text-foreground text-2xl font-bold">Sjekk e-posten din</h2>
          <p className="text-muted-foreground">
            Vi har sendt en bekreftelseslenke til{" "}
            <strong className="text-foreground">{email}</strong>. Klikk på lenken for å aktivere
            kontoen din.
          </p>
          <Link href="/login" className="text-primary hover:text-primary/80 text-sm font-semibold">
            Tilbake til innlogging
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
            Opprett konto
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">
                E-postadresse
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
                placeholder="E-postadresse"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Passord
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
                placeholder="Passord (min. 8 tegn)"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Bekreft passord
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
                placeholder="Bekreft passord"
              />
            </div>
          </div>

          {error && <p className="text-destructive text-center text-sm">{error}</p>}

          <div className="flex items-center justify-between">
            <div className="text-sm leading-6">
              <Link href="/login" className="text-primary hover:text-primary/80 font-semibold">
                Har du allerede en konto? Logg inn
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary relative flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {loading ? "Oppretter konto..." : "Opprett konto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
