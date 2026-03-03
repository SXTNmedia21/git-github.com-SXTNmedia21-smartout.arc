"use client";

import { useState, useEffect } from "react";
import { createClient } from "@smartout/supabase/client";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

export function HeroSection() {
  const { isAuthenticated, userId, completeSection, activeSection, botsson } = useOnboarding();

  useEffect(() => {
    if (activeSection === "hero") botsson.triggerSection("hero", "enter");
  }, [activeSection, botsson]);
  const supabase = createClient();

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

  return (
    <section className="flex min-h-svh items-center justify-center px-6">
      <SectionReveal>
        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <RevealItem>
            <h1 className="text-center font-[family-name:var(--font-display)] text-5xl leading-tight tracking-tight text-white sm:text-6xl">
              Velkommen til Smartout
            </h1>
          </RevealItem>

          <RevealItem>
            <p className="text-center text-lg text-white/60">
              Din AI-drevne arbeidsplassassistent. La oss komme i gang.
            </p>
          </RevealItem>

          {isAuthenticated ? (
            <RevealItem>
              <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
                <p className="mb-6 text-center text-white/80">Velkommen tilbake, {userId}</p>
                <button
                  type="button"
                  onClick={() => completeSection("hero")}
                  className="w-full rounded-xl bg-white py-3 font-semibold text-black hover:bg-white/90"
                >
                  Kom i gang
                </button>
              </div>
            </RevealItem>
          ) : (
            <RevealItem>
              <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
                <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                  <input
                    type="email"
                    placeholder="E-post"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none disabled:opacity-50"
                  />
                  <input
                    type="password"
                    placeholder="Passord"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none disabled:opacity-50"
                  />

                  {error && <p className="text-sm text-red-400">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-white py-3 font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                  >
                    {loading ? "Vennligst vent..." : "Opprett konto"}
                  </button>
                </form>

                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-sm text-white/40">eller</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSSO}
                  disabled={loading}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Fortsett med Google
                </button>
              </div>
            </RevealItem>
          )}
        </div>
      </SectionReveal>
    </section>
  );
}
