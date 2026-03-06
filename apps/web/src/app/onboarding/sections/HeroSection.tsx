"use client";

import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { Mail, Mic, PenLine } from "lucide-react";
import { motion } from "framer-motion";
import { useOnboarding } from "../WizardContext";

// UI Events:
// - action: handleSignUp / handleSignIn / handleGoogleSSO
// - action: botsson.startSession() — assisted mode
// - action: completeSection("hero") — manual mode

export function HeroSection() {
  const { isAuthenticated, completeSection, botsson } = useOnboarding();

  const supabase = createClient();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        if (
          signUpError.message.includes("already registered") ||
          signUpError.message.includes("already been registered")
        ) {
          setError("Denne e-posten er allerede registrert. Prøv å logge inn i stedet.");
          setIsLoginMode(true);
        } else {
          setError(signUpError.message);
        }
      }
    } catch {
      setError("Noe gikk galt. Vennligst prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
    } catch {
      setError("Noe gikk galt. Vennligst prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSSO() {
    setError(null);
    setLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/onboarding" },
      });
      if (oauthError) setError(oauthError.message);
    } catch {
      setError("Noe gikk galt med Google-innlogging.");
    } finally {
      setLoading(false);
    }
  }

  // Authenticated — pick your mode
  if (isAuthenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-8 py-20">
        <motion.div
          className="w-full max-w-2xl text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="font-heading text-[clamp(4rem,10vw,8rem)] leading-[0.9] tracking-tight text-white">
            La oss bygge
            <br />
            arbeidsplassen
            <br />
            <span className="text-white/25">din.</span>
          </h1>

          <p className="mt-8 text-xl text-white/35">Velg hvordan du vil komme i gang.</p>

          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => void botsson.startSession()}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white px-10 py-5 text-lg font-semibold text-black transition-all hover:bg-white/90"
            >
              <Mic className="h-5 w-5" />
              Assistert
              <span className="text-sm font-normal text-black/50">~5 min</span>
            </button>
            <button
              type="button"
              onClick={() => completeSection("hero")}
              className="flex items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-10 py-5 text-lg font-semibold text-white/60 transition-all hover:bg-white/[0.08]"
            >
              <PenLine className="h-5 w-5" />
              Manuelt
              <span className="text-sm font-normal text-white/30">~10 min</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Unauthenticated — sign up / login
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left: The big statement */}
      <div className="flex flex-col justify-center px-10 py-20 lg:w-[55%] lg:px-20">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">
            Smartout
          </p>
          <h1 className="font-heading mt-6 text-[clamp(4rem,9vw,7.5rem)] leading-[0.88] tracking-tight text-white">
            Din AI-
            <br />
            drevne
            <br />
            arbeids-
            <br />
            <span className="text-white/25">plass.</span>
          </h1>
          <p className="mt-8 max-w-sm text-xl leading-relaxed text-white/35">
            Onboarding, opplæring og daglig støtte — alt på én plass.
          </p>
        </motion.div>
      </div>

      {/* Right: Auth form */}
      <div className="flex flex-col justify-center border-t border-white/[0.04] px-10 py-16 lg:w-[45%] lg:border-t-0 lg:border-l lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <h2 className="text-2xl font-semibold text-white">Kom i gang</h2>
          <p className="mt-2 text-base text-white/35">Opprett konto eller logg inn.</p>

          <div className="mt-8 flex flex-col gap-4">
            {/* Google SSO */}
            <button
              type="button"
              onClick={handleGoogleSSO}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-base font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
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
              Fortsett med Google
            </button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-sm text-white/25">eller</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {!showEmailForm ? (
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.05] px-6 py-4 text-base font-semibold text-white/60 transition-colors hover:bg-white/[0.08]"
              >
                <Mail className="h-5 w-5" />
                {isLoginMode ? "Logg inn med e-post" : "Opprett konto med e-post"}
              </button>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
                <form
                  onSubmit={isLoginMode ? handleSignIn : handleSignUp}
                  className="flex flex-col gap-4"
                >
                  <input
                    type="email"
                    placeholder="E-post"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                    className="rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none disabled:opacity-50"
                  />
                  <input
                    type="password"
                    placeholder="Passord"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none disabled:opacity-50"
                  />
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-white py-3 text-base font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                  >
                    {loading ? "Vennligst vent..." : isLoginMode ? "Logg inn" : "Opprett konto"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginMode(!isLoginMode);
                      setError(null);
                    }}
                    className="text-sm text-white/35 hover:text-white/55"
                  >
                    {isLoginMode
                      ? "Har du ikke konto? Opprett en"
                      : "Har du allerede konto? Logg inn"}
                  </button>
                </form>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => completeSection("hero")}
            className="mt-8 text-sm text-white/20 transition-colors hover:text-white/40"
          >
            Hopp over
          </button>
        </motion.div>
      </div>
    </div>
  );
}
