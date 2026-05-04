"use client";

import { Suspense, useState, useEffect } from "react";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Sparkles, ArrowRight, Send } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { cn } from "@/lib/utils";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthIconInput } from "@/components/auth/AuthIconInput";

// UI Events:
// - nav: /join (form submit success, localhost)
// - nav: /dashboard (invite flow success — accept-invitation already provisioned profile)
// - nav: /login (footer link, success state link)
// - nav: / (offline state link)
// - action: handleGoogleSignup() (Google SSO button)
// - action: handleMagicLink() (magic link form)
// - action: handlePasswordSignup() (email+password form)
// - action: handleInviteAccept() (invite-aware submit — POST accept-invitation + signIn)

type InviteState = {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
  role: string;
};

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
  return (
    <Suspense fallback={<div className="bg-background min-h-[100dvh]" />}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Invite arrivals are pre-verified via the token (= proof of email
  // ownership), so we force password mode and skip the magic-link path.
  const [emailMethod, setEmailMethod] = useState<EmailMethod>(
    inviteToken ? "password" : "magic-link",
  );
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [invite, setInvite] = useState<InviteState | null>(null);
  const [inviteResolving, setInviteResolving] = useState<boolean>(Boolean(inviteToken));

  // Resolve the invitation server-side via the same RPC the /invite page uses.
  // We only pre-fill on `pending` (status check inside RPC). Anything else
  // (used / expired / unknown) falls through to the regular signup flow with
  // a soft error, because the user already has the form open.
  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: rpcError } = await supabase.rpc("get_invitation_by_token", {
          p_token: inviteToken,
        });
        if (cancelled) return;
        if (rpcError || !data || (data as { status?: string }).status !== "pending") {
          setError(
            "Invitasjonen ble ikke funnet eller er ikke lenger gyldig. Du kan fortsatt opprette en konto manuelt.",
          );
          setInviteResolving(false);
          return;
        }
        const inv = data as {
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          workspace_name: string | null;
          role: string;
        };
        if (!inv.email) {
          setInviteResolving(false);
          return;
        }
        setInvite({
          token: inviteToken,
          email: inv.email,
          firstName: inv.first_name ?? "",
          lastName: inv.last_name ?? "",
          workspaceName: inv.workspace_name ?? "din nye arbeidsplass",
          role: inv.role,
        });
        setEmail(inv.email);
        setInviteResolving(false);
      } catch {
        if (cancelled) return;
        setInviteResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  useEffect(() => {
    // Don't override an invite-supplied email with a stale localStorage value.
    if (inviteToken) return;
    const pending = getPendingSignup();
    if (pending) setEmail(pending.email);
  }, [inviteToken]);

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

  /**
   * Invite arrival: caller has clicked a Smartout-issued link with a token
   * that is itself proof of email ownership. We POST directly to the
   * accept-invitation Edge Function (same path mobile uses), which:
   *   1. Creates the auth user with the supplied password (no email confirm)
   *   2. Provisions user_identity, profile (status: trainee), company_member
   *   3. Flips invitation.status → accepted
   * Then we sign in client-side so the session is established and route to
   * /dashboard. This deliberately bypasses the magic-link / signUp path so
   * the user does NOT receive a second verification email.
   */
  async function handleInviteAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!invite) {
      setError("Invitasjonen er ikke klar ennå. Vent et øyeblikk og prøv igjen.");
      return;
    }
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
      // `supabase.functions.invoke` attaches the apikey + (if present) the
      // current session JWT automatically. accept-invitation runs with
      // `verify_jwt = false` so anon callers are accepted; the apikey
      // is what the gateway needs to route the request.
      const { data, error: invokeError } = await supabase.functions.invoke("accept-invitation", {
        body: {
          token: invite.token,
          first_name: invite.firstName || "Bruker",
          last_name: invite.lastName || "",
          email: invite.email,
          password,
        },
      });

      if (invokeError || (data && (data as { error?: string }).error)) {
        const msg =
          (data as { error?: string } | null)?.error ??
          invokeError?.message ??
          "Kunne ikke godta invitasjonen. Prøv igjen.";
        setError(msg);
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });
      if (signInError) {
        // Rare: account exists but sign-in failed. Send to /login with prefill.
        router.push(`/login?email=${encodeURIComponent(invite.email)}`);
        return;
      }

      clearPendingSignup();
      router.push("/dashboard");
    } catch (err) {
      if (isNetworkError(err)) {
        savePendingSignup(invite.email);
        setSavedOffline(true);
      } else {
        setError("Noe gikk galt. Prøv igjen.");
      }
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
            {invite ? "Bli med i teamet" : "Opprett konto"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {invite ? (
              <>
                Du er invitert til{" "}
                <strong className="text-foreground font-semibold">{invite.workspaceName}</strong>.
                Sett et passord for å fullføre.
              </>
            ) : (
              "Start ny arbeidsplass i Smartout."
            )}
          </p>
        </div>

        {/* Tabs: Magisk lenke / Passord — hidden on invite (forced password). */}
        {!invite && (
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
        )}

        {error && (
          <div className="border-destructive/20 bg-destructive/5 text-destructive animate-auth-in mb-5 rounded-xl border px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="animate-auth-in" style={{ animationDelay: "220ms" }}>
          {invite ? (
            <form onSubmit={handleInviteAccept} className="space-y-4">
              <AuthIconInput
                id="email-invite"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={invite.email}
                onChange={() => {
                  /* locked — invitation binds to this email */
                }}
                placeholder="navn@bedrift.no"
                label="E-post (fra invitasjon)"
                icon={<Mail className="h-4 w-4" />}
                readOnly
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
                label="Velg passord"
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
                disabled={loading || inviteResolving}
                className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Oppretter konto..." : "Godta invitasjon og bli med"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-muted-foreground text-xs leading-relaxed">
                E-postadressen din er allerede bekreftet via invitasjonen — ingen ekstra
                e-postverifisering nødvendig.
              </p>
            </form>
          ) : emailMethod === "magic-link" ? (
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

        {/* Divider — hidden in invite flow (no SSO/alt method shown there). */}
        {!invite && (
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
        )}

        {/* Google SSO — hidden in invite flow (accept-invitation requires
            password-based provisioning to bind the auth user to the token). */}
        {!invite && (
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
        )}

        {/* Invitation hint — only shown to non-invitees (the invitee already
            arrived via the link this hint points to). */}
        {!invite && (
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
        )}

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
