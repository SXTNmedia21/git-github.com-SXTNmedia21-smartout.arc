"use client";

import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { ArrowRight, Mail } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

export function HeroSection() {
  const { isAuthenticated, completeSection } = useOnboarding();

  const supabase = createClient();

  const [showEmailForm, setShowEmailForm] = useState(false);
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

  async function handleGoogleSSO() {
    setError(null);
    setLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/onboarding",
        },
      });

      if (oauthError) {
        setError(oauthError.message);
      }
    } catch {
      setError("Noe gikk galt med Google-innlogging.");
    } finally {
      setLoading(false);
    }
  }

  if (isAuthenticated) {
    return (
      <section className="flex min-h-svh items-center justify-center px-6">
        <SectionReveal>
          <div className="flex w-full max-w-lg flex-col items-center gap-10">
            <RevealItem>
              <h1 className="text-center font-[family-name:var(--font-display)] text-6xl leading-[1.1] tracking-tight text-white sm:text-7xl">
                Velkommen tilbake
              </h1>
            </RevealItem>

            <RevealItem>
              <p className="text-center text-xl leading-relaxed text-white/50">
                Alt er klart. La oss fortsette der du slapp.
              </p>
            </RevealItem>

            <RevealItem>
              <button
                type="button"
                onClick={() => completeSection("hero")}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
              >
                Fortsett
                <ArrowRight className="h-5 w-5" />
              </button>
            </RevealItem>
          </div>
        </SectionReveal>
      </section>
    );
  }

  return (
    <section className="flex min-h-svh items-center justify-center px-6">
      <SectionReveal>
        <div className="flex w-full max-w-lg flex-col items-center gap-10">
          <RevealItem>
            <h1 className="text-center font-[family-name:var(--font-display)] text-6xl leading-[1.1] tracking-tight text-white sm:text-7xl">
              Velkommen til
              <br />
              Smartout
            </h1>
          </RevealItem>

          <RevealItem>
            <p className="text-center text-xl leading-relaxed text-white/50">
              Din AI-drevne arbeidsplassassistent.
              <br />
              La oss sette opp bedriften din.
            </p>
          </RevealItem>

          <RevealItem>
            <div className="flex w-full flex-col gap-4">
              {/* Google SSO — primary action */}
              <button
                type="button"
                onClick={handleGoogleSSO}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50"
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

              {/* Divider */}
              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="text-sm text-white/30">eller</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>

              {/* Email form — expandable */}
              {!showEmailForm ? (
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.05] px-8 py-4 text-base text-white/70 transition-colors hover:bg-white/[0.08]"
                >
                  <Mail className="h-5 w-5" />
                  Opprett konto med e-post
                </button>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.05] p-6">
                  <form onSubmit={handleSignUp} className="flex flex-col gap-4">
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

                    {error && <p className="text-sm text-red-400">{error}</p>}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-white py-3.5 text-base font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                    >
                      {loading ? "Vennligst vent..." : "Opprett konto"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </RevealItem>

          <RevealItem>
            <div className="text-center">
              <button
                type="button"
                onClick={() => completeSection("hero")}
                className="text-sm text-white/25 transition-colors hover:text-white/40"
              >
                Hopp over
              </button>
            </div>
          </RevealItem>
        </div>
      </SectionReveal>
    </section>
  );
}
