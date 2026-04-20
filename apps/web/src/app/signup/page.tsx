"use client";

import { useState, useEffect } from "react";

import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Sparkles, ArrowRight, Send } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { cn } from "@/lib/utils";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthIconInput } from "@/components/auth/AuthIconInput";

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
        options: {
          emailRedirectTo: window.location.origin + "/api/auth/callback?next=/join",
        },
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
      setSuccess(true);
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

  // ── Confirmation / message states — rendered inside Nordic Split ──
  function renderConfirmation(
    title: string,
    body: React.ReactNode,
    linkHref: string,
    linkLabel: string,
  ) {
    return (
      <div className="animate-auth-in text-center" style={{ animationDelay: "100ms" }}>
        <div className="bg-success/10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Mail className="text-success h-6 w-6" />
        </div>
        <h2 className="font-heading text-foreground text-3xl tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{body}</p>
        <Link
          href={linkHref}
          className="text-brand-orange hover:text-brand-orange/80 mt-6 inline-block text-sm font-medium transition-colors duration-150"
        >
          {linkLabel}
        </Link>
      </div>
    );
  }

  let formContent: React.ReactNode;

  if (savedOffline) {
    formContent = renderConfirmation(
      "Registreringen er lagret",
      <>
        Vi har lagret e-postadressen din <strong className="text-foreground">{email}</strong>{" "}
        lokalt. Registreringen fullføres automatisk neste gang du besøker denne siden.
      </>,
      "/",
      "Tilbake til forsiden",
    );
  } else if (magicLinkSent) {
    formContent = renderConfirmation(
      "Sjekk e-posten din",
      <>
        Vi har sendt en innloggingslenke til <strong className="text-foreground">{email}</strong>.
        Klikk lenken for å komme i gang.
      </>,
      "/login",
      "Tilbake til innlogging",
    );
  } else if (success) {
    formContent = renderConfirmation(
      "Sjekk e-posten din",
      <>
        Vi har sendt en bekreftelseslenke til <strong className="text-foreground">{email}</strong>.
      </>,
      "/login",
      "Tilbake til innlogging",
    );
  } else {
    formContent = (
      <>
        <div className="animate-auth-in mb-8" style={{ animationDelay: "100ms" }}>
          <h1 className="font-heading text-foreground text-[2rem] leading-[1.1] tracking-tight">
            Opprett konto
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Start ny arbeidsplass i Smartout.</p>
        </div>

        {/* Tabs: Magisk lenke / Passord */}
        <div className="animate-auth-in mb-6" style={{ animationDelay: "160ms" }}>
          <div className="bg-muted/40 inline-flex rounded-xl p-1">
            {(
              [
                { value: "magic-link", label: "Magisk lenke" },
                { value: "password", label: "Passord" },
              ] as const
            ).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setEmailMethod(t.value);
                  setError(null);
                }}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-[0.8125rem] font-medium transition-all duration-200",
                  emailMethod === t.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="border-destructive/20 bg-destructive/5 text-destructive animate-auth-in mb-5 rounded-xl border px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="animate-auth-in" style={{ animationDelay: "220ms" }}>
          {emailMethod === "magic-link" ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <AuthIconInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="navn@bedrift.no"
                label="E-post"
                icon={<Mail className="h-4 w-4" />}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? "Sender lenke..." : "Send lenke"}
              </button>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Vi sender deg en magisk lenke. Ingen passord nødvendig.
              </p>
            </form>
          ) : (
            <form onSubmit={handlePasswordSignup} className="space-y-4">
              <AuthIconInput
                id="email-pw"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="navn@bedrift.no"
                label="E-post"
                icon={<Mail className="h-4 w-4" />}
              />
              <AuthIconInput
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 tegn"
                label="Passord"
                icon={<Lock className="h-4 w-4" />}
                withPasswordToggle
              />
              <AuthIconInput
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Bekreft passord"
                label="Bekreft"
                icon={<Lock className="h-4 w-4" />}
                withPasswordToggle
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Oppretter konto..." : "Opprett konto"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        {/* Divider */}
        <div className="animate-auth-in my-6" style={{ animationDelay: "280ms" }}>
          <div className="relative">
            <div className="border-border/80 absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background text-muted-foreground px-3 text-[0.6875rem] tracking-[0.1em] uppercase">
                eller
              </span>
            </div>
          </div>
        </div>

        {/* Google SSO */}
        <div className="animate-auth-in" style={{ animationDelay: "320ms" }}>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
            className="border-border bg-background text-foreground hover:bg-accent flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            <GoogleIcon />
            {googleLoading ? "Registrerer..." : "Fortsett med Google"}
          </button>
        </div>

        {/* Invitation hint */}
        <div
          className="animate-auth-in border-brand-orange/20 bg-brand-orange/5 mt-5 flex gap-3 rounded-xl border p-4"
          style={{ animationDelay: "380ms" }}
        >
          <Sparkles className="text-brand-orange/80 mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-[0.8125rem] leading-relaxed">
            <strong className="text-foreground font-semibold">
              Er du invitert av en arbeidsgiver?
            </strong>
            <br />
            <span className="text-muted-foreground">
              Bruk invitasjons-lenken du fikk på e-post eller SMS.
            </span>
          </div>
        </div>

        {/* Footer link */}
        <p
          className="animate-auth-in border-border/60 text-muted-foreground mt-8 border-t pt-5 text-sm"
          style={{ animationDelay: "440ms" }}
        >
          Har du konto?{" "}
          <Link
            href="/login"
            className="text-foreground hover:text-brand-orange font-medium transition-colors duration-150"
          >
            Logg inn →
          </Link>
        </p>
      </>
    );
  }

  return (
    <div className="bg-background relative flex min-h-[100dvh] overflow-hidden">
      <AuthBrandPanel
        headline={
          <>
            Teamet ditt,
            <br />
            <span style={{ color: "oklch(0.78 0.16 45)" }}>klar</span> fra dag en.
          </>
        }
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden">
          <Image src="/smartout-logo.png" alt="Smartout" width={120} height={42} priority />
        </div>

        <div className="w-full max-w-[400px]">{formContent}</div>
      </div>
    </div>
  );
}
