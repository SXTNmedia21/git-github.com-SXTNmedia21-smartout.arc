"use client";

/**
 * login-form.tsx — email OTP login form
 *
 * Sends a magic link via Supabase auth.signInWithOtp.
 * shouldCreateUser: false — accountant must already exist in user_identity.
 */
import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Only allow existing users — accountant accounts are provisioned by Pontus.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium">Sjekk e-posten din</p>
        <p className="text-muted-foreground text-sm">
          Vi har sendt en innloggingslenke til <span className="font-medium">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
          type="email"
          placeholder="navn@eksempel.no"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
      </div>

      {status === "error" && <p className="text-destructive text-sm">{errorMessage}</p>}

      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Sender..." : "Send innloggingslenke"}
      </Button>
    </form>
  );
}
