"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

export default function LoginPage() {
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
      setError("Noe gikk galt med Google-innlogging.");
      setGoogleLoading(false);
    }
  }

  // Sends an OTP to the given email. Never reveals whether the email exists in the system.
  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    // shouldCreateUser: false — OTP login only works for existing accounts.
    // We don't await for a specific error to avoid leaking email existence.
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setOtpSent(true);
    setLoading(false);
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
          setError("Kunne ikke koble til databasen. Sjekk at Supabase kjører lokalt.");
          setLoading(false);
          return;
        }
        if (
          authError.message.includes("Invalid login credentials") ||
          authError.message.includes("invalid_credentials")
        ) {
          setError("Feil e-post eller passord.");
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
        setError("Kunne ikke koble til serveren. Prøv igjen om litt.");
      } else {
        setError("Noe gikk galt. Prøv igjen.");
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
        <div className="absolute inset-0 bg-[oklch(0.18_0.03_50)]" />

        {/* Darkening overlay when logging in */}
        <motion.div
          className="absolute inset-0 bg-[oklch(0.06_0.015_50)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoggingIn ? 1 : 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
        />

        {/* Ambient orbs — radial gradients (Nordic Split spec) */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 35%, oklch(0.72 0.16 45 / 0.35), transparent 55%)," +
              "radial-gradient(circle at 72% 72%, oklch(0.65 0.22 40 / 0.22), transparent 60%)," +
              "radial-gradient(circle at 20% 90%, oklch(0.55 0.18 300 / 0.10), transparent 55%)",
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
                    Teamet ditt,
                    <br />
                    <span className="text-[oklch(0.75_0.18_40)]">klar</span> fra dag en.
                  </h2>
                  <p className="mt-5 text-[0.95rem] leading-relaxed text-white/50">
                    Alt du trenger for opplæring, drift og utvikling — samlet i ett system.
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
                    Bygg noe
                    <br />
                    <span className="text-[oklch(0.75_0.18_40)]">teamet ditt</span>
                    <br />
                    fortjener.
                  </h2>
                  <p className="mt-4 text-[0.9rem] leading-relaxed text-white/50">
                    Opplæring, drift og utvikling — klart på under fem minutter.
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
                    La oss sette
                    <br />
                    <span className="text-[oklch(0.75_0.18_40)]">i gang.</span>
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
                    Der er du jo.
                  </h2>
                  <p className="mt-5 text-[0.95rem] leading-relaxed text-white/35">
                    Dashboardet ditt er klart.
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
        className="relative flex w-full flex-1 flex-col items-center justify-center bg-[oklch(0.99_0.004_60)] px-6 py-12"
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
          className="absolute top-0 left-0 hidden h-full w-px bg-gradient-to-b from-transparent via-[oklch(0_0_0/0.06)] to-transparent lg:block"
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
                    <h1 className="font-heading text-[2rem] leading-[1.15] font-bold tracking-tight text-[oklch(0.15_0.01_50)]">
                      Velkommen tilbake
                    </h1>
                    <p className="mt-2 text-[0.875rem] text-[oklch(0.5_0.01_52)]">
                      Logg inn for å fortsette til Smartout.
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
                      Sesjonen er utløpt — logg inn for å fortsette der du slapp.
                    </div>
                  </motion.div>
                )}

                {/* Auth method tabs — toggle between password and OTP */}
                <motion.div
                  variants={itemVariant}
                  className={!hasInteracted ? "animate-auth-in" : undefined}
                  style={!hasInteracted ? { animationDelay: "40ms" } : undefined}
                >
                  <div className="mb-6 flex gap-1 rounded-xl bg-[oklch(0.95_0.004_55)] p-1">
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
                          ? "bg-white text-[oklch(0.15_0.01_50)] shadow-sm"
                          : "text-[oklch(0.5_0.01_52)] hover:text-[oklch(0.3_0.01_50)]",
                      )}
                    >
                      E-post og passord
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
                          ? "bg-white text-[oklch(0.15_0.01_50)] shadow-sm"
                          : "text-[oklch(0.5_0.01_52)] hover:text-[oklch(0.3_0.01_50)]",
                      )}
                    >
                      Engangskode
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
                        className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-[oklch(0.9_0.006_55)] bg-white px-4 py-2.5 text-[0.875rem] font-medium text-[oklch(0.2_0.01_50)] shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                      >
                        <GoogleIcon />
                        {googleLoading ? "Logger inn..." : "Fortsett med Google"}
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
                          <div className="w-full border-t border-[oklch(0.92_0.005_55)]" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-[oklch(0.99_0.004_60)] px-3 text-xs text-[oklch(0.6_0.01_52)]">
                            eller
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
                          placeholder="din@epost.no"
                          label="E-post"
                          icon={<Mail className="h-4 w-4" />}
                        />
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label
                              htmlFor="password"
                              className="text-foreground text-[0.8125rem] font-medium"
                            >
                              Passord
                            </label>
                            <Link
                              href="/reset-password"
                              className="text-muted-foreground hover:text-brand-orange text-[0.8125rem] transition-colors"
                            >
                              Glemt passord?
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
                            className="bg-brand-orange w-full rounded-xl px-4 py-3 text-[0.875rem] font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                          >
                            {loading ? "Logger inn..." : "Logg inn"}
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
                        <p className="text-center text-[0.8125rem] text-[oklch(0.5_0.01_52)]">
                          Hvis denne e-posten finnes, har vi sendt en kode
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
                          Vi sender en engangskode til e-posten din
                        </p>
                        <AuthIconInput
                          id="otp-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="din@epost.no"
                          label="E-post"
                          icon={<Mail className="h-4 w-4" />}
                        />
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={loading || !email.includes("@")}
                          className="bg-brand-orange w-full rounded-xl px-4 py-3 text-[0.875rem] font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                        >
                          {loading ? "Sender..." : "Send kode"}
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
                  <p className="mt-8 text-center text-[0.8125rem] text-[oklch(0.55_0.01_52)]">
                    Har du ikke konto?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="cursor-pointer font-medium text-[oklch(0.65_0.22_40)] transition-colors hover:text-[oklch(0.55_0.22_40)]"
                    >
                      Opprett konto
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
                    <h1 className="font-heading text-[2.2rem] leading-[1.1] font-bold tracking-tight text-[oklch(0.15_0.01_50)]">
                      Kom i gang
                    </h1>
                    <p className="mt-3 text-[0.9rem] leading-relaxed text-[oklch(0.5_0.01_52)]">
                      Sett opp bedriften din på under fem minutter.
                      <br />
                      Ingen kredittkort. Ingen forpliktelser.
                    </p>
                  </div>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <button
                    type="button"
                    onClick={() => switchMode("navigating")}
                    className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl bg-[oklch(0.65_0.22_40)] px-4 py-3.5 text-[0.9rem] font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98]"
                  >
                    Start registrering
                    <ArrowRightIcon />
                  </button>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[oklch(0.92_0.005_55)]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[oklch(0.99_0.004_60)] px-3 text-xs text-[oklch(0.6_0.01_52)]">
                        eller
                      </span>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <button
                    type="button"
                    onClick={() => switchMode("navigating")}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-[oklch(0.9_0.006_55)] bg-white px-4 py-3 text-[0.875rem] font-medium text-[oklch(0.2_0.01_50)] shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                  >
                    <GoogleIcon />
                    Registrer med Google
                  </button>
                </motion.div>

                <motion.div variants={itemVariant}>
                  <p className="mt-10 text-center text-[0.8125rem] text-[oklch(0.55_0.01_52)]">
                    Har du allerede konto?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="cursor-pointer font-medium text-[oklch(0.65_0.22_40)] transition-colors hover:text-[oklch(0.55_0.22_40)]"
                    >
                      Logg inn
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
                        <div className="absolute inset-0 rounded-full border-2 border-[oklch(0.65_0.22_40/0.15)]" />
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[oklch(0.65_0.22_40)]"
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
                          className="absolute inset-[-8px] rounded-full border-2 border-[oklch(0.65_0.22_40)]"
                          initial={{ scale: 0.5, opacity: 1 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                        {/* Check circle */}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[oklch(0.65_0.22_40)]">
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
                      <h2 className="mb-3 text-[1.4rem] font-semibold tracking-tight text-[oklch(0.2_0.01_50)]">
                        Gjør deg klar...
                      </h2>

                      {/* Pulsing subtitle */}
                      <div className="h-6">
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={navStep}
                            className="text-[0.875rem] text-[oklch(0.55_0.01_52)]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                          >
                            {navStep === 0 && "Et øyeblikk..."}
                            {navStep === 1 && "Fremtiden er her."}
                            {navStep === 2 && "Er du klar?"}
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
                  <div className="absolute inset-0 rounded-full border-2 border-[oklch(0.65_0.22_40/0.12)]" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-[oklch(0.65_0.22_40/0.6)]"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <p className="text-[0.8125rem] text-[oklch(0.5_0.01_52)]">Logger inn...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
