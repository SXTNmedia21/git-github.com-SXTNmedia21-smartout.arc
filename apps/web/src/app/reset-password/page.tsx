"use client";

/**
 * Reset Password page — handles both requesting a reset link AND setting a new password.
 *
 * Two modes:
 * 1. No hash params → show "enter email" form, sends reset link via Supabase
 * 2. With hash params (from Supabase reset link) → show "set new password" form
 *
 * Supabase password reset links contain auth tokens in the URL hash fragment.
 * The client SDK auto-detects these and establishes a session.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, Loader2, Mail, Lock } from "lucide-react";
import { createClient } from "@smartout/supabase/client";

type Mode = "request" | "update";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>("request");
  const router = useRouter();

  // Detect if we arrived via a reset link (hash contains access_token)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("access_token") || hash.includes("type=recovery")) {
      setMode("update");
    }
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: "Hvis kontoen finnes, har vi sendt en lenke for å tilbakestille passordet.",
      });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({ type: "error", text: "Passordet må være minst 8 tegn." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passordene stemmer ikke overens." });
      return;
    }

    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Passordet er oppdatert! Sender deg videre..." });
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-t border-orange-300 bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_20px_rgba(234,88,12,0.4)] transition-transform hover:scale-105">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-foreground flex items-center gap-1 text-2xl font-black tracking-tight">
            Smart<span className="text-muted-foreground">out</span>
            <span className="mb-2 h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
          </span>
        </div>
        <h2 className="text-foreground mt-8 text-center text-2xl font-extrabold tracking-tight">
          {mode === "request" ? "Tilbakestill passord" : "Sett nytt passord"}
        </h2>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          {mode === "request"
            ? "Skriv inn e-posten din for å motta en tilbakestillingslenke"
            : "Velg et nytt passord for kontoen din"}
        </p>
      </div>

      <div className="relative z-10 mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <div className="border-border bg-card px-4 py-8 shadow-2xl sm:rounded-2xl sm:px-10">
          {mode === "request" ? (
            <form className="space-y-6" onSubmit={handleRequestReset}>
              <div>
                <label
                  htmlFor="email"
                  className="text-foreground mb-2 block text-xs font-bold tracking-wider uppercase"
                >
                  E-postadresse
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="text-muted-foreground h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary block w-full appearance-none rounded-lg border px-3 py-2.5 pl-10 transition-colors focus:ring-1 focus:outline-none sm:text-sm"
                    placeholder="navn@bedrift.no"
                  />
                </div>
              </div>

              {message && (
                <div
                  className={`rounded-lg border p-3 text-sm font-medium ${
                    message.type === "error"
                      ? "border-red-500/20 bg-red-500/10 text-red-400"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="group flex w-full items-center justify-center rounded-lg border border-transparent bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Send tilbakestillingslenke
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleUpdatePassword}>
              <div>
                <label
                  htmlFor="password"
                  className="text-foreground mb-2 block text-xs font-bold tracking-wider uppercase"
                >
                  Nytt passord
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="text-muted-foreground h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary block w-full appearance-none rounded-lg border px-3 py-2.5 pl-10 transition-colors focus:ring-1 focus:outline-none sm:text-sm"
                    placeholder="Minst 8 tegn"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="text-foreground mb-2 block text-xs font-bold tracking-wider uppercase"
                >
                  Bekreft passord
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="text-muted-foreground h-4 w-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary block w-full appearance-none rounded-lg border px-3 py-2.5 pl-10 transition-colors focus:ring-1 focus:outline-none sm:text-sm"
                    placeholder="Skriv passordet igjen"
                  />
                </div>
              </div>

              {message && (
                <div
                  className={`rounded-lg border p-3 text-sm font-medium ${
                    message.type === "error"
                      ? "border-red-500/20 bg-red-500/10 text-red-400"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="group flex w-full items-center justify-center rounded-lg border border-transparent bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Oppdater passord
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        Husker du passordet?{" "}
        <Link
          href="/login"
          className="font-semibold text-orange-500 transition-colors hover:text-orange-400"
        >
          Tilbake til innlogging
        </Link>
      </p>
    </div>
  );
}
