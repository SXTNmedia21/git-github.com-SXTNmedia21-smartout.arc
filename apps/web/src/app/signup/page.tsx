"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@smartout/supabase/client";

// UI Events:
// - nav: /join (form submit success, localhost)
// - nav: /login (footer link, success state link)
// - nav: / (offline state link)
// - action: handleGoogleSignup() (Google SSO button)
// - action: handleMagicLink() (magic link form)
// - action: handlePasswordSignup() (email+password form)

const PENDING_SIGNUP_KEY = "smartout_pending_signup";

type EmailMethod = "magic-link" | "password";

interface PendingSignup {
  email: string;
  savedAt: string;
}

function savePendingSignup(email: string) {
  try {
    localStorage.setItem(
      PENDING_SIGNUP_KEY,
      JSON.stringify({ email, savedAt: new Date().toISOString() }),
    );
  } catch {
    // silent
  }
}

function getPendingSignup(): PendingSignup | null {
  try {
    const raw = localStorage.getItem(PENDING_SIGNUP_KEY);
    return raw ? (JSON.parse(raw) as PendingSignup) : null;
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

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailMethod, setEmailMethod] = useState<EmailMethod>("magic-link");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    const pending = getPendingSignup();
    if (pending) setEmail(pending.email);
  }, []);

  async function handleGoogleSignup() {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/api/auth/callback?next=/join",
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch {
      setError("Noe gikk galt med Google-registrering.");
      setGoogleLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + "/api/auth/callback?next=/join",
        },
      });

      if (otpError) {
        if (isNetworkError(otpError)) {
          savePendingSignup(email);
          setSavedOffline(true);
          setLoading(false);
          return;
        }
        setError(otpError.message);
        setLoading(false);
        return;
      }

      clearPendingSignup();
      setMagicLinkSent(true);
      setLoading(false);
    } catch (err) {
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

  async function handlePasswordSignup(e: React.FormEvent) {
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

      clearPendingSignup();

      if (process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost") {
        router.push("/join");
        router.refresh();
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch (err) {
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

  // --- Offline saved state ---
  if (savedOffline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[oklch(0.985_0.005_60)] px-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[40%] left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full bg-[oklch(0.92_0.04_55)] blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-[400px]">
          <div className="animate-auth-in border-border/60 bg-background/70 rounded-2xl border p-8 text-center shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] backdrop-blur-xl">
            <div className="bg-warning/10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <span className="text-2xl">&#128203;</span>
            </div>
            <h2 className="font-heading text-foreground text-2xl">Registreringen er lagret</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Vi har lagret e-postadressen din <strong className="text-foreground">{email}</strong>{" "}
              lokalt. Registreringen fullføres automatisk neste gang du besøker denne siden.
            </p>
            <Link
              href="/"
              className="text-brand-orange hover:text-brand-orange/80 mt-6 inline-block text-sm font-medium transition-colors duration-150"
            >
              Tilbake til forsiden
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Magic link sent confirmation ---
  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[oklch(0.985_0.005_60)] px-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[40%] left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full bg-[oklch(0.92_0.04_55)] blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-[400px]">
          <div className="animate-auth-in border-border/60 bg-background/70 rounded-2xl border p-8 text-center shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] backdrop-blur-xl">
            <div className="bg-success/10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <span className="text-2xl">&#9993;&#65039;</span>
            </div>
            <h2 className="font-heading text-foreground text-2xl">Sjekk e-posten din</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Vi har sendt en innloggingslenke til{" "}
              <strong className="text-foreground">{email}</strong>. Klikk lenken for å komme i gang.
            </p>
            <Link
              href="/login"
              className="text-brand-orange hover:text-brand-orange/80 mt-6 inline-block text-sm font-medium transition-colors duration-150"
            >
              Tilbake til innlogging
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Email confirmation sent (password signup) ---
  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[oklch(0.985_0.005_60)] px-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[40%] left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full bg-[oklch(0.92_0.04_55)] blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-[400px]">
          <div className="animate-auth-in border-border/60 bg-background/70 rounded-2xl border p-8 text-center shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] backdrop-blur-xl">
            <div className="bg-success/10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <span className="text-2xl">&#9993;&#65039;</span>
            </div>
            <h2 className="font-heading text-foreground text-2xl">Sjekk e-posten din</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Vi har sendt en bekreftelseslenke til{" "}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <Link
              href="/login"
              className="text-brand-orange hover:text-brand-orange/80 mt-6 inline-block text-sm font-medium transition-colors duration-150"
            >
              Tilbake til innlogging
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Main signup form ---
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[oklch(0.985_0.005_60)] px-4">
      {/* Warm ambient glow — two overlapping orbs for depth */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-1/2 h-[80vh] w-[80vh] -translate-x-1/2 rounded-full bg-[oklch(0.92_0.04_55)] blur-[120px]" />
        <div className="absolute -right-[10%] -bottom-[20%] h-[50vh] w-[50vh] rounded-full bg-[oklch(0.95_0.02_40)] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo — enters first */}
        <div className="animate-auth-in mb-8 text-center" style={{ animationDelay: "0ms" }}>
          <Image
            src="/smartout-logo.png"
            alt="Smartout"
            width={140}
            height={48}
            className="inline-block"
            priority
          />
        </div>

        {/* Frosted glass card */}
        <div
          className="animate-auth-in border-border/60 bg-background/70 rounded-2xl border p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] backdrop-blur-xl"
          style={{ animationDelay: "80ms" }}
        >
          {/* Heading */}
          <div className="animate-auth-in mb-6 text-center" style={{ animationDelay: "140ms" }}>
            <h1 className="font-heading text-foreground text-[1.85rem] leading-tight tracking-tight">
              Kom i gang
            </h1>
            <p className="text-muted-foreground mt-1.5 text-[0.875rem]">
              Opprett konto for å starte med Smartout.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="border-destructive/20 bg-destructive/5 text-destructive mb-5 rounded-lg border px-4 py-3 text-center text-sm">
              {error}
            </div>
          )}

          {/* Google SSO — primary option */}
          <div className="animate-auth-in" style={{ animationDelay: "200ms" }}>
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={googleLoading || loading}
              className="border-border bg-background text-foreground hover:border-border/60 hover:bg-accent flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              <GoogleIcon />
              {googleLoading ? "Registrerer..." : "Fortsett med Google"}
            </button>
          </div>

          {/* Divider */}
          <div className="animate-auth-in relative my-6" style={{ animationDelay: "260ms" }}>
            <div className="absolute inset-0 flex items-center">
              <div className="border-border/80 w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background/70 text-muted-foreground px-3 backdrop-blur-sm">
                eller fortsett med e-post
              </span>
            </div>
          </div>

          {/* Email method toggle */}
          <div className="animate-auth-in mb-5" style={{ animationDelay: "320ms" }}>
            <div className="border-border bg-muted/40 flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setEmailMethod("magic-link")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  emailMethod === "magic-link"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Magisk lenke
              </button>
              <button
                type="button"
                onClick={() => setEmailMethod("password")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  emailMethod === "password"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Passord
              </button>
            </div>
          </div>

          {/* Magic link form */}
          {emailMethod === "magic-link" && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="animate-auth-in" style={{ animationDelay: "380ms" }}>
                <label
                  htmlFor="email"
                  className="text-foreground mb-1.5 block text-[0.8125rem] font-medium"
                >
                  E-post
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-brand-orange block w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.1)] focus:outline-none"
                  placeholder="din@epost.no"
                />
              </div>

              <div className="animate-auth-in pt-1" style={{ animationDelay: "440ms" }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brand-orange flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
                >
                  {loading ? "Sender lenke..." : "Send innloggingslenke"}
                </button>
              </div>
            </form>
          )}

          {/* Password form */}
          {emailMethod === "password" && (
            <form onSubmit={handlePasswordSignup} className="space-y-4">
              <div className="animate-auth-in" style={{ animationDelay: "380ms" }}>
                <label
                  htmlFor="email-pw"
                  className="text-foreground mb-1.5 block text-[0.8125rem] font-medium"
                >
                  E-post
                </label>
                <input
                  id="email-pw"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-brand-orange block w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.1)] focus:outline-none"
                  placeholder="din@epost.no"
                />
              </div>
              <div className="animate-auth-in" style={{ animationDelay: "440ms" }}>
                <label
                  htmlFor="password"
                  className="text-foreground mb-1.5 block text-[0.8125rem] font-medium"
                >
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
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-brand-orange block w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.1)] focus:outline-none"
                  placeholder="Min. 8 tegn"
                />
              </div>
              <div className="animate-auth-in" style={{ animationDelay: "500ms" }}>
                <label
                  htmlFor="confirm-password"
                  className="text-foreground mb-1.5 block text-[0.8125rem] font-medium"
                >
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
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-brand-orange block w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.1)] focus:outline-none"
                  placeholder="Bekreft passord"
                />
              </div>

              <div className="animate-auth-in pt-1" style={{ animationDelay: "560ms" }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brand-orange flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
                >
                  {loading ? "Oppretter konto..." : "Opprett konto"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer link */}
        <p
          className="animate-auth-in text-muted-foreground mt-8 text-center text-sm"
          style={{ animationDelay: "620ms" }}
        >
          Har du allerede konto?{" "}
          <Link
            href="/login"
            className="text-brand-orange hover:text-brand-orange/80 font-medium transition-colors duration-150"
          >
            Logg inn
          </Link>
        </p>
      </div>
    </div>
  );
}
