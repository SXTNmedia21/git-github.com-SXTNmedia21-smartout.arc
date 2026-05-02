"use client";

/**
 * login-form.tsx — email + password login (local dev) with OTP fallback
 *
 * Local dev flow uses signInWithPassword (avoids Mailpit redirect-loop).
 * Production switches to magic-link via NEXT_PUBLIC_AUTH_MODE=magic-link.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@smartout/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@smartout.local");
  const [password, setPassword] = useState("password123");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    router.push("/workspaces");
    router.refresh();
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

      <div className="space-y-1.5">
        <Label htmlFor="password">Passord</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {status === "error" && <p className="text-destructive text-sm">{errorMessage}</p>}

      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Logger inn..." : "Logg inn"}
      </Button>
    </form>
  );
}
