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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, ArrowLeft, Send, Info, CheckCircle2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthIconInput } from "@/components/auth/AuthIconInput";

type Mode = "request" | "update";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [mode, setMode] = useState<Mode>("request");
  const [forceMigration, setForceMigration] = useState(false);
  const router = useRouter();

  // Detect recovery via both hash AND Supabase auth state change.
  // The hash check handles immediate loads; onAuthStateChange catches
  // cases where Supabase SDK consumes the hash before our effect runs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("access_token") || hash.includes("type=recovery")) {
      setMode("update");
    }

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.force_password_reset) {
        setForceMigration(true);
        setMode("update");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
      }
    });

    return () => subscription.unsubscribe();
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
    // Also clear the migration force_password_reset flag if it was set.
    // Users pre-created by strike-auth-bridge carry this flag in user_metadata;
    // the middleware gate (apps/web/src/middleware.ts §4b) redirects them here
    // until the flag is false. Clearing it on successful update lifts the gate.
    const { error } = await supabase.auth.updateUser({
      password,
      data: { force_password_reset: false },
    });

    setIsLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Passordet er oppdatert! Sender deg videre..." });
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  // ── Password strength (simple heuristic, update mode only) ──
  const pwStrength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwStrengthLabel = (["—", "Svakt", "Svakt", "Middels", "Sterk", "Sterk"] as const)[
    pwStrength
  ];

  const panelHeadline =
    mode === "update" && forceMigration ? (
      <>
        Velkommen til <span style={{ color: "oklch(0.78 0.16 45)" }}>nye</span> Smartout.
      </>
    ) : (
      <>
        Teamet ditt,
        <br />
        <span style={{ color: "oklch(0.78 0.16 45)" }}>klar</span> fra dag en.
      </>
    );

  return (
    <div className="bg-background relative flex min-h-[100dvh] overflow-hidden">
      <AuthBrandPanel headline={panelHeadline} />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden">
          <Image src="/smartout-logo.png" alt="Smartout" width={120} height={42} priority />
        </div>

        <div className="w-full max-w-[400px]">
          {mode === "request" ? (
            <>
              <div className="animate-auth-in mb-8" style={{ animationDelay: "100ms" }}>
                <h1 className="font-heading text-foreground text-[2rem] leading-[1.1] tracking-tight">
                  Glemt passord?
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Vi sender deg en lenke for å sette et nytt.
                </p>
              </div>

              {message && (
                <div
                  className={
                    "animate-auth-in mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm " +
                    (message.type === "error"
                      ? "border-destructive/20 bg-destructive/5 text-destructive"
                      : "border-success/20 bg-success/5 text-success")
                  }
                >
                  {message.type === "error" ? (
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <form
                onSubmit={handleRequestReset}
                className="animate-auth-in space-y-4"
                style={{ animationDelay: "160ms" }}
              >
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
                  disabled={isLoading}
                  className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {isLoading ? "Sender..." : "Send lenke"}
                </button>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Tilbake til innlogging
                </Link>
              </form>
            </>
          ) : (
            <>
              {forceMigration && (
                <div
                  className="border-info/20 bg-info/5 text-foreground animate-auth-in mb-5 flex gap-2.5 rounded-xl border px-4 py-3 text-[0.8125rem] leading-relaxed"
                  style={{ animationDelay: "80ms" }}
                >
                  <Info className="text-info mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Du må sette nytt passord første gang du logger inn i den nye Smartout.
                  </span>
                </div>
              )}

              <div className="animate-auth-in mb-8" style={{ animationDelay: "120ms" }}>
                <h1 className="font-heading text-foreground text-[2rem] leading-[1.1] tracking-tight">
                  Sett nytt passord
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Velg et nytt passord for kontoen din.
                </p>
              </div>

              {message && (
                <div
                  className={
                    "animate-auth-in mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm " +
                    (message.type === "error"
                      ? "border-destructive/20 bg-destructive/5 text-destructive"
                      : "border-success/20 bg-success/5 text-success")
                  }
                >
                  {message.type === "error" ? (
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <form
                onSubmit={handleUpdatePassword}
                className="animate-auth-in space-y-4"
                style={{ animationDelay: "180ms" }}
              >
                <AuthIconInput
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minst 8 tegn"
                  label="Nytt passord"
                  icon={<Lock className="h-4 w-4" />}
                  withPasswordToggle
                  autoFocus
                />
                <AuthIconInput
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Skriv passordet igjen"
                  label="Bekreft"
                  icon={<Lock className="h-4 w-4" />}
                  withPasswordToggle
                />

                {/* Strength meter */}
                <div>
                  <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
                    <span>Styrke</span>
                    <span className={pwStrength >= 4 ? "text-success" : undefined}>
                      {pwStrengthLabel}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={
                          "h-1 flex-1 rounded-full " +
                          (i <= pwStrength
                            ? pwStrength >= 4
                              ? "bg-success"
                              : pwStrength >= 3
                                ? "bg-warning"
                                : "bg-destructive"
                            : "bg-border")
                        }
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Min. 8 tegn · inkl. stor bokstav · inkl. tall
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading
                    ? "Oppdaterer..."
                    : forceMigration
                      ? "Lagre og logg inn"
                      : "Oppdater passord"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          <p className="border-border/60 text-muted-foreground mt-8 border-t pt-5 text-center text-sm">
            Husker du passordet?{" "}
            <Link
              href="/login"
              className="text-foreground hover:text-brand-orange font-medium transition-colors"
            >
              Tilbake til innlogging
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
