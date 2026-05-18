"use client";

/**
 * Step6CreateAccount — final step of Join wizard.
 *
 * If the email is new → sign up with password.
 * If the email exists → sign in with existing password (supports multiple workspaces).
 * Then calls next() which triggers onComplete → completeSignup → redirect.
 */

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";
import { DevAutoFill } from "./DevAutoFill";

type AccountMode = "checking" | "signup" | "signin";

export function Step6CreateAccount({ state, updateState, next, t }: WizardStepProps<JoinState>) {
  const email = state.account.email ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AccountMode>("checking");

  // Check if user already exists on mount
  const hasChecked = useRef(false);
  useEffect(() => {
    if (hasChecked.current || !email) return;
    hasChecked.current = true;

    const supabase = createClient();
    supabase.auth
      .signInWithOtp({ email, options: { shouldCreateUser: false } })
      .then(({ error: otpError }) => {
        // If no error or "otp_disabled", user exists. If "user_not_found" → new user.
        if (
          otpError?.message?.includes("not found") ||
          otpError?.message?.includes("Signups not allowed")
        ) {
          setMode("signup");
        } else {
          setMode("signin");
        }
      })
      .catch(() => {
        // Fallback: assume new user
        setMode("signup");
      });
  }, [email]);

  const handleCreate = async () => {
    setError("");

    if (password.length < 8) {
      setError("Passordet må være minst 8 tegn.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passordene stemmer ikke overens.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      let accessToken: string | undefined;

      if (mode === "signin") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError("Feil passord. Prøv igjen.");
          setLoading(false);
          return;
        }
        accessToken = data.session?.access_token;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: state.account.firstName ?? "",
              last_name: state.account.lastName ?? "",
            },
          },
        });

        if (signUpError) {
          // User was created between our check and now — try signin
          if (signUpError.message.includes("already registered")) {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(
              { email, password },
            );
            if (signInError) {
              setError("Feil passord for eksisterende konto.");
              setLoading(false);
              return;
            }
            accessToken = signInData.session?.access_token;
          } else {
            setError(signUpError.message);
            setLoading(false);
            return;
          }
        } else {
          accessToken = data.session?.access_token;
        }
      }

      // Cookies are written by Supabase client. wizard-definition.onComplete
      // triggers a getSession() refresh before the Server Action POST so the
      // server reads up-to-date cookies (no stale-token fallback needed).
      void accessToken;
      await next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
      setLoading(false);
    }
  };

  const isSignIn = mode === "signin";

  const devFill = () => {
    setPassword("test1234");
    setConfirmPassword("test1234");
  };

  return (
    <form
      className="mx-auto w-full max-w-md space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
    >
      <DevAutoFill onFill={devFill} label="Fyll steg 6" />
      <div>
        <h2 className="font-heading text-foreground text-[1.75rem] leading-tight tracking-tight">
          {isSignIn ? "Logg inn" : "Opprett konto"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {isSignIn
            ? "Du har allerede en konto. Logg inn for å opprette ny bedrift."
            : "Sett et passord for å fullføre registreringen."}
        </p>
      </div>

      {mode === "checking" ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Passord</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={isSignIn ? "Ditt eksisterende passord" : "Minst 8 tegn"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {!isSignIn && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bekreft passord</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Skriv passordet igjen"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
              />
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {isSignIn && (
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (resetError) {
                  setError(resetError.message);
                } else {
                  setError("");
                  alert(`E-post sendt til ${email} med lenke for å tilbakestille passord.`);
                }
              }}
              className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
            >
              Glemt passord?
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !password || mode === "checking"}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{
          background: "var(--brand, #f97316)",
          boxShadow:
            "0 2px 12px color-mix(in oklch, var(--brand-orange, #f97316) 25%, transparent)",
        }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isSignIn ? "Logger inn..." : "Oppretter..."}
          </>
        ) : isSignIn ? (
          "Logg inn og opprett bedrift"
        ) : (
          "Fullfør registrering"
        )}
      </button>
    </form>
  );
}
