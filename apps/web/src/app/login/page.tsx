"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { cn } from "@/lib/utils";
import { validateReturnTo } from "@/lib/safe-redirect";
import { OtpVerificationForm } from "@/components/auth/OtpVerificationForm";
import { AuthIconInput } from "@/components/auth/AuthIconInput";
import { useTranslation } from "@smartout/i18n";

/* ─────────────────────────────────────────────────────
   Nordic Split — Choreographed panel swap

   Animation philosophy: ONE thing at a time, sequentially.

   Login ↔ Signup: content stagger out/in, panel resize
   Start registrering: full panel swap → redirect /join
   Login success: brand darkens + expands → redirect /dashboard
   ───────────────────────────────────────────────────── */

type Mode = "login" | "signup" | "navigating" | "logging-in";

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

function ArrowRightIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

/* ── Springs ── */

// Panel resize — heavier and slower
const panelSpring = {
  type: "spring" as const,
  stiffness: 35,
  damping: 20,
  mass: 2.2,
};

// Full panel swap — heavy, cinematic
const swapSpring = {
  type: "spring" as const,
  stiffness: 45,
  damping: 22,
  mass: 2,
};

// Logging in — smooth expand
const expandSpring = {
  type: "spring" as const,
  stiffness: 30,
  damping: 24,
  mass: 2.5,
};

/* ── Stagger variants ── */

const loginContainer = {
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
  exit: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
};

const signupContainer = {
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
  exit: {
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
};

const itemVariant = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const brandTextVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] as const, delay: 0.5 },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

function LoginContent() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const routerRef = useRef(router);
  const searchParams = useSearchParams();

  // Safe-validated return_to: only allow known prefixes — open-redirect guard.
  const returnTo =
    validateReturnTo(searchParams.get("return_to"), {
      allowedPrefixes: ["/join", "/onboarding", "/dashboard"],
    }) ?? "/dashboard";

  // Banner shown when user was redirected here because their session expired mid-wizard.
  const expiredReason = searchParams.get("reason") === "expired";

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [mode, setMode] = useState<Mode>("login");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const switchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const [navStep, setNavStep] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // OTP login method state
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [otpSent, setOtpSent] = useState(false);

  // Delayed mode switch: let button animation breathe, then start transition
  const switchMode = useCallback((next: Mode) => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
    setHasInteracted(true);
    switchTimer.current = setTimeout(() => {
      setPendingMode(next);
    }, 280);
  }, []);

  const handleExitComplete = useCallback(() => {
    if (pendingMode !== null) {
      setMode(pendingMode);
      setPendingMode(null);
    }
  }, [pendingMode]);

  const showContent = pendingMode === null;

  // Hype sequence: cycle through messages, then redirect
  useEffect(() => {
    if (mode !== "navigating") return;
    const delays = [1500, 1500, 1500, 1200];
    if (navStep < delays.length) {
      const t = setTimeout(() => setNavStep((s) => s + 1), delays[navStep]);
      return () => clearTimeout(t);
    }
    console.warn("[hype] Redirecting to /join");
    window.location.href = "/join";
  }, [mode, navStep]);

  // Navigate after panel animations settle (logging in)
  useEffect(() => {
    if (mode !== "logging-in") return;
    const t = setTimeout(() => {
      routerRef.current.push(returnTo);
      routerRef.current.refresh();
    }, 1100);
    return () => clearTimeout(t);
  }, [mode, returnTo]);

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/api/auth/callback?next=/dashboard",
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch {
      setError(t("login.error.google"));
      setGoogleLoading(false);
    }
  }

  // Sends an OTP to the given email. Default Supabase email template carries
  // both a 6-digit code AND a magic link. The magic link path needs the same
  // `/api/auth/callback?next=` redirect the password-reset flow uses — without
  // it, the link lands on `site_url` with `?code=PKCE_CODE` and no handler,
  // so the click is silently lost. Code-typing path is unaffected.
  //
  // Enumeration safety: with `shouldCreateUser: false`, GoTrue returns
  // "Signups not allowed for otp" (code `otp_disabled`) for emails that don't
  // exist (supabase/auth#1547). Surfacing that message would leak account
  // existence, so we treat it as success and advance to the digit screen
  // exactly as for a real user. Only genuine send failures (rate-limit, SMTP,
  // network) reach the UI, and they show a generic i18n message — never the
  // raw English Supabase string.
  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    const isEnumerationSignal =
      otpError?.code === "otp_disabled" || /signups not allowed/i.test(otpError?.message ?? "");
    if (otpError && !isEnumerationSignal) {
      setError(t("login.error.otp_send"));
      return;
    }
    setOtpSent(true);
  }

  function handleOtpVerified() {
    setHasInteracted(true);
    setTimeout(() => setPendingMode("logging-in"), 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (
          authError.message.includes("Failed to fetch") ||
          authError.message.includes("fetch failed") ||
          authError.message.includes("NetworkError") ||
          authError.message.includes("network")
        ) {
          setError(t("login.error.network"));
          setLoading(false);
          return;
        }
        if (
          authError.message.includes("Invalid login credentials") ||
          authError.message.includes("invalid_credentials")
        ) {
          setError(t("login.error.credentials"));
          setLoading(false);
          return;
        }
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Breathe, then darken + navigate
      setHasInteracted(true);
      setTimeout(() => setPendingMode("logging-in"), 200);
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError(t("login.error.server"));
      } else {
        setError(t("login.error.generic"));
      }
      setLoading(false);
    }
  }

  // ── Panel positions ──
  const isSwapped = mode === "navigating";
  const isLoggingIn = mode === "logging-in";
  const brandPanelX = isSwapped ? "100%" : "0%";
  const formPanelX = isSwapped ? "-100%" : "0%";
  const brandPanelFlex = isLoggingIn ? 3 : mode === "signup" ? 0.6 : 1;
  const formMaxWidth = isLoggingIn ? "280px" : mode === "signup" ? "600px" : "520px";
  const contentMaxWidth =
    mode === "signup" ? "400px" : mode === "navigating" || isLoggingIn ? "320px" : "360px";

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden">
      <div className="bg-noise pointer-events-none fixed inset-0 z-30 opacity-[0.025] mix-blend-overlay" />

      {/* ── BRAND PANEL ── */}
      <motion.div
        className="relative hidden overflow-hidden lg:flex"
        style={{ willChange: "transform, flex" }}
        initial={false}
        animate={{
          x: brandPanelX,
          flex: isSwapped ? 1 : brandPanelFlex,
        }}
        transition={isSwapped ? swapSpring : isLoggingIn ? expandSpring : panelSpring}
      >
        <div className="absolute inset-0 bg-[var(--panel)]" />

        {/* Darkening overlay when logging in */}
        <motion.div
          className="absolute inset-0 bg-[var(--panel-deep)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoggingIn ? 1 : 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
        />

        {/* Ambient orbs — radial gradients (Nordic Split spec).
            ADR-0366 sweep wrote `var(--brand-orange-warm) 35%` for the first
            orb — that's a gradient stop, not an alpha. It painted a solid
            disc to 35% of the radius. Use color-mix to recover ambient alpha. */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 35%, color-mix(in oklch, var(--brand-orange-warm) 35%, transparent), transparent 55%)," +
              "radial-gradient(circle at 72% 72%, color-mix(in oklch, var(--brand-orange) 22%, transparent), transparent 60%)," +
              "radial-gradient(circle at 20% 90%, color-mix(in oklch, var(--brand-purple) 10%, transparent), transparent 55%)",
          }}
          animate={{ opacity: isLoggingIn ? 0.45 : 1 }}
          transition={{ duration: 1.5 }}
        />
        <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
          <div className="animate-auth-in" style={{ animationDelay: "0ms" }}>
            <Image
              src="/smartout-logo.png"
              alt="Smartout"
              width={110}
              height={38}
              className="opacity-80 brightness-0 invert"
              priority
            />
          </div>

          <div className="max-w-[360px]">
            <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
              {showContent && mode === "login" && (
                <motion.div
                  key="brand-login"
                  variants={brandTextVariant}
                  initial={hasInteracted ? "hidden" : false}
                  animate="visible"
                  exit="exit"
                  className={!hasInteracted ? "animate-auth-in" : undefined}
                  style={!hasInteracted ? { animationDelay: "200ms" } : undefined}
                >
                  <h2 className="font-heading text-[2.6rem] leading-[1.05] font-bold tracking-tight text-white">
                    {t("login.brand.tagline")}
                    <br />
                    <span className="text-brand-orange-light">{t("login.brand.ready")}</span>{" "}
                    {t("login.brand.tagline_suffix")}
                  </h2>
                  <p className="mt-5 text-[0.95rem] leading-relaxed text-white/50">
                    {t("login.brand.subtitle")}
                  </p>
                </motion.div>
              )}
              {showContent && mode === "signup" && (
                <motion.div
                  key="brand-signup"
                  variants={brandTextVariant}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <h2 className="font-heading text-[2.2rem] leading-[1.1] font-bold tracking-tight text-white">
                    {t("login.brand.signup_heading")}
                    <br />
                    <span className="text-brand-orange-light">{t("login.brand.signup_team")}</span>
                    <br />
                    {t("login.brand.signup_suffix")}
                  </h2>
                  <p className="mt-4 text-[0.9rem] leading-relaxed text-white/50">
                    {t("login.brand.signup_subtitle")}
                  </p>
                </motion.div>
              )}
              {showContent && mode === "navigating" && (
                <motion.div
                  key="brand-navigating"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <h2 className="font-heading text-[2.6rem] leading-[1.05] font-bold tracking-tight text-white">
                    {t("login.brand.lets_go")}
                    <br />
                    <span className="text-brand-orange-light">
                      {t("login.brand.lets_go_suffix")}
                    </span>
                  </h2>
                </motion.div>
              )}
              {showContent && mode === "logging-in" && (
                <motion.div
                  key="brand-logging-in"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <h2 className="font-heading text-[2.6rem] leading-[1.05] font-bold tracking-tight text-white">
                    {t("login.brand.welcome_back")}
                  </h2>
                  <p className="mt-5 text-[0.95rem] leading-relaxed text-white/35">
                    {t("login.brand.dashboard_ready")}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.p
            className="text-[0.75rem] text-white/25"
            animate={{ opacity: isLoggingIn ? 0 : 1 }}
            transition={{ duration: 0.5 }}
          >
            &copy; 2026 Smartout AS
          </motion.p>
        </div>
      </motion.div>

      {/* ── FORM PANEL ── */}
      <motion.div
        className="relative flex w-full flex-1 flex-col items-center justify-center bg-[var(--surface-base)] px-6 py-12"
        style={{ willChange: "transform, max-width", maxWidth: "520px" }}
        initial={false}
        animate={{
          x: formPanelX,
          maxWidth: isSwapped ? "520px" : formMaxWidth,
        }}
        transition={isSwapped ? swapSpring : isLoggingIn ? expandSpring : panelSpring}
      >
        {/* Edge line — hidden when swapped */}
        <motion.div
          className="absolute top-0 left-0 hidden h-full w-px bg-gradient-to-b from-transparent via-black/6 to-transparent lg:block"
          animate={{ opacity: isSwapped || isLoggingIn ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        />

        {/* Mobile logo */}
        <div className="mb-10 lg:hidden">
          <Image
            src="/smartout-logo.png"
            alt="Smartout"
            width={120}
            height={42}
            className="inline-block"
            priority
          />
        </div>

        <motion.div
          className="w-full"
          initial={false}
          animate={{ maxWidth: contentMaxWidth }}
          transition={panelSpring}
        >
          <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
            {/* ── LOGIN FORM ── */}
            {showContent && mode === "login" && (
              <motion.div
                key="form-login"
                variants={loginContainer}
                initial={hasInteracted ? "hidden" : false}
                animate="visible"
                exit="exit"
              >
                {/* Heading */}
                <motion.div
                  variants={itemVariant}
                  className={!hasInteracted ? "animate-auth-in" : undefined}
                  style={!hasInteracted ? { animationDelay: "0ms" } : undefined}
                >
                  <div className="mb-8">
                    <h1 className="font-heading text-[2rem] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
                      {t("login.heading")}
                    </h1>
                    <p className="mt-2 text-[0.875rem] text-[var(--text-dim)]">
                      {t("login.subtitle")}
                    </p>
                  </div>
                </motion.div>

                {/* Expired-session banner — shown when redirected from /join with reason=expired */}
                {expiredReason && (
                  <motion.div
                    variants={itemVariant}
                    className={!hasInteracted ? "animate-auth-in" : undefined}
                    style={!hasInteracted ? { animationDelay: "20ms" } : undefined}
                  >
                    <div className="border-border bg-muted text-foreground mb-6 rounded-lg border p-3 text-sm">
                      {t("login.session_expired")}
                    </div>
                  </motion.div>
                )}

                {/* Auth method tabs — toggle between password and OTP */}
                <motion.div
                  variants={itemVariant}
                  className={!hasInteracted ? "animate-auth-in" : undefined}
                  style={!hasInteracted ? { animationDelay: "40ms" } : undefined}
                >
                  <div className="mb-6 flex gap-1 rounded-xl bg-[var(--surface-raised)] p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod("password");
                        setOtpSent(false);
                        setError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-[0.8125rem] font-medium transition-all duration-200",
                        authMethod === "password"
                          ? "bg-white text-[var(--foreground)] shadow-sm"
                          : "text-[var(--text-dim)] hover:text-[var(--text-mid)]",
                      )}
                    >
                      {t("login.method.password")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod("otp");
                        setError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-[0.8125rem] font-medium transition-all duration-200",
                        authMethod === "otp"
                          ? "bg-white text-[var(--foreground)] shadow-sm"
                          : "text-[var(--text-dim)] hover:text-[var(--text-mid)]",
                      )}
                    >
                      {t("login.method.otp")}
                    </button>
                  </div>
                </motion.div>

                {/* Error — shown for both auth methods */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="border-destructive/20 bg-destructive/5 text-destructive overflow-hidden rounded-xl border px-4 py-3 text-center text-[0.8125rem] leading-snug"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Password method: Google SSO + divider + email/password form */}
                {authMethod === "password" && (
                  <>
                    {/* Google SSO */}
                    <motion.div
                      variants={itemVariant}
                      className={!hasInteracted ? "animate-auth-in" : undefined}
                      style={!hasInteracted ? { animationDelay: "80ms" } : undefined}
                    >
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading || loading}
                        className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-[0.875rem] font-medium text-[var(--text-strong)] shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                      >
                        <GoogleIcon />
                        {googleLoading ? t("login.google.loading") : t("login.google.button")}
                      </button>
                    </motion.div>

                    {/* Divider */}
                    <motion.div
                      variants={itemVariant}
                      className={!hasInteracted ? "animate-auth-in" : undefined}
                      style={!hasInteracted ? { animationDelay: "140ms" } : undefined}
                    >
                      <div className="relative my-7">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[var(--border)]" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-[var(--surface-base)] px-3 text-xs text-[var(--text-dim)]">
                            {t("login.divider")}
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Form */}
                    <motion.div
                      variants={itemVariant}
                      className={!hasInteracted ? "animate-auth-in" : undefined}
                      style={!hasInteracted ? { animationDelay: "200ms" } : undefined}
                    >
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <AuthIconInput
                          data-testid="login-email"
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("login.email.placeholder")}
                          label={t("login.email.label")}
                          icon={<Mail className="h-4 w-4" />}
                        />
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label
                              htmlFor="password"
                              className="text-foreground text-[0.8125rem] font-medium"
                            >
                              {t("login.password.label")}
                            </label>
                            <Link
                              href="/reset-password"
                              className="text-muted-foreground hover:text-brand-orange text-[0.8125rem] transition-colors"
                            >
                              {t("login.forgot_password")}
                            </Link>
                          </div>
                          <AuthIconInput
                            data-testid="login-password"
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            icon={<Lock className="h-4 w-4" />}
                            withPasswordToggle
                          />
                        </div>
                        <div className="pt-2">
                          <button
                            data-testid="login-submit"
                            type="submit"
                            disabled={loading}
                            className="bg-brand-orange w-full rounded-xl px-4 py-3 text-[0.875rem] font-semibold text-white shadow-[var(--shadow-cta-sm)] transition-[transform,box-shadow,filter] duration-200 hover:shadow-[var(--shadow-cta-md)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                          >
                            {loading ? t("login.submit.loading") : t("login.submit.idle")}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </>
                )}

                {/* OTP method: email input → send code → OTP digit inputs */}
                {authMethod === "otp" && (
                  <motion.div
                    variants={itemVariant}
                    className={!hasInteracted ? "animate-auth-in" : undefined}
                    style={!hasInteracted ? { animationDelay: "80ms" } : undefined}
                  >
                    {otpSent ? (
                      <div className="space-y-4">
                        <p className="text-center text-[0.8125rem] text-[var(--text-dim)]">
                          {t("otp.ifExists")}
                        </p>
                        <OtpVerificationForm
                          email={email}
                          context="login"
                          onVerified={handleOtpVerified}
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-muted-foreground text-[0.8125rem]">
                          {t("login.otp.description")}
                        </p>
                        <AuthIconInput
                          id="otp-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("login.email.placeholder")}
                          label={t("login.email.label")}
                          icon={<Mail className="h-4 w-4" />}
                        />
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={loading || !email.includes("@")}
                          className="bg-brand-orange w-full rounded-xl px-4 py-3 text-[0.875rem] font-semibold text-white shadow-[var(--shadow-cta-sm)] transition-[transform,box-shadow,filter] duration-200 hover:shadow-[var(--shadow-cta-md)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                        >
                          {loading ? t("login.otp.loading") : t("login.method.sendCode")}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Footer: Opprett konto */}
                <motion.div
                  variants={itemVariant}
                  className={!hasInteracted ? "animate-auth-in" : undefined}
                  style={!hasInteracted ? { animationDelay: "280ms" } : undefined}
                >
                  <p className="mt-8 text-center text-[0.8125rem] text-[var(--text-dim)]">
                    {t("login.no_account")}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="text-brand-orange hover:text-brand-orange-dark cursor-pointer font-medium transition-colors"
                    >
                      {t("login.create_account")}
                    </button>
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* ── SIGNUP CTA ── */}
            {showContent && mode === "signup" && (
              <motion.div
                key="form-signup"
                variants={signupContainer}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <motion.div variants={itemVariant}>
                  <div className="mb-10">
                    <h1 className="font-heading text-[2.2rem] leading-[1.1] font-bold tracking-tight text-[var(--foreground)]">
                      {t("login.signup.heading")}
                    </h1>
                    <p className="mt-3 text-[0.9rem] leading-relaxed text-[var(--text-dim)]">
                      {t("login.signup.subtitle")}
                      <br />
                      {t("login.signup.no_credit_card")}
                    </p>
                  </div>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <button
                    type="button"
                    onClick={() => switchMode("navigating")}
                    className="bg-brand-orange mb-4 flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-[0.9rem] font-semibold text-white shadow-[var(--shadow-cta-sm)] transition-[transform,box-shadow,filter] duration-200 hover:shadow-[var(--shadow-cta-md)] hover:brightness-110 active:scale-[0.98]"
                  >
                    {t("login.signup.start")}
                    <ArrowRightIcon />
                  </button>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--border)]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[var(--surface-base)] px-3 text-xs text-[var(--text-dim)]">
                        {t("login.divider")}
                      </span>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <button
                    type="button"
                    onClick={() => switchMode("navigating")}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-[0.875rem] font-medium text-[var(--text-strong)] shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.98]"
                  >
                    <GoogleIcon />
                    {t("login.signup.google")}
                  </button>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <p className="mt-10 text-center text-[0.8125rem] text-[var(--text-dim)]">
                    {t("login.signup.has_account")}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="text-brand-orange hover:text-brand-orange-dark cursor-pointer font-medium transition-colors"
                    >
                      {t("login.signup.login_link")}
                    </button>
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* ── NAVIGATING → /join — hype sequence ── */}
            {showContent && mode === "navigating" && (
              <motion.div
                key="form-navigating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                {/* Spinner → checkmark on finale */}
                <div className="relative mb-8 h-10 w-10">
                  <AnimatePresence mode="wait">
                    {navStep < 3 ? (
                      <motion.div
                        key="spinner"
                        className="absolute inset-0"
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="border-brand-orange/15 absolute inset-0 rounded-full border-2" />
                        <motion.div
                          className="border-t-brand-orange absolute inset-0 rounded-full border-2 border-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="check"
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 15,
                          mass: 0.8,
                        }}
                      >
                        {/* Burst ring */}
                        <motion.div
                          className="border-brand-orange absolute inset-[-8px] rounded-full border-2"
                          initial={{ scale: 0.5, opacity: 1 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                        {/* Check circle */}
                        <div className="bg-brand-orange flex h-10 w-10 items-center justify-center rounded-full">
                          <motion.svg
                            className="h-5 w-5 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                          >
                            <motion.path d="M5 13l4 4L19 7" />
                          </motion.svg>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Heading + subtitle — fade out on finale */}
                <AnimatePresence>
                  {navStep < 3 && (
                    <motion.div exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                      <h2 className="mb-3 text-[1.4rem] font-semibold tracking-tight text-[var(--text-strong)]">
                        {t("login.navigating.heading")}
                      </h2>

                      {/* Pulsing subtitle */}
                      <div className="h-6">
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={navStep}
                            className="text-[0.875rem] text-[var(--text-dim)]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                          >
                            {navStep === 0 && t("login.navigating.step0")}
                            {navStep === 1 && t("login.navigating.step1")}
                            {navStep === 2 && t("login.navigating.step2")}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── LOGGING IN → /dashboard ── */}
            {showContent && mode === "logging-in" && (
              <motion.div
                key="form-logging-in"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="relative mb-5 h-8 w-8">
                  <div className="border-brand-orange/12 absolute inset-0 rounded-full border-2" />
                  <motion.div
                    className="border-t-brand-orange/60 absolute inset-0 rounded-full border-2 border-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <p className="text-[0.8125rem] text-[var(--text-dim)]">
                  {t("login.logging_in.spinner")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[var(--surface-base)]" />}>
      <LoginContent />
    </Suspense>
  );
}
