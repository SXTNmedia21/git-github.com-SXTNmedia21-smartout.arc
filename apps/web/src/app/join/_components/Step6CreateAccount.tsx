"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import type { WizardStepProps } from "@smartout/ui";
import type { JoinState } from "../types";

export function Step6CreateAccount({ state, updateState, next, back }: WizardStepProps<JoinState>) {
  const email = state.account.email ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setError("");

    if (password.length < 8) {
      setError("Passordet ma vaere minst 8 tegn.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passordene stemmer ikke overens.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: state.business.firstName ?? "",
            last_name: state.business.lastName ?? "",
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          // Try signing in instead
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setError("Denne e-posten er allerede registrert. Sjekk passordet.");
            setLoading(false);
            return;
          }
        } else {
          setError(signUpError.message);
          setLoading(false);
          return;
        }
      }

      // Account created — save password state and go to next step (team)
      updateState({ createAccount: { ...state.createAccount } });
      next();
    } catch {
      setError("Noe gikk galt. Prov igjen.");
      setLoading(false);
    }
  };

  return (
    <form
      className="mx-auto w-full max-w-md space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
    >
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">Opprett konto</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Sett et passord for a fullfare registreringen.
        </p>
      </div>

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
              placeholder="Minst 8 tegn"
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

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={back}
          className="flex-1"
          disabled={loading}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>
        <Button
          type="submit"
          disabled={loading || !password}
          className="bg-brand-orange hover:bg-brand-orange-dark flex-1 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Oppretter...
            </>
          ) : (
            "Opprett konto"
          )}
        </Button>
      </div>
    </form>
  );
}
