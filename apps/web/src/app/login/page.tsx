"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@smartout/supabase/client";

// UI Events:
// - nav: /dashboard (form submit success)
// - nav: /signup (footer link)
// - action: handleSubmit() (login form)
// - action: handleGoogleLogin() (Google SSO button)

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Kunne ikke koble til serveren. Prøv igjen om litt.");
      } else {
        setError("Noe gikk galt. Prøv igjen.");
      }
      setLoading(false);
    }
  }

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
              Velkommen tilbake
            </h1>
            <p className="text-muted-foreground mt-1.5 text-[0.875rem]">
              Logg inn for å fortsette til Smartout.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="border-destructive/20 bg-destructive/5 text-destructive mb-5 rounded-lg border px-4 py-3 text-center text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="animate-auth-in" style={{ animationDelay: "200ms" }}>
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
            <div className="animate-auth-in" style={{ animationDelay: "260ms" }}>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-foreground text-[0.8125rem] font-medium">
                  Passord
                </label>
                <Link
                  href="/reset-password"
                  className="text-muted-foreground hover:text-brand-orange text-[0.8125rem] transition-colors duration-150"
                >
                  Glemt passord?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-brand-orange block w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.1)] focus:outline-none"
                placeholder="Passord"
              />
            </div>

            <div className="animate-auth-in pt-1" style={{ animationDelay: "320ms" }}>
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-orange flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
              >
                {loading ? "Logger inn..." : "Logg inn"}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="animate-auth-in relative my-6" style={{ animationDelay: "380ms" }}>
            <div className="absolute inset-0 flex items-center">
              <div className="border-border/80 w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background/70 text-muted-foreground px-3 backdrop-blur-sm">
                eller
              </span>
            </div>
          </div>

          {/* Google SSO */}
          <div className="animate-auth-in" style={{ animationDelay: "420ms" }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="border-border bg-background text-foreground hover:border-border/60 hover:bg-accent flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
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
              {googleLoading ? "Logger inn..." : "Fortsett med Google"}
            </button>
          </div>
        </div>

        {/* Footer link */}
        <p
          className="animate-auth-in text-muted-foreground mt-8 text-center text-sm"
          style={{ animationDelay: "480ms" }}
        >
          Har du ikke konto?{" "}
          <Link
            href="/signup"
            className="text-brand-orange hover:text-brand-orange/80 font-medium transition-colors duration-150"
          >
            Opprett konto
          </Link>
        </p>
      </div>
    </div>
  );
}
