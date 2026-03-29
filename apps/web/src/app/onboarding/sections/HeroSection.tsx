"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@smartout/supabase/client";
import { Mic, PenLine } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { EASE_EXPO } from "../lib/motion";

// ---------------------------------------------------------------------------
// Animated background orbs — slow-rotating glows behind the hero content
// ---------------------------------------------------------------------------

function HeroOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large warm orb — top right, slow clockwise rotation */}
      <motion.div
        className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.7 0.15 30 / 0.3) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />
      {/* Medium cool orb — bottom left, counter-clockwise */}
      <motion.div
        className="absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.6 0.12 250 / 0.25) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
      />
      {/* Small accent orb — center, gentle float */}
      <motion.div
        className="absolute top-1/3 left-1/2 h-[200px] w-[200px] -translate-x-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.75 0.1 60 / 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          y: [-20, 20, -20],
          x: [-10, 15, -10],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE_EXPO },
  },
};

// ---------------------------------------------------------------------------
// HeroSection
// ---------------------------------------------------------------------------

export function HeroSection() {
  const { isAuthenticated, completeSection, botsson } = useOnboarding();

  const supabase = createClient();

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
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      }
    } catch {
      setError("Noe gikk galt. Vennligst prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  // ── Authenticated: choose setup mode ──────────────────────────────────

  if (isAuthenticated) {
    return (
      <section className="relative flex min-h-svh items-center justify-center px-6">
        <HeroOrbs />

        <motion.div
          className="relative z-10 flex w-full max-w-lg flex-col items-center gap-10"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            variants={fadeUp}
            className="font-heading text-center text-6xl leading-[1.1] tracking-tight text-white sm:text-7xl"
          >
            La oss komme
            <br />i gang
          </motion.h1>

          <motion.p variants={fadeUp} className="text-center text-xl leading-relaxed text-white/50">
            Velg hvordan du vil sette opp bedriften din.
          </motion.p>

          <motion.div variants={fadeUp} className="flex w-full flex-col gap-4 sm:flex-row sm:gap-6">
            <div className="flex flex-1 flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  void botsson.startSession();
                }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-8 py-5 text-xl font-semibold text-black transition-colors hover:bg-white/90"
              >
                <Mic className="h-6 w-6" />
                Assistert
              </button>
              <p className="text-center text-sm text-white/30">~5 min</p>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <button
                type="button"
                onClick={() => completeSection("hero")}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.05] px-8 py-5 text-xl font-semibold text-white/70 transition-colors hover:bg-white/[0.08]"
              >
                <PenLine className="h-6 w-6" />
                Manuelt
              </button>
              <p className="text-center text-sm text-white/30">~10 min</p>
            </div>
          </motion.div>
        </motion.div>
      </section>
    );
  }

  // ── Not authenticated: sign up form ───────────────────────────────────

  return (
    <section className="relative flex min-h-svh items-center justify-center px-6">
      <HeroOrbs />

      <motion.div
        className="relative z-10 flex w-full max-w-lg flex-col items-center gap-10"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          variants={fadeUp}
          className="font-heading text-center text-6xl leading-[1.1] tracking-tight text-white sm:text-7xl"
        >
          Velkommen til
          <br />
          Smartout
        </motion.h1>

        <motion.p variants={fadeUp} className="text-center text-xl leading-relaxed text-white/50">
          Din AI-drevne arbeidsplassassistent.
          <br />
          La oss sette opp bedriften din.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] p-6"
        >
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
              className="rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3.5 text-base text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none disabled:opacity-50"
            />
            <input
              type="password"
              placeholder="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="rounded-xl border border-white/[0.06] bg-white/5 px-4 py-3.5 text-base text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none disabled:opacity-50"
            />

            {error && <p className="text-destructive text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3.5 text-base font-semibold text-black hover:bg-white/90 disabled:opacity-50"
            >
              {loading ? "Vennligst vent..." : isLoginMode ? "Logg inn" : "Opprett konto"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError(null);
              }}
              className="text-center text-sm text-white/40 transition-colors hover:text-white/60"
            >
              {isLoginMode
                ? "Har du ikke konto? Opprett en her"
                : "Har du allerede konto? Logg inn"}
            </button>
          </form>
        </motion.div>

        <motion.div variants={fadeUp} className="text-center">
          <button
            type="button"
            onClick={() => completeSection("hero")}
            className="text-sm text-white/25 transition-colors hover:text-white/40"
          >
            Hopp over
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
