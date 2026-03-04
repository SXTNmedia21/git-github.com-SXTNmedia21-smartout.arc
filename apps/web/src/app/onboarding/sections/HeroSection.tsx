"use client";

import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { Mic, PenLine } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

export function HeroSection() {
  const { isAuthenticated, completeSection, botsson } = useOnboarding();

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

  if (isAuthenticated) {
    return (
      <section className="flex min-h-svh items-center justify-center px-6">
        <SectionReveal>
          <div className="flex w-full max-w-lg flex-col items-center gap-10">
            <RevealItem>
              <h1 className="font-heading text-center text-6xl leading-[1.1] tracking-tight text-white sm:text-7xl">
                Velkommen tilbake
              </h1>
            </RevealItem>

            <RevealItem>
              <p className="text-center text-xl leading-relaxed text-white/50">
                Velg hvordan du vil sette opp bedriften din.
              </p>
            </RevealItem>

            <RevealItem>
              <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="flex flex-1 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void botsson.startSession();
                      // completeSection("hero") removed — Lise drives the transition via advanceToNextSection
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
              </div>
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
            <h1 className="font-heading text-center text-6xl leading-[1.1] tracking-tight text-white sm:text-7xl">
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
            <div className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] p-6">
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
